export interface InstrumentInfo {
  id: number;
  symbol: string;
  underlying_symbol: string;
  type: string;
  strike?: number;
  expiry?: string;
}

export interface PositionDetail {
  instrument_id: number;
  instrument: InstrumentInfo;
  quantity: number;
  avg_price: number;
  last_price: number;
  unbooked_pnl: number;
  booked_pnl: number;
  underlying_price: number;
}

export interface PositionChange {
  instrument_id: number;
  instrument_symbol: string;
  instrument?: InstrumentInfo;
  change_type: 'new' | 'closed' | 'quantity_change' | 'price_change';
  old_quantity?: number;
  new_quantity?: number;
  old_price?: number;
  new_price?: number;
}

export interface TradeMarker {
  type: 'adjustment' | 'square_up' | 'none';
  changes: PositionChange[];
  summary: string;
}

export interface SnapshotData {
  timestamp: string;
  total_pnl: number;
  underlying_price?: number;
  position_count: number;
  positions: PositionDetail[];
  trade_marker?: TradeMarker;
}

export interface DaySummary {
  date: string;
  total_snapshots: number;
  total_trades: number;
  final_pnl: number;
  market_open?: string;
  market_close?: string;
  min_pnl: number;
  max_pnl: number;
  underlying_range?: {
    min: number;
    max: number;
    open: number;
    close: number;
  };
}

export interface TradingDayData {
  date: string;
  summary: DaySummary;
  timeseries: SnapshotData[];
}

export interface ChartData {
  time: number;
  value: number;
  underlying?: number;
  snapshot?: SnapshotData;
}

export interface ViewMode {
  type: 'default' | 'expanded' | 'delta';
  label: string;
}

export interface ChartSettings {
  selectedUnderlying: string | null; // null means hide spot chart, string is the underlying symbol
  showTradeMarkers: boolean;
  showMarketContext: boolean;
  isFullscreen: boolean;
  displayMode: 'quantity' | 'lots'; // Toggle between showing raw quantity or lots
}

export interface FilterOption {
  underlying_symbol: string;
  expiry: string;
  key: string;
}