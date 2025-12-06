/**
 * GreenRoomHero Component
 * Hero section for the Green Room Hub with cycle status and CTAs
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Clock,
  Send,
  Vote,
  HelpCircle,
  Flame,
  Calendar,
} from 'lucide-react';
import { Cycle, CycleStatus } from '@/lib/api/greenroom';

interface GreenRoomHeroProps {
  currentCycle: Cycle | null;
  isFilmmaker: boolean;
  isLoading?: boolean;
  onHowItWorksClick?: () => void;
}

const getTimeRemaining = (endDate: string): string => {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours !== 1 ? 's' : ''} remaining`;
};

const getPhaseLabel = (status: CycleStatus): string => {
  switch (status) {
    case 'upcoming':
      return 'Submissions Open Soon';
    case 'active':
      return 'Voting Active';
    case 'closed':
      return 'Cycle Complete';
    default:
      return 'Unknown';
  }
};

const getStatusColor = (status: CycleStatus): string => {
  switch (status) {
    case 'active':
      return 'bg-emerald-600';
    case 'upcoming':
      return 'bg-blue-600';
    case 'closed':
      return 'bg-gray-600';
    default:
      return 'bg-gray-600';
  }
};

export const GreenRoomHero: React.FC<GreenRoomHeroProps> = ({
  currentCycle,
  isFilmmaker,
  isLoading,
  onHowItWorksClick,
}) => {
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-emerald-900/40 to-charcoal-black border-emerald-600/30">
        <CardContent className="p-8 md:p-12">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted-gray/30 rounded w-1/3" />
            <div className="h-6 bg-muted-gray/30 rounded w-2/3" />
            <div className="h-20 bg-muted-gray/30 rounded w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-emerald-900/40 via-charcoal-black to-charcoal-black border-emerald-600/30 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-yellow/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <CardContent className="p-8 md:p-12 relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left: Title and Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-emerald-400" />
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-bone-white">
                The <span className="text-emerald-400">Green Room</span>
              </h1>
            </div>
            <p className="text-lg text-bone-white/80 max-w-xl">
              Second Watch's development hub where projects fight for a slot on the slate.
              Submit your vision, rally votes, and earn your place in production.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 pt-4">
              {currentCycle?.status === 'active' && (
                <Button
                  asChild
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Link to={`/greenroom/cycles/${currentCycle.id}`}>
                    <Vote className="h-5 w-5 mr-2" />
                    Vote This Round
                  </Link>
                </Button>
              )}

              {isFilmmaker && (currentCycle?.status === 'active' || currentCycle?.status === 'upcoming') && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black"
                >
                  <Link to="/greenroom/submit">
                    <Send className="h-5 w-5 mr-2" />
                    Submit a Project
                  </Link>
                </Button>
              )}

              {!isFilmmaker && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-muted-gray text-bone-white hover:bg-muted-gray/50"
                >
                  <Link to="/apply/filmmaker">
                    <Flame className="h-5 w-5 mr-2" />
                    Become a Creator
                  </Link>
                </Button>
              )}

              <Button
                variant="ghost"
                size="lg"
                className="text-bone-white/70 hover:text-bone-white"
                onClick={onHowItWorksClick}
              >
                <HelpCircle className="h-5 w-5 mr-2" />
                How It Works
              </Button>
            </div>
          </div>

          {/* Right: Current Cycle Status */}
          {currentCycle ? (
            <div className="bg-charcoal-black/60 backdrop-blur-sm rounded-xl p-6 border border-emerald-600/20">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-gray uppercase tracking-wider">Current Cycle</span>
                  <Badge className={`${getStatusColor(currentCycle.status)} text-white`}>
                    {getPhaseLabel(currentCycle.status)}
                  </Badge>
                </div>

                <h2 className="text-2xl font-heading font-bold text-bone-white">
                  {currentCycle.name}
                </h2>

                {currentCycle.description && (
                  <p className="text-bone-white/70 text-sm line-clamp-2">
                    {currentCycle.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    <div>
                      <p className="text-xs text-muted-gray">Time Remaining</p>
                      <p className="text-sm font-semibold text-bone-white">
                        {getTimeRemaining(currentCycle.end_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                    <div>
                      <p className="text-xs text-muted-gray">Ends</p>
                      <p className="text-sm font-semibold text-bone-white">
                        {new Date(currentCycle.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 pt-2 border-t border-muted-gray/30">
                  <div>
                    <p className="text-2xl font-bold text-emerald-400">
                      {currentCycle.project_count || 0}
                    </p>
                    <p className="text-xs text-muted-gray">Projects</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-accent-yellow">
                      {currentCycle.total_votes || 0}
                    </p>
                    <p className="text-xs text-muted-gray">Votes Cast</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-bone-white">
                      ${currentCycle.ticket_price || 1}
                    </p>
                    <p className="text-xs text-muted-gray">Per Ticket</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-charcoal-black/60 backdrop-blur-sm rounded-xl p-6 border border-muted-gray/30 text-center">
              <Calendar className="h-12 w-12 text-muted-gray mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-bone-white mb-2">No Active Cycle</h3>
              <p className="text-muted-gray">
                The next Green Room cycle will be announced soon. Stay tuned!
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GreenRoomHero;
