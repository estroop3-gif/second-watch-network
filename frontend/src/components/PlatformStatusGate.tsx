import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import MaintenancePage from '@/pages/MaintenancePage';
import ComingSoonPage from '@/pages/ComingSoonPage';

/**
 * PlatformStatusGate - Controls access based on platform status
 *
 * IMPORTANT: This gate renders children immediately and doesn't block on auth loading.
 * This ensures fast perceived load times on mobile, especially during Lambda cold starts.
 *
 * The gate only blocks for:
 * - Maintenance mode (shows MaintenancePage)
 * - Coming soon mode (shows ComingSoonPage)
 *
 * Auth loading states are handled by individual pages/components, not here.
 */
const PlatformStatusGate = ({ children }: { children: React.ReactNode }) => {
  const { settings, isLoading: settingsLoading } = useSettings();
  const { session, loading: authLoading } = useAuth();

  // Check admin status - admins always get through
  const isAdmin = session?.user?.user_metadata?.role === 'admin' ||
                  session?.user?.user_metadata?.roles?.includes('admin');

  // Admins can always access the site immediately
  if (isAdmin) {
    return <>{children}</>;
  }

  // For non-admin users, only block if settings indicate maintenance/coming_soon
  // Don't block on settingsLoading - default to allowing access
  const status = settings?.platform_status;

  if (!settingsLoading && status === 'maintenance') {
    return <MaintenancePage />;
  }

  if (!settingsLoading && status === 'coming_soon') {
    return <ComingSoonPage />;
  }

  // CRITICAL: Don't block on auth loading - render children immediately
  // Individual pages handle their own loading states
  // This ensures the app shell appears quickly even during cold starts
  return <>{children}</>;
};

export default PlatformStatusGate;