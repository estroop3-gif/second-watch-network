/**
 * OnboardingProgressBar - Visual progress indicator for crew onboarding documents
 * Shows completion percentage with color-coded progress bar
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { CrewDocumentSummary } from '@/types/backlot';
import {
  getCompletionStatus,
  getProgressColor,
  formatCompletionPercentage,
  CompletionStatus,
} from '@/hooks/backlot/useCrewDocuments';
import { cn } from '@/lib/utils';

interface OnboardingProgressBarProps {
  summary: CrewDocumentSummary;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_ICONS: Record<CompletionStatus, React.ElementType> = {
  complete: CheckCircle,
  in_progress: Clock,
  missing: AlertCircle,
  not_started: FileText,
};

export function OnboardingProgressBar({
  summary,
  showDetails = true,
  size = 'md',
  className,
}: OnboardingProgressBarProps) {
  const status = getCompletionStatus(summary);
  const progressColor = getProgressColor(summary.completion_percentage);
  const StatusIcon = STATUS_ICONS[status];

  const sizeClasses = {
    sm: {
      progress: 'h-1.5',
      text: 'text-xs',
      icon: 'h-3 w-3',
    },
    md: {
      progress: 'h-2',
      text: 'text-sm',
      icon: 'h-4 w-4',
    },
    lg: {
      progress: 'h-3',
      text: 'text-base',
      icon: 'h-5 w-5',
    },
  };

  const styles = sizeClasses[size];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('space-y-1', className)}>
            {showDetails && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <StatusIcon
                    className={cn(
                      styles.icon,
                      status === 'complete' && 'text-green-400',
                      status === 'in_progress' && 'text-yellow-400',
                      status === 'missing' && 'text-red-400',
                      status === 'not_started' && 'text-muted-foreground'
                    )}
                  />
                  <span className={cn(styles.text, 'text-muted-foreground')}>
                    {summary.documents.signed}/{summary.documents.required}
                  </span>
                </div>
                <span
                  className={cn(
                    styles.text,
                    'font-medium',
                    status === 'complete' && 'text-green-400',
                    status === 'in_progress' && 'text-yellow-400',
                    status === 'missing' && 'text-red-400',
                    status === 'not_started' && 'text-muted-foreground'
                  )}
                >
                  {formatCompletionPercentage(summary.completion_percentage)}
                </span>
              </div>
            )}

            <div className={cn('rounded-full bg-muted-gray/20 overflow-hidden', styles.progress)}>
              <div
                className={cn('h-full transition-all duration-500', progressColor)}
                style={{ width: `${Math.min(summary.completion_percentage, 100)}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{summary.person_name}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">Required:</span>
              <span>{summary.documents.required}</span>
              <span className="text-muted-foreground">Signed:</span>
              <span className="text-green-400">{summary.documents.signed}</span>
              <span className="text-muted-foreground">Pending:</span>
              <span className="text-yellow-400">{summary.documents.pending}</span>
              <span className="text-muted-foreground">Missing:</span>
              <span className="text-red-400">{summary.documents.missing}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact inline version for card headers
export function OnboardingProgressBadge({
  summary,
  className,
}: {
  summary: CrewDocumentSummary;
  className?: string;
}) {
  const status = getCompletionStatus(summary);
  const StatusIcon = STATUS_ICONS[status];

  const statusColors = {
    complete: 'bg-green-500/20 text-green-400 border-green-500/30',
    in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    missing: 'bg-red-500/20 text-red-400 border-red-500/30',
    not_started: 'bg-muted-gray/20 text-muted-foreground border-muted-gray/30',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn('text-xs', statusColors[status], className)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {summary.documents.signed}/{summary.documents.required}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>
            {status === 'complete'
              ? 'All documents signed'
              : status === 'in_progress'
              ? `${summary.documents.pending} pending`
              : status === 'missing'
              ? `${summary.documents.missing} missing`
              : 'No documents assigned'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Mini version for tight spaces
export function OnboardingProgressMini({
  summary,
  className,
}: {
  summary: CrewDocumentSummary;
  className?: string;
}) {
  const progressColor = getProgressColor(summary.completion_percentage);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('w-12 h-1.5 rounded-full bg-muted-gray/20 overflow-hidden', className)}>
            <div
              className={cn('h-full', progressColor)}
              style={{ width: `${Math.min(summary.completion_percentage, 100)}%` }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>
            {summary.documents.signed}/{summary.documents.required} documents (
            {formatCompletionPercentage(summary.completion_percentage)})
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
