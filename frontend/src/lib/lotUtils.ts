// Lot size mapping for different underlyings
export const LOT_SIZES: Record<string, number> = {
  'NIFTY': 75,
  'BANKNIFTY': 15,
  'SENSEX': 20,
  'BANKEX': 15,
  'FINNIFTY': 40,
  'MIDCPNIFTY': 75,
  // Add more as needed
};

// Get lot size for an underlying, default to 1 if not found
export function getLotSize(underlying: string): number {
  return LOT_SIZES[underlying.toUpperCase()] || 1;
}

// Convert quantity to lots
export function quantityToLots(quantity: number, underlying: string): number {
  const lotSize = getLotSize(underlying);
  return Math.round(quantity / lotSize * 100) / 100; // Round to 2 decimal places
}

// Convert lots to quantity
export function lotsToQuantity(lots: number, underlying: string): number {
  const lotSize = getLotSize(underlying);
  return lots * lotSize;
}

// Format display based on mode
export function formatQuantityDisplay(
  quantity: number, 
  underlying: string, 
  mode: 'quantity' | 'lots'
): string {
  if (mode === 'lots') {
    const lots = quantityToLots(Math.abs(quantity), underlying);
    const sign = quantity < 0 ? '-' : '';
    return `${sign}${lots}`;
  }
  return quantity.toString();
}

// Format change display (for Delta tab)
export function formatChangeDisplay(
  oldQty: number,
  newQty: number,
  underlying: string,
  mode: 'quantity' | 'lots'
): { old: string; new: string; net: string } {
  if (mode === 'lots') {
    const oldLots = quantityToLots(Math.abs(oldQty), underlying);
    const newLots = quantityToLots(Math.abs(newQty), underlying);
    const netChange = newLots - oldLots;
    
    const oldSign = oldQty < 0 ? '-' : '';
    const newSign = newQty < 0 ? '-' : '';
    const netSign = netChange > 0 ? '+' : '';
    
    return {
      old: oldQty === 0 ? '0' : `${oldSign}${oldLots}`,
      new: newQty === 0 ? '0' : `${newSign}${newLots}`,
      net: `${netSign}${Math.abs(netChange)}`
    };
  }
  
  const netChange = newQty - oldQty;
  const netSign = netChange > 0 ? '+' : '';
  
  return {
    old: oldQty.toString(),
    new: newQty.toString(),
    net: `${netSign}${netChange}`
  };
}