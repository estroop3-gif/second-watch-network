import { useAuth } from "@/context/AuthContext";
import { useEnrichedProfile } from "@/context/EnrichedProfileContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSettings } from "@/context/SettingsContext";
import { safeStorage } from "@/lib/api";

const OnboardingGate = () => {
  const { session, loading: authLoading } = useAuth();
  const { isFilmmaker, hasFilmmakerProfile, profile, isLoading: profileLoading } = useEnrichedProfile();
  const { settings, isLoading: settingsLoading } = useSettings();
  const location = useLocation();

  // If auth is loading but we have a token, let the content render
  // (AuthenticatedLayout handles its own loading skeleton)
  if (authLoading) {
    const hasToken = !!safeStorage.getItem('access_token');
    if (hasToken) {
      return <Outlet />;
    }
    // No token during auth loading — will resolve quickly to landing redirect
    return null;
  }

  if (!session) {
    return <Navigate to="/landing" state={{ from: location }} replace />;
  }

  // Filmmaker onboarding is no longer required - users can optionally complete it
  // The onboarding page still exists at /filmmaker-onboarding if needed

  return <Outlet />;
};

export default OnboardingGate;