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

  const isLoading = authLoading || profileLoading || settingsLoading;

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
    return <Navigate to="/landing" state={{ from: location }} replace />;
  }

  // Check if filmmaker onboarding is needed:
  // - User has filmmaker role (is_filmmaker flag set in profiles table, or has filmmaker_profile, or auth metadata)
  // - User has NOT completed onboarding (no filmmaker_profiles entry exists)
  // - Onboarding feature is enabled in settings
  const hasCompletedOnboarding = profile?.has_completed_filmmaker_onboarding || hasFilmmakerProfile;

  if (settings?.filmmaker_onboarding_enabled && isFilmmaker && !hasCompletedOnboarding) {
    if (location.pathname !== '/filmmaker-onboarding') {
      return <Navigate to="/filmmaker-onboarding" replace />;
    }
  }

  return <Outlet />;
};

export default OnboardingGate;