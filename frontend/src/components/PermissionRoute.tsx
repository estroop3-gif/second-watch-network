import { usePermissions } from '@/hooks/usePermissions';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface PermissionRouteProps {
  requiredRoles: string[];
  redirectTo?: string;
}

const PermissionRoute = ({ requiredRoles, redirectTo = '/dashboard' }: PermissionRouteProps) => {
  const { session, loading: authLoading } = useAuth();
  const { hasAnyRole, isLoading: permissionsLoading } = usePermissions();
  const location = useLocation();

  const isLoading = authLoading || permissionsLoading;
  const hasPermission = hasAnyRole(requiredRoles);

  useEffect(() => {
    if (!isLoading && session && !hasPermission) {
      toast.error("Access Denied", {
        description: "You do not have the required permissions to view this page.",
      });
    }
  }, [isLoading, session, hasPermission]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="space-y-4 p-8 w-full max-w-md">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasPermission) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
};

export default PermissionRoute;