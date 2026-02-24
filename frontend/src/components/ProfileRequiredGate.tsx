import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserCircle } from 'lucide-react';

interface ProfileRequiredGateProps {
  children: React.ReactNode;
}

const ProfileRequiredGate = ({ children }: ProfileRequiredGateProps) => {
  const { profile, isLoading } = useEnrichedProfile();
  const navigate = useNavigate();

  if (isLoading) return null;

  const hasName = profile?.full_name && profile.full_name.trim().length > 0;

  if (!hasName) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md text-center space-y-6 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-accent-yellow/10 flex items-center justify-center">
            <UserCircle className="h-8 w-8 text-accent-yellow" />
          </div>
          <h1 className="text-2xl font-heading text-bone-white">Complete Your Profile</h1>
          <p className="text-muted-gray">
            To access the community, please add your full name to your profile first.
          </p>
          <Button
            onClick={() => navigate('/my-profile')}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 font-bold px-8 py-3"
          >
            Edit My Profile
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProfileRequiredGate;
