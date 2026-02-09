import { useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Mail, MailOpen, Archive, Star, CheckSquare, Square, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { normalizeSubject } from '@/lib/emailUtils';

interface Thread {
  id: string;
  subject: string;
  contact_email: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_company?: string;
  account_email?: string;
  participants?: string[];
  unread_count: number;
  last_message_at: string;
  is_archived: boolean;
  is_starred?: boolean;
  labels?: { id: string; name: string; color: string }[];
  assigned_to_name?: string;
  last_message_preview?: string;
  message_count?: number;
  has_attachments?: boolean;
}

interface EmailThreadListProps {
  threads: Thread[];
  selectedThreadId?: string;
  onSelectThread: (threadId: string) => void;
  isLoading?: boolean;
  bulkMode?: boolean;
  selectedThreadIds?: string[];
  onToggleSelect?: (threadId: string) => void;
  selectedIndex?: number;
}

const EmailThreadList = ({
  threads, selectedThreadId, onSelectThread, isLoading,
  bulkMode, selectedThreadIds = [], onToggleSelect, selectedIndex = -1,
}: EmailThreadListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Scroll selected item into view for keyboard navigation
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (isLoading) {
    return (
      <div className="space-y-0 divide-y divide-muted-gray/30">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[72px] bg-muted-gray/10 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!threads.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-gray">
        <Mail className="h-10 w-10 mb-3 opacity-50" />
        <p className="text-sm">No emails yet</p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="divide-y divide-muted-gray/30">
      {threads.map((thread, index) => {
        const contactName = thread.contact_first_name
          ? `${thread.contact_first_name} ${thread.contact_last_name || ''}`.trim()
          : thread.contact_email;
        const isSelected = thread.id === selectedThreadId;
        const isUnread = thread.unread_count > 0;
        const isKeyboardHighlighted = index === selectedIndex;
        const isChecked = selectedThreadIds.includes(thread.id);
        const displaySubject = normalizeSubject(thread.subject);

        // Build participant display like Gmail: "Me, Contact (3)"
        const participantParts: string[] = [];
        if (thread.message_count && thread.message_count > 1) {
          participantParts.push('Me');
        }
        participantParts.push(contactName);

        return (
          <button
            key={thread.id}
            ref={el => { itemRefs.current[index] = el; }}
            onClick={() => {
              if (bulkMode && onToggleSelect) {
                onToggleSelect(thread.id);
              } else {
                onSelectThread(thread.id);
              }
            }}
            className={cn(
              'w-full text-left px-4 py-3 transition-colors hover:bg-muted-gray/20',
              isSelected && 'bg-accent-yellow/10 border-l-2 border-accent-yellow',
              !isSelected && isKeyboardHighlighted && 'bg-muted-gray/10 border-l-2 border-muted-gray',
              !isSelected && !isKeyboardHighlighted && 'border-l-2 border-transparent'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox or mail icon */}
              <div className="mt-1 flex-shrink-0">
                {bulkMode ? (
                  isChecked ? (
                    <CheckSquare className="h-4 w-4 text-accent-yellow" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-gray" />
                  )
                ) : isUnread ? (
                  <Mail className="h-4 w-4 text-accent-yellow" />
                ) : thread.is_archived ? (
                  <Archive className="h-4 w-4 text-muted-gray" />
                ) : (
                  <MailOpen className="h-4 w-4 text-muted-gray/60" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                {/* Row 1: Participants, message count, timestamp */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
                    {thread.is_starred && (
                      <Star className="h-3 w-3 text-accent-yellow fill-accent-yellow flex-shrink-0" />
                    )}
                    <span className={cn(
                      'text-sm truncate max-w-[200px]',
                      isUnread ? 'font-semibold text-bone-white' : 'text-bone-white/80'
                    )}>
                      {participantParts.join(', ')}
                    </span>
                    {thread.message_count && thread.message_count > 1 && (
                      <span className="text-xs text-muted-gray flex-shrink-0">({thread.message_count})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                    {thread.has_attachments && (
                      <Paperclip className="h-3 w-3 text-muted-gray" />
                    )}
                    {isUnread && (
                      <Badge variant="default" className="bg-accent-yellow text-charcoal-black text-xs px-1.5 py-0">
                        {thread.unread_count}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-gray whitespace-nowrap">
                      {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Row 2: Subject */}
                <p className={cn(
                  'text-sm truncate mt-0.5',
                  isUnread ? 'font-medium text-bone-white' : 'text-bone-white/70'
                )}>
                  {displaySubject}
                </p>

                {/* Row 3: Message preview snippet */}
                {thread.last_message_preview && (
                  <p className="text-xs text-muted-gray/70 truncate mt-0.5">
                    {thread.last_message_preview}
                  </p>
                )}

                {/* Row 4: Company, assigned rep, labels */}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {thread.contact_company && (
                    <span className="text-xs text-muted-gray">{thread.contact_company}</span>
                  )}
                  {thread.assigned_to_name && (
                    <span className="text-[10px] text-accent-yellow/70 bg-accent-yellow/10 px-1.5 py-0 rounded">
                      {thread.assigned_to_name}
                    </span>
                  )}
                  {thread.labels?.map((label: any) => (
                    <span
                      key={label.id}
                      className="text-[10px] px-1.5 py-0 rounded"
                      style={{ backgroundColor: `${label.color}20`, color: label.color }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default EmailThreadList;
