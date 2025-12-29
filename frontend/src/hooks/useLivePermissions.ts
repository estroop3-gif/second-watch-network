/**
 * Live Permissions Hook
 * Fetches user's effective permissions from the database in real-time
 * based on their assigned roles.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface LivePermissions {
  user_id: string;
  roles: string[];
  permissions: Record<string, boolean>;
  profile_flags: Record<string, boolean>;
}

// Badge priority for display (highest to lowest)
const BADGE_PRIORITY = [
  'superadmin',
  'admin',
  'moderator',
  'lodge_officer',
  'order_member',
  'partner',
  'filmmaker',
  'premium',
  'free',
] as const;

export type BadgeType = typeof BADGE_PRIORITY[number];

export const useLivePermissions = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const isAuthenticated = !!session?.access_token;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['live-permissions'],
    queryFn: () => api.getMyPermissions(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // Consider stale after 30 seconds
    refetchInterval: 60 * 1000, // Refetch every 60 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permKey: string): boolean => {
    if (!data) return false;
    return data.permissions[permKey] === true;
  };

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = (permKeys: string[]): boolean => {
    if (!data) return false;
    return permKeys.some((key) => data.permissions[key] === true);
  };

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = (permKeys: string[]): boolean => {
    if (!data) return false;
    return permKeys.every((key) => data.permissions[key] === true);
  };

  /**
   * Get the user's highest priority badge for display
   */
  const getHighestBadge = (): BadgeType => {
    if (!data) return 'free';

    const flags = data.profile_flags;
    const roles = data.roles;

    // Check profile flags first
    if (flags.is_superadmin) return 'superadmin';
    if (flags.is_admin) return 'admin';
    if (flags.is_moderator) return 'moderator';
    if (flags.is_lodge_officer) return 'lodge_officer';
    if (flags.is_order_member) return 'order_member';
    if (flags.is_partner) return 'partner';
    if (flags.is_filmmaker) return 'filmmaker';
    if (flags.is_premium) return 'premium';

    // Check role names
    for (const badge of BADGE_PRIORITY) {
      if (roles.includes(badge)) return badge;
    }

    return 'free';
  };

  /**
   * Force refetch permissions (call after role changes)
   */
  const invalidatePermissions = () => {
    queryClient.invalidateQueries({ queryKey: ['live-permissions'] });
  };

  return {
    isLoading,
    error,
    data,
    permissions: data?.permissions || {},
    roles: data?.roles || [],
    profileFlags: data?.profile_flags || {},
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    highestBadge: getHighestBadge(),
    refetch,
    invalidatePermissions,
  };
};

/**
 * Badge display configuration
 */
export const BADGE_CONFIG: Record<BadgeType, { label: string; className: string }> = {
  superadmin: {
    label: 'Superadmin',
    className: 'bg-gradient-to-r from-red-600 to-amber-500 text-white',
  },
  admin: {
    label: 'Admin',
    className: 'bg-amber-500 text-black',
  },
  moderator: {
    label: 'Mod',
    className: 'bg-purple-600 text-white',
  },
  lodge_officer: {
    label: 'Officer',
    className: 'bg-gradient-to-r from-amber-400 to-amber-600 text-black',
  },
  order_member: {
    label: 'Order',
    className: 'bg-emerald-600 text-white',
  },
  partner: {
    label: 'Partner',
    className: 'bg-sky-500 text-white',
  },
  filmmaker: {
    label: 'Filmmaker',
    className: 'bg-rose-600 text-white',
  },
  premium: {
    label: 'Premium',
    className: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white',
  },
  free: {
    label: 'Member',
    className: 'bg-slate-600 text-white',
  },
};
