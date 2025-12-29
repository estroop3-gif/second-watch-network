import React from 'react';
import ConnectButton from '@/components/connections/ConnectButton';

type Props = {
  userId: string;
};

const ProfileHeaderConnect: React.FC<Props> = ({ userId }) => {
  return (
    <div className="w-full">
      <ConnectButton peerId={userId} fullWidth size="lg" />
    </div>
  );
};

export default ProfileHeaderConnect;