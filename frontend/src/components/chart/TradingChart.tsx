'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, UTCTimestamp, MouseEventParams, Time } from 'lightweight-charts';
import { useStore } from '@/store/useStore';
import { ChartTooltip } from './ChartTooltip';
import { SnapshotData, ChartData } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { throttle } from '@/lib/utils';

export function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const pnlSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const underlyingSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  
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
        visible: chartSettings.showUnderlying,
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
      visible: chartSettings.showUnderlying,
    });

    chartRef.current = chart;
    pnlSeriesRef.current = pnlSeries;
    underlyingSeriesRef.current = underlyingSeries;

    // Handle crosshair move
    const throttledCrosshairMove = throttle((param: MouseEventParams<Time>) => {
      if (!param.point || !param.time || !currentData) return;

      const snapshot = currentData.timeseries.find(
        (s: SnapshotData) => new Date(s.timestamp).getTime() / 1000 === param.time
      );

      if (snapshot) {
        setSelectedSnapshot(snapshot);
        setTooltipPosition({
          x: param.point.x + chartContainerRef.current!.offsetLeft,
          y: param.point.y + chartContainerRef.current!.offsetTop,
        });
      }
    }, 16);

    chart.subscribeCrosshairMove(throttledCrosshairMove);

    // Handle click
    chart.subscribeClick((param: MouseEventParams<Time>) => {
      if (!param.point || !param.time || !currentData) return;

      const snapshot = currentData.timeseries.find(
        (s: SnapshotData) => new Date(s.timestamp).getTime() / 1000 === param.time
      );

      if (snapshot) {
        setSelectedSnapshot(snapshot);
        setTooltipPosition({
          x: param.point.x + chartContainerRef.current!.offsetLeft,
          y: param.point.y + chartContainerRef.current!.offsetTop,
        });
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
  }, [currentData, chartSettings.showUnderlying]);

  // Update chart data
  useEffect(() => {
    if (!currentData || !pnlSeriesRef.current || !underlyingSeriesRef.current) return;

    const chartData: ChartData[] = currentData.timeseries.map((snapshot) => ({
      time: (new Date(snapshot.timestamp).getTime() / 1000) as UTCTimestamp,
      value: snapshot.total_pnl,
      underlying: snapshot.underlying_price,
      snapshot,
    }));

    // Set P&L data
    pnlSeriesRef.current.setData(
      chartData.map((d) => ({ time: d.time as UTCTimestamp, value: d.value }))
    );

    // Set underlying data
    if (chartSettings.showUnderlying) {
      underlyingSeriesRef.current.setData(
        chartData
          .filter((d) => d.underlying != null)
          .map((d) => ({ time: d.time as UTCTimestamp, value: d.underlying! }))
      );
    }

    // Add trade markers
    if (chartSettings.showTradeMarkers) {
      const markers = chartData
        .filter((d) => d.snapshot?.trade_marker && d.snapshot.trade_marker.type !== 'none')
        .map((d) => ({
          time: d.time as UTCTimestamp,
          position: 'belowBar' as const,
          color: d.snapshot!.trade_marker!.type === 'square_up' ? '#dc2626' : '#3b82f6',
          shape: 'circle' as const,
          text: d.snapshot!.trade_marker!.type === 'square_up' ? 'S' : 'T',
        }));

      pnlSeriesRef.current.setMarkers(markers);
    }

    // Fit content
    chartRef.current?.timeScale().fitContent();
  }, [currentData, chartSettings.showTradeMarkers, chartSettings.showUnderlying]);

  // Update underlying visibility
  useEffect(() => {
    if (underlyingSeriesRef.current && chartRef.current) {
      underlyingSeriesRef.current.applyOptions({
        visible: chartSettings.showUnderlying,
      });
      
      chartRef.current.applyOptions({
        rightPriceScale: {
          visible: chartSettings.showUnderlying,
        },
      });
    }
  }, [chartSettings.showUnderlying]);

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
    setTooltipPosition(null);
  };

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
      
      {selectedSnapshot && tooltipPosition && (
        <ChartTooltip
          snapshot={selectedSnapshot}
          position={tooltipPosition}
          viewMode={viewMode}
          onClose={handleCloseTooltip}
          onViewModeChange={setViewMode}
        />
      )}
    </div>
  );
}