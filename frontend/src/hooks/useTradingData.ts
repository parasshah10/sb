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
    setTradingDays,
    setCurrentData,
    setLoading,
    setError,
    resetState,
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

  const loadTradingDayData = useCallback(async (date: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTradingDayData(date);
      setCurrentData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trading data');
      setCurrentData(null);
    } finally {
      setLoading(false);
    }
  }, [setCurrentData, setLoading, setError]);

  const refreshData = useCallback(() => {
    if (selectedDate) {
      loadTradingDayData(selectedDate);
    }
  }, [selectedDate, loadTradingDayData]);

  // Load trading days on mount
  useEffect(() => {
    loadTradingDays();
  }, [loadTradingDays]);

  // Load data when selected date changes
  useEffect(() => {
    if (selectedDate) {
      loadTradingDayData(selectedDate);
    } else {
      resetState();
    }
  }, [selectedDate, loadTradingDayData, resetState]);

  return {
    tradingDays,
    currentData,
    loading,
    error,
    refreshData,
    loadTradingDayData,
  };
}