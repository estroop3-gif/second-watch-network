import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import ConnectButton from '@/components/connections/ConnectButton';
import { CommunityProfile } from '@/types';

type Props = {
  profile: CommunityProfile;
};

const CommunityCard: React.FC<Props> = ({ profile }) => {
  const name = profile.full_name || profile.display_name || profile.username || 'Member';
  const initials = (profile.full_name || profile.display_name || profile.username || 'M').slice(0, 1);
  const username = profile.username || 'member';

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-6 text-center flex flex-col items-center">
      <Link to={`/profile/${username}`} className="flex flex-col items-center">
        <Avatar className="w-24 h-24 mb-4 border-4 border-muted-gray">
          <AvatarImage src={profile.avatar_url || ''} alt={name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <h3 className="font-heading text-xl text-bone-white hover:text-accent-yellow transition-colors">{name}</h3>
      </Link>
      <p className="text-muted-gray text-sm mb-4">@{username}</p>
      <div className="mt-auto flex flex-col gap-2 w-full pt-4">
        <Button asChild className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white">
          <Link to={`/profile/${username}`}>View Profile</Link>
        </Button>
        <ConnectButton peerId={profile.profile_id} />
      </div>
    </div>
  );
};

export default CommunityCard;