import { useAuth } from "@/context/AuthContext";
import { useEnrichedProfile } from "@/context/EnrichedProfileContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Skeleton } from "./ui/skeleton";
import { useSettings } from "@/context/SettingsContext";

const OnboardingGate = () => {
  const { session, loading: authLoading } = useAuth();
  const { isFilmmaker, hasFilmmakerProfile, profile, isLoading: profileLoading } = useEnrichedProfile();
  const { settings, isLoading: settingsLoading } = useSettings();
  const location = useLocation();

  // Only block on auth loading - we need to know if user is authenticated
  // Profile/settings loading can happen in the background while content renders
  if (authLoading) {
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
    return <Navigate to="/landing" state={{ from: location }} replace />;
  }

  // Filmmaker onboarding is no longer required - users can optionally complete it
  // The onboarding page still exists at /filmmaker-onboarding if needed

  return <Outlet />;
};

export default OnboardingGate;