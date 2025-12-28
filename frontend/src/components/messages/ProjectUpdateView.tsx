/**
 * ProjectUpdateView - Read-only timeline of project updates
 *
 * Displays project updates (announcements, milestones, schedule changes)
 * in a timeline format. Users can view updates but cannot reply.
 */
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Film,
  ArrowLeft,
  Megaphone,
  Flag,
  Calendar,
  Bell,
  ExternalLink,
  FileText,
  User
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

// Icons for update types
const UPDATE_TYPE_CONFIG = {
  announcement: { icon: Megaphone, label: 'Announcement', color: 'bg-blue-500' },
  milestone: { icon: Flag, label: 'Milestone', color: 'bg-green-500' },
  schedule_change: { icon: Calendar, label: 'Schedule Change', color: 'bg-orange-500' },
  general: { icon: Bell, label: 'Update', color: 'bg-gray-500' },
};

interface ProjectUpdateViewProps {
  projectId: string;
  projectTitle: string;
  projectThumbnail: string | null;
  isMobile?: boolean;
  onBack?: () => void;
}

interface ProjectUpdate {
  id: string;
  title: string;
  content: string | null;
  type: 'announcement' | 'milestone' | 'schedule_change' | 'general';
  created_at: string;
  has_read: boolean;
  read_at: string | null;
  attachments?: { url: string; name: string; type: string }[];
  author?: {
    id: string;
    full_name: string;
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

export const ProjectUpdateView = ({
  projectId,
  projectTitle,
  projectThumbnail,
  isMobile,
  onBack,
}: ProjectUpdateViewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Fetch project updates
  const { data: updates, isLoading } = useQuery<ProjectUpdate[]>({
    queryKey: ['project-inbox-updates', projectId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return api.getProjectInboxUpdates(projectId, user.id);
    },
    enabled: !!user?.id && !!projectId,
  });

  // Set up intersection observer to mark updates as read when scrolled into view
  useEffect(() => {
    if (!updates || !user?.id) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const updateId = entry.target.getAttribute('data-update-id');
            const hasRead = entry.target.getAttribute('data-has-read') === 'true';

            if (updateId && !hasRead) {
              // Mark as read
              api.markProjectUpdateRead(projectId, updateId, user.id).then(() => {
                // Invalidate queries to refresh unread counts
                queryClient.invalidateQueries({ queryKey: ['inbox'] });
                queryClient.invalidateQueries({ queryKey: ['project-inbox-updates', projectId] });
              });
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [updates, user?.id, projectId, queryClient]);

  // Observe update elements
  useEffect(() => {
    if (!scrollRef.current || !observerRef.current) return;

    const updateElements = scrollRef.current.querySelectorAll('[data-update-id]');
    updateElements.forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => {
      updateElements.forEach((el) => {
        observerRef.current?.unobserve(el);
      });
    };
  }, [updates]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-muted-gray">
        {isMobile && onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <div className="h-10 w-10 rounded-lg bg-primary-red/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {projectThumbnail ? (
            <img src={projectThumbnail} className="h-full w-full object-cover" alt={projectTitle} />
          ) : (
            <Film className="h-5 w-5 text-primary-red" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{projectTitle}</h2>
          <p className="text-xs text-muted-foreground">Project Updates</p>
        </div>

        <Link to={`/backlot/projects/${projectId}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">View Project</span>
          </Button>
        </Link>
      </div>

      {/* Updates Timeline */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {isLoading ? (
            // Loading skeletons
            [...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>
            ))
          ) : updates && updates.length > 0 ? (
            updates.map((update) => (
              <UpdateCard key={update.id} update={update} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No updates yet</p>
              <p className="text-sm">Updates from this project will appear here</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer - Read-only notice */}
      <div className="p-3 border-t border-muted-gray bg-muted-gray/20">
        <p className="text-xs text-center text-muted-foreground">
          Project updates are read-only. Visit the project for more options.
        </p>
      </div>
    </div>
  );
};

// Individual update card
const UpdateCard = ({ update }: { update: ProjectUpdate }) => {
  const config = UPDATE_TYPE_CONFIG[update.type] || UPDATE_TYPE_CONFIG.general;
  const TypeIcon = config.icon;
  const authorName = update.author?.display_name || update.author?.full_name || update.author?.username || 'Unknown';

  return (
    <div
      data-update-id={update.id}
      data-has-read={update.has_read.toString()}
      className="flex gap-3 relative"
    >
      {/* Unread indicator */}
      {!update.has_read && (
        <div className="absolute -left-2 top-4 w-2 h-2 rounded-full bg-primary-red" />
      )}

      {/* Author avatar */}
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={update.author?.avatar_url} alt={authorName} />
        <AvatarFallback>
          {authorName[0]?.toUpperCase() || <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Update content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{authorName}</span>
          <Badge variant="secondary" className={`${config.color} text-white text-xs px-1.5 py-0`}>
            <TypeIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
          </span>
        </div>

        <div className="mt-2 p-3 bg-muted-gray/30 rounded-lg">
          <h3 className="font-semibold text-sm mb-1">{update.title}</h3>
          {update.content && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{update.content}</p>
          )}

          {/* Attachments */}
          {update.attachments && update.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {update.attachments.map((attachment, idx) => (
                <a
                  key={idx}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary-red hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {attachment.name}
                </a>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-1">
          {format(new Date(update.created_at), 'MMM d, yyyy h:mm a')}
        </p>
      </div>
    </div>
  );
};
