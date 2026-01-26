/**
 * Rate parsing and formatting utilities for crew rates
 */

export type RatePeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'flat';

export interface ParsedRate {
  amount: number;
  period: RatePeriod;
}

/**
 * Parse a booking rate string into structured data
 * @param bookingRate - Rate string like "$500/daily", "$2000/weekly", "$50/hour", etc.
 * @returns Parsed rate object or null if invalid
 */
export function parseBookingRate(bookingRate: string): ParsedRate | null {
  if (!bookingRate || typeof bookingRate !== 'string') return null;

  // Trim whitespace
  const trimmed = bookingRate.trim();
  if (!trimmed) return null;

  // Parse "$500/daily" or "$500/day" or "$2000/weekly" or "$50" (flat) etc.
  // Handle variations: with/without $, with/without /, with/without spaces
  const match = trimmed.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)\s*\/?\s*(hourly|daily|weekly|monthly|flat|hour|day|week|month|hr|dy|wk|mo)?/i);

  if (!match) return null;

  // Parse amount - remove commas
  const amountStr = match[1].replace(/,/g, '');
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || amount < 0) return null;

  // Parse period - default to 'flat' if not specified
  const periodStr = (match[2] || 'flat').toLowerCase();

  // Normalize period variations
  const periodMap: Record<string, RatePeriod> = {
    'hourly': 'hourly', 'hour': 'hourly', 'hr': 'hourly', 'h': 'hourly',
    'daily': 'daily', 'day': 'daily', 'dy': 'daily', 'd': 'daily',
    'weekly': 'weekly', 'week': 'weekly', 'wk': 'weekly', 'w': 'weekly',
    'monthly': 'monthly', 'month': 'monthly', 'mo': 'monthly', 'm': 'monthly',
    'flat': 'flat', 'total': 'flat', 'project': 'flat',
  };

  const period = periodMap[periodStr] || 'flat';

  return { amount, period };
}

/**
 * Format a rate amount and period for display
 * @param amount - Rate amount in dollars
 * @param period - Rate period
 * @returns Formatted string like "$500/day" or "$2,000/week"
 */
export function formatRate(amount: number, period: RatePeriod): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  // Add period suffix
  const suffixMap: Record<RatePeriod, string> = {
    hourly: '/hr',
    daily: '/day',
    weekly: '/wk',
    monthly: '/mo',
    flat: '',
  };

  const suffix = suffixMap[period] || '';
  return `${formatted}${suffix}`;
}

/**
 * Validate a rate string format
 * @param rateStr - Rate string to validate
 * @returns True if valid format, false otherwise
 */
export function validateRateString(rateStr: string): boolean {
  if (!rateStr || typeof rateStr !== 'string') return false;
  const parsed = parseBookingRate(rateStr);
  return parsed !== null && parsed.amount > 0;
}

/**
 * Extract just the amount from a rate string
 * @param rateStr - Rate string like "$500/daily"
 * @returns Amount in dollars or null if invalid
 */
export function extractRateAmount(rateStr: string): number | null {
  const parsed = parseBookingRate(rateStr);
  return parsed ? parsed.amount : null;
}

/**
 * Extract just the period from a rate string
 * @param rateStr - Rate string like "$500/daily"
 * @returns Period or null if invalid
 */
export function extractRatePeriod(rateStr: string): RatePeriod | null {
  const parsed = parseBookingRate(rateStr);
  return parsed ? parsed.period : null;
}

/**
 * Normalize a rate string to standard format
 * @param rateStr - Rate string in any format
 * @returns Normalized string like "$500/day" or null if invalid
 */
export function normalizeRateString(rateStr: string): string | null {
  const parsed = parseBookingRate(rateStr);
  if (!parsed) return null;
  return formatRate(parsed.amount, parsed.period);
}
