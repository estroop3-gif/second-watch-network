/**
 * Date utility functions that handle timezone issues correctly.
 *
 * Problem: When JavaScript parses "2025-02-06" it treats it as UTC midnight,
 * which can shift to the previous day in local time (e.g., Feb 5th at 7pm EST).
 *
 * Solution: Parse date-only strings as local dates, not UTC.
 */

import { format as dateFnsFormat, parseISO as dateFnsParseISO } from 'date-fns';

/**
 * Parse a date string as a local date (not UTC).
 * Handles both date-only (YYYY-MM-DD) and datetime (ISO) strings.
 *
 * @param dateStr - Date string in YYYY-MM-DD or ISO format
 * @returns Date object in local timezone
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();

  // If it's a date-only string (YYYY-MM-DD), parse as local date
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // If it contains time info, check if it has timezone
  // ISO strings with 'Z' or timezone offset should be parsed as-is
  if (dateStr.includes('T')) {
    // If no timezone indicator, treat as local
    if (!dateStr.includes('Z') && !dateStr.match(/[+-]\d{2}:\d{2}$/)) {
      // Local datetime string - parse components
      const [datePart, timePart] = dateStr.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes, seconds] = timePart.split(':').map(s => parseInt(s) || 0);
      return new Date(year, month - 1, day, hours, minutes, seconds);
    }
  }

  // Fall back to standard parsing for full ISO strings with timezone
  return new Date(dateStr);
}

/**
 * Safe wrapper around date-fns parseISO that handles date-only strings correctly.
 * Use this instead of parseISO from date-fns.
 */
export function parseISO(dateStr: string): Date {
  return parseLocalDate(dateStr);
}

/**
 * Format a date string for display.
 * Automatically handles timezone issues.
 *
 * @param dateStr - Date string in any format
 * @param formatStr - date-fns format string (default: 'MMM d, yyyy')
 * @returns Formatted date string
 */
export function formatDate(dateStr: string, formatStr: string = 'MMM d, yyyy'): string {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  return dateFnsFormat(date, formatStr);
}

/**
 * Format a date with time for display.
 *
 * @param dateStr - Date string in any format
 * @param formatStr - date-fns format string (default: 'MMM d, yyyy h:mm a')
 * @returns Formatted datetime string
 */
export function formatDateTime(dateStr: string, formatStr: string = 'MMM d, yyyy h:mm a'): string {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  return dateFnsFormat(date, formatStr);
}

/**
 * Format just the time portion.
 *
 * @param dateStr - Date string containing time
 * @param formatStr - date-fns format string (default: 'h:mm a')
 * @returns Formatted time string
 */
export function formatTime(dateStr: string, formatStr: string = 'h:mm a'): string {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  return dateFnsFormat(date, formatStr);
}

/**
 * Get today's date as YYYY-MM-DD string in local timezone.
 */
export function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Convert a Date object to YYYY-MM-DD string in local timezone.
 */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
