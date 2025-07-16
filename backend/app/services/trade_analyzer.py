import pandas as pd
import numpy as np
from typing import List, Dict, Set, Optional
from concurrent.futures import ThreadPoolExecutor
import logging

from ..models.schemas import (
    SnapshotData, TradeMarker, PositionChange, 
    TradeMarkerType, PositionDetail
)
from ..core.config import settings

logger = logging.getLogger(__name__)

class TradeAnalyzer:
    def __init__(self):
        self.batch_size = settings.BATCH_SIZE
        self.max_workers = settings.MAX_WORKERS
    
    def calculate_trade_markers(self, snapshots: List[SnapshotData]) -> List[SnapshotData]:
        """Calculate trade markers for all snapshots using batch processing"""
        if len(snapshots) < 2:
            return snapshots
        
        try:
            # Process in batches for better performance
            updated_snapshots = []
            
            # First snapshot never has a trade marker
            updated_snapshots.append(snapshots[0])
            
            # Process remaining snapshots in batches
            for i in range(1, len(snapshots)):
                current_snapshot = snapshots[i]
                previous_snapshot = snapshots[i - 1]
                
                trade_marker = self._compare_snapshots(previous_snapshot, current_snapshot)
                current_snapshot.trade_marker = trade_marker
                updated_snapshots.append(current_snapshot)
            
            return updated_snapshots
        
        except Exception as e:
            logger.error(f"Error calculating trade markers: {str(e)}")
            return snapshots
    
    def _compare_snapshots(self, prev_snapshot: SnapshotData, curr_snapshot: SnapshotData) -> TradeMarker:
        """Compare two consecutive snapshots to detect position changes"""
        try:
            # Create position maps for fast lookup
            prev_positions = {p.instrument_id: p for p in prev_snapshot.positions}
            curr_positions = {p.instrument_id: p for p in curr_snapshot.positions}
            
            # Get all instrument IDs from both snapshots
            all_instrument_ids = set(prev_positions.keys()) | set(curr_positions.keys())
            
            changes = []
            
            for instrument_id in all_instrument_ids:
                prev_pos = prev_positions.get(instrument_id)
                curr_pos = curr_positions.get(instrument_id)
                
                if prev_pos is None and curr_pos is not None:
                    # New position
                    changes.append(PositionChange(
                        instrument_id=instrument_id,
                        instrument_symbol=curr_pos.instrument.symbol,
                        change_type="new",
                        old_quantity=0,
                        new_quantity=curr_pos.quantity,
                        old_price=0.0,
                        new_price=curr_pos.avg_price
                    ))
                
                elif prev_pos is not None and curr_pos is None:
                    # Closed position
                    changes.append(PositionChange(
                        instrument_id=instrument_id,
                        instrument_symbol=prev_pos.instrument.symbol,
                        change_type="closed",
                        old_quantity=prev_pos.quantity,
                        new_quantity=0,
                        old_price=prev_pos.avg_price,
                        new_price=0.0
                    ))
                
                elif prev_pos is not None and curr_pos is not None:
                    # Check for quantity or price changes
                    quantity_changed = prev_pos.quantity != curr_pos.quantity
                    price_changed = abs(prev_pos.avg_price - curr_pos.avg_price) > 0.01
                    
                    if quantity_changed or price_changed:
                        change_type = "quantity_change" if quantity_changed else "price_change"
                        changes.append(PositionChange(
                            instrument_id=instrument_id,
                            instrument_symbol=curr_pos.instrument.symbol,
                            change_type=change_type,
                            old_quantity=prev_pos.quantity,
                            new_quantity=curr_pos.quantity,
                            old_price=prev_pos.avg_price,
                            new_price=curr_pos.avg_price
                        ))
            
            # Determine marker type and create summary
            if not changes:
                return TradeMarker(
                    type=TradeMarkerType.NONE,
                    changes=[],
                    summary="No changes"
                )
            
            # Check if it's a square-up (all positions closed)
            if (len(prev_snapshot.positions) > 0 and 
                len(curr_snapshot.positions) == 0):
                return TradeMarker(
                    type=TradeMarkerType.SQUARE_UP,
                    changes=changes,
                    summary=f"Square-up: Closed {len(changes)} positions"
                )
            
            # Regular adjustment
            summary = self._create_change_summary(changes)
            return TradeMarker(
                type=TradeMarkerType.ADJUSTMENT,
                changes=changes,
                summary=summary
            )
        
        except Exception as e:
            logger.error(f"Error comparing snapshots: {str(e)}")
            return TradeMarker(
                type=TradeMarkerType.NONE,
                changes=[],
                summary="Error analyzing changes"
            )
    
    def _create_change_summary(self, changes: List[PositionChange]) -> str:
        """Create a human-readable summary of position changes"""
        if not changes:
            return "No changes"
        
        new_count = sum(1 for c in changes if c.change_type == "new")
        closed_count = sum(1 for c in changes if c.change_type == "closed")
        modified_count = sum(1 for c in changes if c.change_type in ["quantity_change", "price_change"])
        
        parts = []
        if new_count > 0:
            parts.append(f"{new_count} new")
        if closed_count > 0:
            parts.append(f"{closed_count} closed")
        if modified_count > 0:
            parts.append(f"{modified_count} modified")
        
        return f"Adjustment: {', '.join(parts)}"
    
    def get_position_deltas(self, snapshots: List[SnapshotData]) -> List[Dict]:
        """Calculate position deltas between consecutive snapshots"""
        if len(snapshots) < 2:
            return []
        
        deltas = []
        for i in range(1, len(snapshots)):
            prev_snapshot = snapshots[i - 1]
            curr_snapshot = snapshots[i]
            
            delta = {
                "timestamp": curr_snapshot.timestamp,
                "position_changes": []
            }
            
            if curr_snapshot.trade_marker and curr_snapshot.trade_marker.changes:
                for change in curr_snapshot.trade_marker.changes:
                    delta["position_changes"].append({
                        "instrument_id": change.instrument_id,
                        "symbol": change.instrument_symbol,
                        "change_type": change.change_type,
                        "quantity_delta": (change.new_quantity or 0) - (change.old_quantity or 0),
                        "price_delta": (change.new_price or 0) - (change.old_price or 0)
                    })
            
            deltas.append(delta)
        
        return deltas