/**
 * CycleStatsRow Component
 * Mini stats section showing aggregate cycle metrics
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Film,
  Users,
  Ticket,
  TrendingUp,
  DollarSign,
  Trophy,
} from 'lucide-react';
import { Cycle } from '@/lib/api/greenroom';
import { cn } from '@/lib/utils';

interface CycleStatsRowProps {
  currentCycle: Cycle | null;
  allTimeStats?: {
    totalProjects: number;
    totalVotes: number;
    totalTicketsSold: number;
    totalContributed: number;
    winnersCount: number;
    uniqueVoters: number;
  };
  isLoading?: boolean;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconColor: string;
  subtext?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  iconColor,
  subtext,
}) => (
  <div className="bg-charcoal-black/60 rounded-lg p-4 border border-muted-gray/20 flex items-center gap-3">
    <div className={cn('p-2.5 rounded-lg bg-opacity-20', `bg-${iconColor}/20`)}>
      <Icon className={cn('h-5 w-5', `text-${iconColor}`)} />
    </div>
    <div>
      <p className="text-2xl font-bold text-bone-white">{value}</p>
      <p className="text-xs text-muted-gray">{label}</p>
      {subtext && <p className="text-[10px] text-muted-gray/70">{subtext}</p>}
    </div>
  </div>
);

export const CycleStatsRow: React.FC<CycleStatsRowProps> = ({
  currentCycle,
  allTimeStats,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card className="bg-charcoal-black/30 border-muted-gray">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-charcoal-black/60 rounded-lg p-4 border border-muted-gray/20 animate-pulse"
              >
                <div className="h-8 w-16 bg-muted-gray/30 rounded mb-2" />
                <div className="h-3 w-20 bg-muted-gray/30 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate current cycle stats
  const cycleProjects = currentCycle?.project_count || 0;
  const cycleVotes = currentCycle?.total_votes || 0;
  const ticketPrice = currentCycle?.ticket_price || 1;

  // All-time stats with defaults
  const stats = allTimeStats || {
    totalProjects: cycleProjects,
    totalVotes: cycleVotes,
    totalTicketsSold: 0,
    totalContributed: 0,
    winnersCount: 0,
    uniqueVoters: 0,
  };

  return (
    <Card className="bg-charcoal-black/30 border-muted-gray">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-bone-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            Green Room Stats
          </h3>
          <span className="text-xs text-muted-gray">
            {currentCycle ? `${currentCycle.name}` : 'All Cycles'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Current Cycle Stats */}
          <div className="bg-charcoal-black/60 rounded-lg p-4 border border-emerald-600/30 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/20">
              <Film className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-bone-white">{cycleProjects}</p>
              <p className="text-xs text-muted-gray">Projects</p>
              <p className="text-[10px] text-emerald-400">This Cycle</p>
            </div>
          </div>

          <div className="bg-charcoal-black/60 rounded-lg p-4 border border-accent-yellow/30 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-accent-yellow/20">
              <Ticket className="h-5 w-5 text-accent-yellow" />
            </div>
            <div>
              <p className="text-2xl font-bold text-bone-white">{cycleVotes}</p>
              <p className="text-xs text-muted-gray">Votes Cast</p>
              <p className="text-[10px] text-accent-yellow">This Cycle</p>
            </div>
          </div>

          <div className="bg-charcoal-black/60 rounded-lg p-4 border border-muted-gray/20 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/20">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-bone-white">
                {stats.uniqueVoters || '--'}
              </p>
              <p className="text-xs text-muted-gray">Voters</p>
              <p className="text-[10px] text-muted-gray/70">All Time</p>
            </div>
          </div>

          {/* All-Time Stats */}
          <div className="bg-charcoal-black/60 rounded-lg p-4 border border-muted-gray/20 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/20">
              <Film className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-bone-white">{stats.totalProjects}</p>
              <p className="text-xs text-muted-gray">Total Projects</p>
              <p className="text-[10px] text-muted-gray/70">All Cycles</p>
            </div>
          </div>

          <div className="bg-charcoal-black/60 rounded-lg p-4 border border-muted-gray/20 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-500/20">
              <DollarSign className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-bone-white">
                ${stats.totalContributed.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-muted-gray">Contributed</p>
              <p className="text-[10px] text-muted-gray/70">All Time</p>
            </div>
          </div>

          <div className="bg-charcoal-black/60 rounded-lg p-4 border border-muted-gray/20 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/20">
              <Trophy className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-bone-white">{stats.winnersCount}</p>
              <p className="text-xs text-muted-gray">Winners</p>
              <p className="text-[10px] text-muted-gray/70">Greenlit</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CycleStatsRow;
