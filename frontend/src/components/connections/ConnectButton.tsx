import React from 'react';
import { Button } from '@/components/ui/button';
import { useConnectionRelationship } from '@/hooks/useConnectionRelationship';
import { toast } from 'sonner';
import { UserPlus, CheckCheck, Handshake, MailQuestion } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Props = {
  peerId: string | undefined;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
  fullWidth?: boolean;
};

const ConnectButton: React.FC<Props> = ({ peerId, className, size = 'default', fullWidth }) => {
  const navigate = useNavigate();
  const { isSelf, state, connection, isLoading, sendRequest } = useConnectionRelationship(peerId);

  if (!peerId || isSelf) return null;

  const onConnect = () => {
    sendRequest.mutate(undefined, {
      onSuccess: () => {
        toast.success('Connection request sent');
      },
      onError: (e: any) => {
        // unique violation or already connected
        toast.error('Could not send request', { description: e?.message ?? 'Please try again.' });
      },
    });
  };

  const widthClass = fullWidth ? 'w-full' : '';

  if (isLoading) {
    return (
      <Button variant="outline" disabled size={size} className={widthClass}>
        <UserPlus className="mr-2 h-4 w-4" />
        Loading...
      </Button>
    );
  }

  if (state === 'connected') {
    return (
      <Button variant="secondary" disabled size={size} className={`${widthClass} cursor-default`}>
        <Handshake className="mr-2 h-4 w-4" />
        Connected
      </Button>
    );
  }

  if (state === 'outboundPending') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" disabled size={size} className={`${widthClass} cursor-default`}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Requested
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Awaiting response
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (state === 'inboundPending') {
    return (
      <Button
        variant="outline"
        size={size}
        className={widthClass}
        onClick={() => {
          // Deep-link to requests tab; Stage 3 will implement the tab
          navigate('/notifications?tab=requests' + (connection?.requester_id ? `&from=${connection.requester_id}` : ''));
        }}
      >
        <MailQuestion className="mr-2 h-4 w-4" />
        Respond
      </Button>
    );
  }

  // none
  return (
    <Button
      variant="outline"
      size={size}
      className={widthClass}
      onClick={onConnect}
      disabled={sendRequest.isPending}
    >
      <UserPlus className="mr-2 h-4 w-4" />
      Connect
    </Button>
  );
};

export default ConnectButton;