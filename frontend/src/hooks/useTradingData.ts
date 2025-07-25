import { useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { api } from '@/services/api';

export function useTradingData() {
  const {
    selectedDate,
    tradingDays,
    currentData,
    loading,
    error,
    selectedFilters,
    setTradingDays,
    setCurrentData,
    setLoading,
    setError,
    resetState,
    setAvailableFilters,
    setAvailableUnderlyings,
  } = useStore();

  const loadTradingDays = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTradingDays();
      setTradingDays(data.available_dates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trading days');
    } finally {
      setLoading(false);
    }
  }, [setTradingDays, setLoading, setError]);

  const loadDataForDate = useCallback(async (date: string, filters: string[]) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch filters and data in parallel
      const [filterData, dayData] = await Promise.all([
        api.getAvailableFilters(date),
        api.getTradingDayData(date, filters)
      ]);

      setAvailableFilters(filterData.filters);
      setCurrentData(dayData);

      // Extract available underlyings from the data
      if (dayData?.timeseries) {
        const underlyings = new Set<string>();
        dayData.timeseries.forEach(snapshot => {
          snapshot.positions.forEach(position => {
            if (position.instrument.underlying_symbol) {
              underlyings.add(position.instrument.underlying_symbol);
            }
          });
        });
        const sortedUnderlyings = Array.from(underlyings).sort();
        setAvailableUnderlyings(sortedUnderlyings);
        
        // Auto-select the first underlying if none is currently selected
        const { chartSettings, updateChartSettings } = useStore.getState();
        if (sortedUnderlyings.length > 0 && !chartSettings.selectedUnderlying) {
          updateChartSettings({ selectedUnderlying: sortedUnderlyings[0] });
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trading data');
      setCurrentData(null);
      setAvailableFilters([]);
    } finally {
      setLoading(false);
    }
  }, [setCurrentData, setLoading, setError, setAvailableFilters]);

  const refreshData = useCallback(async () => {
    if (selectedDate) {
      try {
        // Clear backend cache first
        await api.refreshCache();
        // Then reload the data
        loadDataForDate(selectedDate, selectedFilters);
      } catch (err) {
        console.warn('Failed to clear cache, proceeding with data reload:', err);
        // Still try to reload data even if cache clear fails
        loadDataForDate(selectedDate, selectedFilters);
      }
    }
  }, [selectedDate, selectedFilters, loadDataForDate]);

  // Load trading days on mount
  useEffect(() => {
    loadTradingDays();
  }, [loadTradingDays]);

  // Load data when selected date or filters change
  useEffect(() => {
    if (selectedDate) {
      loadDataForDate(selectedDate, selectedFilters);
    } else {
      resetState();
    }
  }, [selectedDate, selectedFilters, loadDataForDate, resetState]);

  return {
    tradingDays,
    currentData,
    loading,
    error,
    refreshData,
  };
}