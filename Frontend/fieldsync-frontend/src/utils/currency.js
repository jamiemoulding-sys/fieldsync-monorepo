// Currency configuration for international pricing
export const CURRENCIES = {
  GBP: {
    symbol: '£',
    code: 'GBP',
    name: 'British Pound',
    pricePerEmployee: 24.99, // £24.99 per employee
    locale: 'en-GB'
  },
  USD: {
    symbol: '$',
    code: 'USD', 
    name: 'US Dollar',
    pricePerEmployee: 29.99, // $29.99 per employee
    locale: 'en-US'
  },
  EUR: {
    symbol: '€',
    code: 'EUR',
    name: 'Euro', 
    pricePerEmployee: 27.99, // €27.99 per employee
    locale: 'de-DE'
  },
  CAD: {
    symbol: 'C$',
    code: 'CAD',
    name: 'Canadian Dollar',
    pricePerEmployee: 39.99, // C$39.99 per employee
    locale: 'en-CA'
  },
  AUD: {
    symbol: 'A$',
    code: 'AUD',
    name: 'Australian Dollar',
    pricePerEmployee: 44.99, // A$44.99 per employee
    locale: 'en-AU'
  },
  JPY: {
    symbol: '¥',
    code: 'JPY',
    name: 'Japanese Yen',
    pricePerEmployee: 4500, // ¥4500 per employee
    locale: 'ja-JP'
  }
};

// Default currency (can be changed based on user location or preference)
export const DEFAULT_CURRENCY = 'GBP';

// Format price with currency
export const formatPrice = (amount, currencyCode = DEFAULT_CURRENCY) => {
  const currency = CURRENCIES[currencyCode] || CURRENCIES[DEFAULT_CURRENCY];
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Get currency info
export const getCurrencyInfo = (currencyCode = DEFAULT_CURRENCY) => {
  return CURRENCIES[currencyCode] || CURRENCIES[DEFAULT_CURRENCY];
};
