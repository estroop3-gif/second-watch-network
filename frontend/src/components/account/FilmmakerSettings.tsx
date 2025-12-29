import React from 'react';
import { useAuth } from '@/context/AuthContext';
import EditProfileForm from '@/components/forms/EditProfileForm';
import { useQueryClient } from '@tanstack/react-query';

// This type is a placeholder for the complex profile structure.
// It's safe to use `any` here because the data shape is validated
// by the EditProfileForm itself.
interface ProfileData {
  [key: string]: any;
}

interface FilmmakerSettingsProps {
  profile: ProfileData;
}

const FilmmakerSettings = ({ profile }: FilmmakerSettingsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleProfileUpdate = () => {
    // When the form is updated, we invalidate the query to refetch the latest data.
    queryClient.invalidateQueries({ queryKey: ['filmmaker_profile', user?.id] });
  };

  return (
    <div className="container mx-auto px-4 max-w-4xl py-12">
       <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-2 -rotate-1">
          Edit Your Profile
        </h1>
        <p className="text-muted-gray">Keep your professional info up-to-date.</p>
      </div>
      <EditProfileForm profile={profile} onProfileUpdate={handleProfileUpdate} />
    </div>
  );
};

export default FilmmakerSettings;