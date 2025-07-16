import { SnapshotData, ViewMode } from '@/types';
import { formatTime, formatCurrency, formatNumber, getPnlColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X, TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const pnlColor = getPnlColor(snapshot.total_pnl);
  const PnlIcon = snapshot.total_pnl >= 0 ? TrendingUp : TrendingDown;

  const viewModes: ViewMode[] = [
    { type: 'default', label: 'Default' },
    { type: 'expanded', label: 'Expanded' },
    { type: 'delta', label: 'Delta' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
        className="fixed top-4 left-1/2 z-50 chart-tooltip shadow-xl"
        style={{ 
          transform: 'translateX(-50%)',
          width: '320px', 
          maxWidth: 'calc(100vw - 32px)' 
        }}
      >
        <div className="max-h-72 flex flex-col text-xs">
          {/* Compact Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-gray-500" />
              <span className="font-medium text-gray-900">{formatTime(snapshot.timestamp)}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-600">{snapshot.position_count} pos</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 hover:bg-gray-100"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Compact P&L and Underlying */}
          <div className="px-3 py-2 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PnlIcon className={`h-3 w-3 ${pnlColor}`} />
                <span className="text-gray-600">P&L:</span>
                <span className={`font-semibold ${pnlColor}`}>
                  {formatCurrency(snapshot.total_pnl)}
                </span>
              </div>
              {snapshot.underlying_price && (
                <div className="flex items-center gap-2">
                  <Activity className="h-3 w-3 text-gray-500" />
                  <span className="text-gray-600">Spot:</span>
                  <span className="font-mono font-medium">
                    {formatNumber(snapshot.underlying_price)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Compact View Mode Tabs */}
          <div className="flex border-b border-gray-200">
            {viewModes.map((mode) => (
              <button
                key={mode.type}
                onClick={() => onViewModeChange(mode.type)}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === mode.type
                    ? 'border-b-2 border-primary-500 text-primary-600 bg-primary-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Compact Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {viewMode === 'default' && (
              <DefaultView snapshot={snapshot} />
            )}
            {viewMode === 'expanded' && (
              <ExpandedView snapshot={snapshot} />
            )}
            {viewMode === 'delta' && (
              <DeltaView snapshot={snapshot} />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function DefaultView({ snapshot }: { snapshot: SnapshotData }) {
  return (
    <div className="p-2 space-y-1">
      {snapshot.positions.map((position) => (
        <div
          key={position.instrument_id}
          className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
        >
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {position.instrument.symbol}
            </div>
            <div className="text-xs text-gray-500">
              {position.instrument.type} {position.instrument.strike}
            </div>
          </div>
          <div className="text-right ml-2">
            <div className="font-medium">
              {position.quantity} @ {formatNumber(position.last_price, { maximumFractionDigits: 1 })}
            </div>
            <div className={`text-xs ${getPnlColor(position.unbooked_pnl)}`}>
              {formatCurrency(position.unbooked_pnl, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpandedView({ snapshot }: { snapshot: SnapshotData }) {
  return (
    <div className="p-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-1 px-1">Symbol</th>
              <th className="text-right py-1 px-1">Qty</th>
              <th className="text-right py-1 px-1">Avg</th>
              <th className="text-right py-1 px-1">LTP</th>
              <th className="text-right py-1 px-1">P&L</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.positions.map((position) => (
              <tr key={position.instrument_id} className="border-b border-gray-100">
                <td className="py-1 px-1">
                  <div className="font-medium truncate">{position.instrument.symbol}</div>
                  <div className="text-xs text-gray-500">
                    {position.instrument.type} {position.instrument.strike}
                  </div>
                </td>
                <td className="text-right py-1 px-1">{position.quantity}</td>
                <td className="text-right py-1 px-1 font-mono">
                  {formatNumber(position.avg_price, { maximumFractionDigits: 1 })}
                </td>
                <td className="text-right py-1 px-1 font-mono">
                  {formatNumber(position.last_price, { maximumFractionDigits: 1 })}
                </td>
                <td className={`text-right py-1 px-1 ${getPnlColor(position.unbooked_pnl)}`}>
                  {formatCurrency(position.unbooked_pnl, { maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeltaView({ snapshot }: { snapshot: SnapshotData }) {
  if (!snapshot.trade_marker || snapshot.trade_marker.type === 'none') {
    return (
      <div className="p-3 text-center text-gray-500 text-xs">
        No position changes
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      <div className="font-medium text-gray-900 mb-2 text-xs">
        {snapshot.trade_marker.summary}
      </div>
      
      {snapshot.trade_marker.changes.map((change, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
        >
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {change.instrument_symbol}
            </div>
            <div className="text-xs text-gray-500 capitalize">
              {change.change_type.replace('_', ' ')}
            </div>
          </div>
          <div className="text-right ml-2">
            {change.change_type === 'quantity_change' && (
              <div className="text-xs">
                <span className="font-mono">
                  {change.old_quantity} → {change.new_quantity}
                </span>
              </div>
            )}
            {change.change_type === 'new' && (
              <div className="text-xs text-success-600 font-medium">
                +{change.new_quantity} NEW
              </div>
            )}
            {change.change_type === 'closed' && (
              <div className="text-xs text-error-600 font-medium">
                -{change.old_quantity} CLOSED
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}