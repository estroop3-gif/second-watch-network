/**
 * ApplicantScore - Display match score badge with expandable breakdown
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScoreBreakdown } from '@/types/applications';
import {
  Star,
  Briefcase,
  Users,
  ChevronDown,
  ChevronUp,
  Film,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApplicantScoreProps {
  score: number | null;
  breakdown: ScoreBreakdown | null;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Score tier configuration
const getScoreTier = (score: number) => {
  if (score >= 80) {
    return {
      label: 'Excellent',
      color: 'bg-green-500/20 text-green-400 border-green-500/30',
      bgGradient: 'from-green-500/10 to-green-500/5',
    };
  }
  if (score >= 60) {
    return {
      label: 'Good',
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      bgGradient: 'from-blue-500/10 to-blue-500/5',
    };
  }
  if (score >= 40) {
    return {
      label: 'Fair',
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      bgGradient: 'from-yellow-500/10 to-yellow-500/5',
    };
  }
  return {
    label: 'Low',
    color: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
    bgGradient: 'from-muted-gray/10 to-muted-gray/5',
  };
};

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5',
};

function ScoreBar({ score, label, max = 100 }: { score: number; label: string; max?: number }) {
  const percentage = Math.min(100, (score / max) * 100);
  const barColor = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-muted-gray';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-gray">{label}</span>
        <span className="text-bone-white font-medium">{score}</span>
      </div>
      <div className="w-full bg-muted-gray/20 h-1.5 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ScoreBreakdownDetail({ breakdown }: { breakdown: ScoreBreakdown }) {
  const [showCredits, setShowCredits] = useState(false);

  return (
    <div className="space-y-4 p-3">
      {/* Overall Score */}
      <div className="text-center pb-3 border-b border-muted-gray/20">
        <div className="text-3xl font-bold text-bone-white">{breakdown.total}%</div>
        <div className="text-xs text-muted-gray">Match Score</div>
      </div>

      {/* Component Scores */}
      <div className="space-y-3">
        {/* Role Credits Score */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-bone-white">
            <Film className="w-4 h-4 text-accent-yellow" />
            <span>Role Experience</span>
          </div>
          <ScoreBar score={breakdown.role_credits.score} label="Credits in role" />
          <div className="flex gap-2 text-xs text-muted-gray">
            <span>{breakdown.role_credits.exact_matches} exact</span>
            <span>&bull;</span>
            <span>{breakdown.role_credits.department_matches} dept</span>
            <span>&bull;</span>
            <span>{breakdown.role_credits.transferable_matches} related</span>
          </div>
        </div>

        {/* Experience Score */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-bone-white">
            <Briefcase className="w-4 h-4 text-blue-400" />
            <span>Total Experience</span>
          </div>
          <ScoreBar score={breakdown.experience.score} label="Overall credits" />
          <div className="text-xs text-muted-gray">
            {breakdown.experience.total_credits} total credits
          </div>
        </div>

        {/* Network Score */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-bone-white">
            <Users className="w-4 h-4 text-purple-400" />
            <span>Network</span>
          </div>
          <ScoreBar score={breakdown.network.score} label="Connections" />
          <div className="flex gap-2 text-xs text-muted-gray">
            <span>{breakdown.network.direct_connections} connections</span>
            <span>&bull;</span>
            <span>{breakdown.network.shared_projects} shared projects</span>
          </div>
          {breakdown.network.connected_to && breakdown.network.connected_to.length > 0 && (
            <div className="text-xs text-muted-gray/80">
              Connected to: {breakdown.network.connected_to.slice(0, 3).join(', ')}
              {breakdown.network.connected_to.length > 3 && ` +${breakdown.network.connected_to.length - 3} more`}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Credits (Expandable) */}
      {(breakdown.role_credits.exact_match_credits?.length ||
        breakdown.role_credits.dept_match_credits?.length ||
        breakdown.role_credits.transferable_credits?.length) && (
        <div className="pt-2 border-t border-muted-gray/20">
          <button
            onClick={() => setShowCredits(!showCredits)}
            className="flex items-center gap-1 text-xs text-muted-gray hover:text-bone-white transition-colors w-full justify-between"
          >
            <span>View matching credits</span>
            {showCredits ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showCredits && (
            <div className="mt-2 space-y-2 text-xs">
              {breakdown.role_credits.exact_match_credits && breakdown.role_credits.exact_match_credits.length > 0 && (
                <div>
                  <div className="text-green-400 font-medium mb-1">Exact matches:</div>
                  {breakdown.role_credits.exact_match_credits.map((credit, i) => (
                    <div key={i} className="text-muted-gray pl-2">
                      {credit.role} - {credit.project}
                    </div>
                  ))}
                </div>
              )}
              {breakdown.role_credits.dept_match_credits && breakdown.role_credits.dept_match_credits.length > 0 && (
                <div>
                  <div className="text-blue-400 font-medium mb-1">Department matches:</div>
                  {breakdown.role_credits.dept_match_credits.map((credit, i) => (
                    <div key={i} className="text-muted-gray pl-2">
                      {credit.role} ({credit.department}) - {credit.project}
                    </div>
                  ))}
                </div>
              )}
              {breakdown.role_credits.transferable_credits && breakdown.role_credits.transferable_credits.length > 0 && (
                <div>
                  <div className="text-yellow-400 font-medium mb-1">Transferable skills:</div>
                  {breakdown.role_credits.transferable_credits.map((credit, i) => (
                    <div key={i} className="text-muted-gray pl-2">
                      {credit.role} ({credit.category}) - {credit.project}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ApplicantScore({
  score,
  breakdown,
  showDetails = false,
  size = 'md',
  className,
}: ApplicantScoreProps) {
  // No score yet
  if (score === null || score === undefined) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                'border gap-1 bg-muted-gray/10 text-muted-gray border-muted-gray/30',
                sizeClasses[size],
                className
              )}
            >
              <RefreshCw className="w-3 h-3" />
              <span>--</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Score not calculated yet</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const tier = getScoreTier(score);

  // Simple badge without details
  if (!showDetails || !breakdown) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                'border gap-1',
                tier.color,
                sizeClasses[size],
                className
              )}
            >
              <Star className="w-3 h-3" />
              <span>{score}%</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tier.label} match ({score}%)</p>
            {breakdown && (
              <p className="text-xs text-muted-gray mt-1">
                Role: {breakdown.role_credits.score} | Exp: {breakdown.experience.score} | Network: {breakdown.network.score}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Badge with expandable details
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'h-auto p-0 hover:bg-transparent',
            className
          )}
        >
          <Badge
            variant="outline"
            className={cn(
              'border gap-1 cursor-pointer hover:opacity-80 transition-opacity',
              tier.color,
              sizeClasses[size]
            )}
          >
            <Star className="w-3 h-3" />
            <span>{score}%</span>
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 bg-charcoal-black border-muted-gray/30"
        align="start"
      >
        <ScoreBreakdownDetail breakdown={breakdown} />
      </PopoverContent>
    </Popover>
  );
}

// Compact inline version for lists/tables
export function ApplicantScoreInline({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  if (score === null || score === undefined) {
    return <span className={cn('text-muted-gray text-sm', className)}>--</span>;
  }

  const tier = getScoreTier(score);
  const colorClass = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-blue-400' : score >= 40 ? 'text-yellow-400' : 'text-muted-gray';

  return (
    <span className={cn('font-medium', colorClass, className)}>
      {score}%
    </span>
  );
}

export default ApplicantScore;
