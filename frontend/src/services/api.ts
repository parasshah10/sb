import { TradingDayData, DaySummary, FilterOption } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, params?: URLSearchParams): Promise<T> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    url.search = params.toString();
  }
  
  const response = await fetch(url.toString());
  
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
  
  async getAvailableFilters(date: string): Promise<{ filters: FilterOption[] }> {
    return fetchApi(`/data/${date}/filters`);
  },

  async getTradingDayData(date: string, filters?: string[]): Promise<TradingDayData> {
    const params = new URLSearchParams();
    if (filters && filters.length > 0) {
      filters.forEach(f => params.append('filters', f));
    }
    return fetchApi(`/data/${date}`, params);
  },
  
  async getDaySummary(date: string): Promise<DaySummary> {
    return fetchApi(`/data/${date}/summary`);
  },
  
  async healthCheck(): Promise<{ status: string; available_days: number }> {
    return fetchApi('/health');
  },

  async refreshCache(): Promise<{ cache_cleared: boolean }> {
    const response = await fetch(`${API_BASE_URL}/refresh-cache`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new ApiError(
        `Cache refresh failed: ${response.statusText}`,
        response.status
      );
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new ApiError(data.error || 'Cache refresh failed', response.status);
    }
    
    return data.data;
  },
};