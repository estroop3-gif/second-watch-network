/**
 * Escalation Status Badge
 * Visual indicator for a user's strike/escalation status
 */
import React from 'react';
import { AlertTriangle, CheckCircle, Clock, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type EscalationStatus = 'clear' | 'active' | 'escalated' | 'probation' | 'suspended';

interface EscalationStatusBadgeProps {
  isEscalated: boolean;
  requiresReview?: boolean;
  reviewDecision?: 'approved' | 'probation' | 'suspended' | null;
  activeStrikes?: number;
  className?: string;
}

export function EscalationStatusBadge({
  isEscalated,
  requiresReview,
  reviewDecision,
  activeStrikes = 0,
  className,
}: EscalationStatusBadgeProps) {
  // Determine status
  let status: EscalationStatus = 'clear';
  if (reviewDecision === 'suspended') {
    status = 'suspended';
  } else if (reviewDecision === 'probation') {
    status = 'probation';
  } else if (isEscalated && requiresReview) {
    status = 'escalated';
  } else if (activeStrikes > 0) {
    status = 'active';
  }

  const config: Record<
    EscalationStatus,
    {
      label: string;
      icon: React.ElementType;
      className: string;
    }
  > = {
    clear: {
      label: 'Clear',
      icon: CheckCircle,
      className: 'bg-green-500/10 text-green-400 border-green-500/30',
    },
    active: {
      label: `${activeStrikes} Strike${activeStrikes !== 1 ? 's' : ''}`,
      icon: AlertTriangle,
      className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    },
    escalated: {
      label: 'Escalated',
      icon: AlertTriangle,
      className: 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse',
    },
    probation: {
      label: 'Probation',
      icon: Clock,
      className: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    },
    suspended: {
      label: 'Suspended',
      icon: Ban,
      className: 'bg-red-500/10 text-red-400 border-red-500/30',
    },
  };

  const { label, icon: Icon, className: badgeClass } = config[status];

  return (
    <Badge variant="outline" className={cn('gap-1 text-xs', badgeClass, className)}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

export default EscalationStatusBadge;
