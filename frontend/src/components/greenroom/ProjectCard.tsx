/**
 * Project Card Component
 * Displays project with voting interface
 */
'use client';

import { Project } from '@/lib/api/greenroom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Film, ThumbsUp, User, Calendar } from 'lucide-react';
import Image from 'next/image';

interface ProjectCardProps {
  project: Project;
  onVote?: (project: Project) => void;
  onViewDetails?: (project: Project) => void;
  showVoteButton?: boolean;
  userVoteCount?: number;
}

export function ProjectCard({
  project,
  onVote,
  onViewDetails,
  showVoteButton = true,
  userVoteCount = 0,
}: ProjectCardProps) {
  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      drama: 'bg-blue-500',
      comedy: 'bg-yellow-500',
      action: 'bg-red-500',
      documentary: 'bg-green-500',
      horror: 'bg-purple-500',
      scifi: 'bg-cyan-500',
    };
    return colors[category?.toLowerCase() || ''] || 'bg-gray-500';
  };

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
      {/* Project Image */}
      {project.image_url && (
        <div className="relative w-full h-48 overflow-hidden rounded-t-lg">
          <Image
            src={project.image_url}
            alt={project.title}
            fill
            className="object-cover"
          />
        </div>
      )}

      <CardHeader>
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-xl line-clamp-2">{project.title}</CardTitle>
          {project.category && (
            <Badge variant="secondary" className="shrink-0">
              {project.category}
            </Badge>
          )}
        </div>

        {/* Vote Count */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <ThumbsUp className="h-4 w-4" />
            <span className="font-semibold text-foreground">{project.vote_count}</span>
            <span>votes</span>
          </div>
          {userVoteCount > 0 && (
            <Badge variant="outline" className="gap-1">
              You: {userVoteCount} tickets
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <CardDescription className="line-clamp-3 mb-4">
          {project.description}
        </CardDescription>

        <div className="space-y-2 text-sm">
          {project.filmmaker_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{project.filmmaker_name}</span>
            </div>
          )}

          {project.video_url && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Film className="h-4 w-4" />
              <a
                href={project.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Watch Pitch Video
              </a>
            </div>
          )}

          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Submitted {new Date(project.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => onViewDetails?.(project)}
        >
          Details
        </Button>
        {showVoteButton && onVote && (
          <Button
            className="flex-1"
            onClick={() => onVote(project)}
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            Vote
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
