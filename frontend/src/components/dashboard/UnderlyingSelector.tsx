import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronDown, X, EyeOff } from 'lucide-react';

export function UnderlyingSelector() {
  const { availableUnderlyings, chartSettings, updateChartSettings, loading } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  const handleUnderlyingSelect = (underlying: string | null) => {
    updateChartSettings({ selectedUnderlying: underlying });
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (availableUnderlyings.length === 0) {
    return null;
  }

  const getButtonText = () => {
    if (!chartSettings.selectedUnderlying) return "No Spot";
    return chartSettings.selectedUnderlying;
  };

  const getButtonIcon = () => {
    if (!chartSettings.selectedUnderlying) {
      return <EyeOff className="h-3 w-3" />;
    }
    return <TrendingUp className="h-3 w-3" />;
  };

  const isActive = chartSettings.selectedUnderlying !== null;

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant={isActive ? 'default' : 'outline'}
        size="sm"
        onClick={handleToggle}
        disabled={loading}
        className="h-8 px-2 min-w-[80px] justify-between"
      >
        <div className="flex items-center gap-1">
          {getButtonIcon()}
          <span className="hidden sm:inline ml-1 truncate">{getButtonText()}</span>
        </div>
        <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
      </Button>

      {isOpen && buttonRect && createPortal(
        <div 
          className="fixed w-48 bg-white border border-gray-200 rounded-md shadow-lg p-2" 
          style={{ 
            zIndex: 999999,
            left: buttonRect.left,
            top: buttonRect.top - 125, // Position above the button with optimal spacing
          }}
          ref={dropdownRef}
        >
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-sm">Spot Chart</h4>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
            {/* None option */}
            <button
              onClick={() => handleUnderlyingSelect(null)}
              className={`w-full text-left p-2 rounded-md hover:bg-gray-100 text-sm flex items-center gap-2 ${
                !chartSettings.selectedUnderlying ? 'bg-primary-50 text-primary-700 font-medium' : ''
              }`}
            >
              <EyeOff className="h-3 w-3" />
              <span>Hide Spot Chart</span>
            </button>
            
            {/* Underlying options */}
            {availableUnderlyings.map((underlying) => (
              <button
                key={underlying}
                onClick={() => handleUnderlyingSelect(underlying)}
                className={`w-full text-left p-2 rounded-md hover:bg-gray-100 text-sm flex items-center gap-2 ${
                  chartSettings.selectedUnderlying === underlying ? 'bg-primary-50 text-primary-700 font-medium' : ''
                }`}
              >
                <TrendingUp className="h-3 w-3" />
                <span>{underlying}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}