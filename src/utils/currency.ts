import { CurrencyConfig } from '../types';

export const DEFAULT_CURRENCY: CurrencyConfig = {
  code: 'INR',
  symbol: '₹',
  decimalPlaces: 2,
};

/**
 * Converts minor currency units (e.g., paise, cents) into human-readable currency string.
 * Uses Indian numbering format (e.g. ₹1,00,000.00) when currency is INR.
 */
export function formatCurrency(
  minorUnits: number,
  currency: CurrencyConfig = DEFAULT_CURRENCY,
  showSign: boolean = false
): string {
  if (isNaN(minorUnits)) {
    minorUnits = 0;
  }

  const isNegative = minorUnits < 0;
  const absUnits = Math.abs(minorUnits);
  const factor = Math.pow(10, currency.decimalPlaces);
  const major = Math.floor(absUnits / factor);
  const minor = absUnits % factor;

  const paddedMinor = currency.decimalPlaces > 0
    ? '.' + minor.toString().padStart(currency.decimalPlaces, '0')
    : '';

  // Use Indian English locale (en-IN) for INR to format as 1,00,000
  const locale = currency.code === 'INR' || currency.symbol === '₹' ? 'en-IN' : 'en-US';
  const formattedMajor = major.toLocaleString(locale);
  const formattedNumber = `${currency.symbol}${formattedMajor}${paddedMinor}`;

  if (isNegative) {
    return `-${formattedNumber}`;
  }
  if (showSign && minorUnits > 0) {
    return `+${formattedNumber}`;
  }
  return formattedNumber;
}

/**
 * Converts user input string safely to integer minor units (paise).
 * Eliminates floating point errors.
 */
export function parseCurrencyInput(
  input: string | number,
  decimalPlaces: number = 2
): number {
  if (typeof input === 'number') {
    return Math.round(input * Math.pow(10, decimalPlaces));
  }

  if (!input || typeof input !== 'string') {
    return 0;
  }

  // Remove commas, currency symbols, and extra spaces
  const sanitized = input.replace(/[^0-9.-]/g, '').trim();
  if (!sanitized || sanitized === '-' || sanitized === '.') {
    return 0;
  }

  const parts = sanitized.split('.');
  const sign = sanitized.startsWith('-') ? -1 : 1;
  const wholePartStr = parts[0].replace('-', '');
  const wholeUnits = parseInt(wholePartStr, 10) || 0;

  let minorUnits = 0;
  if (parts.length > 1 && decimalPlaces > 0) {
    const rawDecimal = parts[1].slice(0, decimalPlaces);
    const paddedDecimal = rawDecimal.padEnd(decimalPlaces, '0');
    minorUnits = parseInt(paddedDecimal, 10) || 0;
  }

  const factor = Math.pow(10, decimalPlaces);
  return sign * (wholeUnits * factor + minorUnits);
}

/**
 * Formats minor units for simple numeric input display without currency symbol.
 */
export function formatMinorUnitsForInput(
  minorUnits: number,
  decimalPlaces: number = 2
): string {
  if (minorUnits === 0) return '';
  const factor = Math.pow(10, decimalPlaces);
  return (minorUnits / factor).toFixed(decimalPlaces);
}
