/**
 * Order Profile Settings API
 * Direct Supabase client for managing Order profile visibility settings
 */

import { supabase } from '@/integrations/supabase/client';
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Try to fetch existing settings
  const { data, error } = await supabase
    .from('order_profile_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching order profile settings:', error);
    return null;
  }

  // If settings exist, return them
  if (data) {
    return data as OrderProfileSettings;
  }

  // Create default settings for this user
  const { data: newSettings, error: insertError } = await supabase
    .from('order_profile_settings')
    .insert({
      user_id: user.id,
      ...DEFAULT_ORDER_PROFILE_SETTINGS,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error creating default order profile settings:', insertError);
    return null;
  }

  return newSettings as OrderProfileSettings;
}

/**
 * Update Order profile settings for the current user
 */
export async function updateOrderProfileSettings(
  updates: OrderProfileSettingsUpdate
): Promise<OrderProfileSettings | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Upsert the settings
  const { data, error } = await supabase
    .from('order_profile_settings')
    .upsert(
      {
        user_id: user.id,
        ...updates,
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error updating order profile settings:', error);
    throw new Error('Failed to update order profile settings');
  }

  return data as OrderProfileSettings;
}

/**
 * Get Order profile settings for a specific user (for viewing other profiles)
 * Returns null if the viewer doesn't have permission to see the settings
 */
export async function getOrderProfileSettingsForUser(
  userId: string
): Promise<OrderProfileSettings | null> {
  const { data, error } = await supabase
    .from('order_profile_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    // RLS will block access if user doesn't have permission
    return null;
  }

  return data as OrderProfileSettings | null;
}

/**
 * Check if the current user can view another user's Order section
 * based on visibility settings
 */
export async function canViewOrderSection(
  targetUserId: string,
  viewerIsOrderMember: boolean
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  // Owner can always see their own section
  if (user?.id === targetUserId) {
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
