import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

interface DatePickerProps {
  selectedDate: string;
  availableDates: string[];
  onDateChange: (date: string) => void;
  disabled?: boolean;
}

export function DatePicker({
  selectedDate,
  availableDates,
  onDateChange,
  disabled = false,
}: DatePickerProps) {
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

  const handleDateSelect = (date: string) => {
    onDateChange(date);
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

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
      <Button
        ref={buttonRef}
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={disabled}
        className="h-8 px-3 w-32 sm:w-40 justify-between text-sm"
      >
        <span className="truncate">{formatDate(selectedDate)}</span>
        <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
      </Button>

      {isOpen && buttonRect && createPortal(
        <div 
          className="fixed w-64 bg-white border border-gray-200 rounded-md shadow-lg p-2" 
          style={{ 
            zIndex: 999999,
            left: buttonRect.left,
            top: buttonRect.top - 85, // Position above the button
          }}
          ref={dropdownRef}
        >
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-sm">Select Date</h4>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
            {availableDates.map((date) => (
              <button
                key={date}
                onClick={() => handleDateSelect(date)}
                className={`w-full text-left p-2 rounded-md hover:bg-gray-100 text-sm ${
                  date === selectedDate ? 'bg-primary-50 text-primary-700 font-medium' : ''
                }`}
              >
                {formatDate(date)}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}