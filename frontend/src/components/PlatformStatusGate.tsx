import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import MaintenancePage from '@/pages/MaintenancePage';
import ComingSoonPage from '@/pages/ComingSoonPage';

const PlatformStatusGate = ({ children }: { children: React.ReactNode }) => {
  const { settings, isLoading: settingsLoading } = useSettings();
  const { session, loading: authLoading } = useAuth();

  const isLoading = settingsLoading || authLoading;

  if (isLoading) {
    return (
      <div className="bg-charcoal-black min-h-screen w-full flex items-center justify-center">
        <p className="text-accent-yellow font-spray text-2xl animate-pulse">Loading Platform...</p>
      </div>
    );
  }

  const isAdmin = session?.user?.user_metadata?.role === 'admin' || session?.user?.user_metadata?.roles?.includes('admin');

  // Admins can always access the site
  if (isAdmin) {
    return <>{children}</>;
  }

  const status = settings?.platform_status;

  if (status === 'maintenance') {
    return <MaintenancePage />;
  }

  if (status === 'coming_soon') {
    return <ComingSoonPage />;
  }

  return <>{children}</>;
};

export default PlatformStatusGate;