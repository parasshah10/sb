import { Button } from '@/components/ui/button';
import { DatePicker } from './DatePicker';
import { DaySummary } from './DaySummary';
import { FilterControl } from './FilterControl';
import { UnderlyingSelector } from './UnderlyingSelector';
import { useStore } from '@/store/useStore';
import { useTradingData } from '@/hooks/useTradingData';
import {
  RefreshCw,
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
    <div className="glass-effect rounded-lg p-2 sm:p-3 border border-gray-200/50 max-w-full">
      {/* Mobile Layout - Stack vertically */}
      <div className="block sm:hidden space-y-2">
        {/* Top row - Date and Filter 50/50 split */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <DatePicker
              selectedDate={selectedDate}
              availableDates={tradingDays}
              onDateChange={setSelectedDate}
              disabled={loading}
            />
          </div>
          <div className="flex-1">
            <FilterControl />
          </div>
        </div>
        
        {/* Bottom row - Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={loading}
              className="h-7 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
            <UnderlyingSelector />
            
            <Button
              variant={chartSettings.showTradeMarkers ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                updateChartSettings({
                  showTradeMarkers: !chartSettings.showTradeMarkers,
                })
              }
              className="h-7 px-2"
            >
              {chartSettings.showTradeMarkers ? (
                <Target className="h-3 w-3" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
            </Button>
          </div>
          
          {/* Mobile summary - inline */}
          {currentData?.summary && (
            <div className="text-xs">
              <DaySummary summary={currentData.summary} />
            </div>
          )}
        </div>
      </div>

      {/* Desktop Layout - Single row */}
      <div className="hidden sm:flex items-center justify-between gap-2">
        {/* Left side - Date picker, filters, and summary */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <DatePicker
              selectedDate={selectedDate}
              availableDates={tradingDays}
              onDateChange={setSelectedDate}
              disabled={loading}
            />
            
            <FilterControl />
          </div>

          {currentData?.summary && (
            <div className="hidden md:block">
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
          
          <UnderlyingSelector />
          
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
      
      {/* Desktop mobile summary */}
      {currentData?.summary && (
        <div className="hidden sm:block md:hidden mt-2 pt-2 border-t border-gray-200">
          <DaySummary summary={currentData.summary} />
        </div>
      )}
    </div>
  );
}