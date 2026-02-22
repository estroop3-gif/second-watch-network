import { useAuth } from '@/context/AuthContext';
import { useEnrichedProfileSafe } from '@/context/EnrichedProfileContext';
import { PERMISSIONS, requirePerm, listPermissionsForRoles, PermKey } from '@/lib/permissions';

export const usePermissions = () => {
  const { session, loading: authLoading } = useAuth();
  const enrichedProfile = useEnrichedProfileSafe();

  const rolesFromMeta = (session?.user?.user_metadata?.roles as string[]) || [];
  const legacyRole = session?.user?.user_metadata?.role as string | undefined;

  // Combine roles array with legacy single role for compatibility
  const userRolesSet = new Set<string>(rolesFromMeta);
  if (legacyRole && !userRolesSet.has(legacyRole)) {
    userRolesSet.add(legacyRole);
  }

  // Also add roles from the database profile
  if (enrichedProfile.profile) {
    if (enrichedProfile.isSuperadmin) userRolesSet.add('superadmin');
    if (enrichedProfile.isAdmin) userRolesSet.add('admin');
    if (enrichedProfile.isPremium) userRolesSet.add('premium');
    if (enrichedProfile.isFilmmaker) userRolesSet.add('filmmaker');
    if (enrichedProfile.isPartner) userRolesSet.add('partner');
    if (enrichedProfile.isOrderMember) userRolesSet.add('order_member');
    if (enrichedProfile.isLodgeOfficer) userRolesSet.add('lodge_officer');
    if (enrichedProfile.isModerator) userRolesSet.add('moderator');
    if (enrichedProfile.isSalesAdmin) userRolesSet.add('sales_admin');
    if (enrichedProfile.isSalesAgent) userRolesSet.add('sales_agent');
    if (enrichedProfile.isSalesRep) userRolesSet.add('sales_rep');
    if (enrichedProfile.isMediaTeam) userRolesSet.add('media_team');
  }

  const roles = Array.from(userRolesSet);

  const hasRole = (role: string): boolean => {
    if (authLoading) return false;
    return userRolesSet.has(role);
  };

  const hasAnyRole = (requiredRoles: string[]): boolean => {
    if (authLoading) return false;
    return requiredRoles.some(role => userRolesSet.has(role));
  };

  const hasAllRoles = (requiredRoles: string[]): boolean => {
    if (authLoading) return false;
    return requiredRoles.every(role => userRolesSet.has(role));
  };

  const hasPermission = (perm: PermKey): boolean => {
    if (authLoading) return false;
    return requirePerm(roles, perm);
  };

  const derivedPermissions = Array.from(listPermissionsForRoles(roles));

  return {
    isLoading: authLoading,
    roles,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    hasPermission,
    permissions: derivedPermissions,
    PERMISSIONS, // optional export for UI if needed
  };
};