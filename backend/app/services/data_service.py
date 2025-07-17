import sqlite3
import gzip
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set
from datetime import datetime, date
from concurrent.futures import ThreadPoolExecutor
import logging

from ..core.config import settings
from ..models.schemas import InstrumentInfo, PositionDetail, SnapshotData, DaySummary, FilterOption

logger = logging.getLogger(__name__)

class DataService:
    def __init__(self):
        self.data_folder = settings.DATA_FOLDER
        self._instruments_cache: Dict[str, Dict[int, InstrumentInfo]] = {}
    
    def clear_cache(self):
        """Clear all cached data - useful for refreshing data"""
        self._instruments_cache.clear()
    
    def get_available_trading_days(self) -> List[str]:
        """Get all available trading days from data folder"""
        try:
            dates = set()  # Use set to avoid duplicates
            
            # Look for both compressed and uncompressed files
            for file_path in self.data_folder.glob(f"{settings.DB_PREFIX}*"):
                filename = file_path.name
                
                # Handle compressed files
                if filename.endswith(f"{settings.DB_EXTENSION}{settings.COMPRESSED_EXTENSION}"):
                    date_part = filename.replace(settings.DB_PREFIX, "").replace(f"{settings.DB_EXTENSION}{settings.COMPRESSED_EXTENSION}", "")
                # Handle uncompressed files
                elif filename.endswith(settings.DB_EXTENSION):
                    date_part = filename.replace(settings.DB_PREFIX, "").replace(settings.DB_EXTENSION, "")
                else:
                    continue
                
                try:
                    # Validate date format
                    datetime.strptime(date_part, "%Y-%m-%d")
                    dates.add(date_part)  # Add to set (automatically deduplicates)
                except ValueError:
                    continue
            
            return sorted(list(dates), reverse=True)  # Convert set back to sorted list
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
                        conn = sqlite3.connect(f"file:{temp_file.name}?mode=ro", uri=True)
                        return conn
            else:
                # Handle uncompressed file
                return sqlite3.connect(f"file:{str(db_path)}?mode=ro", uri=True)
        
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
    
    def _load_snapshots_batch(
        self, conn: sqlite3.Connection, date_str: str, filters: Optional[List[str]] = None
    ) -> List[SnapshotData]:
        """Load all snapshots with positions, applying filters if provided."""
        try:
            instruments = self._load_instruments(conn, date_str)
            
            allowed_instrument_ids: Set[int] = set()
            if filters:
                parsed_filters = set()
                for f in filters:
                    parts = f.split('_')
                    if len(parts) == 2:
                        parsed_filters.add((parts[0], parts[1]))
                
                for inst_id, inst_info in instruments.items():
                    if (inst_info.underlying_symbol, inst_info.expiry) in parsed_filters:
                        allowed_instrument_ids.add(inst_id)

            query = """
                SELECT 
                    s.id as snapshot_id, s.timestamp, s.total_pnl,
                    pd.instrument_id, pd.quantity, pd.avg_price, pd.last_price,
                    pd.unbooked_pnl, pd.booked_pnl, pd.underlying_price
                FROM snapshots s
                LEFT JOIN position_details pd ON s.id = pd.snapshot_id
                ORDER BY s.timestamp, pd.instrument_id
            """
            df = pd.read_sql_query(query, conn)
            if df.empty: return []

            snapshots = []
            grouped = df.groupby('snapshot_id')
            
            for snapshot_id, group in grouped:
                first_row = group.iloc[0]
                timestamp = datetime.fromisoformat(first_row['timestamp'].replace('Z', '+00:00'))
                
                positions = []
                underlying_price = None
                recalculated_pnl = 0.0

                for _, row in group.iterrows():
                    if pd.notna(row['instrument_id']):
                        instrument_id = int(row['instrument_id'])
                        
                        if not filters or instrument_id in allowed_instrument_ids:
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
                                if filters:
                                    recalculated_pnl += (float(row['unbooked_pnl']) + float(row['booked_pnl']))
                                if underlying_price is None:
                                    underlying_price = float(row['underlying_price'])
                
                final_pnl = recalculated_pnl if filters else float(first_row['total_pnl'])
                
                snapshots.append(SnapshotData(
                    timestamp=timestamp, total_pnl=final_pnl,
                    underlying_price=underlying_price, position_count=len(positions),
                    positions=positions, trade_marker=None
                ))
            
            return sorted(snapshots, key=lambda x: x.timestamp)
        
        except Exception as e:
            logger.error(f"Error loading snapshots for {date_str}: {e}")
            return []
    
    def _calculate_summary(self, snapshots: List[SnapshotData], date_str: str) -> DaySummary:
        """Calculate day summary statistics"""
        if not snapshots:
            return DaySummary(
                date=date_str, total_snapshots=0, total_trades=0,
                final_pnl=0.0, min_pnl=0.0, max_pnl=0.0
            )
        
        pnl_values = [s.total_pnl for s in snapshots]
        min_pnl, max_pnl, final_pnl = min(pnl_values), max(pnl_values), pnl_values[-1]
        
        underlying_prices = [s.underlying_price for s in snapshots if s.underlying_price is not None]
        underlying_range = None
        if underlying_prices:
            underlying_range = {"min": min(underlying_prices), "max": max(underlying_prices),
                                "open": underlying_prices[0], "close": underlying_prices[-1]}
        
        total_trades = sum(1 for s in snapshots if s.trade_marker and s.trade_marker.type != "none")
        market_open = snapshots[0].timestamp.strftime("%H:%M:%S")
        market_close = snapshots[-1].timestamp.strftime("%H:%M:%S")
        
        return DaySummary(
            date=date_str, total_snapshots=len(snapshots), total_trades=total_trades,
            final_pnl=final_pnl, market_open=market_open, market_close=market_close,
            min_pnl=min_pnl, max_pnl=max_pnl, underlying_range=underlying_range
        )
    
    def get_trading_day_data(self, date_str: str, filters: Optional[List[str]] = None) -> Optional[Dict]:
        """Get complete trading day data with trade markers, applying filters."""
        conn = self._get_db_connection(date_str)
        if not conn: return None
        
        try:
            snapshots = self._load_snapshots_batch(conn, date_str, filters)
            if not snapshots: return None
            
            from .trade_analyzer import TradeAnalyzer
            analyzer = TradeAnalyzer()
            snapshots_with_markers = analyzer.calculate_trade_markers(snapshots)
            
            summary = self._calculate_summary(snapshots_with_markers, date_str)
            
            return {"date": date_str, "summary": summary, "timeseries": snapshots_with_markers}
        
        except Exception as e:
            logger.error(f"Error getting trading day data for {date_str}: {e}")
            return None
        finally:
            conn.close()
    
    def get_day_summary_only(self, date_str: str, filters: Optional[List[str]] = None) -> Optional[DaySummary]:
        """Get only summary data for a trading day, applying filters."""
        conn = self._get_db_connection(date_str)
        if not conn: return None
        
        try:
            # If filters are applied, we must do the full calculation
            if filters:
                data = self.get_trading_day_data(date_str, filters)
                return DaySummary(**data['summary'].dict()) if data else None

            # Original fast path for no filters
            df = pd.read_sql_query("SELECT timestamp, total_pnl FROM snapshots ORDER BY timestamp", conn)
            if df.empty: return None
            
            pnl_values = df['total_pnl'].tolist()
            timestamps = pd.to_datetime(df['timestamp'])
            
            return DaySummary(
                date=date_str, total_snapshots=len(df), total_trades=0,
                final_pnl=pnl_values[-1],
                market_open=timestamps.iloc[0].strftime("%H:%M:%S"),
                market_close=timestamps.iloc[-1].strftime("%H:%M:%S"),
                min_pnl=min(pnl_values), max_pnl=max(pnl_values)
            )
        except Exception as e:
            logger.error(f"Error getting summary for {date_str}: {e}")
            return None
        finally:
            conn.close()

    def get_available_filters(self, date_str: str) -> Optional[List[FilterOption]]:
        """Get available underlying/expiry filters for a given trading day."""
        conn = self._get_db_connection(date_str)
        if not conn: return None
        
        try:
            query = "SELECT DISTINCT underlying_symbol, expiry FROM instruments WHERE underlying_symbol IS NOT NULL AND expiry IS NOT NULL"
            df = pd.read_sql_query(query, conn)
            
            filters = []
            for _, row in df.iterrows():
                filters.append(FilterOption(
                    underlying_symbol=row['underlying_symbol'],
                    expiry=row['expiry'],
                    key=f"{row['underlying_symbol']}_{row['expiry']}"
                ))
            return sorted(filters, key=lambda x: (x.underlying_symbol, x.expiry))
        except Exception as e:
            logger.error(f"Error getting available filters for {date_str}: {e}")
            return None
        finally:
            conn.close()