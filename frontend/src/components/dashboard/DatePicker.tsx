import { Calendar } from 'lucide-react';
import { Select } from '@/components/ui/select';
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
  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-gray-500" />
      <Select
        value={selectedDate}
        onChange={(e) => onDateChange(e.target.value)}
        disabled={disabled}
        className="min-w-[140px]"
      >
        {availableDates.map((date, index) => (
          <option key={`${date}-${index}`} value={date}>
            {formatDate(date)}
          </option>
        ))}
      </Select>
    </div>
  );
}