import { InboxItem, DMInboxItem, ProjectInboxItem } from '@/pages/Messages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { User, Film, Megaphone, Flag, Calendar, Bell } from 'lucide-react';

// Icons for project update types
const UPDATE_TYPE_ICONS = {
  announcement: Megaphone,
  milestone: Flag,
  schedule_change: Calendar,
  general: Bell,
};

interface ConversationListProps {
  items: InboxItem[];
  selectedId: string | null;
  onSelectItem: (id: string) => void;
  isLoading: boolean;
}

export const ConversationList = ({ items, selectedId, onSelectItem, isLoading }: ConversationListProps) => {
  if (isLoading) {
    return (
      <div className="p-2 space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="p-4 text-center text-muted-foreground h-full flex items-center justify-center">No messages yet.</div>;
  }

  return (
    <ScrollArea className="h-full no-scrollbar overflow-x-hidden">
      <div className="flex flex-col gap-1 p-2">
        {items.map((item) => {
          if (item.type === 'project') {
            return <ProjectItem
              key={`project-${item.project_id}`}
              item={item}
              isSelected={selectedId === `project:${item.project_id}`}
              onSelect={() => onSelectItem(`project:${item.project_id}`)}
            />;
          }
          return <DMItem
            key={`dm-${item.id}`}
            item={item}
            isSelected={selectedId === item.id}
            onSelect={() => onSelectItem(item.id)}
          />;
        })}
      </div>
    </ScrollArea>
  );
};

// DM conversation item
const DMItem = ({
  item,
  isSelected,
  onSelect,
}: {
  item: DMInboxItem;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const name = item.other_participant.full_name || item.other_participant.username || 'User';

  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 p-2 rounded-md text-left transition-colors w-full overflow-hidden',
        isSelected ? 'bg-muted-gray' : 'hover:bg-muted-gray/50'
      )}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={item.other_participant.avatar_url || undefined} alt={name} />
        <AvatarFallback>{name?.[0] || <User />}</AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <div className="flex justify-between items-center">
          <p className="font-semibold truncate text-sm">{name}</p>
          <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">
            {item.last_message_at && formatDistanceToNow(new Date(item.last_message_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex justify-between items-start mt-1">
          <p className="text-xs text-muted-foreground truncate">
            {item.last_message || 'No messages yet'}
          </p>
          {item.unread_count > 0 && (
            <span className="bg-accent-yellow text-charcoal-black text-xs font-bold rounded-full px-1.5 py-0.5 ml-2">
              {item.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// Project update item
const ProjectItem = ({
  item,
  isSelected,
  onSelect,
}: {
  item: ProjectInboxItem;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const TypeIcon = UPDATE_TYPE_ICONS[item.update_type || 'general'];

  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 p-2 rounded-md text-left transition-colors w-full overflow-hidden',
        'border-l-4 border-l-primary-red', // Visual distinction
        isSelected ? 'bg-muted-gray' : 'hover:bg-muted-gray/50'
      )}
    >
      {/* Project thumbnail or icon */}
      <div className="h-10 w-10 rounded-lg bg-primary-red/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {item.project_thumbnail ? (
          <img src={item.project_thumbnail} className="h-full w-full object-cover" alt={item.project_title} />
        ) : (
          <Film className="h-5 w-5 text-primary-red" />
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex justify-between items-center">
          <p className="font-semibold truncate text-sm flex items-center gap-1.5">
            <TypeIcon className="h-3 w-3 text-primary-red flex-shrink-0" />
            <span className="truncate">{item.project_title}</span>
          </p>
          <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">
            {item.last_message_at && formatDistanceToNow(new Date(item.last_message_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex justify-between items-start mt-1">
          <p className="text-xs text-muted-foreground truncate">
            {item.last_message || 'No updates yet'}
          </p>
          {item.unread_count > 0 && (
            <span className="bg-primary-red text-bone-white text-xs font-bold rounded-full px-1.5 py-0.5 ml-2">
              {item.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
