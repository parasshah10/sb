import sqlite3
import gzip
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime, date
from concurrent.futures import ThreadPoolExecutor
import logging

from ..core.config import settings
from ..models.schemas import InstrumentInfo, PositionDetail, SnapshotData, DaySummary

logger = logging.getLogger(__name__)

class DataService:
    def __init__(self):
        self.data_folder = settings.DATA_FOLDER
        self._instruments_cache: Dict[str, Dict[int, InstrumentInfo]] = {}
    
    def get_available_trading_days(self) -> List[str]:
        """Get all available trading days from data folder"""
        try:
            dates = []
            for file_path in self.data_folder.glob(f"{settings.DB_PREFIX}*{settings.DB_EXTENSION}*"):
                # Extract date from filename
                filename = file_path.stem
                if filename.endswith(settings.DB_EXTENSION):
                    filename = filename[:-len(settings.DB_EXTENSION)]
                
                date_part = filename.replace(settings.DB_PREFIX, "")
                try:
                    # Validate date format
                    datetime.strptime(date_part, "%Y-%m-%d")
                    dates.append(date_part)
                except ValueError:
                    continue
            
            return sorted(dates, reverse=True)
        except Exception as e:
            logger.error(f"Error getting trading days: {str(e)}")
            return []
    
    def _get_db_path(self, date_str: str) -> Optional[Path]:
        """Get database path for given date (compressed or uncompressed)"""
        db_filename = f"{settings.DB_PREFIX}{date_str}{settings.DB_EXTENSION}"
        compressed_path = self.data_folder / f"{db_filename}{settings.COMPRESSED_EXTENSION}"
        uncompressed_path = self.data_folder / db_filename
        
        if compressed_path.exists():
            return compressed_path
        elif uncompressed_path.exists():
            return uncompressed_path
        else:
            return None
    

    def _get_db_connection(self, date_str: str) -> Optional[sqlite3.Connection]:
        """Get database connection (handle compressed/uncompressed files)"""
        db_path = self._get_db_path(date_str)
        if not db_path:
            return None
        
        try:
            if db_path.suffix == settings.COMPRESSED_EXTENSION:
                # Handle compressed file
                import tempfile
                with gzip.open(db_path, 'rb') as f_in:
                    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as temp_file:
                        temp_file.write(f_in.read())
                        temp_file.flush()
                        conn = sqlite3.connect(temp_file.name)
                        return conn
            else:
                # Handle uncompressed file
                return sqlite3.connect(str(db_path))
        
        except Exception as e:
            logger.error(f"Error connecting to database for {date_str}: {str(e)}")
            return None

    
    def _load_instruments(self, conn: sqlite3.Connection, date_str: str) -> Dict[int, InstrumentInfo]:
        """Load and cache instruments for a given date"""
        if date_str in self._instruments_cache:
            return self._instruments_cache[date_str]
        
        try:
            query = """
                SELECT id, symbol, underlying_symbol, type, strike, expiry
                FROM instruments
                ORDER BY id
            """
            
            df = pd.read_sql_query(query, conn)
            
            instruments = {}
            for _, row in df.iterrows():
                instruments[row['id']] = InstrumentInfo(
                    id=row['id'],
                    symbol=row['symbol'],
                    underlying_symbol=row['underlying_symbol'] or "",
                    type=row['type'] or "",
                    strike=row['strike'],
                    expiry=row['expiry']
                )
            
            self._instruments_cache[date_str] = instruments
            return instruments
        
        except Exception as e:
            logger.error(f"Error loading instruments for {date_str}: {str(e)}")
            return {}
    
    def _load_snapshots_batch(self, conn: sqlite3.Connection, date_str: str) -> List[SnapshotData]:
        """Load all snapshots with positions in batches for maximum performance"""
        try:
            # Load instruments first
            instruments = self._load_instruments(conn, date_str)
            
            # Load all data in one optimized query with JOIN
            query = """
                SELECT 
                    s.id as snapshot_id,
                    s.timestamp,
                    s.total_pnl,
                    pd.instrument_id,
                    pd.quantity,
                    pd.avg_price,
                    pd.last_price,
                    pd.unbooked_pnl,
                    pd.booked_pnl,
                    pd.underlying_price
                FROM snapshots s
                LEFT JOIN position_details pd ON s.id = pd.snapshot_id
                ORDER BY s.timestamp, pd.instrument_id
            """
            
            df = pd.read_sql_query(query, conn)
            
            # Group by snapshot_id for batch processing
            snapshots = []
            grouped = df.groupby('snapshot_id')
            
            for snapshot_id, group in grouped:
                # Get snapshot info from first row
                first_row = group.iloc[0]
                timestamp = datetime.fromisoformat(first_row['timestamp'].replace('Z', '+00:00'))
                total_pnl = first_row['total_pnl']
                
                # Process positions
                positions = []
                underlying_price = None
                
                for _, row in group.iterrows():
                    if pd.notna(row['instrument_id']):  # Has position data
                        instrument_id = int(row['instrument_id'])
                        if instrument_id in instruments:
                            positions.append(PositionDetail(
                                instrument_id=instrument_id,
                                instrument=instruments[instrument_id],
                                quantity=int(row['quantity']),
                                avg_price=float(row['avg_price']),
                                last_price=float(row['last_price']),
                                unbooked_pnl=float(row['unbooked_pnl']),
                                booked_pnl=float(row['booked_pnl']),
                                underlying_price=float(row['underlying_price'])
                            ))
                            
                            # Get underlying price (same for all positions in snapshot)
                            if underlying_price is None:
                                underlying_price = float(row['underlying_price'])
                
                snapshots.append(SnapshotData(
                    timestamp=timestamp,
                    total_pnl=total_pnl,
                    underlying_price=underlying_price,
                    position_count=len(positions),
                    positions=positions,
                    trade_marker=None  # Will be calculated later
                ))
            
            return sorted(snapshots, key=lambda x: x.timestamp)
        
        except Exception as e:
            logger.error(f"Error loading snapshots for {date_str}: {str(e)}")
            return []
    
    def _calculate_summary(self, snapshots: List[SnapshotData], date_str: str) -> DaySummary:
        """Calculate day summary statistics"""
        if not snapshots:
            return DaySummary(
                date=date_str,
                total_snapshots=0,
                total_trades=0,
                final_pnl=0.0,
                min_pnl=0.0,
                max_pnl=0.0
            )
        
        # Calculate PnL stats
        pnl_values = [s.total_pnl for s in snapshots]
        min_pnl = min(pnl_values)
        max_pnl = max(pnl_values)
        final_pnl = pnl_values[-1]
        
        # Calculate underlying price range
        underlying_prices = [s.underlying_price for s in snapshots if s.underlying_price is not None]
        underlying_range = None
        if underlying_prices:
            underlying_range = {
                "min": min(underlying_prices),
                "max": max(underlying_prices),
                "open": underlying_prices[0],
                "close": underlying_prices[-1]
            }
        
        # Count trades (will be updated after trade marker calculation)
        total_trades = sum(1 for s in snapshots if s.trade_marker and s.trade_marker.type != "none")
        
        # Market timings
        market_open = snapshots[0].timestamp.strftime("%H:%M:%S") if snapshots else None
        market_close = snapshots[-1].timestamp.strftime("%H:%M:%S") if snapshots else None
        
        return DaySummary(
            date=date_str,
            total_snapshots=len(snapshots),
            total_trades=total_trades,
            final_pnl=final_pnl,
            market_open=market_open,
            market_close=market_close,
            min_pnl=min_pnl,
            max_pnl=max_pnl,
            underlying_range=underlying_range
        )
    
    def get_trading_day_data(self, date_str: str) -> Optional[Dict]:
        """Get complete trading day data with trade markers"""
        try:
            # Validate date format
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            return None
        
        conn = self._get_db_connection(date_str)
        if not conn:
            return None
        
        try:
            # Load all snapshots
            snapshots = self._load_snapshots_batch(conn, date_str)
            if not snapshots:
                return None
            
            # Calculate trade markers (import here to avoid circular import)
            from .trade_analyzer import TradeAnalyzer
            analyzer = TradeAnalyzer()
            snapshots_with_markers = analyzer.calculate_trade_markers(snapshots)
            
            # Calculate summary
            summary = self._calculate_summary(snapshots_with_markers, date_str)
            
            # Update trade count in summary
            total_trades = sum(1 for s in snapshots_with_markers 
                             if s.trade_marker and s.trade_marker.type != "none")
            summary.total_trades = total_trades
            
            return {
                "date": date_str,
                "summary": summary,
                "timeseries": snapshots_with_markers
            }
        
        except Exception as e:
            logger.error(f"Error getting trading day data for {date_str}: {str(e)}")
            return None
        
        finally:
            conn.close()
    
    def get_day_summary_only(self, date_str: str) -> Optional[DaySummary]:
        """Get only summary data for a trading day (faster for overview)"""
        conn = self._get_db_connection(date_str)
        if not conn:
            return None
        
        try:
            # Load basic snapshot data only
            query = """
                SELECT timestamp, total_pnl
                FROM snapshots
                ORDER BY timestamp
            """
            df = pd.read_sql_query(query, conn)
            
            if df.empty:
                return None
            
            # Calculate summary without full position data
            pnl_values = df['total_pnl'].tolist()
            timestamps = pd.to_datetime(df['timestamp'])
            
            return DaySummary(
                date=date_str,
                total_snapshots=len(df),
                total_trades=0,  # Would need full analysis for this
                final_pnl=pnl_values[-1],
                market_open=timestamps.iloc[0].strftime("%H:%M:%S"),
                market_close=timestamps.iloc[-1].strftime("%H:%M:%S"),
                min_pnl=min(pnl_values),
                max_pnl=max(pnl_values)
            )
        
        except Exception as e:
            logger.error(f"Error getting summary for {date_str}: {str(e)}")
            return None
        
        finally:
            conn.close()