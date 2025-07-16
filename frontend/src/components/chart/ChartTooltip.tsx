import { SnapshotData, ViewMode } from '@/types';
import { formatTime, formatCurrency, formatNumber, getPnlColor } from '@/lib/utils';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface ChartTooltipProps {
  snapshot: SnapshotData;
  viewMode: ViewMode['type'];
  onClose: () => void;
  onViewModeChange: (mode: ViewMode['type']) => void;
}

export function ChartTooltip({
  snapshot,
  viewMode,
  onClose,
  onViewModeChange,
}: ChartTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pnlColor = getPnlColor(snapshot.total_pnl);

  const viewModes: ViewMode[] = [
    { type: 'default', label: 'Default' },
    { type: 'expanded', label: 'Expanded' },
    { type: 'delta', label: 'Delta' },
  ];

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
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
        className="absolute z-50 shadow-xl chart-tooltip-glass"
        style={{
          width: window.innerWidth < 640 ? '240px' : '280px',
          maxWidth: 'calc(100vw - 16px)',
          borderRadius: '8px',
          padding: '8px',
          fontSize: '12px',
          color: 'rgba(0, 0, 0, 0.8)'
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded text-gray-500"
        >
          <X className="h-3 w-3" />
        </button>
  
        {/* Compact table like your original */}
        <table className="w-full border-collapse text-xs">
          <tbody>
            {/* Time and P&L row */}
            <tr>
              <td className="py-0 text-gray-700 text-xs font-medium">Time</td>
              <td className="py-0 text-center font-bold text-blue-600 text-xs" colSpan={2}>
                {formatTime(snapshot.timestamp)}
              </td>
              <td className="py-0 text-center text-xs border-l border-gray-200 pl-1 text-gray-700">
                M2M
              </td>
              <td className={`py-0 text-sm font-bold ${pnlColor}`}>
                {formatCurrency(snapshot.total_pnl, {
                  maximumFractionDigits: 0,
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
                    compact: true
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
  
            {/* View mode tabs as compact buttons */}
            <tr>
              <td colSpan={5} className="py-1">
                <div className="flex gap-0.5">
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
              </td>
            </tr>
          </tbody>
        </table>
  
        {/* Compact content */}
        <div className="max-h-48 overflow-y-auto custom-scrollbar mt-1">
          {viewMode === 'default' && <DefaultView snapshot={snapshot} />}
          {viewMode === 'expanded' && <ExpandedView snapshot={snapshot} />}
          {viewMode === 'delta' && <DeltaView snapshot={snapshot} />}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function DefaultView({ snapshot }: { snapshot: SnapshotData }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="text-left py-0.5 text-xs font-medium text-gray-700">Symbol</th>
          <th className="text-right py-0.5 text-xs font-medium text-gray-700">Qty</th>
          <th className="text-right py-0.5 text-xs font-medium text-gray-700">LTP</th>
          <th className="text-right py-0.5 text-xs font-medium text-gray-700">P&L</th>
        </tr>
      </thead>
      <tbody>
        {snapshot.positions.map((position) => (
          <tr key={position.instrument_id} className="border-b border-gray-100">
            <td className="py-0.5 text-xs">
              <div className="font-medium truncate">{position.instrument.symbol}</div>
              <div className="text-xs text-gray-500">
                {position.instrument.type} {position.instrument.strike}
              </div>
            </td>
            <td className="text-right py-0.5 text-xs font-medium">{position.quantity}</td>
            <td className="text-right py-0.5 text-xs font-mono text-purple-600 font-bold">
              {formatNumber(position.last_price, { maximumFractionDigits: 1 })}
            </td>
            <td className={`text-right py-0.5 text-sm font-bold ${getPnlColor(position.unbooked_pnl)}`}>
              {formatCurrency(position.unbooked_pnl, {
                maximumFractionDigits: 0,
                compact: true
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExpandedView({ snapshot }: { snapshot: SnapshotData }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="text-left py-0.5 text-xs font-medium text-gray-700">Symbol</th>
          <th className="text-right py-0.5 text-xs font-medium text-gray-700">Qty</th>
          <th className="text-right py-0.5 text-xs font-medium text-gray-700">Avg</th>
          <th className="text-right py-0.5 text-xs font-medium text-gray-700">LTP</th>
          <th className="text-right py-0.5 text-xs font-medium text-gray-700">P&L</th>
        </tr>
      </thead>
      <tbody>
        {snapshot.positions.map((position) => (
          <tr key={position.instrument_id} className="border-b border-gray-100">
            <td className="py-0.5 text-xs">
              <div className="font-medium truncate">{position.instrument.symbol}</div>
              <div className="text-xs text-gray-500">
                {position.instrument.type} {position.instrument.strike}
              </div>
            </td>
            <td className="text-right py-0.5 text-xs font-medium">{position.quantity}</td>
            <td className="text-right py-0.5 text-xs font-mono">
              {formatNumber(position.avg_price, { maximumFractionDigits: 1 })}
            </td>
            <td className="text-right py-0.5 text-xs font-mono text-purple-600 font-bold">
              {formatNumber(position.last_price, { maximumFractionDigits: 1 })}
            </td>
            <td className={`text-right py-0.5 text-xs font-bold ${getPnlColor(position.unbooked_pnl)}`}>
              {formatCurrency(position.unbooked_pnl, { maximumFractionDigits: 0 })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeltaView({ snapshot }: { snapshot: SnapshotData }) {
  if (!snapshot.trade_marker || snapshot.trade_marker.type === 'none') {
    return (
      <div className="text-center text-gray-500 text-xs py-2">
        No position changes
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="font-medium text-gray-900 text-xs mb-1">
        {snapshot.trade_marker.summary}
      </div>
      
      <table className="w-full border-collapse text-xs">
        <tbody>
          {snapshot.trade_marker.changes.map((change, index) => (
            <tr key={index} className="border-b border-gray-100">
              <td className="py-0.5 text-xs">
                <div className="font-medium truncate">{change.instrument_symbol}</div>
                <div className="text-xs text-gray-500 capitalize">
                  {change.change_type.replace('_', ' ')}
                </div>
              </td>
              <td className="text-right py-0.5 text-xs">
                {change.change_type === 'quantity_change' && (
                  <span className="font-mono">
                    {change.old_quantity} → {change.new_quantity}
                  </span>
                )}
                {change.change_type === 'new' && (
                  <span className="text-success-600 font-medium">
                    +{change.new_quantity} NEW
                  </span>
                )}
                {change.change_type === 'closed' && (
                  <span className="text-error-600 font-medium">
                    -{change.old_quantity} CLOSED
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}