import { TradingDayData, DaySummary } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  
  if (!response.ok) {
    throw new ApiError(
      `API request failed: ${response.statusText}`,
      response.status
    );
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new ApiError(data.error || 'API request failed', response.status);
  }
  
  return data.data;
}

export const api = {
  async getTradingDays(): Promise<{ available_dates: string[]; total_days: number }> {
    return fetchApi('/trading-days');
  },
  
  async getTradingDayData(date: string): Promise<TradingDayData> {
    return fetchApi(`/data/${date}`);
  },
  
  async getDaySummary(date: string): Promise<DaySummary> {
    return fetchApi(`/data/${date}/summary`);
  },
  
  async healthCheck(): Promise<{ status: string; available_days: number }> {
    return fetchApi('/health');
  },
};