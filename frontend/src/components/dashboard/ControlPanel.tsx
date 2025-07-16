import { Button } from '@/components/ui/button';
import { DatePicker } from './DatePicker';
import { DaySummary } from './DaySummary';
import { useStore } from '@/store/useStore';
import { useTradingData } from '@/hooks/useTradingData';
import {
  RefreshCw,
  Eye,
  EyeOff,
  Target,
  Circle,
} from 'lucide-react';

export function ControlPanel() {
  const {
    selectedDate,
    chartSettings,
    currentData,
    loading,
    setSelectedDate,
    updateChartSettings,
  } = useStore();
  
  const { tradingDays, refreshData } = useTradingData();

  return (
    <div className="glass-effect rounded-lg p-3 border border-gray-200/50 max-w-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Left side - Date picker and summary */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <DatePicker
            selectedDate={selectedDate}
            availableDates={tradingDays}
            onDateChange={setSelectedDate}
            disabled={loading}
          />
          
          {currentData?.summary && (
            <div className="hidden sm:block">
              <DaySummary summary={currentData.summary} />
            </div>
          )}
        </div>
        
        {/* Right side - Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
            className="h-8 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-1">Refresh</span>
          </Button>
          
          <Button
            variant={chartSettings.showUnderlying ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              updateChartSettings({
                showUnderlying: !chartSettings.showUnderlying,
              })
            }
            className="h-8 px-2"
          >
            {chartSettings.showUnderlying ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
            <span className="hidden sm:inline ml-1">Spot</span>
          </Button>
          
          <Button
            variant={chartSettings.showTradeMarkers ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              updateChartSettings({
                showTradeMarkers: !chartSettings.showTradeMarkers,
              })
            }
            className="h-8 px-2"
          >
            {chartSettings.showTradeMarkers ? (
              <Target className="h-3 w-3" />
            ) : (
              <Circle className="h-3 w-3" />
            )}
            <span className="hidden sm:inline ml-1">Trades</span>
          </Button>
        </div>
      </div>
      
      {/* Mobile summary */}
      {currentData?.summary && (
        <div className="sm:hidden mt-2 pt-2 border-t border-gray-200">
          <DaySummary summary={currentData.summary} />
        </div>
      )}
    </div>
  );
}