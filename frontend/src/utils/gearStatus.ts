/**
 * Utility functions for gear rental order and work order status handling
 */

export const RENTAL_ORDER_STATUSES = [
  'confirmed',
  'building',
  'packed',
  'ready_for_pickup',
  'picked_up',
  'in_use',
  'returned',
  'reconciling',
  'closed',
] as const;

export type RentalOrderStatus = typeof RENTAL_ORDER_STATUSES[number] | 'draft' | 'cancelled' | 'disputed';

/**
 * Get Tailwind classes for rental order status badge
 */
export function getRentalStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-500/20 text-gray-400',
    confirmed: 'bg-blue-500/20 text-blue-400',
    building: 'bg-orange-500/20 text-orange-400',
    packed: 'bg-yellow-500/20 text-yellow-400',
    ready_for_pickup: 'bg-teal-500/20 text-teal-400',
    picked_up: 'bg-purple-500/20 text-purple-400',
    in_use: 'bg-indigo-500/20 text-indigo-400',
    returned: 'bg-green-500/20 text-green-400',
    reconciling: 'bg-cyan-500/20 text-cyan-400',
    closed: 'bg-green-700/20 text-green-500',
    cancelled: 'bg-red-500/20 text-red-400',
    disputed: 'bg-orange-600/20 text-orange-500',
  };
  return colors[status] || colors.draft;
}

/**
 * Get human-readable label for rental order status
 */
export function getRentalStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    confirmed: 'Confirmed',
    building: 'Building',
    packed: 'Packed',
    ready_for_pickup: 'Ready for Pickup',
    picked_up: 'Picked Up',
    in_use: 'In Use',
    returned: 'Returned',
    reconciling: 'Reconciling',
    closed: 'Closed',
    cancelled: 'Cancelled',
    disputed: 'Disputed',
  };
  return labels[status] || status;
}

/**
 * Get the current status index in the progression timeline
 */
export function getCurrentStatusIndex(status: string): number {
  return RENTAL_ORDER_STATUSES.indexOf(status as any);
}

/**
 * Get Tailwind classes for work order status badge
 */
export function getWorkOrderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-500/20 text-gray-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    ready: 'bg-green-500/20 text-green-400',
    checked_out: 'bg-purple-500/20 text-purple-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };
  return colors[status] || colors.draft;
}

/**
 * Get human-readable label for work order status
 */
export function getWorkOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    in_progress: 'In Progress',
    ready: 'Ready',
    checked_out: 'Checked Out',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

/**
 * Calculate the number of days in a rental period (inclusive)
 */
export function calculateRentalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Get the number of days until a target date
 * Returns negative number if date is in the past
 */
export function getDaysUntil(date: string): number {
  const target = new Date(date);
  const now = new Date();
  // Set both to start of day for accurate day counting
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format a date string to a readable format
 */
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a date with time
 */
export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Get a relative time description (e.g., "in 3 days", "2 days ago")
 */
export function getRelativeTime(date: string): string {
  const daysUntil = getDaysUntil(date);

  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil === -1) return 'Yesterday';
  if (daysUntil > 1) return `in ${daysUntil} days`;
  return `${Math.abs(daysUntil)} days ago`;
}

/**
 * Check if a date is overdue (in the past)
 */
export function isOverdue(date: string): boolean {
  return getDaysUntil(date) < 0;
}
