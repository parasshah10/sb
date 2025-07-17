// Utility functions for handling option types

/**
 * Normalize option type to standard format (CE/PE)
 * Handles both "Call"/"Put" and "CE"/"PE" formats
 */
export function normalizeOptionType(type: string): 'CE' | 'PE' | string {
  const normalized = type.toUpperCase().trim();
  
  if (normalized === 'CALL' || normalized === 'CE') {
    return 'CE';
  }
  if (normalized === 'PUT' || normalized === 'PE') {
    return 'PE';
  }
  
  // Return original if not recognized
  return type;
}

/**
 * Get display name for option type
 */
export function getOptionTypeDisplay(type: string): string {
  const normalized = normalizeOptionType(type);
  return normalized;
}

/**
 * Get color class for option type
 */
export function getOptionTypeColor(type: string): string {
  const normalized = normalizeOptionType(type);
  if (normalized === 'CE') return 'text-blue-600';
  if (normalized === 'PE') return 'text-red-600';
  return 'text-gray-900';
}

/**
 * Compare option types for sorting (PUTs first, then CALLs)
 */
export function compareOptionTypes(typeA: string, typeB: string): number {
  const normalizedA = normalizeOptionType(typeA);
  const normalizedB = normalizeOptionType(typeB);
  
  if (normalizedA !== normalizedB) {
    if (normalizedA === 'PE' && normalizedB === 'CE') return -1;
    if (normalizedA === 'CE' && normalizedB === 'PE') return 1;
  }
  return 0;
}