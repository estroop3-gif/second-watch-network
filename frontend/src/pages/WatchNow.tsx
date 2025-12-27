import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { UpgradeGate } from '@/components/upgrade/UpgradeGateWrapper';

const WatchNow = () => {
  const { session, user, loading: authLoading } = useAuth();
  const { isLoading: permissionsLoading, hasPermission } = usePermissions();
  const navigate = useNavigate();

  const isLoading = authLoading || permissionsLoading;
  const canWatchPremium = useMemo(() => hasPermission('watch_now_premium'), [hasPermission]);

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

  // Guests: keep previous behavior (send to free dashboard)
  if (!session || !user) {
    navigate('/dashboard/free', { replace: true });
    return null;
  }

  // Allowed users: show premium area (simple section)
  if (canWatchPremium) {
    return (
      <div className="min-h-screen bg-charcoal-black">
        <div className="container mx-auto px-4 md:px-8 py-10">
          <h1 className="text-3xl md:text-4xl font-bold text-bone-white mb-3">Watch Now</h1>
          <p className="text-muted-gray mb-8">Enjoy Premium content.</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-muted-gray/30 bg-muted-gray/10 p-6">
              <p className="text-bone-white font-semibold mb-2">Premium Area</p>
              <p className="text-sm text-muted-gray">Your upgraded access is active. Explore Premium shows here.</p>
              <div className="mt-4">
                <Button variant="secondary" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Free user: show upgrade gate immediately with a clear CTA and a fallback
  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="container mx-auto px-4 md:px-8 py-10">
        <h1 className="text-3xl md:text-4xl font-bold text-bone-white mb-3">Watch Now</h1>
        <p className="text-muted-gray mb-6">This area requires Premium.</p>

        <UpgradeGate requiredPerm="watch_now_premium" autoOpen>
          <Button className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
            Unlock Premium
          </Button>
        </UpgradeGate>

        <div className="mt-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard/free')}>Explore free content</Button>
        </div>
      </div>
    </div>
  );
};

export default WatchNow;