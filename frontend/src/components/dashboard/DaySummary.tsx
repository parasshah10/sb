import { DaySummary as DaySummaryType } from '@/types';
import { formatCurrency, getPnlColor } from '@/lib/utils';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface DaySummaryProps {
  summary: DaySummaryType;
}

export function DaySummary({ summary }: DaySummaryProps) {
  const pnlColor = getPnlColor(summary.final_pnl);
  const PnlIcon = summary.final_pnl >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1.5">
        <PnlIcon className={`h-4 w-4 ${pnlColor}`} />
        <span className={`font-semibold ${pnlColor}`}>
          {formatCurrency(summary.final_pnl)}
        </span>
      </div>
      
      <div className="flex items-center gap-1.5">
        <Activity className="h-4 w-4 text-gray-500" />
        <span className="font-medium">{summary.total_trades} trades</span>
      </div>
    </div>
  );
}