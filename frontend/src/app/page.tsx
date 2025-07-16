'use client';

import { TradingChart } from '@/components/chart/TradingChart';
import { ControlPanel } from '@/components/dashboard/ControlPanel';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useStore } from '@/store/useStore';
import { useTradingData } from '@/hooks/useTradingData';
import { AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { error } = useStore();
  const { loading } = useTradingData();

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
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
    <div className="h-screen overflow-hidden flex flex-col">
      {/* Chart Container - Takes remaining space */}
      <div className="flex-1 min-h-0 relative bg-white">
        <TradingChart />
      </div>

      {/* Control Panel - Fixed height at bottom */}
      <div className="flex-shrink-0 p-2 sm:p-4 bg-gray-50">
        <ControlPanel />
      </div>
    </div>
  );
}