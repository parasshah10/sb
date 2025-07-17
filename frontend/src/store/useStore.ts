import { create } from 'zustand';
import { TradingDayData, SnapshotData, ChartSettings, ViewMode, FilterOption } from '@/types';

interface AppState {
  // Data
  selectedDate: string;
  tradingDays: string[];
  currentData: TradingDayData | null;
  selectedSnapshot: SnapshotData | null;
  loading: boolean;
  error: string | null;
  
  // Filters
  availableFilters: FilterOption[];
  selectedFilters: string[]; // array of filter keys
  
  // Chart settings
  chartSettings: ChartSettings;
  
  // UI state
  viewMode: ViewMode['type'];
  isTooltipVisible: boolean;
  tooltipPosition: { x: number; y: number } | null;
  
  // Actions
  setSelectedDate: (date: string) => void;
  setTradingDays: (days: string[]) => void;
  setCurrentData: (data: TradingDayData | null) => void;
  setSelectedSnapshot: (snapshot: SnapshotData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAvailableFilters: (filters: FilterOption[]) => void;
  setSelectedFilters: (filters: string[]) => void;
  updateChartSettings: (settings: Partial<ChartSettings>) => void;
  setViewMode: (mode: ViewMode['type']) => void;
  setTooltipVisible: (visible: boolean) => void;
  setTooltipPosition: (position: { x: number; y: number } | null) => void;
  resetState: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  selectedDate: (() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })(),
  tradingDays: [],
  currentData: null,
  selectedSnapshot: null,
  loading: false,
  error: null,
  
  availableFilters: [],
  selectedFilters: [],

  chartSettings: {
    showUnderlying: true,
    showTradeMarkers: true,
    showMarketContext: true,
    isFullscreen: false,
  },
  
  viewMode: 'expanded',
  isTooltipVisible: false,
  tooltipPosition: null,
  
  // Actions
  setSelectedDate: (date: string) => set({ 
    selectedDate: date, 
    selectedFilters: [], // Reset filters when date changes
    availableFilters: [],
  }),
  setTradingDays: (days: string[]) => set({ tradingDays: days }),
  setCurrentData: (data: TradingDayData | null) => set({ currentData: data }),
  setSelectedSnapshot: (snapshot: SnapshotData | null) => set({ selectedSnapshot: snapshot }),
  setLoading: (loading: boolean) => set({ loading }),
  setError: (error: string | null) => set({ error }),
  
  setAvailableFilters: (filters: FilterOption[]) => set({ availableFilters: filters }),
  setSelectedFilters: (filters: string[]) => set({ selectedFilters: filters }),

  updateChartSettings: (settings) =>
    set((state) => ({
      chartSettings: { ...state.chartSettings, ...settings },
    })),
  
  setViewMode: (mode: ViewMode['type']) => set({ viewMode: mode }),
  setTooltipVisible: (visible: boolean) => set({ isTooltipVisible: visible }),
  setTooltipPosition: (position: { x: number; y: number } | null) => set({ tooltipPosition: position }),
  
  resetState: () =>
    set({
      currentData: null,
      selectedSnapshot: null,
      loading: false,
      error: null,
      isTooltipVisible: false,
      tooltipPosition: null,
      selectedFilters: [],
      availableFilters: [],
    }),
}));