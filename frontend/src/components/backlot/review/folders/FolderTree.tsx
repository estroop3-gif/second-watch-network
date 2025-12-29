/**
 * FolderTree - Collapsible folder tree navigation for Review tab
 * Displays nested folder structure with drag-and-drop support
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ReviewFolder, ReviewAssetEnhanced } from '@/types/backlot';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit2,
  Move,
  Film,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface FolderTreeProps {
  folders: ReviewFolder[];
  rootAssets?: ReviewAssetEnhanced[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onEditFolder?: (folder: ReviewFolder) => void;
  onDeleteFolder?: (folder: ReviewFolder) => void;
  onMoveFolder?: (folder: ReviewFolder) => void;
  isLoading?: boolean;
}

interface FolderItemProps {
  folder: ReviewFolder;
  level: number;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onEditFolder?: (folder: ReviewFolder) => void;
  onDeleteFolder?: (folder: ReviewFolder) => void;
  onMoveFolder?: (folder: ReviewFolder) => void;
}

const FOLDER_COLORS: Record<string, string> = {
  '#ef4444': 'bg-red-500',
  '#f97316': 'bg-orange-500',
  '#eab308': 'bg-yellow-500',
  '#22c55e': 'bg-green-500',
  '#3b82f6': 'bg-blue-500',
  '#8b5cf6': 'bg-purple-500',
  '#ec4899': 'bg-pink-500',
};

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  level,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onMoveFolder,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedFolderId === folder.id;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleSelect = () => {
    onSelectFolder(folder.id);
    if (hasChildren) {
      setIsExpanded(true);
    }
  };

  // Get folder icon color
  const colorClass = folder.color ? FOLDER_COLORS[folder.color] : null;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
          isSelected
            ? 'bg-accent-yellow/20 text-accent-yellow'
            : 'hover:bg-white/5 text-bone-white/80 hover:text-bone-white'
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        onClick={handleSelect}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={handleToggle}
          className={cn(
            'p-0.5 rounded hover:bg-white/10 transition-colors',
            !hasChildren && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Folder Icon */}
        <div className="relative">
          {isExpanded ? (
            <FolderOpen className={cn('w-4 h-4', colorClass ? '' : 'text-accent-yellow/70')} />
          ) : (
            <Folder className={cn('w-4 h-4', colorClass ? '' : 'text-accent-yellow/70')} />
          )}
          {colorClass && (
            <div
              className={cn('absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full', colorClass)}
            />
          )}
        </div>

        {/* Folder Name */}
        <span className="flex-1 text-sm truncate">{folder.name}</span>

        {/* Asset Count */}
        {(folder.asset_count ?? 0) > 0 && (
          <span className="text-xs text-muted-gray">
            {folder.asset_count}
          </span>
        )}

        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onCreateFolder(folder.id)}>
              <Plus className="w-4 h-4 mr-2" />
              New Subfolder
            </DropdownMenuItem>
            {onEditFolder && (
              <DropdownMenuItem onClick={() => onEditFolder(folder)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
            )}
            {onMoveFolder && (
              <DropdownMenuItem onClick={() => onMoveFolder(folder)}>
                <Move className="w-4 h-4 mr-2" />
                Move
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onDeleteFolder && (
              <DropdownMenuItem
                onClick={() => onDeleteFolder(folder)}
                className="text-red-400 focus:text-red-400"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              onCreateFolder={onCreateFolder}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
              onMoveFolder={onMoveFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  rootAssets,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onMoveFolder,
  isLoading,
}) => {
  const rootAssetCount = rootAssets?.length ?? 0;
  const isRootSelected = selectedFolderId === null;

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-sm font-medium text-bone-white">Folders</span>
        <button
          onClick={() => onCreateFolder(null)}
          className="p-1 rounded hover:bg-white/10 transition-colors text-muted-gray hover:text-bone-white"
          title="New Folder"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Root / All Assets */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors mb-1',
            isRootSelected
              ? 'bg-accent-yellow/20 text-accent-yellow'
              : 'hover:bg-white/5 text-bone-white/80 hover:text-bone-white'
          )}
          onClick={() => onSelectFolder(null)}
        >
          <Film className="w-4 h-4" />
          <span className="flex-1 text-sm">All Assets</span>
          {rootAssetCount > 0 && (
            <span className="text-xs text-muted-gray">{rootAssetCount}</span>
          )}
        </div>

        {/* Folders */}
        {folders.length > 0 ? (
          folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              level={0}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              onCreateFolder={onCreateFolder}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
              onMoveFolder={onMoveFolder}
            />
          ))
        ) : (
          <div className="px-3 py-4 text-center text-muted-gray text-sm">
            No folders yet.
            <br />
            <button
              onClick={() => onCreateFolder(null)}
              className="text-accent-yellow hover:underline mt-1"
            >
              Create your first folder
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderTree;
