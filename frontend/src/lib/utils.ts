import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(isoString: string) {
  return format(parseISO(isoString), 'HH:mm:ss');
}

export function formatDate(dateString: string, formatStr: string = 'dd MMM yyyy') {
  try {
    if (!dateString) return '';
    return format(parseISO(dateString), formatStr);
  } catch (e) {
    return dateString;
  }
}

function customCompactFormat(value: number, maximumFractionDigits: number = 2): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 10000000) { // 1 crore
    return `${sign}${(absValue / 10000000).toFixed(maximumFractionDigits).replace(/\.?0+$/, '')}Cr`;
  } else if (absValue >= 100000) { // 1 lakh
    return `${sign}${(absValue / 100000).toFixed(maximumFractionDigits).replace(/\.?0+$/, '')}L`;
  } else if (absValue >= 1000) {
    return `${sign}${(absValue / 1000).toFixed(maximumFractionDigits).replace(/\.?0+$/, '')}K`;
  } else {
    return value.toFixed(maximumFractionDigits).replace(/\.?0+$/, '');
  }
}

export function formatCurrency(
  value: number,
  options: { compact?: boolean; maximumFractionDigits?: number } = {}
) {
  const { compact = false, maximumFractionDigits = 2 } = options;
  
  if (compact) {
    return `₹${customCompactFormat(value, maximumFractionDigits)}`;
  }
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits,
  }).format(value);
}

export function formatNumber(
  value: number,
  options: { compact?: boolean; maximumFractionDigits?: number } = {}
) {
  const { compact = false, maximumFractionDigits = 2 } = options;
  
  if (compact) {
    return customCompactFormat(value, maximumFractionDigits);
  }
  
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(value);
}

export function getPnlColor(pnl: number) {
  if (pnl > 0) return 'text-success-600';
  if (pnl < 0) return 'text-error-600';
  return 'text-gray-700';
}