/**
 * AdNotesHistoryCard - Display version history of AD notes
 *
 * Features:
 * - List all published note entries for the day
 * - Show version number, timestamp, creator
 * - Expand/collapse to view full content
 * - Click to view with comments
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  History,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Clock,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdNoteEntries, AdNoteEntry } from '@/hooks/backlot/useAdNotes';
import { format, formatDistanceToNow } from 'date-fns';

interface AdNotesHistoryCardProps {
  dayId: string;
  projectId: string;
  canEdit: boolean;
  className?: string;
  onEntryClick?: (entry: AdNoteEntry) => void;
}

const NoteEntryRow: React.FC<{
  entry: AdNoteEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onClick: () => void;
}> = ({ entry, isExpanded, onToggle, onClick }) => {
  const createdAt = new Date(entry.created_at);
  const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true });
  const formattedTime = format(createdAt, 'h:mm a');

  const initials = entry.creator?.display_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  // Truncate content for preview
  const previewContent =
    entry.content.length > 100 ? entry.content.slice(0, 100) + '...' : entry.content;

  return (
    <div className="border border-muted-gray/20 rounded-md bg-charcoal-black/50 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted-gray/5"
        onClick={onToggle}
      >
        <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-gray" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-gray" />
          )}
        </Button>

        <Badge
          variant="outline"
          className="text-xs bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow"
        >
          v{entry.version_number}
        </Badge>

        <div className="flex items-center gap-1 text-xs text-muted-gray">
          <Clock className="w-3 h-3" />
          <span>{formattedTime}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Avatar className="w-5 h-5">
            <AvatarImage src={entry.creator?.avatar_url} />
            <AvatarFallback className="text-[10px] bg-muted-gray/20">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-bone-white truncate">
            {entry.creator?.display_name || 'Unknown'}
          </span>
        </div>

        {(entry.comment_count || 0) > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-gray">
            <MessageSquare className="w-3 h-3" />
            <span>{entry.comment_count}</span>
          </div>
        )}
      </div>

      {/* Content Preview / Expanded */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-muted-gray/10">
          <p className="text-sm text-bone-white/90 whitespace-pre-wrap">{entry.content}</p>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-gray">{timeAgo}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="h-7 text-xs"
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              View Comments
            </Button>
          </div>
        </div>
      )}

      {/* Collapsed Preview */}
      {!isExpanded && (
        <div
          className="px-3 pb-2 cursor-pointer hover:bg-muted-gray/5"
          onClick={onClick}
        >
          <p className="text-xs text-muted-gray line-clamp-2">{previewContent}</p>
        </div>
      )}
    </div>
  );
};

export const AdNotesHistoryCard: React.FC<AdNotesHistoryCardProps> = ({
  dayId,
  projectId,
  canEdit,
  className,
  onEntryClick,
}) => {
  const { data: entries, isLoading, error } = useAdNoteEntries(dayId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card className={cn('bg-soft-black border-muted-gray/20', className)}>
        <CardHeader className="py-3 px-4 border-b border-muted-gray/20">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-accent-yellow" />
            Notes History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const entryCount = entries?.length || 0;

  return (
    <Card className={cn('bg-soft-black border-muted-gray/20', className)}>
      <CardHeader className="py-3 px-4 border-b border-muted-gray/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-accent-yellow" />
            Notes History
          </CardTitle>
          {entryCount > 0 && (
            <Badge variant="outline" className="text-xs bg-muted-gray/10 border-muted-gray/30">
              {entryCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {error ? (
          <p className="text-sm text-red-400 text-center py-4">Failed to load history</p>
        ) : entryCount === 0 ? (
          <div className="text-center py-6">
            <History className="w-8 h-8 mx-auto text-muted-gray/50 mb-2" />
            <p className="text-sm text-muted-gray">No saved notes yet</p>
            <p className="text-xs text-muted-gray/70 mt-1">
              Save a note to start the history
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {entries?.map((entry) => (
              <NoteEntryRow
                key={entry.id}
                entry={entry}
                isExpanded={expandedIds.has(entry.id)}
                onToggle={() => toggleExpanded(entry.id)}
                onClick={() => onEntryClick?.(entry)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
