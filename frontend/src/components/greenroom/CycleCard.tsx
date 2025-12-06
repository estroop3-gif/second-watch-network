/**
 * Cycle Card Component
 * Displays voting cycle with status and actions
 */
import { Cycle, CycleStatus } from '@/lib/api/greenroom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Clock, CheckCircle2, Calendar, Users, Ticket } from 'lucide-react';

interface CycleCardProps {
  cycle: Cycle;
  onViewDetails?: (cycle: Cycle) => void;
  onViewResults?: (cycle: Cycle) => void;
  compact?: boolean;
}

export function CycleCard({
  cycle,
  onViewDetails,
  onViewResults,
  compact = false,
}: CycleCardProps) {
  const getStatusConfig = (status: CycleStatus) => {
    const configs = {
      active: { variant: 'default' as const, icon: TrendingUp, label: 'Active', color: 'text-green-500' },
      upcoming: { variant: 'secondary' as const, icon: Clock, label: 'Upcoming', color: 'text-blue-500' },
      closed: { variant: 'outline' as const, icon: CheckCircle2, label: 'Closed', color: 'text-gray-500' },
    };
    return configs[status];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const end = new Date(cycle.end_date);
    const start = new Date(cycle.start_date);

    if (cycle.status === 'upcoming') {
      const diff = start.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? `Starts in ${days} day${days !== 1 ? 's' : ''}` : 'Starting soon';
    }

    if (cycle.status === 'active') {
      const diff = end.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? `${days} day${days !== 1 ? 's' : ''} left` : 'Ending soon';
    }

    return 'Voting ended';
  };

  const getProgress = () => {
    const now = new Date().getTime();
    const start = new Date(cycle.start_date).getTime();
    const end = new Date(cycle.end_date).getTime();

    if (cycle.status === 'upcoming') return 0;
    if (cycle.status === 'closed') return 100;

    const progress = ((now - start) / (end - start)) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const statusConfig = getStatusConfig(cycle.status);
  const StatusIcon = statusConfig.icon;

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onViewDetails?.(cycle)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{cycle.name}</CardTitle>
            <Badge variant={statusConfig.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{cycle.project_count || 0} projects</span>
            <span>{cycle.total_votes || 0} votes</span>
            <span className={statusConfig.color}>{getTimeRemaining()}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-xl">{cycle.name}</CardTitle>
          <Badge variant={statusConfig.variant} className="gap-1 shrink-0">
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
        {cycle.description && (
          <CardDescription className="line-clamp-2">{cycle.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Voting Period */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>
            {formatDate(cycle.start_date)} - {formatDate(cycle.end_date)}
          </span>
        </div>

        {/* Progress Bar for active cycles */}
        {cycle.status === 'active' && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className={statusConfig.color}>{getTimeRemaining()}</span>
            </div>
            <Progress value={getProgress()} className="h-2" />
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Projects</span>
            </div>
            <p className="text-2xl font-bold">{cycle.project_count || 0}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Total Votes</span>
            </div>
            <p className="text-2xl font-bold">{cycle.total_votes || 0}</p>
          </div>
        </div>

        {/* Ticket Info */}
        <div className="flex items-center gap-2 text-sm">
          <Ticket className="h-4 w-4 text-muted-foreground" />
          <span>
            ${cycle.ticket_price.toFixed(2)} per ticket
            <span className="text-muted-foreground"> (max {cycle.max_tickets_per_user})</span>
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() => onViewDetails?.(cycle)}
        >
          {cycle.status === 'active' ? 'Vote Now' : 'View Details'}
        </Button>
        {cycle.status === 'closed' && onViewResults && (
          <Button
            variant="outline"
            onClick={() => onViewResults(cycle)}
          >
            Results
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
