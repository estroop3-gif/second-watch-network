import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS, requirePerm, listPermissionsForRoles, PermKey } from '@/lib/permissions';

export const usePermissions = () => {
  const { session, loading: authLoading } = useAuth();

  const rolesFromMeta = (session?.user?.user_metadata?.roles as string[]) || [];
  const legacyRole = session?.user?.user_metadata?.role as string | undefined;

  // Combine roles array with legacy single role for compatibility
  const userRolesSet = new Set<string>(rolesFromMeta);
  if (legacyRole && !userRolesSet.has(legacyRole)) {
    userRolesSet.add(legacyRole);
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