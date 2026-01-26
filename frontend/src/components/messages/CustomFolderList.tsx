/**
 * CustomFolderList
 * Renders custom message folders in the sidebar with unread counts
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomFolder } from '@/hooks/useCustomFolders';
import {
  FolderPlus,
  Settings,
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
  Folder,
} from 'lucide-react';

// Icon mapping for folder icons
const FOLDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
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

interface CustomFolderListProps {
  folders: CustomFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: () => void;
  onManageFolders: () => void;
  isLoading?: boolean;
  isCollapsed?: boolean;
}

export function CustomFolderList({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onManageFolders,
  isLoading,
  isCollapsed,
}: CustomFolderListProps) {
  if (isLoading) {
    return (
      <div className="p-2 space-y-1">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Divider */}
      {folders.length > 0 && (
        <div className="border-t border-muted-gray/30 my-2" />
      )}

      {/* Custom folders */}
      <div className="space-y-1 px-2">
        {folders.map((folder) => {
          const Icon = FOLDER_ICONS[folder.icon || 'folder'] || Folder;
          const isActive = selectedFolderId === `custom:${folder.id}`;

          return (
            <button
              key={folder.id}
              onClick={() => onSelectFolder(`custom:${folder.id}`)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative',
                isActive
                  ? 'bg-accent-yellow/20 text-accent-yellow'
                  : 'text-bone-white hover:bg-muted-gray/30',
                isCollapsed && 'justify-center px-2'
              )}
              title={isCollapsed ? folder.name : undefined}
            >
              <Icon
                className="h-4 w-4 flex-shrink-0"
                style={{ color: folder.color || undefined }}
              />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left truncate">{folder.name}</span>
                  {folder.unread_count > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-xs px-1.5 py-0.5 min-w-[20px] text-center"
                      style={{
                        backgroundColor: folder.color || '#FF3C3C',
                        color: '#FFFFFF',
                      }}
                    >
                      {folder.unread_count > 99 ? '99+' : folder.unread_count}
                    </Badge>
                  )}
                </>
              )}
              {isCollapsed && folder.unread_count > 0 && (
                <span
                  className="absolute -top-1 -right-1 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center"
                  style={{ backgroundColor: folder.color || '#FF3C3C' }}
                >
                  {folder.unread_count > 9 ? '9+' : folder.unread_count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="border-t border-muted-gray/30 mt-2 pt-2 px-2 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateFolder}
          className={cn(
            'w-full justify-start text-muted-foreground hover:text-bone-white',
            isCollapsed && 'justify-center px-2'
          )}
          title={isCollapsed ? 'Create Folder' : undefined}
        >
          <FolderPlus className="h-4 w-4 mr-2" />
          {!isCollapsed && 'Create Folder'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onManageFolders}
          className={cn(
            'w-full justify-start text-muted-foreground hover:text-bone-white',
            isCollapsed && 'justify-center px-2'
          )}
          title={isCollapsed ? 'Manage Folders' : undefined}
        >
          <Settings className="h-4 w-4 mr-2" />
          {!isCollapsed && 'Manage Folders'}
        </Button>
      </div>
    </div>
  );
}

// Export icon options for folder creation
export const FOLDER_ICON_OPTIONS = Object.keys(FOLDER_ICONS);

// Export color options for folder creation
export const FOLDER_COLOR_OPTIONS = [
  '#FF3C3C', // Primary Red
  '#FCDC58', // Accent Yellow
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#9C27B0', // Purple
  '#FF9800', // Orange
  '#E91E63', // Pink
  '#00BCD4', // Cyan
];
