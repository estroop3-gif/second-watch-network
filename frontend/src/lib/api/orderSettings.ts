/**
 * Order Profile Settings API
 * Uses the backend API for managing Order profile visibility settings
 */

import { api, safeStorage } from '@/lib/api';
import {
  OrderProfileSettings,
  OrderProfileSettingsUpdate,
  DEFAULT_ORDER_PROFILE_SETTINGS,
} from './order';

/**
 * Get Order profile settings for the current user
 * Creates default settings if none exist
 */
export async function getOrderProfileSettings(): Promise<OrderProfileSettings | null> {
  try {
    const token = api.getToken();
    if (!token) return null;

    const data = await api.getOrderProfileSettings();
    return data as OrderProfileSettings;
  } catch (error) {
    console.error('Error fetching order profile settings:', error);
    return null;
  }
}

/**
 * Update Order profile settings for the current user
 */
export async function updateOrderProfileSettings(
  updates: OrderProfileSettingsUpdate
): Promise<OrderProfileSettings | null> {
  try {
    const token = api.getToken();
    if (!token) return null;

    const data = await api.updateOrderProfileSettings(updates);
    return data as OrderProfileSettings;
  } catch (error) {
    console.error('Error updating order profile settings:', error);
    throw new Error('Failed to update order profile settings');
  }
}

/**
 * Get Order profile settings for a specific user (for viewing other profiles)
 * Returns null if the viewer doesn't have permission to see the settings
 */
export async function getOrderProfileSettingsForUser(
  userId: string
): Promise<OrderProfileSettings | null> {
  try {
    const data = await api.getOrderProfileSettingsForUser(userId);
    return data as OrderProfileSettings | null;
  } catch (error) {
    // RLS will block access if user doesn't have permission
    return null;
  }
}

/**
 * Check if the current user can view another user's Order section
 * based on visibility settings
 */
export async function canViewOrderSection(
  targetUserId: string,
  viewerIsOrderMember: boolean
): Promise<boolean> {
  const token = api.getToken();

  // Get current user's profile ID to check if it's their own profile
  const currentProfileId = safeStorage.getItem('profile_id');

  // Owner can always see their own section
  if (currentProfileId === targetUserId) {
    return true;
  }

  // Get target user's settings
  const settings = await getOrderProfileSettingsForUser(targetUserId);

  if (!settings) {
    // No settings = use default (members-only)
    return viewerIsOrderMember;
  }

  switch (settings.public_visibility) {
    case 'public':
      return true;
    case 'members-only':
      return viewerIsOrderMember;
    case 'private':
      return false;
    default:
      return viewerIsOrderMember;
  }
}
