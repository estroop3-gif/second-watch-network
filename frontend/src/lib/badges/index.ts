/**
 * Badge System Exports
 */
export {
  // Types
  type RoleType,
  type BadgeConfig,
  type ProfileWithRoles,
  // Constants
  BADGE_CONFIGS,
  ROLE_HIERARCHY,
  PROFILE_ROLE_FIELDS,
  // Core functions
  getActiveRolesFromProfile,
  getPrimaryRole,
  getBadgeConfig,
  getPrimaryBadge,
  getAllBadges,
  // Role checking functions
  hasRole,
  hasAnyRole,
  hasAllRoles,
  isStaff,
  isAdminOrHigher,
  isSuperadmin,
  // Permission checking functions
  canAccessOrder,
  canManageLodge,
  canSubmitToGreenroom,
  canVoteInGreenroom,
  canAccessPartnerTools,
} from './userBadges';
