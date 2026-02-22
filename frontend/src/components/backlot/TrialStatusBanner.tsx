import { useMyBacklotTrial, useRequestTrialExtension } from '@/hooks/crm/useTrialRequests';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Clock, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const TrialStatusBanner = () => {
  const { data } = useMyBacklotTrial();
  const extensionMutation = useRequestTrialExtension();

  const trial = data?.trial;
  if (!trial) return null;

  const status = trial.status;
  const trialEndsAt = trial.extension_ends_at || trial.trial_ends_at;

  // Don't show banner for non-trial statuses
  if (!['active', 'extended', 'extension_requested', 'expired'].includes(status)) return null;

  const now = new Date();
  const endDate = trialEndsAt ? new Date(trialEndsAt) : null;
  const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : null;
  const isExpiring = daysLeft !== null && daysLeft <= 3 && status === 'active';
  const canRequestExtension = (isExpiring || status === 'expired') && !trial.extension_requested_at;

  const handleRequestExtension = async () => {
    try {
      await extensionMutation.mutateAsync(trial.id);
      toast.success('Extension request submitted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to request extension');
    }
  };

  // Active trial — days remaining
  if (status === 'active' && !isExpiring) {
    return (
      <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-blue-300">
            <Clock className="h-4 w-4" />
            <span>{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining on your free trial</span>
          </div>
          <Link to="/backlot/billing">
            <Button size="sm" variant="outline" className="border-blue-400/40 text-blue-300 hover:bg-blue-500/10 h-7 text-xs">
              Subscribe Now
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Expiring soon (last 3 days)
  if (isExpiring) {
    return (
      <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-yellow-300">
            <AlertTriangle className="h-4 w-4" />
            <span>Your trial expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}!</span>
          </div>
          <div className="flex items-center gap-2">
            {canRequestExtension && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRequestExtension}
                disabled={extensionMutation.isPending}
                className="border-yellow-400/40 text-yellow-300 hover:bg-yellow-500/10 h-7 text-xs"
              >
                {extensionMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Request Extension
              </Button>
            )}
            <Link to="/backlot/billing">
              <Button size="sm" className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 h-7 text-xs">
                Subscribe Now
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Extension requested
  if (status === 'extension_requested') {
    return (
      <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-blue-300">
            <Clock className="h-4 w-4" />
            <span>Your extension request is under review</span>
          </div>
          <Link to="/backlot/billing">
            <Button size="sm" variant="outline" className="border-blue-400/40 text-blue-300 hover:bg-blue-500/10 h-7 text-xs">
              Subscribe Now
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Extended trial
  if (status === 'extended') {
    return (
      <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-blue-300">
            <Clock className="h-4 w-4" />
            <span>{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining on your extended trial</span>
          </div>
          <Link to="/backlot/billing">
            <Button size="sm" variant="outline" className="border-blue-400/40 text-blue-300 hover:bg-blue-500/10 h-7 text-xs">
              Subscribe Now
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Expired
  if (status === 'expired') {
    return (
      <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-red-300">
            <XCircle className="h-4 w-4" />
            <span>Your trial has expired. Your data is preserved for 90 days.</span>
          </div>
          <div className="flex items-center gap-2">
            {canRequestExtension && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRequestExtension}
                disabled={extensionMutation.isPending}
                className="border-red-400/40 text-red-300 hover:bg-red-500/10 h-7 text-xs"
              >
                {extensionMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Request Extension
              </Button>
            )}
            <Link to="/backlot/billing">
              <Button size="sm" className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 h-7 text-xs">
                Subscribe to Continue
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default TrialStatusBanner;
