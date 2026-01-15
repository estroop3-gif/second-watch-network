/**
 * AssetFolderTree - Collapsible folder tree navigation for Asset Folders
 * Displays nested folder structure created from desktop app
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { AssetFolder, AssetFolderType } from '@/types/backlot';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit2,
  Music,
  Box,
  Image,
  FileText,
  Layers,
  Home,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface AssetFolderTreeProps {
  folders: AssetFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onEditFolder?: (folder: AssetFolder) => void;
  onDeleteFolder?: (folder: AssetFolder) => void;
  isLoading?: boolean;
  canEdit?: boolean;
}

interface FolderItemProps {
  folder: AssetFolder;
  level: number;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onEditFolder?: (folder: AssetFolder) => void;
  onDeleteFolder?: (folder: AssetFolder) => void;
  canEdit?: boolean;
}

// Icon based on folder type
const FolderTypeIcon: React.FC<{ type: AssetFolderType | null; isOpen: boolean; className?: string }> = ({
  type,
  isOpen,
  className
}) => {
  const iconClass = cn('w-4 h-4', className);

  switch (type) {
    case 'audio':
      return <Music className={iconClass} />;
    case '3d':
      return <Box className={iconClass} />;
    case 'graphics':
      return <Image className={iconClass} />;
    case 'documents':
      return <FileText className={iconClass} />;
    case 'mixed':
      return <Layers className={iconClass} />;
    default:
      return isOpen ? <FolderOpen className={iconClass} /> : <Folder className={iconClass} />;
  }
};

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  level,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  canEdit,
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
        <FolderTypeIcon
          type={folder.folder_type}
          isOpen={isExpanded}
          className={isSelected ? 'text-accent-yellow' : 'text-accent-yellow/70'}
        />

        {/* Folder Name */}
        <span className="flex-1 text-sm truncate">{folder.name}</span>

        {/* Folder Type Badge */}
        {folder.folder_type && (
          <span className="text-[10px] text-muted-gray uppercase tracking-wider">
            {folder.folder_type}
          </span>
        )}

        {/* Actions Menu */}
        {canEdit && (
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
        )}
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
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AssetFolderTree: React.FC<AssetFolderTreeProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  isLoading,
  canEdit,
}) => {
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
        <span className="text-sm font-medium text-bone-white">Asset Folders</span>
        {canEdit && (
          <button
            onClick={() => onCreateFolder(null)}
            className="p-1 rounded hover:bg-white/10 transition-colors text-muted-gray hover:text-bone-white"
            title="New Folder"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Root / All Files */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors mb-1',
            isRootSelected
              ? 'bg-accent-yellow/20 text-accent-yellow'
              : 'hover:bg-white/5 text-bone-white/80 hover:text-bone-white'
          )}
          onClick={() => onSelectFolder(null)}
        >
          <Home className="w-4 h-4" />
          <span className="flex-1 text-sm">All Files</span>
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
              canEdit={canEdit}
            />
          ))
        ) : (
          <div className="px-3 py-4 text-center text-muted-gray text-sm">
            No folders yet.
            {canEdit && (
              <>
                <br />
                <button
                  onClick={() => onCreateFolder(null)}
                  className="text-accent-yellow hover:underline mt-1"
                >
                  Create your first folder
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetFolderTree;
