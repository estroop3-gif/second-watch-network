/**
 * BacklotAccessGate
 * Wraps Backlot routes to check for access (subscription or organization seat)
 * Shows paywall if user doesn't have access
 */

import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useBacklotAccess } from '@/hooks/useOrganizations';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Film, Building2, Sparkles, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

function BacklotPaywall({ reason }: { reason?: string }) {
  return (
    <div className="min-h-screen bg-charcoal-black flex items-center justify-center p-4">
      <Card className="bg-charcoal-black border-muted-gray/30 max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-red/20 flex items-center justify-center">
            <Film className="w-8 h-8 text-primary-red" />
          </div>
          <CardTitle className="text-2xl text-bone-white">Backlot Access Required</CardTitle>
          <CardDescription className="text-muted-gray">
            Backlot is our professional production management suite for filmmakers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/20">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-accent-yellow mt-0.5" />
                <div>
                  <h3 className="font-medium text-bone-white">Individual Subscription</h3>
                  <p className="text-sm text-muted-gray mt-1">
                    Subscribe to Backlot to manage your own productions with full access to all features.
                  </p>
                  <Button asChild className="mt-3" size="sm">
                    <Link to="/subscriptions?product=backlot">
                      Subscribe Now
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/20">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <h3 className="font-medium text-bone-white">Organization Access</h3>
                  <p className="text-sm text-muted-gray mt-1">
                    Get access through your production company or organization. Ask your organization admin to add you as a Backlot seat.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pt-4 border-t border-muted-gray/20">
            <Button variant="ghost" asChild>
              <Link to="/dashboard">Return to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function BacklotAccessGate() {
  const { session, loading: authLoading } = useAuth();
  const { data: accessInfo, isLoading: accessLoading } = useBacklotAccess();
  const location = useLocation();

  const isLoading = authLoading || accessLoading;

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

  if (!accessInfo?.has_access) {
    return <BacklotPaywall reason={accessInfo?.reason} />;
  }

  return <Outlet />;
}

export default BacklotAccessGate;
