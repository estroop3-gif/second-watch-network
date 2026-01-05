/**
 * AvailabilityQuickToggle - Quick status toggle for the feed
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface AvailabilityQuickToggleProps {
  initialAcceptingWork?: boolean;
  initialStatusMessage?: string;
}

const AvailabilityQuickToggle: React.FC<AvailabilityQuickToggleProps> = ({
  initialAcceptingWork = false,
  initialStatusMessage = '',
}) => {
  const { profileId } = useAuth();
  const queryClient = useQueryClient();
  const [acceptingWork, setAcceptingWork] = useState(initialAcceptingWork);
  const [statusMessage, setStatusMessage] = useState(initialStatusMessage);
  const [isEditingStatus, setIsEditingStatus] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: { accepting_work: boolean; status_message?: string }) => {
      return api.updateAvailability(data);
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['filmmaker-profile'] });
      queryClient.invalidateQueries({ queryKey: ['enriched-profile'] });
      toast.success('Availability updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update availability');
      // Revert on error
      setAcceptingWork(initialAcceptingWork);
    },
  });

  const handleToggleAvailability = (newValue: boolean) => {
    setAcceptingWork(newValue);
    mutation.mutate({ accepting_work: newValue });
  };

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ accepting_work: acceptingWork, status_message: statusMessage });
    setIsEditingStatus(false);
  };

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-gray">Your Status:</span>

        {/* Availability dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'gap-2 px-3',
                acceptingWork
                  ? 'border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                  : 'border-muted-gray/30 text-muted-gray hover:text-bone-white'
              )}
              disabled={mutation.isPending}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  acceptingWork ? 'bg-green-400' : 'bg-muted-gray'
                )}
              />
              {acceptingWork ? 'Available for Work' : 'Not Available'}
              {mutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-charcoal-black border-muted-gray/30">
            <DropdownMenuItem
              onClick={() => handleToggleAvailability(true)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="flex-1">Available for Work</span>
              {acceptingWork && <Check className="w-4 h-4 text-green-400" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleToggleAvailability(false)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-muted-gray" />
              <span className="flex-1">Not Available</span>
              {!acceptingWork && <Check className="w-4 h-4 text-muted-gray" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status message */}
        <div className="flex-1">
          {isEditingStatus ? (
            <form onSubmit={handleStatusSubmit} className="flex gap-2">
              <Input
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder="What are you working on?"
                className="h-8 text-sm bg-charcoal-black/50 border-muted-gray/30"
                maxLength={100}
                autoFocus
              />
              <Button
                type="submit"
                size="sm"
                disabled={mutation.isPending}
                className="h-8"
              >
                {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditingStatus(false);
                  setStatusMessage(initialStatusMessage);
                }}
                className="h-8"
              >
                Cancel
              </Button>
            </form>
          ) : (
            <button
              onClick={() => setIsEditingStatus(true)}
              className="text-sm text-muted-gray hover:text-bone-white transition-colors truncate max-w-xs"
            >
              {statusMessage || 'Set status message...'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvailabilityQuickToggle;
