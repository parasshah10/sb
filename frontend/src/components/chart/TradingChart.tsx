'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { useStore } from '@/store/useStore';
import { ChartTooltip } from './ChartTooltip';
import { SnapshotData, ChartData } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const pnlSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const underlyingSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotData | null>(null);
  
  const {
    currentData,
    loading,
    chartSettings,
    viewMode,
    setViewMode,
  } = useStore();

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#64748b',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#f1f5f9' },
        horzLines: { color: '#f1f5f9' },
      },
      leftPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      rightPriceScale: {
        visible: chartSettings.selectedUnderlying !== null,
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
      },
      crosshair: {
        mode: 0, // Normal crosshair
        vertLine: {
          width: 1,
          color: '#9ca3af',
          style: 1, // Dotted
        },
        horzLine: {
          width: 1,
          color: '#9ca3af',
          style: 1, // Dotted
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Create P&L series
    const pnlSeries = chart.addAreaSeries({
      lineColor: '#3b82f6',
      topColor: 'rgba(59, 130, 246, 0.3)',
      bottomColor: 'rgba(59, 130, 246, 0.05)',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 0,
        minMove: 1,
      },
      priceScaleId: 'left',
    });

    // Create underlying series
    const underlyingSeries = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 0,
        minMove: 1,
      },
      priceScaleId: 'right',
      visible: chartSettings.selectedUnderlying !== null,
    });

    chartRef.current = chart;
    pnlSeriesRef.current = pnlSeries;
    underlyingSeriesRef.current = underlyingSeries;

    // Handle CLICK ONLY - no hover nonsense
    chart.subscribeClick((param) => {
      if (!param.point || !param.time || !currentData) {
        // Click outside, close tooltip
        setSelectedSnapshot(null);
        return;
      }

      // Find snapshot using deduplicated data to match chart data
      const chartData: ChartData[] = currentData.timeseries.map((snapshot) => ({
        time: new Date(snapshot.timestamp).getTime() / 1000,
        value: snapshot.total_pnl,
        underlying: snapshot.underlying_price,
        snapshot,
      }));
      
      const uniqueChartData = chartData.reduce((acc: ChartData[], current) => {
        const existingIndex = acc.findIndex(item => item.time === current.time);
        if (existingIndex === -1) {
          acc.push(current);
        } else {
          acc[existingIndex] = current;
        }
        return acc;
      }, []).sort((a, b) => a.time - b.time);

      const chartDataItem = uniqueChartData.find(
        (item) => item.time === param.time
      );
      const snapshot = chartDataItem?.snapshot;

      if (snapshot) {
        setSelectedSnapshot(snapshot);
      }
    });

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    resizeObserverRef.current = new ResizeObserver(handleResize);
    resizeObserverRef.current.observe(chartContainerRef.current);

    return () => {
      chart.remove();
      resizeObserverRef.current?.disconnect();
    };
  }, [currentData, chartSettings.selectedUnderlying]);

  useEffect(() => {
    if (!currentData || !pnlSeriesRef.current || !underlyingSeriesRef.current) return;
  
    const chartData: ChartData[] = currentData.timeseries.map((snapshot) => ({
      time: new Date(snapshot.timestamp).getTime() / 1000,
      value: snapshot.total_pnl,
      underlying: snapshot.underlying_price,
      snapshot,
    }));
  
    // Remove duplicates and ensure ascending order by time
    const uniqueChartData = chartData.reduce((acc: ChartData[], current) => {
      const existingIndex = acc.findIndex(item => item.time === current.time);
      if (existingIndex === -1) {
        acc.push(current);
      } else {
        // Keep the latest data for duplicate timestamps
        acc[existingIndex] = current;
      }
      return acc;
    }, []).sort((a, b) => a.time - b.time);
  
    // Set P&L data - filter out invalid values
    const pnlData = uniqueChartData
      .filter((d) => typeof d.value === 'number' && !isNaN(d.value))
      .map((d) => ({ 
        time: d.time as Time, 
        value: d.value 
      }));
  
    pnlSeriesRef.current.setData(pnlData);
  
    // Set underlying data - filter out null/undefined/invalid values
    if (chartSettings.selectedUnderlying !== null) {
      const underlyingData = uniqueChartData
        .filter((d) => 
          d.underlying !== null && 
          d.underlying !== undefined && 
          typeof d.underlying === 'number' && 
          !isNaN(d.underlying)
        )
        .map((d) => ({ 
          time: d.time as Time, 
          value: d.underlying! 
        }));
  
      underlyingSeriesRef.current.setData(underlyingData);
    }
  
    // Note: Trade markers and selection indicators are now handled 
    // in the separate useEffect for selection indicator
  
    // Fit content
    chartRef.current?.timeScale().fitContent();
  }, [currentData, chartSettings.showTradeMarkers, chartSettings.selectedUnderlying]);
  
  // Update underlying visibility
  useEffect(() => {
    if (underlyingSeriesRef.current && chartRef.current) {
      underlyingSeriesRef.current.applyOptions({
        visible: chartSettings.selectedUnderlying !== null,
      });
      
      chartRef.current.applyOptions({
        rightPriceScale: {
          visible: chartSettings.selectedUnderlying !== null,
        },
      });
    }
  }, [chartSettings.selectedUnderlying]);

  // Handle fullscreen
  useEffect(() => {
    if (chartContainerRef.current) {
      const container = chartContainerRef.current.parentElement;
      if (container) {
        if (chartSettings.isFullscreen) {
          container.classList.add('fixed', 'inset-0', 'z-50', 'bg-white');
        } else {
          container.classList.remove('fixed', 'inset-0', 'z-50', 'bg-white');
        }
      }
    }
  }, [chartSettings.isFullscreen]);

  const handleCloseTooltip = () => {
    setSelectedSnapshot(null);
  };

  // Update markers (trade markers + selection indicator)
  useEffect(() => {
    if (!pnlSeriesRef.current || !currentData) return;

    // Get all trade markers - need to access uniqueChartData from the data effect
    // For now, recreate the deduplication logic here
    const chartData: ChartData[] = currentData.timeseries.map((snapshot) => ({
      time: new Date(snapshot.timestamp).getTime() / 1000,
      value: snapshot.total_pnl,
      underlying: snapshot.underlying_price,
      snapshot,
    }));
    
    const uniqueChartData = chartData.reduce((acc: ChartData[], current) => {
      const existingIndex = acc.findIndex(item => item.time === current.time);
      if (existingIndex === -1) {
        acc.push(current);
      } else {
        acc[existingIndex] = current;
      }
      return acc;
    }, []).sort((a, b) => a.time - b.time);

    const tradeMarkers = chartSettings.showTradeMarkers ? 
      uniqueChartData
        .filter((chartDataItem) => 
          chartDataItem.snapshot?.trade_marker && 
          chartDataItem.snapshot.trade_marker.type !== 'none'
        )
        .map((chartDataItem) => ({
          time: chartDataItem.time as Time,
          position: 'belowBar' as const,
          color: chartDataItem.snapshot!.trade_marker!.type === 'square_up' ? '#dc2626' : '#3b82f6',
          shape: 'circle' as const,
          text: chartDataItem.snapshot!.trade_marker!.type === 'square_up' ? 'S' : 'T',
        })) : [];

    let allMarkers = [...tradeMarkers];

    // Add selection indicator if there's a selected snapshot
    if (selectedSnapshot) {
      const selectedTime = new Date(selectedSnapshot.timestamp).getTime() / 1000;
      
      const selectionMarker = {
        time: selectedTime as Time,
        position: 'aboveBar' as const, // Above the chart line
        color: '#f59e0b', // Back to gold since you said it was better
        shape: 'arrowDown' as const,
        text: '', // NO TEXT - just the arrow shape itself
        size: 3, // Bigger size for better visibility
      };

      allMarkers.push(selectionMarker);
    }

    // Sort all markers by time to ensure ascending order
    allMarkers.sort((a, b) => (a.time as number) - (b.time as number));

    // Set all markers
    pnlSeriesRef.current.setMarkers(allMarkers);
  }, [currentData, chartSettings.showTradeMarkers, selectedSnapshot]);

  // Navigation between trade events
  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!currentData || !selectedSnapshot) return;

    // Find all snapshots with trade markers
    const tradeSnapshots = currentData.timeseries.filter(
      snapshot => snapshot.trade_marker && snapshot.trade_marker.type !== 'none'
    );

    if (tradeSnapshots.length === 0) return;

    // Find current snapshot's timestamp
    const currentTimestamp = selectedSnapshot.timestamp;
    
    if (direction === 'next') {
      // Find the first trade snapshot after the current timestamp
      const nextTradeSnapshot = tradeSnapshots.find(
        snapshot => snapshot.timestamp > currentTimestamp
      );
      if (nextTradeSnapshot) {
        setSelectedSnapshot(nextTradeSnapshot);
      }
    } else {
      // Find the last trade snapshot before the current timestamp
      const prevTradeSnapshot = tradeSnapshots
        .slice()
        .reverse()
        .find(snapshot => snapshot.timestamp < currentTimestamp);
      if (prevTradeSnapshot) {
        setSelectedSnapshot(prevTradeSnapshot);
      }
    }
  };

  // Check if navigation is possible
  const getNavigationState = () => {
    if (!currentData || !selectedSnapshot) {
      return { canNavigatePrev: false, canNavigateNext: false };
    }

    const tradeSnapshots = currentData.timeseries.filter(
      snapshot => snapshot.trade_marker && snapshot.trade_marker.type !== 'none'
    );

    if (tradeSnapshots.length === 0) {
      return { canNavigatePrev: false, canNavigateNext: false };
    }

    const currentTimestamp = selectedSnapshot.timestamp;

    // Check if there's a trade snapshot after the current timestamp
    const hasNext = tradeSnapshots.some(
      snapshot => snapshot.timestamp > currentTimestamp
    );

    // Check if there's a trade snapshot before the current timestamp
    const hasPrev = tradeSnapshots.some(
      snapshot => snapshot.timestamp < currentTimestamp
    );

    return {
      canNavigatePrev: hasPrev,
      canNavigateNext: hasNext
    };
  };

  const { canNavigatePrev, canNavigateNext } = getNavigationState();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={chartContainerRef}
        className="h-full w-full"
        style={{ minHeight: '400px' }}
      />
      
      
      {selectedSnapshot && (
        <ChartTooltip
          snapshot={selectedSnapshot}
          viewMode={viewMode}
          onClose={handleCloseTooltip}
          onViewModeChange={setViewMode}
          onNavigate={handleNavigate}
          canNavigatePrev={canNavigatePrev}
          canNavigateNext={canNavigateNext}
        />
      )}
    </div>
  );
}