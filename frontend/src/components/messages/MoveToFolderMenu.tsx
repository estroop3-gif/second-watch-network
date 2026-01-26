/**
 * MoveToFolderMenu
 * Dropdown menu for moving a conversation to a custom folder
 */

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  useCustomFolders,
  useAssignConversation,
  useUnassignConversation,
  useConversationAssignment,
} from '@/hooks/useCustomFolders';
import {
  FolderInput,
  FolderMinus,
  Folder,
  Check,
  Loader2,
  Star,
  Heart,
  Briefcase,
  Home,
  Users,
  Tag,
  Flag,
  Bookmark,
  Bell,
  Zap,
  Coffee,
  Gift,
  Music,
  Camera,
} from 'lucide-react';

// Icon component map
const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star,
  heart: Heart,
  briefcase: Briefcase,
  home: Home,
  users: Users,
  tag: Tag,
  flag: Flag,
  bookmark: Bookmark,
  bell: Bell,
  zap: Zap,
  coffee: Coffee,
  gift: Gift,
  music: Music,
  camera: Camera,
  folder: Folder,
};

interface MoveToFolderMenuProps {
  partnerId: string;
  trigger?: React.ReactNode;
  onMoved?: () => void;
}

export function MoveToFolderMenu({ partnerId, trigger, onMoved }: MoveToFolderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: folders, isLoading: foldersLoading } = useCustomFolders();
  const { data: assignment } = useConversationAssignment(partnerId);
  const assignConversation = useAssignConversation();
  const unassignConversation = useUnassignConversation();

  const isLoading = assignConversation.isPending || unassignConversation.isPending;
  const currentFolderId = assignment?.folder_id;

  const handleMoveToFolder = async (folderId: string) => {
    try {
      await assignConversation.mutateAsync({ folderId, partnerId });
      onMoved?.();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to move conversation:', error);
    }
  };

  const handleRemoveFromFolder = async () => {
    try {
      await unassignConversation.mutateAsync(partnerId);
      onMoved?.();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to remove from folder:', error);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <FolderInput className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56 bg-charcoal-black border-muted-gray text-bone-white"
      >
        <DropdownMenuLabel className="text-muted-foreground">
          Move to folder
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-muted-gray/30" />

        {foldersLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !folders || folders.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No custom folders yet.
            <br />
            Create one from the sidebar.
          </div>
        ) : (
          <>
            {folders.map((folder) => {
              const Icon = ICON_COMPONENTS[folder.icon || 'folder'] || Folder;
              const isCurrentFolder = currentFolderId === folder.id;

              return (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => !isCurrentFolder && handleMoveToFolder(folder.id)}
                  disabled={isLoading || isCurrentFolder}
                  className="cursor-pointer"
                >
                  <Icon
                    className="h-4 w-4 mr-2"
                    style={{ color: folder.color || undefined }}
                  />
                  <span className="flex-1">{folder.name}</span>
                  {isCurrentFolder && (
                    <Check className="h-4 w-4 text-accent-yellow" />
                  )}
                </DropdownMenuItem>
              );
            })}

            {currentFolderId && (
              <>
                <DropdownMenuSeparator className="bg-muted-gray/30" />
                <DropdownMenuItem
                  onClick={handleRemoveFromFolder}
                  disabled={isLoading}
                  className="cursor-pointer text-muted-foreground hover:text-bone-white"
                >
                  <FolderMinus className="h-4 w-4 mr-2" />
                  Remove from folder
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Compact folder badge to show current folder assignment
 */
export function FolderBadge({ partnerId }: { partnerId: string }) {
  const { data: assignment } = useConversationAssignment(partnerId);

  if (!assignment) return null;

  const Icon = ICON_COMPONENTS[assignment.icon || 'folder'] || Folder;

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
      style={{
        backgroundColor: `${assignment.color}20` || 'rgba(255, 60, 60, 0.1)',
        color: assignment.color || '#FF3C3C',
      }}
    >
      <Icon className="h-3 w-3" />
      <span className="truncate max-w-[60px]">{assignment.folder_name}</span>
    </span>
  );
}
