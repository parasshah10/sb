from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class TradeMarkerType(str, Enum):
    ADJUSTMENT = "adjustment"
    SQUARE_UP = "square_up"
    NONE = "none"

class InstrumentInfo(BaseModel):
    id: int
    symbol: str
    underlying_symbol: str
    type: str
    strike: Optional[float] = None
    expiry: Optional[str] = None

class PositionDetail(BaseModel):
    instrument_id: int
    instrument: InstrumentInfo
    quantity: int
    avg_price: float
    last_price: float
    unbooked_pnl: float
    booked_pnl: float
    underlying_price: float

class PositionChange(BaseModel):
    instrument_id: int
    instrument_symbol: str
    instrument: Optional[InstrumentInfo] = None  # Include full instrument details
    change_type: str  # "new", "closed", "quantity_change", "price_change"
    old_quantity: Optional[int] = None
    new_quantity: Optional[int] = None
    old_price: Optional[float] = None
    new_price: Optional[float] = None

class TradeMarker(BaseModel):
    type: TradeMarkerType
    changes: List[PositionChange]
    summary: str

class SnapshotData(BaseModel):
    timestamp: datetime
    total_pnl: float
    underlying_price: Optional[float] = None
    position_count: int
    positions: List[PositionDetail]
    trade_marker: Optional[TradeMarker] = None

class DaySummary(BaseModel):
    date: str
    total_snapshots: int
    total_trades: int
    final_pnl: float
    market_open: Optional[str] = None
    market_close: Optional[str] = None
    min_pnl: float
    max_pnl: float
    underlying_range: Optional[Dict[str, float]] = None

class TradingDayData(BaseModel):
    date: str
    summary: DaySummary
    timeseries: List[SnapshotData]

class TradingDaysResponse(BaseModel):
    available_dates: List[str]
    total_days: int

class FilterOption(BaseModel):
    underlying_symbol: str
    expiry: str
    key: str

class AvailableFiltersResponse(BaseModel):
    filters: List[FilterOption]

class APIResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None
    error: Optional[str] = None