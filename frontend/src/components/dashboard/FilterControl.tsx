import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Filter, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function FilterControl() {
  const { availableFilters, selectedFilters, setSelectedFilters, loading } = useStore();
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

  const handleFilterChange = (key: string) => {
    const newSelection = selectedFilters.includes(key)
      ? selectedFilters.filter((k) => k !== key)
      : [...selectedFilters, key];
    setSelectedFilters(newSelection);
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

  if (availableFilters.length === 0) {
    return null;
  }

  const getButtonText = () => {
    if (selectedFilters.length === 0) return "All Instruments";
    if (selectedFilters.length === 1) {
      const filter = availableFilters.find(f => f.key === selectedFilters[0]);
      return filter ? `${filter.underlying_symbol}` : "1 Selected";
    }
    return `${selectedFilters.length} Selected`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        ref={buttonRef}
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={loading}
        className="h-8 px-2 w-32 justify-start"
      >
        <Filter className="h-3 w-3 mr-2" />
        <span className="truncate">{getButtonText()}</span>
      </Button>

      {isOpen && buttonRect && createPortal(
        <div 
          className="fixed w-64 bg-white border border-gray-200 rounded-md shadow-lg p-2" 
          style={{ 
            zIndex: 999999,
            left: buttonRect.left,
            top: buttonRect.top - 150, // Position just above the button
          }}
          ref={dropdownRef}
        >
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-sm">Filter by</h4>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
            {availableFilters.length > 0 ? (
              availableFilters.map((filter) => (
                <label
                  key={filter.key}
                  className="flex items-center space-x-2 p-1.5 rounded-md hover:bg-gray-100 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFilters.includes(filter.key)}
                    onChange={() => handleFilterChange(filter.key)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">
                    {filter.underlying_symbol}
                    <span className="text-gray-500 ml-1">({filter.expiry})</span>
                  </span>
                </label>
              ))
            ) : (
              <div className="text-sm text-gray-500 p-2">No filters available</div>
            )}
          </div>
          
          <div className="mt-2 pt-2 border-t border-gray-200 flex gap-2">
            <Button size="sm" variant="link" onClick={() => setSelectedFilters([])} className="h-auto p-0 text-xs">
              Clear all
            </Button>
            <Button size="sm" variant="link" onClick={() => setSelectedFilters(availableFilters.map(f => f.key))} className="h-auto p-0 text-xs">
              Select all
            </Button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}