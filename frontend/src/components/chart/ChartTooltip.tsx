import { SnapshotData, ViewMode } from '@/types';
import { formatTime, formatCurrency, formatNumber, getPnlColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X, TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChartTooltipProps {
  snapshot: SnapshotData;
  position: { x: number; y: number };
  viewMode: ViewMode['type'];
  onClose: () => void;
  onViewModeChange: (mode: ViewMode['type']) => void;
}

export function ChartTooltip({
  snapshot,
  position,
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed z-50 chart-tooltip shadow-xl"
        style={{
          left: Math.min(position.x, window.innerWidth - 400),
          top: Math.min(position.y, window.innerHeight - 300),
        }}
      >
        <div className="w-96 max-h-80 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <div className="font-semibold text-gray-900">
                  {formatTime(snapshot.timestamp)}
                </div>
                <div className="text-sm text-gray-500">
                  {snapshot.position_count} positions
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* P&L and Underlying */}
          <div className="p-4 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <PnlIcon className={`h-4 w-4 ${pnlColor}`} />
                <div>
                  <div className="text-sm text-gray-600">Total P&L</div>
                  <div className={`font-semibold ${pnlColor}`}>
                    {formatCurrency(snapshot.total_pnl)}
                  </div>
                </div>
              </div>
              {snapshot.underlying_price && (
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-600">Underlying</div>
                    <div className="font-mono font-medium">
                      {formatNumber(snapshot.underlying_price)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex border-b border-gray-200">
            {viewModes.map((mode) => (
              <button
                key={mode.type}
                onClick={() => onViewModeChange(mode.type)}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === mode.type
                    ? 'border-b-2 border-primary-500 text-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Content */}
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
    <div className="p-4 space-y-3">
      {snapshot.positions.map((position) => (
        <div
          key={position.instrument_id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div className="flex-1">
            <div className="font-medium text-gray-900">
              {position.instrument.symbol}
            </div>
            <div className="text-sm text-gray-600">
              {position.instrument.type} {position.instrument.strike}
            </div>
          </div>
          <div className="text-right">
            <div className="font-medium">
              {position.quantity} @ {formatNumber(position.last_price)}
            </div>
            <div className={`text-sm ${getPnlColor(position.unbooked_pnl)}`}>
              {formatCurrency(position.unbooked_pnl)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpandedView({ snapshot }: { snapshot: SnapshotData }) {
  return (
    <div className="p-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2">Symbol</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Avg</th>
              <th className="text-right py-2">LTP</th>
              <th className="text-right py-2">P&L</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.positions.map((position) => (
              <tr key={position.instrument_id} className="border-b border-gray-100">
                <td className="py-2">
                  <div className="font-medium">{position.instrument.symbol}</div>
                  <div className="text-xs text-gray-500">
                    {position.instrument.type} {position.instrument.strike}
                  </div>
                </td>
                <td className="text-right py-2">{position.quantity}</td>
                <td className="text-right py-2 font-mono">
                  {formatNumber(position.avg_price)}
                </td>
                <td className="text-right py-2 font-mono">
                  {formatNumber(position.last_price)}
                </td>
                <td className={`text-right py-2 ${getPnlColor(position.unbooked_pnl)}`}>
                  {formatCurrency(position.unbooked_pnl)}
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
      <div className="p-4 text-center text-gray-500">
        No position changes at this time
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="font-medium text-gray-900 mb-3">
        {snapshot.trade_marker.summary}
      </div>
      
      {snapshot.trade_marker.changes.map((change, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div className="flex-1">
            <div className="font-medium text-gray-900">
              {change.instrument_symbol}
            </div>
            <div className="text-sm text-gray-600 capitalize">
              {change.change_type.replace('_', ' ')}
            </div>
          </div>
          <div className="text-right">
            {change.change_type === 'quantity_change' && (
              <div className="text-sm">
                <span className="text-gray-500">Qty:</span>{' '}
                <span className="font-mono">
                  {change.old_quantity} → {change.new_quantity}
                </span>
              </div>
            )}
            {change.change_type === 'new' && (
              <div className="text-sm text-success-600 font-medium">
                +{change.new_quantity} NEW
              </div>
            )}
            {change.change_type === 'closed' && (
              <div className="text-sm text-error-600 font-medium">
                -{change.old_quantity} CLOSED
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}