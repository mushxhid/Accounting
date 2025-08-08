// Currency conversion utility
export interface CurrencyRate {
  PKR: number;
  USD: number;
  lastUpdated: string;
}

// Cache for currency rates to avoid too many API calls
let rateCache: CurrencyRate | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const fetchPKRtoUSDRate = async (): Promise<number> => {
  try {
    // Check if we have a cached rate that's still valid
    if (rateCache && (Date.now() - new Date(rateCache.lastUpdated).getTime()) < CACHE_DURATION) {
      return rateCache.PKR;
    }

    // Fetch current exchange rate from a free API
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rate');
    }

    const data = await response.json();
    const pkrRate = data.rates.PKR;

    // Cache the rate
    rateCache = {
      PKR: pkrRate,
      USD: 1,
      lastUpdated: new Date().toISOString()
    };

    return pkrRate;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    
    // Fallback to a reasonable rate if API fails
    // You can update this fallback rate as needed
    const fallbackRate = 280; // Approximate PKR to USD rate
    
    rateCache = {
      PKR: fallbackRate,
      USD: 1,
      lastUpdated: new Date().toISOString()
    };

    return fallbackRate;
  }
};

export const convertPKRtoUSD = (pkrAmount: number, rate: number): number => {
  return pkrAmount / rate;
};

export const convertUSDtoPKR = (usdAmount: number, rate: number): number => {
  return usdAmount * rate;
};

export const formatPKR = (amount: number): string => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Special function for formatting exchange rates with decimal precision
export const formatExchangeRate = (rate: number): string => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(rate);
};

export const formatUSD = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};
