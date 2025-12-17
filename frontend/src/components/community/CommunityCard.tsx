import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import ConnectButton from '@/components/connections/ConnectButton';
import PersonCard from '@/components/shared/PersonCard';
import { CommunityProfile } from '@/types';

type Props = {
  profile: CommunityProfile;
};

const CommunityCard: React.FC<Props> = ({ profile }) => {
  const username = profile.username || 'member';

  return (
    <PersonCard
      profile={profile}
      variant="default"
      showProfileLink={true}
      actions={
        <>
          <Button asChild className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white">
            <Link to={`/profile/${username}`}>View Profile</Link>
          </Button>
          <ConnectButton peerId={profile.profile_id} />
        </>
      }
    />
  );
};

export default CommunityCard;
