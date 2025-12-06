/**
 * Cycle Results Component
 * Displays voting results with rankings
 */
'use client';

import { useEffect, useState } from 'react';
import { greenroomAPI, CycleResults as CycleResultsType, ProjectResult } from '@/lib/api/greenroom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Trophy, Medal, Award, ThumbsUp, Users, Film } from 'lucide-react';

interface CycleResultsProps {
  cycleId: number;
  onProjectClick?: (projectId: number) => void;
}

export function CycleResults({ cycleId, onProjectClick }: CycleResultsProps) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<CycleResultsType | null>(null);

  useEffect(() => {
    loadResults();
  }, [cycleId]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const data = await greenroomAPI.getCycleResults(cycleId);
      setResults(data);
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      case 2:
        return 'border-gray-400 bg-gray-50 dark:bg-gray-950/20';
      case 3:
        return 'border-amber-600 bg-amber-50 dark:bg-amber-950/20';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!results) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No results available for this cycle.
        </CardContent>
      </Card>
    );
  }

  const maxVotes = results.projects.length > 0
    ? Math.max(...results.projects.map(p => p.vote_count))
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          {results.cycle_name} Results
        </CardTitle>
        <CardDescription>
          Final voting results for this cycle
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
          <div className="text-center">
            <Film className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{results.total_projects}</p>
            <p className="text-xs text-muted-foreground">Projects</p>
          </div>
          <div className="text-center">
            <ThumbsUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{results.total_votes}</p>
            <p className="text-xs text-muted-foreground">Total Votes</p>
          </div>
          <div className="text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{results.total_voters}</p>
            <p className="text-xs text-muted-foreground">Voters</p>
          </div>
        </div>

        {/* Rankings */}
        <div className="space-y-3">
          {results.projects.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No projects were submitted to this cycle.
            </p>
          ) : (
            results.projects.map((project) => (
              <div
                key={project.project_id}
                className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${getRankStyle(project.rank)}`}
                onClick={() => onProjectClick?.(project.project_id)}
              >
                {/* Rank */}
                <div className="flex items-center justify-center w-10 h-10">
                  {getRankIcon(project.rank)}
                </div>

                {/* Project Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{project.title}</h4>
                  {project.filmmaker_name && (
                    <p className="text-sm text-muted-foreground truncate">
                      by {project.filmmaker_name}
                    </p>
                  )}

                  {/* Vote Bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <Progress
                      value={maxVotes > 0 ? (project.vote_count / maxVotes) * 100 : 0}
                      className="h-2 flex-1"
                    />
                    <span className="text-sm text-muted-foreground w-16 text-right">
                      {((project.vote_count / (results.total_votes || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Vote Count */}
                <Badge variant={project.rank <= 3 ? 'default' : 'secondary'} className="gap-1 shrink-0">
                  <ThumbsUp className="h-3 w-3" />
                  {project.vote_count}
                </Badge>
              </div>
            ))
          )}
        </div>

        {/* Winner Highlight */}
        {results.projects.length > 0 && results.projects[0] && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-950/30 dark:to-amber-950/30 border border-yellow-300 dark:border-yellow-800">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Winner</p>
                <p className="text-lg font-bold">{results.projects[0].title}</p>
                <p className="text-sm text-muted-foreground">
                  {results.projects[0].vote_count} votes ({((results.projects[0].vote_count / (results.total_votes || 1)) * 100).toFixed(1)}% of total)
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
