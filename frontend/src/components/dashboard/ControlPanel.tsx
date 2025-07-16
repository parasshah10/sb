import { Button } from '@/components/ui/button';
import { DatePicker } from './DatePicker';
import { DaySummary } from './DaySummary';
import { useStore } from '@/store/useStore';
import { useTradingData } from '@/hooks/useTradingData';
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  Eye,
  EyeOff,
  Target,
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
    <div className="glass-effect rounded-lg p-4 border border-gray-200/50">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left side - Date picker and summary */}
        <div className="flex items-center gap-6">
          <DatePicker
            selectedDate={selectedDate}
            availableDates={tradingDays}
            onDateChange={setSelectedDate}
            disabled={loading}
          />
          
          {currentData?.summary && (
            <DaySummary summary={currentData.summary} />
          )}
        </div>
        
        {/* Right side - Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant={chartSettings.showUnderlying ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              updateChartSettings({
                showUnderlying: !chartSettings.showUnderlying,
              })
            }
            className="flex items-center gap-2"
          >
            {chartSettings.showUnderlying ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            Underlying
          </Button>
          
          <Button
            variant={chartSettings.showTradeMarkers ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              updateChartSettings({
                showTradeMarkers: !chartSettings.showTradeMarkers,
              })
            }
            className="flex items-center gap-2"
          >
            {chartSettings.showTradeMarkers ? (
              <Target className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            Trades
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateChartSettings({
                isFullscreen: !chartSettings.isFullscreen,
              })
            }
            className="flex items-center gap-2"
          >
            {chartSettings.isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {chartSettings.isFullscreen ? 'Exit' : 'Full'}
          </Button>
        </div>
      </div>
    </div>
  );
}