/**
 * User Badge System
 * Centralized badge definitions and helpers for displaying user roles.
 *
 * Badge Hierarchy (descending priority):
 * 1. Superadmin - "SUPERADMIN" (red/gold gradient)
 * 2. Admin - "ADMIN" (yellow)
 * 3. Moderator - "MOD" (purple)
 * 4. Lodge Officer - "LODGE OFFICER" (gold)
 * 5. Order Member - "ORDER" (emerald)
 * 6. Partner - "PARTNER" (blue)
 * 7. Filmmaker - "FILMMAKER" (accent-yellow)
 * 8. Premium - "PREMIUM" (purple/pink gradient)
 * 9. Free - "FREE" (gray)
 */

export type RoleType =
  | 'superadmin'
  | 'admin'
  | 'moderator'
  | 'lodge_officer'
  | 'order_member'
  | 'partner'
  | 'filmmaker'
  | 'premium'
  | 'free';

export interface BadgeConfig {
  role: RoleType;
  label: string;
  shortLabel: string;
  cssClass: string;
  priority: number;
  description: string;
}

// Badge configurations in priority order
// Each role has a distinct color scheme for visual clarity
export const BADGE_CONFIGS: Record<RoleType, BadgeConfig> = {
  superadmin: {
    role: 'superadmin',
    label: 'Superadmin',
    shortLabel: 'SUPERADMIN',
    cssClass: 'bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold shadow-lg shadow-red-500/30',
    priority: 1,
    description: 'System administrator with full access',
  },
  admin: {
    role: 'admin',
    label: 'Admin',
    shortLabel: 'ADMIN',
    cssClass: 'bg-amber-500 text-charcoal-black font-bold',
    priority: 2,
    description: 'Platform administrator',
  },
  moderator: {
    role: 'moderator',
    label: 'Moderator',
    shortLabel: 'MOD',
    cssClass: 'bg-violet-600 text-white font-bold',
    priority: 3,
    description: 'Content and community moderator',
  },
  lodge_officer: {
    role: 'lodge_officer',
    label: 'Lodge Officer',
    shortLabel: 'LODGE OFFICER',
    cssClass: 'bg-gradient-to-r from-amber-600 to-yellow-400 text-charcoal-black font-bold',
    priority: 4,
    description: 'Order lodge leadership',
  },
  order_member: {
    role: 'order_member',
    label: 'Order Member',
    shortLabel: 'ORDER',
    cssClass: 'bg-emerald-600 text-white font-bold',
    priority: 5,
    description: 'Member of The Second Watch Order',
  },
  partner: {
    role: 'partner',
    label: 'Partner',
    shortLabel: 'PARTNER',
    cssClass: 'bg-sky-500 text-white font-bold',
    priority: 6,
    description: 'Business partner or sponsor',
  },
  filmmaker: {
    role: 'filmmaker',
    label: 'Filmmaker',
    shortLabel: 'FILMMAKER',
    cssClass: 'bg-rose-500 text-white font-bold',
    priority: 7,
    description: 'Verified content creator',
  },
  premium: {
    role: 'premium',
    label: 'Premium',
    shortLabel: 'PREMIUM',
    cssClass: 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold',
    priority: 8,
    description: 'Premium subscriber',
  },
  free: {
    role: 'free',
    label: 'Free',
    shortLabel: 'FREE',
    cssClass: 'bg-slate-600 text-slate-200',
    priority: 9,
    description: 'Free tier member',
  },
};

// Role hierarchy (lower index = higher priority)
export const ROLE_HIERARCHY: RoleType[] = [
  'superadmin',
  'admin',
  'moderator',
  'lodge_officer',
  'order_member',
  'partner',
  'filmmaker',
  'premium',
  'free',
];

// Map of profile fields to role types
export const PROFILE_ROLE_FIELDS: Record<string, RoleType> = {
  is_superadmin: 'superadmin',
  is_admin: 'admin',
  is_moderator: 'moderator',
  is_lodge_officer: 'lodge_officer',
  is_order_member: 'order_member',
  is_partner: 'partner',
  is_filmmaker: 'filmmaker',
  is_premium: 'premium',
};

/**
 * Profile interface with role boolean fields
 */
export interface ProfileWithRoles {
  id?: string;
  email?: string;
  username?: string;
  full_name?: string;
  role?: string; // Legacy role field
  is_superadmin?: boolean;
  is_admin?: boolean;
  is_moderator?: boolean;
  is_order_member?: boolean;
  is_lodge_officer?: boolean;
  is_partner?: boolean;
  is_filmmaker?: boolean;
  is_premium?: boolean;
  has_completed_filmmaker_onboarding?: boolean;
  [key: string]: unknown;
}

/**
 * Extract active roles from a profile object.
 */
export function getActiveRolesFromProfile(profile: ProfileWithRoles | null): Set<RoleType> {
  if (!profile) {
    return new Set(['free']);
  }

  const activeRoles = new Set<RoleType>();

  // Check boolean role fields
  for (const [field, role] of Object.entries(PROFILE_ROLE_FIELDS)) {
    if (profile[field] === true) {
      activeRoles.add(role);
    }
  }

  // Also check legacy 'role' field for backwards compatibility
  const legacyRole = profile.role;
  if (legacyRole) {
    const legacyMap: Record<string, RoleType> = {
      admin: 'admin',
      moderator: 'moderator',
      partner: 'partner',
      filmmaker: 'filmmaker',
      premium: 'premium',
      free: 'free',
    };
    if (legacyRole in legacyMap) {
      activeRoles.add(legacyMap[legacyRole]);
    }
  }

  // Everyone has at least FREE role
  if (activeRoles.size === 0) {
    activeRoles.add('free');
  }

  return activeRoles;
}

/**
 * Get the highest-priority role for display (badge) purposes.
 */
export function getPrimaryRole(profile: ProfileWithRoles | null): RoleType {
  const activeRoles = getActiveRolesFromProfile(profile);

  // Return highest priority role based on hierarchy
  for (const role of ROLE_HIERARCHY) {
    if (activeRoles.has(role)) {
      return role;
    }
  }

  return 'free';
}

/**
 * Get badge configuration for a role.
 */
export function getBadgeConfig(role: RoleType): BadgeConfig {
  return BADGE_CONFIGS[role] || BADGE_CONFIGS.free;
}

/**
 * Get the primary (highest priority) badge for a user profile.
 */
export function getPrimaryBadge(profile: ProfileWithRoles | null): BadgeConfig {
  const primaryRole = getPrimaryRole(profile);
  return getBadgeConfig(primaryRole);
}

/**
 * Get all badges for a user profile, sorted by priority.
 */
export function getAllBadges(profile: ProfileWithRoles | null): BadgeConfig[] {
  const activeRoles = getActiveRolesFromProfile(profile);
  const badges = Array.from(activeRoles).map(role => getBadgeConfig(role));
  return badges.sort((a, b) => a.priority - b.priority);
}

/**
 * Check if profile has a specific role.
 */
export function hasRole(profile: ProfileWithRoles | null, role: RoleType): boolean {
  const activeRoles = getActiveRolesFromProfile(profile);
  return activeRoles.has(role);
}

/**
 * Check if profile has any of the specified roles.
 */
export function hasAnyRole(profile: ProfileWithRoles | null, roles: RoleType[]): boolean {
  const activeRoles = getActiveRolesFromProfile(profile);
  return roles.some(role => activeRoles.has(role));
}

/**
 * Check if profile has all of the specified roles.
 */
export function hasAllRoles(profile: ProfileWithRoles | null, roles: RoleType[]): boolean {
  const activeRoles = getActiveRolesFromProfile(profile);
  return roles.every(role => activeRoles.has(role));
}

/**
 * Check if user is staff (superadmin, admin, or moderator).
 */
export function isStaff(profile: ProfileWithRoles | null): boolean {
  return hasAnyRole(profile, ['superadmin', 'admin', 'moderator']);
}

/**
 * Check if user is admin or superadmin.
 */
export function isAdminOrHigher(profile: ProfileWithRoles | null): boolean {
  return hasAnyRole(profile, ['superadmin', 'admin']);
}

/**
 * Check if user is superadmin (god mode).
 */
export function isSuperadmin(profile: ProfileWithRoles | null): boolean {
  return hasRole(profile, 'superadmin');
}

/**
 * Check if user can access Order features.
 */
export function canAccessOrder(profile: ProfileWithRoles | null): boolean {
  return hasAnyRole(profile, ['superadmin', 'admin', 'moderator', 'order_member', 'lodge_officer']);
}

/**
 * Check if user can manage lodge settings.
 */
export function canManageLodge(profile: ProfileWithRoles | null): boolean {
  return hasAnyRole(profile, ['superadmin', 'admin', 'lodge_officer']);
}

/**
 * Check if user can submit to Green Room.
 */
export function canSubmitToGreenroom(profile: ProfileWithRoles | null): boolean {
  return hasAnyRole(profile, ['superadmin', 'admin', 'filmmaker']);
}

/**
 * Check if user can vote in Green Room.
 */
export function canVoteInGreenroom(profile: ProfileWithRoles | null): boolean {
  return hasAnyRole(profile, ['superadmin', 'admin', 'moderator', 'partner', 'filmmaker', 'premium']);
}

/**
 * Check if user can access partner tools.
 */
export function canAccessPartnerTools(profile: ProfileWithRoles | null): boolean {
  return hasAnyRole(profile, ['superadmin', 'admin', 'partner']);
}
