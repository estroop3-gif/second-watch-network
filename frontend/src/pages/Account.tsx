import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAccountProfile } from '@/hooks/useAccountProfile';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EditProfileForm from '@/components/forms/EditProfileForm';
import ManageAvailability from '@/components/profile/ManageAvailability';
import ProfileStatusUpdates from '@/components/profile/ProfileStatusUpdates';
import { ApiKeysSection } from '@/components/account/ApiKeysSection';
import { useAuth } from '@/context/AuthContext';
import { FilmmakerProfileData } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';

const Account = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { profile, isLoading, isError, refetch } = useAccountProfile();
  const { hasAnyRole } = usePermissions();

  // Support deep-linking to specific tabs via URL params (e.g., /account?tab=api-keys)
  const defaultTab = searchParams.get('tab') || 'profile';

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-12 w-12 animate-spin text-accent-yellow" /></div>;
  }

  // Only treat missing user or error as blocking; missing profile should not block creating one
  if (isError || !user) {
    return <div className="text-center py-12">Could not load profile data. Please try again.</div>;
  }

  // Build a safe object for status updates (works even if profile is missing)
  const safeProfile = profile || {};
  const statusUpdatesProfileProp = {
    ...safeProfile,
    user_id: user.id,
  } as FilmmakerProfileData;

  const isFilmmakerOrAdmin = hasAnyRole(['filmmaker', 'admin']);

  return (
    <div className="container mx-auto px-4 max-w-6xl py-12">
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-12 -rotate-1">
        My <span className="font-spray text-accent-yellow">Account</span>
      </h1>
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={`grid w-full ${isFilmmakerOrAdmin ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
          <TabsTrigger value="profile">Profile & Skills</TabsTrigger>
          {isFilmmakerOrAdmin && (
            <>
              <TabsTrigger value="availability">Availability</TabsTrigger>
              <TabsTrigger value="updates">Post an Update</TabsTrigger>
            </>
          )}
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          {/* Pass combined profile with filmmaker data, plus isFilmmaker flag */}
          <EditProfileForm
            profile={safeProfile}
            onProfileUpdate={refetch}
            isFilmmaker={isFilmmakerOrAdmin}
          />
        </TabsContent>
        {isFilmmakerOrAdmin && (
          <>
            <TabsContent value="availability" className="mt-6">
              <ManageAvailability />
            </TabsContent>
            <TabsContent value="updates" className="mt-6">
              <ProfileStatusUpdates profile={statusUpdatesProfileProp} />
            </TabsContent>
          </>
        )}
        <TabsContent value="api-keys" className="mt-6">
          <ApiKeysSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Account;
