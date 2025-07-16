import { DaySummary as DaySummaryType } from '@/types';
import { formatCurrency, formatNumber, getPnlColor } from '@/lib/utils';
import { TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';

interface DaySummaryProps {
  summary: DaySummaryType;
}

export function DaySummary({ summary }: DaySummaryProps) {
  const pnlColor = getPnlColor(summary.final_pnl);
  const PnlIcon = summary.final_pnl >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <PnlIcon className={`h-4 w-4 ${pnlColor}`} />
        <span className="text-gray-600">P&L:</span>
        <span className={`font-semibold ${pnlColor}`}>
          {formatCurrency(summary.final_pnl)}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-gray-500" />
        <span className="text-gray-600">Trades:</span>
        <span className="font-medium">{summary.total_trades}</span>
      </div>
      
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-gray-500" />
        <span className="text-gray-600">
          {summary.market_open} - {summary.market_close}
        </span>
      </div>
      
      {summary.underlying_range && (
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Range:</span>
          <span className="font-mono text-xs">
            {formatNumber(summary.underlying_range.min)} - {formatNumber(summary.underlying_range.max)}
          </span>
        </div>
      )}
    </div>
  );
}