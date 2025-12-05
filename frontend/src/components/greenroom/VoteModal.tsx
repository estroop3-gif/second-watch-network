/**
 * Vote Modal Component
 * Interface for allocating tickets to a project
 */
import { useState } from 'react';
import { Project, VotingTicket } from '@/lib/api/greenroom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThumbsUp, AlertCircle, Info } from 'lucide-react';

interface VoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  availableTickets: number;
  onConfirmVote: (ticketCount: number) => Promise<void>;
  userExistingVotes?: number;
}

export function VoteModal({
  open,
  onOpenChange,
  project,
  availableTickets,
  onConfirmVote,
  userExistingVotes = 0,
}: VoteModalProps) {
  const [ticketCount, setTicketCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!project) return null;

  const handleVote = async () => {
    if (ticketCount < 1 || ticketCount > availableTickets) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirmVote(ticketCount);
      onOpenChange(false);
      setTicketCount(1);
    } catch (error) {
      console.error('Vote failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5" />
            Vote for {project.title}
          </DialogTitle>
          <DialogDescription>
            Allocate your voting tickets to support this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Available Tickets Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You have <strong>{availableTickets}</strong> ticket{availableTickets !== 1 ? 's' : ''} available
            </AlertDescription>
          </Alert>

          {/* Existing Votes Warning */}
          {userExistingVotes > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You have already voted for this project with {userExistingVotes} ticket{userExistingVotes !== 1 ? 's' : ''}.
                Votes are final and cannot be changed!
              </AlertDescription>
            </Alert>
          )}

          {/* Ticket Count Input */}
          <div className="space-y-2">
            <Label htmlFor="ticketCount">Number of Tickets</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                disabled={ticketCount <= 1 || userExistingVotes > 0}
              >
                -
              </Button>
              <Input
                id="ticketCount"
                type="number"
                min={1}
                max={availableTickets}
                value={ticketCount}
                onChange={(e) => setTicketCount(parseInt(e.target.value) || 1)}
                className="text-center"
                disabled={userExistingVotes > 0}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTicketCount(Math.min(availableTickets, ticketCount + 1))}
                disabled={ticketCount >= availableTickets || userExistingVotes > 0}
              >
                +
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Quick select:
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setTicketCount(5)}
                disabled={availableTickets < 5 || userExistingVotes > 0}
                className="px-2"
              >
                5
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setTicketCount(10)}
                disabled={availableTickets < 10 || userExistingVotes > 0}
                className="px-2"
              >
                10
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setTicketCount(availableTickets)}
                disabled={availableTickets < 1 || userExistingVotes > 0}
                className="px-2"
              >
                All ({availableTickets})
              </Button>
            </p>
          </div>

          {/* Warning about finality */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Important:</strong> Votes are final and cannot be changed. Make sure you want to allocate {ticketCount} ticket{ticketCount !== 1 ? 's' : ''} to this project.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVote}
            disabled={isSubmitting || ticketCount < 1 || ticketCount > availableTickets || userExistingVotes > 0}
          >
            {isSubmitting ? 'Submitting...' : `Cast ${ticketCount} Vote${ticketCount !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
