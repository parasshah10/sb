import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Hash, Package } from 'lucide-react';

export function DisplayModeToggle() {
  const { chartSettings, updateChartSettings, loadDisplayModeFromStorage, loading } = useStore();

  // Load saved preference from localStorage after hydration
  useEffect(() => {
    loadDisplayModeFromStorage();
  }, [loadDisplayModeFromStorage]);

  const handleToggle = () => {
    const newMode = chartSettings.displayMode === 'quantity' ? 'lots' : 'quantity';
    updateChartSettings({ displayMode: newMode });
  };

  const isLots = chartSettings.displayMode === 'lots';

  return (
    <Button
      variant={isLots ? 'default' : 'outline'}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="h-8 px-2 min-w-[70px]"
      title={`Switch to ${isLots ? 'Quantity' : 'Lots'} display`}
    >
      {isLots ? (
        <>
          <Package className="h-3 w-3" />
          <span className="hidden sm:inline ml-1">Lots</span>
        </>
      ) : (
        <>
          <Hash className="h-3 w-3" />
          <span className="hidden sm:inline ml-1">Qty</span>
        </>
      )}
    </Button>
  );
}