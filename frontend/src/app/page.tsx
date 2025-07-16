'use client';

import { TradingChart } from '@/components/chart/TradingChart';
import { ControlPanel } from '@/components/dashboard/ControlPanel';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useStore } from '@/store/useStore';
import { useTradingData } from '@/hooks/useTradingData';
import { AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { chartSettings, error } = useStore();
  const { loading } = useTradingData();

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-error-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Data
          </h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${chartSettings.isFullscreen ? 'fixed inset-0 z-50' : 'p-4'}`}>
      {/* Chart Container */}
      <div className={`flex-1 ${chartSettings.isFullscreen ? 'mb-20' : 'mb-4'}`}>
        <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200">
          <TradingChart />
        </div>
      </div>

      {/* Control Panel */}
      <div className={chartSettings.isFullscreen ? 'fixed bottom-4 left-4 right-4 z-60' : ''}>
        <ControlPanel />
      </div>
    </div>
  );
}
