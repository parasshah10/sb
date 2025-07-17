import { SnapshotData, ViewMode } from '@/types';
import { formatTime, formatCurrency, formatNumber, getPnlColor } from '@/lib/utils';
import { normalizeOptionType, getOptionTypeColor, compareOptionTypes } from '@/lib/optionUtils';
import { formatQuantityDisplay, formatChangeDisplay } from '@/lib/lotUtils';
import { useStore } from '@/store/useStore';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

// Helper function to format expiry date compactly
function formatExpiryDate(expiry?: string): string {
  if (!expiry) return '';
  
  try {
    const date = new Date(expiry);
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}${month}${year}`;
  } catch {
    return expiry; // Return original if parsing fails
  }
}

interface ChartTooltipProps {
  snapshot: SnapshotData;
  viewMode: ViewMode['type'];
  onClose: () => void;
  onViewModeChange: (mode: ViewMode['type']) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
}

export function ChartTooltip({
  snapshot,
  viewMode,
  onClose,
  onViewModeChange,
  onNavigate,
  canNavigatePrev = false,
  canNavigateNext = false,
}: ChartTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pnlColor = getPnlColor(snapshot.total_pnl);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPinned, setIsPinned] = useState(true);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const [size, setSize] = useState({ width: 336, maxHeight: 400 });
  const [isResizing, setIsResizing] = useState(false);

  const viewModes: ViewMode[] = [
    { type: 'expanded', label: 'Positions' },
    { type: 'delta', label: 'Delta' },
  ];

  // Reset to original pinned position and size
  const resetPosition = () => {
    setPosition({ x: 0, y: 0 });
    setSize({ width: 336, maxHeight: 400 });
    setIsPinned(true);
  };

  // Handle drag start
  const handleDragStart = () => {
    setIsDragging(true);
    setIsPinned(false);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Handle resize with native mouse events (both width and height)
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.maxHeight;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const newWidth = Math.max(336, Math.min(600, startWidth + deltaX));
      const newMaxHeight = Math.max(300, Math.min(800, startHeight + deltaY));
      setSize({ width: newWidth, maxHeight: newMaxHeight });
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Enable dragging after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsDragEnabled(true);
    }, 100); // Small delay to ensure framer-motion is ready
    
    return () => clearTimeout(timer);
  }, []);

  // Position tooltip exactly like your original HTML code
  useEffect(() => {
    if (!tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const chartContainer = tooltip.closest('.relative');
    
    if (chartContainer) {
      const chartRect = chartContainer.getBoundingClientRect();
      const tooltipWidth = tooltip.offsetWidth;
      
      // Center horizontally exactly like your original code
      const leftPos = (chartRect.width - tooltipWidth) / 2;
      tooltip.style.left = `${Math.max(8, leftPos)}px`;
      tooltip.style.top = '10px';
    }
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        ref={tooltipRef}
        initial={{ opacity: 0, y: -10 }}
        animate={{ 
          opacity: 1, 
          y: position.y,
          x: position.x
        }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: isDragging ? 0 : 0.15 }}
        drag={isDragEnabled && !isResizing}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDrag={(event, info) => {
          setPosition({ x: info.offset.x, y: info.offset.y });
        }}
        className={`absolute z-50 shadow-xl chart-tooltip-glass ${isDragEnabled ? (isDragging ? 'cursor-grabbing shadow-2xl' : 'cursor-grab') : ''}`}
        style={{
          width: `${size.width}px`,
          maxHeight: `${size.maxHeight}px`,
          maxWidth: 'calc(100vw - 16px)',
          borderRadius: '8px',
          padding: '8px 0px 0px 8px',
          fontSize: '12px',
          color: 'rgba(0, 0, 0, 0.8)',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded text-gray-500"
        >
          <X className="h-3 w-3" />
        </button>

        {/* Reset position button - only show when moved from center or resized */}
        {(position.x !== 0 || position.y !== 0 || size.width !== 336 || size.maxHeight !== 400) && (
          <button
            onClick={resetPosition}
            className="absolute top-1 right-6 w-4 h-4 flex items-center justify-center hover:bg-blue-100 rounded text-blue-600 text-xs"
            title="Reset position and size"
          >
            📌
          </button>
        )}

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          className={`absolute bottom-1 right-1 w-3 h-3 cursor-nw-resize flex items-center justify-center text-gray-300 hover:text-gray-500 z-10 select-none`}
          style={{
            background: 'linear-gradient(-45deg, transparent 40%, currentColor 40%, currentColor 45%, transparent 45%, transparent 55%, currentColor 55%, currentColor 60%, transparent 60%)',
            borderRadius: '0 0 4px 0',
          }}
          title="Drag to resize width and height"
        />
  
        {/* Header table - fixed at top */}
        <table className="w-full border-collapse text-xs flex-shrink-0">
          <tbody>
            {/* Time and P&L row */}
            <tr>
              <td className="py-0 text-gray-700 text-xs font-medium">Time</td>
              <td className="py-0 text-center font-bold text-blue-600 text-xs" colSpan={2}>
                {formatTime(snapshot.timestamp)}
              </td>
              <td className="py-0 text-center text-xs border-l border-gray-200 pl-1 text-gray-700">
                P&L
              </td>
              <td className={`py-0 text-sm font-bold ${pnlColor}`}>
                {formatCurrency(snapshot.total_pnl, {
                  maximumFractionDigits: 1,
                  compact: true
                })}
              </td>
            </tr>
  
            {/* Spot and Positions count */}
            <tr className="border-b border-gray-200">
              <td className="py-0 text-gray-700 text-xs">Spot</td>
              <td className="py-0 text-center font-bold text-xs" colSpan={2}>
                {snapshot.underlying_price ?
                  formatNumber(snapshot.underlying_price, {
                    maximumFractionDigits: 0,
                    compact: false
                  }) :
                  '--'
                }
              </td>
              <td className="py-0 text-center text-xs border-l border-gray-200 pl-1 text-gray-700">
                Pos
              </td>
              <td className="py-0 text-xs font-bold">
                {snapshot.position_count}
              </td>
            </tr>
  
            {/* View mode tabs as compact buttons - only show when expanded */}
            {!isCollapsed && (
              <tr>
                <td colSpan={5} className="py-1">
                  <div className="flex items-center justify-between gap-1">
                    {/* Left navigation arrow */}
                    {onNavigate ? (
                      <button
                        onClick={() => onNavigate('prev')}
                        disabled={!canNavigatePrev}
                        className={`p-1 rounded ${
                          canNavigatePrev 
                            ? 'text-gray-600 hover:text-blue-600 hover:bg-gray-100' 
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title="Previous trade"
                      >
                        <ChevronLeft size={12} />
                      </button>
                    ) : <div style={{ width: '28px' }} />}

                    {/* Tabs */}
                    <div className="flex gap-0.5 flex-1 items-center">
                      {viewModes.map((mode) => (
                        <button
                          key={mode.type}
                          onClick={() => onViewModeChange(mode.type)}
                          className={`flex-1 px-1 py-0.5 text-xs font-medium transition-colors rounded ${
                            viewMode === mode.type
                              ? 'bg-blue-100 text-blue-600 border border-blue-300'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                      
                    </div>

                    {/* Right navigation arrow */}
                    {onNavigate ? (
                      <button
                        onClick={() => onNavigate('next')}
                        disabled={!canNavigateNext}
                        className={`p-1 rounded ${
                          canNavigateNext 
                            ? 'text-gray-600 hover:text-blue-600 hover:bg-gray-100' 
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title="Next trade"
                      >
                        <ChevronRight size={12} />
                      </button>
                    ) : <div style={{ width: '28px' }} />}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
  
        {/* Compact content - only show when expanded */}
        {!isCollapsed && (
          <>
            {viewMode === 'expanded' && (
              <ExpandedView 
                snapshot={snapshot}
                onNavigate={onNavigate}
                canNavigatePrev={canNavigatePrev}
                canNavigateNext={canNavigateNext}
              />
            )}
            {viewMode === 'delta' && (
              <div className="overflow-y-auto custom-scrollbar pr-0 flex-1" style={{ margin: '4px 0 0 0', minHeight: '0' }}>
                <DeltaView 
                  snapshot={snapshot} 
                />
              </div>
            )}
          </>
        )}

        {/* Minimal collapse button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center justify-center text-gray-400 hover:text-gray-600 w-full"
          title={isCollapsed ? "Expand tooltip" : "Collapse tooltip"}
          style={{ height: '8px', padding: '0', margin: '0', border: 'none', background: 'none' }}
        >
          {isCollapsed ? (
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}


type SortField = 'symbol' | 'underlying' | 'strike' | 'type' | 'expiry' | 'qty' | 'avg' | 'ltp' | 'pnl';
type SortDirection = 'asc' | 'desc' | null;

function ExpandedView({ 
  snapshot, 
  onNavigate, 
  canNavigatePrev, 
  canNavigateNext 
}: { 
  snapshot: SnapshotData;
  onNavigate?: (direction: 'prev' | 'next') => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
}) {
  const { chartSettings } = useStore();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Reset to default sort function
  const resetToDefaultSort = () => {
    setSortField(null);
    setSortDirection(null);
  };

  // Default sort function - option chain style
  const getDefaultSortedPositions = (positions: any[]) => {
    const underlyingPriority: { [key: string]: number } = {
      'NIFTY': 1,
      'SENSEX': 2,
      'BANKNIFTY': 3
    };

    return [...positions].sort((a, b) => {
      // 1. Group by underlying + expiry
      const aKey = `${a.instrument.underlying_symbol}_${a.instrument.expiry}`;
      const bKey = `${b.instrument.underlying_symbol}_${b.instrument.expiry}`;
      
      if (aKey !== bKey) {
        // First by expiry date
        const aExpiry = new Date(a.instrument.expiry || '').getTime();
        const bExpiry = new Date(b.instrument.expiry || '').getTime();
        if (aExpiry !== bExpiry) return aExpiry - bExpiry;
        
        // Then by underlying priority
        const aPriority = underlyingPriority[a.instrument.underlying_symbol] || 999;
        const bPriority = underlyingPriority[b.instrument.underlying_symbol] || 999;
        if (aPriority !== bPriority) return aPriority - bPriority;
      }

      // 2. Within same underlying+expiry: PUTs first, then CALLs
      const typeComparison = compareOptionTypes(a.instrument.type, b.instrument.type);
      if (typeComparison !== 0) return typeComparison;

      // 3. Within same type: ascending strike order
      return a.instrument.strike - b.instrument.strike;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortDirection === 'asc') {
      return (
        <svg className="h-3 w-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    } else if (sortDirection === 'desc') {
      return (
        <svg className="h-3 w-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      );
    }
    
    return null;
  };

  const sortedPositions = (() => {
    // If no manual sort is applied, use default sort
    if (!sortField || !sortDirection) {
      return getDefaultSortedPositions(snapshot.positions);
    }

    // Apply manual sort
    return [...snapshot.positions].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'symbol':
          aValue = a.instrument.symbol.toLowerCase();
          bValue = b.instrument.symbol.toLowerCase();
          break;
        case 'underlying':
          aValue = a.instrument.underlying_symbol.toLowerCase();
          bValue = b.instrument.underlying_symbol.toLowerCase();
          break;
        case 'strike':
          aValue = a.instrument.strike;
          bValue = b.instrument.strike;
          break;
        case 'type':
          aValue = normalizeOptionType(a.instrument.type);
          bValue = normalizeOptionType(b.instrument.type);
          break;
        case 'expiry':
          aValue = new Date(a.instrument.expiry || '').getTime();
          bValue = new Date(b.instrument.expiry || '').getTime();
          break;
        case 'qty':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'avg':
          aValue = a.avg_price;
          bValue = b.avg_price;
          break;
        case 'ltp':
          aValue = a.last_price;
          bValue = b.last_price;
          break;
        case 'pnl':
          aValue = a.unbooked_pnl;
          bValue = b.unbooked_pnl;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  })();

  return (
    <div style={{ margin: '4px 0 0 0' }} className="relative">
      {/* Reset sort button - positioned absolutely outside table */}
      {(sortField && sortDirection) && (
        <button
          onClick={resetToDefaultSort}
          className="absolute -top-1 -right-1 w-4 h-4 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full flex items-center justify-center z-10"
          title="Reset to default option chain order"
          style={{ fontSize: '10px' }}
        >
          ↻
        </button>
      )}
      
      {/* Fixed header */}
      <table className="w-full border-collapse text-xs" style={{ borderSpacing: '0' }}>
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-1 font-medium text-gray-700 px-0" style={{ width: '45px', padding: '2px 1px', fontSize: '10px' }}>
              <button 
                onClick={() => handleSort('underlying')}
                className="flex items-center gap-0.5 text-left hover:text-blue-600 transition-colors w-full"
                style={{ fontSize: '10px' }}
              >
                <span className="truncate">Sym</span> {getSortIcon('underlying')}
              </button>
            </th>
            <th className="text-center py-1 font-medium text-gray-700 px-0" style={{ width: '25px', padding: '2px 1px', fontSize: '10px' }}>
              <button 
                onClick={() => handleSort('type')}
                className="flex items-center justify-center gap-0.5 hover:text-blue-600 transition-colors w-full"
                style={{ fontSize: '10px' }}
              >
                T {getSortIcon('type')}
              </button>
            </th>
            <th className="text-center py-1 font-medium text-gray-700 px-0" style={{ width: '50px', padding: '2px 1px', fontSize: '10px' }}>
              <button 
                onClick={() => handleSort('strike')}
                className="flex items-center justify-center gap-0.5 hover:text-blue-600 transition-colors w-full"
                style={{ fontSize: '10px' }}
              >
                Strike {getSortIcon('strike')}
              </button>
            </th>
            <th className="text-center py-1 font-medium text-gray-700 px-0" style={{ width: '40px', padding: '2px 1px', fontSize: '10px' }}>
              <button 
                onClick={() => handleSort('qty')}
                className="flex items-center justify-center gap-0.5 hover:text-blue-600 transition-colors w-full"
                style={{ fontSize: '10px' }}
              >
                {chartSettings.displayMode === 'lots' ? 'Lots' : 'Qty'} {getSortIcon('qty')}
              </button>
            </th>
            <th className="text-center py-1 font-medium text-gray-700 px-0" style={{ width: '45px', padding: '2px 1px', fontSize: '10px' }}>
              <button 
                onClick={() => handleSort('avg')}
                className="flex items-center justify-center gap-0.5 hover:text-blue-600 transition-colors w-full"
                style={{ fontSize: '10px' }}
              >
                Avg {getSortIcon('avg')}
              </button>
            </th>
            <th className="text-center py-1 font-medium text-gray-700 px-0" style={{ width: '45px', padding: '2px 1px', fontSize: '10px' }}>
              <button 
                onClick={() => handleSort('ltp')}
                className="flex items-center justify-center gap-0.5 hover:text-blue-600 transition-colors w-full"
                style={{ fontSize: '10px' }}
              >
                LTP {getSortIcon('ltp')}
              </button>
            </th>
            <th className="text-center py-1 font-medium text-gray-700 px-0" style={{ width: '50px', padding: '2px 1px', fontSize: '10px' }}>
              <button 
                onClick={() => handleSort('pnl')}
                className="flex items-center justify-center gap-0.5 hover:text-blue-600 transition-colors w-full"
                style={{ fontSize: '10px' }}
              >
                P&L {getSortIcon('pnl')}
              </button>
            </th>
          </tr>
        </thead>
      </table>
      
      {/* Scrollable body */}
      <div className="overflow-y-auto custom-scrollbar pr-0 flex-1" style={{ minHeight: '0' }}>
        <table className="w-full border-collapse text-xs" style={{ borderSpacing: '0' }}>
          <tbody>
            {sortedPositions.map((position) => (
              <tr key={position.instrument_id} className="border-b border-gray-100">
                <td className="text-xs" style={{ width: '45px', padding: '2px 1px' }}>
                  <div className="font-medium text-gray-900 truncate" style={{ fontSize: '10px' }}>
                    {position.instrument.underlying_symbol}
                  </div>
                  <div className="text-gray-400 truncate" style={{ fontSize: '9px' }}>
                    {formatExpiryDate(position.instrument.expiry)}
                  </div>
                </td>
                <td className="text-center" style={{ width: '25px', padding: '2px 1px' }}>
                  <span className={`font-medium ${getOptionTypeColor(position.instrument.type)}`} style={{ fontSize: '14px' }}>
                    {normalizeOptionType(position.instrument.type)}
                  </span>
                </td>
                <td className="text-right font-mono" style={{ width: '50px', padding: '4px 2px', fontSize: '14px' }}>
                  {position.instrument.strike}
                </td>
                <td className={`text-right font-medium font-mono ${position.quantity > 0 ? 'text-green-600' : position.quantity < 0 ? 'text-red-600' : 'text-gray-900'}`} style={{ width: '40px', padding: '4px 2px', fontSize: '14px' }}>
                  {formatQuantityDisplay(position.quantity, position.instrument.underlying_symbol, chartSettings.displayMode)}
                </td>
                <td className="text-right font-mono" style={{ width: '45px', padding: '4px 2px', fontSize: '14px' }}>
                  {formatNumber(position.avg_price, { 
                    maximumFractionDigits: position.avg_price >= 10000 ? 0 : 1, 
                    compact: true 
                  })}
                </td>
                <td className="text-right font-mono text-purple-600 font-bold" style={{ width: '45px', padding: '4px 2px', fontSize: '14px' }}>
                  {formatNumber(position.last_price, { 
                    maximumFractionDigits: position.last_price >= 10000 ? 0 : 1, 
                    compact: true 
                  })}
                </td>
                <td className={`text-right font-bold font-mono ${getPnlColor(position.quantity === 0 ? position.booked_pnl : position.unbooked_pnl)}`} style={{ fontSize: '14px', width: '50px', padding: '4px 2px' }}>
                  {formatNumber(position.quantity === 0 ? position.booked_pnl : position.unbooked_pnl, {
                    maximumFractionDigits: Math.abs(position.quantity === 0 ? position.booked_pnl : position.unbooked_pnl) >= 1000 ? 1 : 0,
                    compact: true
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeltaView({ 
  snapshot 
}: { 
  snapshot: SnapshotData;
}) {
  const { chartSettings } = useStore();
  const hasTradeMarker = snapshot.trade_marker && snapshot.trade_marker.type !== 'none';

  // Helper function to get change type color and icon
  const getChangeTypeDisplay = (changeType: string, oldQty: number = 0, newQty: number = 0) => {
    switch (changeType) {
      case 'new':
        return { color: 'text-green-600', icon: '+', label: 'NEW' };
      case 'closed':
        return { color: 'text-red-600', icon: '×', label: 'CLOSED' };
      case 'quantity_change':
        // Determine if it's a buy or sell based on quantity change
        const isBuy = newQty > oldQty;
        return { 
          color: isBuy ? 'text-green-600' : 'text-red-600', 
          icon: isBuy ? '+' : '-', 
          label: isBuy ? 'BUY' : 'SELL' 
        };
      case 'price_change':
        return { color: 'text-orange-600', icon: '₹', label: 'PRICE' };
      default:
        return { color: 'text-gray-600', icon: '•', label: 'CHANGE' };
    }
  };

  // Helper function to get position-based color (green for long, red for short)
  const getPositionColor = (quantity: number) => {
    if (quantity > 0) return 'text-green-600';
    if (quantity < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // Helper function to get net change color
  const getNetChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div style={{ margin: '4px 0 0 0' }} className="relative">
      {!hasTradeMarker ? (
        <div className="text-center text-gray-500 text-xs py-4">
          No position changes
        </div>
      ) : (
        <>
          {/* Summary header */}
          <div className="font-medium text-gray-900 text-xs mb-2 px-1">
            {snapshot.trade_marker.summary}
          </div>
          
          {/* Fixed header */}
          <table className="w-full border-collapse text-xs" style={{ borderSpacing: '0' }}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-1 font-medium text-gray-700 px-0" style={{ width: '45px', padding: '2px 1px', fontSize: '10px' }}>
                  Sym
                </th>
                <th className="text-center py-1 font-medium text-gray-700 px-0" style={{ width: '25px', padding: '2px 1px', fontSize: '10px' }}>
                  T
                </th>
                <th className="text-center py-1 font-medium text-gray-700 px-0" style={{ width: '50px', padding: '2px 1px', fontSize: '10px' }}>
                  Strike
                </th>
                <th className="text-center py-1 font-medium text-gray-700 px-0" style={{ width: '30px', padding: '2px 1px', fontSize: '10px' }}>
                  Action
                </th>
                <th className="text-center py-1 font-medium text-gray-700 px-0" style={{ width: '60px', padding: '2px 1px', fontSize: '10px' }}>
                  {chartSettings.displayMode === 'lots' ? 'Lots Δ' : 'Change'}
                </th>
                <th className="text-center py-1 font-medium text-gray-700 px-0" style={{ width: '45px', padding: '2px 1px', fontSize: '10px' }}>
                  Price
                </th>
              </tr>
            </thead>
          </table>
          
          {/* Scrollable body */}
          <div className="overflow-y-auto custom-scrollbar pr-0 flex-1" style={{ minHeight: '0' }}>
            <table className="w-full border-collapse text-xs" style={{ borderSpacing: '0' }}>
              <tbody>
                {snapshot.trade_marker.changes.map((change, index) => {
                  const instrument = change.instrument;
                  const changeDisplay = getChangeTypeDisplay(change.change_type, change.old_quantity || 0, change.new_quantity || 0);
                  const oldQtyColor = getPositionColor(change.old_quantity || 0);
                  const newQtyColor = getPositionColor(change.new_quantity || 0);
                  const netChange = (change.new_quantity || 0) - (change.old_quantity || 0);
                  const netChangeColor = getNetChangeColor(netChange);
                  
                  return (
                    <tr key={index} className="border-b border-gray-100">
                      {/* Symbol column */}
                      <td className="text-xs" style={{ width: '45px', padding: '2px 1px' }}>
                        <div className="font-medium text-gray-900 truncate" style={{ fontSize: '10px' }}>
                          {instrument?.underlying_symbol || change.instrument_symbol}
                        </div>
                        <div className="text-gray-400 truncate" style={{ fontSize: '9px' }}>
                          {formatExpiryDate(instrument?.expiry)}
                        </div>
                      </td>
                      
                      {/* Type column */}
                      <td className="text-center" style={{ width: '25px', padding: '2px 1px' }}>
                        <span className={`font-medium ${getOptionTypeColor(instrument?.type || '')}`} style={{ fontSize: '14px' }}>
                          {normalizeOptionType(instrument?.type || '')}
                        </span>
                      </td>
                      
                      {/* Strike column */}
                      <td className="text-right font-mono" style={{ width: '50px', padding: '4px 2px', fontSize: '14px' }}>
                        {instrument?.strike || '--'}
                      </td>
                      
                      {/* Action column */}
                      <td className="text-center" style={{ width: '30px', padding: '2px 1px' }}>
                        <span className={`font-bold ${changeDisplay.color}`} style={{ fontSize: '12px' }}>
                          {changeDisplay.icon}
                        </span>
                        <div className={`${changeDisplay.color} truncate`} style={{ fontSize: '9px' }}>
                          {changeDisplay.label}
                        </div>
                      </td>
                      
                      {/* Change column */}
                      <td className="text-center font-mono" style={{ width: '60px', padding: '2px 1px' }}>
                        {change.change_type === 'quantity_change' && (
                          <div className="font-medium" style={{ fontSize: '11px' }}>
                            {(() => {
                              const changeDisplay = formatChangeDisplay(
                                change.old_quantity || 0,
                                change.new_quantity || 0,
                                instrument?.underlying_symbol || '',
                                chartSettings.displayMode
                              );
                              return (
                                <>
                                  <div className={oldQtyColor}>{changeDisplay.old}</div>
                                  <div style={{ fontSize: '8px' }}>↓</div>
                                  <div className={newQtyColor}>{changeDisplay.new}</div>
                                  <div className={netChangeColor} style={{ fontSize: '9px', opacity: 0.8 }}>
                                    ({changeDisplay.net})
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {change.change_type === 'new' && (
                          <div className="font-medium" style={{ fontSize: '11px' }}>
                            {(() => {
                              const changeDisplay = formatChangeDisplay(
                                0,
                                change.new_quantity || 0,
                                instrument?.underlying_symbol || '',
                                chartSettings.displayMode
                              );
                              return (
                                <>
                                  <div className="text-gray-600">{changeDisplay.old}</div>
                                  <div style={{ fontSize: '8px' }}>↓</div>
                                  <div className={getPositionColor(change.new_quantity || 0)}>
                                    {changeDisplay.new}
                                  </div>
                                  <div className={getNetChangeColor(change.new_quantity || 0)} style={{ fontSize: '9px', opacity: 0.8 }}>
                                    ({changeDisplay.net})
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {change.change_type === 'closed' && (
                          <div className="font-medium" style={{ fontSize: '11px' }}>
                            {(() => {
                              const changeDisplay = formatChangeDisplay(
                                change.old_quantity || 0,
                                0,
                                instrument?.underlying_symbol || '',
                                chartSettings.displayMode
                              );
                              return (
                                <>
                                  <div className={getPositionColor(change.old_quantity || 0)}>{changeDisplay.old}</div>
                                  <div style={{ fontSize: '8px' }}>↓</div>
                                  <div className="text-gray-600">{changeDisplay.new}</div>
                                  <div className={getNetChangeColor(-(change.old_quantity || 0))} style={{ fontSize: '9px', opacity: 0.8 }}>
                                    ({changeDisplay.net})
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {change.change_type === 'price_change' && (
                          <div className="text-orange-600 font-medium" style={{ fontSize: '11px' }}>
                            <div>{formatNumber(change.old_price || 0, { maximumFractionDigits: 1, compact: true })}</div>
                            <div style={{ fontSize: '8px' }}>↓</div>
                            <div>{formatNumber(change.new_price || 0, { maximumFractionDigits: 1, compact: true })}</div>
                            <div className="text-orange-600" style={{ fontSize: '9px', opacity: 0.8 }}>
                              ({change.new_price! > change.old_price! ? '+' : ''}{formatNumber((change.new_price || 0) - (change.old_price || 0), { maximumFractionDigits: 1, compact: true })})
                            </div>
                          </div>
                        )}
                      </td>
                      
                      {/* Price column */}
                      <td className="text-right font-mono" style={{ width: '45px', padding: '4px 2px', fontSize: '14px' }}>
                        {change.change_type === 'price_change' ? (
                          <span className="text-orange-600 font-medium">
                            {formatNumber(change.new_price || 0, { maximumFractionDigits: 1, compact: true })}
                          </span>
                        ) : (
                          <span className="text-gray-600">
                            {formatNumber(change.new_price || change.old_price || 0, { maximumFractionDigits: 1, compact: true })}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}