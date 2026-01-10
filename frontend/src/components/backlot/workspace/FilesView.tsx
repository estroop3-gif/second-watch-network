/**
 * FilesView - Project file management with folder hierarchy
 *
 * Features:
 * - Folder tree navigation
 * - File list with search and filters
 * - S3 upload with presigned URLs (single + multipart)
 * - Download via presigned GET
 * - File tagging and linking
 * - Bulk upload with progress tracking
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  FolderOpen,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileArchive,
  FileType2,
  MoreVertical,
  Search,
  Filter,
  Tag,
  X,
  Check,
  Link2,
  Eye,
  Pencil,
  RefreshCw,
  ExternalLink,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useProjectFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useProjectFilesList,
  useUpdateFile,
  useDeleteFile,
  useFileDownloadUrl,
  useFileTags,
  FileUploadManager,
  getFileIcon,
  formatFileSize,
  FILE_TYPE_FILTERS,
  ProjectFolder,
  ProjectFile,
  UploadProgress,
} from '@/hooks/backlot';

interface FilesViewProps {
  projectId: string;
  canEdit: boolean;
}

// File Icon Component
function FileIcon({ extension, mimeType, className }: { extension?: string; mimeType?: string; className?: string }) {
  const iconType = getFileIcon(mimeType || null, extension || null);
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    image: FileImage,
    video: FileVideo,
    audio: FileAudio,
    pdf: FileType2,
    doc: FileText,
    spreadsheet: FileText,
    presentation: FileText,
    file: File,
  };
  const IconComponent = iconMap[iconType] || File;
  return <IconComponent className={className} />;
}

// Folder Tree Item Component
function FolderTreeItem({
  folder,
  allFolders,
  selectedFolderId,
  expandedFolderIds,
  depth,
  onSelect,
  onToggleExpand,
  onContextMenu,
}: {
  folder: ProjectFolder;
  allFolders: ProjectFolder[];
  selectedFolderId: string | null;
  expandedFolderIds: Set<string>;
  depth: number;
  onSelect: (folderId: string | null) => void;
  onToggleExpand: (folderId: string) => void;
  onContextMenu: (folder: ProjectFolder, e: React.MouseEvent) => void;
}) {
  const childFolders = allFolders.filter((f) => f.parent_id === folder.id);
  const isExpanded = expandedFolderIds.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = childFolders.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1.5 px-2 cursor-pointer rounded hover:bg-white/5 transition-colors',
          isSelected && 'bg-white/10'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(folder.id)}
        onContextMenu={(e) => onContextMenu(folder, e)}
      >
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-white/10 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(folder.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-gray" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-gray" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <Folder className={cn('w-4 h-4', isSelected ? 'text-accent-yellow' : 'text-muted-gray')} />
        <span className={cn('text-sm truncate flex-1', isSelected ? 'text-bone-white' : 'text-muted-gray')}>
          {folder.name}
        </span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {childFolders
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name))
            .map((child) => (
              <FolderTreeItem
                key={child.id}
                folder={child}
                allFolders={allFolders}
                selectedFolderId={selectedFolderId}
                expandedFolderIds={expandedFolderIds}
                depth={depth + 1}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
                onContextMenu={onContextMenu}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// File Row Component
function FileRow({
  file,
  isSelected,
  onSelect,
  onClick,
  onContextMenu,
}: {
  file: ProjectFile;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors',
        isSelected && 'bg-white/10'
      )}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onSelect(!!checked)}
        onClick={(e) => e.stopPropagation()}
      />
      <FileIcon extension={file.extension} mimeType={file.mime_type} className="w-5 h-5 text-muted-gray" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-bone-white truncate">{file.name}</span>
          {file.upload_status === 'UPLOADING' && (
            <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
              Uploading
            </Badge>
          )}
          {file.upload_status === 'FAILED' && (
            <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">
              Failed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-gray">{formatFileSize(file.size_bytes)}</span>
          {file.extension && (
            <span className="text-xs text-muted-gray uppercase">.{file.extension}</span>
          )}
          {file.tags && file.tags.length > 0 && (
            <div className="flex gap-1">
              {file.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs py-0 px-1 border-white/20">
                  {tag}
                </Badge>
              ))}
              {file.tags.length > 2 && (
                <span className="text-xs text-muted-gray">+{file.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-gray">
        {file.uploaded_at
          ? new Date(file.uploaded_at).toLocaleDateString()
          : new Date(file.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

// Breadcrumb Component
function Breadcrumb({
  folders,
  currentFolderId,
  onNavigate,
}: {
  folders: ProjectFolder[];
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}) {
  // Build path from root to current folder
  const path: ProjectFolder[] = [];
  let current = currentFolderId ? folders.find((f) => f.id === currentFolderId) : null;
  while (current) {
    path.unshift(current);
    current = current.parent_id ? folders.find((f) => f.id === current.parent_id) : null;
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 transition-colors',
          !currentFolderId && 'text-accent-yellow'
        )}
        onClick={() => onNavigate(null)}
      >
        <Home className="w-4 h-4" />
        <span>All Files</span>
      </button>
      {path.map((folder, index) => (
        <React.Fragment key={folder.id}>
          <ChevronRight className="w-4 h-4 text-muted-gray" />
          <button
            className={cn(
              'px-2 py-1 rounded hover:bg-white/10 transition-colors truncate max-w-[150px]',
              index === path.length - 1 ? 'text-accent-yellow' : 'text-muted-gray'
            )}
            onClick={() => onNavigate(folder.id)}
          >
            {folder.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

// Upload Progress Item
function UploadProgressItem({ progress }: { progress: UploadProgress }) {
  const statusColors: Record<string, string> = {
    pending: 'text-muted-gray',
    uploading: 'text-accent-yellow',
    complete: 'text-green-400',
    error: 'text-red-400',
    aborted: 'text-red-400',
  };

  return (
    <div className="p-3 border-b border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <File className="w-4 h-4 text-muted-gray" />
        <span className="text-sm text-bone-white truncate flex-1">{progress.fileName}</span>
        <span className={cn('text-xs', statusColors[progress.status] || 'text-muted-gray')}>
          {progress.status === 'uploading' ? `${Math.round(progress.percentage)}%` : progress.status}
        </span>
      </div>
      {progress.status === 'uploading' && <Progress value={progress.percentage} className="h-1" />}
      {progress.error && <div className="text-xs text-red-400 mt-1">{progress.error}</div>}
    </div>
  );
}

// Main FilesView Component
export function FilesView({ projectId, canEdit }: FilesViewProps) {
  // State
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);

  // Dialogs
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showRenameFolderDialog, setShowRenameFolderDialog] = useState(false);
  const [showDeleteFolderDialog, setShowDeleteFolderDialog] = useState(false);
  const [showFileEditDialog, setShowFileEditDialog] = useState(false);
  const [showDeleteFileDialog, setShowDeleteFileDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);
  const [editingFile, setEditingFile] = useState<ProjectFile | null>(null);

  // Form state
  const [newFolderName, setNewFolderName] = useState('');
  const [fileForm, setFileForm] = useState({ name: '', notes: '', tags: [] as string[] });

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadManagerRef = useRef<FileUploadManager | null>(null);

  // API hooks
  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useProjectFolders(projectId);
  const { data: filesData, isLoading: filesLoading, refetch: refetchFiles } = useProjectFilesList(projectId, {
    folder_id: selectedFolderId || undefined,
    search: searchQuery || undefined,
    type: typeFilter || undefined,
    tag: tagFilter || undefined,
  });
  const { data: tagsData } = useFileTags(projectId);
  const { mutateAsync: createFolder, isPending: creatingFolder } = useCreateFolder();
  const { mutateAsync: updateFolder } = useUpdateFolder();
  const { mutateAsync: deleteFolder, isPending: deletingFolder } = useDeleteFolder();
  const { mutateAsync: updateFile } = useUpdateFile();
  const { mutateAsync: deleteFile, isPending: deletingFile } = useDeleteFile();
  const { mutateAsync: getDownloadUrl } = useFileDownloadUrl();

  const folders = foldersData?.folders || [];
  const files = filesData?.files || [];
  const tags = tagsData?.tags || [];

  // Initialize upload manager
  useEffect(() => {
    uploadManagerRef.current = new FileUploadManager(projectId);
    return () => {
      uploadManagerRef.current = null;
    };
  }, [projectId]);

  // Get root folders
  const rootFolders = useMemo(() => {
    return folders
      .filter((f) => !f.parent_id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
  }, [folders]);

  // Toggle folder expansion
  const toggleFolderExpand = useCallback((folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Handle folder context menu
  const handleFolderContextMenu = useCallback(
    (folder: ProjectFolder, e: React.MouseEvent) => {
      e.preventDefault();
      if (!canEdit) return;
      setEditingFolder(folder);
    },
    [canEdit]
  );

  // Handle file context menu
  const handleFileContextMenu = useCallback(
    (file: ProjectFile, e: React.MouseEvent) => {
      e.preventDefault();
      setPreviewFile(file);
    },
    []
  );

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder({
        projectId,
        data: {
          name: newFolderName.trim(),
          parent_id: selectedFolderId,
        },
      });
      toast.success('Folder created');
      setShowCreateFolderDialog(false);
      setNewFolderName('');
      refetchFolders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create folder');
    }
  };

  // Rename folder
  const handleRenameFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) return;
    try {
      await updateFolder({
        projectId,
        folderId: editingFolder.id,
        data: { name: newFolderName.trim() },
      });
      toast.success('Folder renamed');
      setShowRenameFolderDialog(false);
      setEditingFolder(null);
      setNewFolderName('');
      refetchFolders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename folder');
    }
  };

  // Delete folder
  const handleDeleteFolder = async () => {
    if (!editingFolder) return;
    try {
      await deleteFolder({ projectId, folderId: editingFolder.id });
      toast.success('Folder deleted');
      setShowDeleteFolderDialog(false);
      if (selectedFolderId === editingFolder.id) {
        setSelectedFolderId(null);
      }
      setEditingFolder(null);
      refetchFolders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete folder');
    }
  };

  // Update file
  const handleUpdateFile = async () => {
    if (!editingFile) return;
    try {
      await updateFile({
        projectId,
        fileId: editingFile.id,
        data: {
          name: fileForm.name || undefined,
          notes: fileForm.notes || undefined,
          tags: fileForm.tags.length > 0 ? fileForm.tags : undefined,
        },
      });
      toast.success('File updated');
      setShowFileEditDialog(false);
      setEditingFile(null);
      refetchFiles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update file');
    }
  };

  // Delete file(s)
  const handleDeleteFiles = async () => {
    const idsToDelete = Array.from(selectedFileIds);
    if (idsToDelete.length === 0) return;
    try {
      await Promise.all(idsToDelete.map((fileId) => deleteFile({ projectId, fileId })));
      toast.success(`${idsToDelete.length} file(s) deleted`);
      setShowDeleteFileDialog(false);
      setSelectedFileIds(new Set());
      refetchFiles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete files');
    }
  };

  // Download file
  const handleDownloadFile = async (file: ProjectFile) => {
    try {
      const result = await getDownloadUrl({ projectId, fileId: file.id });
      window.open(result.url, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download file');
    }
  };

  // Handle file selection for upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setFilesToUpload(files);
    setShowUploadDialog(true);
  };

  // Upload files
  const handleUpload = async () => {
    if (!uploadManagerRef.current || filesToUpload.length === 0) return;

    for (const file of filesToUpload) {
      const progress: UploadProgress = {
        fileId: `temp-${file.name}-${Date.now()}`,
        fileName: file.name,
        loaded: 0,
        total: file.size,
        percentage: 0,
        status: 'pending',
      };
      setUploadProgress((prev) => new Map(prev).set(progress.fileId, progress));

      try {
        await uploadManagerRef.current.uploadFile(file, selectedFolderId || undefined, (p) => {
          setUploadProgress((prev) => new Map(prev).set(p.fileId, p));
        });
      } catch (err: any) {
        setUploadProgress((prev) => {
          const next = new Map(prev);
          next.set(progress.fileId, { ...progress, status: 'error', error: err.message });
          return next;
        });
      }
    }

    setFilesToUpload([]);
    refetchFiles();
    // Clear completed uploads after a delay
    setTimeout(() => {
      setUploadProgress((prev) => {
        const next = new Map(prev);
        for (const [key, value] of next) {
          if (value.status === 'complete') {
            next.delete(key);
          }
        }
        return next;
      });
    }, 3000);
  };

  // Toggle file selection
  const toggleFileSelection = useCallback((fileId: string, selected: boolean) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(fileId);
      } else {
        next.delete(fileId);
      }
      return next;
    });
  }, []);

  // Select all files
  const selectAllFiles = useCallback(() => {
    setSelectedFileIds(new Set(files.map((f) => f.id)));
  }, [files]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedFileIds(new Set());
  }, []);

  if (foldersLoading || filesLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Files</h2>
          <p className="text-sm text-muted-gray">Project file management</p>
        </div>
        <div className="flex gap-4">
          <Skeleton className="w-64 h-96" />
          <Skeleton className="flex-1 h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Files</h2>
          <p className="text-sm text-muted-gray">
            {files.length} file{files.length !== 1 ? 's' : ''} • {folders.length} folder
            {folders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => { refetchFolders(); refetchFiles(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex gap-4 h-[calc(100vh-280px)]">
        {/* Folder Tree */}
        <Card className="w-64 flex-shrink-0 bg-charcoal-black/50 border-white/10">
          <CardHeader className="p-3 pb-2 border-b border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-bone-white">Folders</CardTitle>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setNewFolderName('');
                    setShowCreateFolderDialog(true);
                  }}
                >
                  <FolderPlus className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {/* Root "All Files" option */}
              <div
                className={cn(
                  'flex items-center gap-2 py-1.5 px-2 cursor-pointer rounded hover:bg-white/5 transition-colors',
                  selectedFolderId === null && 'bg-white/10'
                )}
                onClick={() => setSelectedFolderId(null)}
              >
                <FolderOpen className={cn('w-4 h-4', selectedFolderId === null ? 'text-accent-yellow' : 'text-muted-gray')} />
                <span className={cn('text-sm', selectedFolderId === null ? 'text-bone-white' : 'text-muted-gray')}>
                  All Files
                </span>
              </div>
              {/* Folder tree */}
              {rootFolders.map((folder) => (
                <FolderTreeItem
                  key={folder.id}
                  folder={folder}
                  allFolders={folders}
                  selectedFolderId={selectedFolderId}
                  expandedFolderIds={expandedFolderIds}
                  depth={0}
                  onSelect={setSelectedFolderId}
                  onToggleExpand={toggleFolderExpand}
                  onContextMenu={handleFolderContextMenu}
                />
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* File List */}
        <Card className="flex-1 bg-charcoal-black/50 border-white/10 flex flex-col">
          {/* Toolbar */}
          <CardHeader className="p-3 border-b border-white/5 space-y-3">
            {/* Top row: breadcrumb + actions */}
            <div className="flex items-center justify-between">
              <Breadcrumb
                folders={folders}
                currentFolderId={selectedFolderId}
                onNavigate={setSelectedFolderId}
              />
              <div className="flex items-center gap-2">
                {canEdit && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Upload
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewFolderName('');
                        setShowCreateFolderDialog(true);
                      }}
                    >
                      <FolderPlus className="w-4 h-4 mr-1" />
                      New Folder
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Second row: search + filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 bg-white/5 border-white/10"
                />
                {searchQuery && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="w-4 h-4 text-muted-gray" />
                  </button>
                )}
              </div>
              <Select value={typeFilter || '__all__'} onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-[140px] h-8 bg-white/5 border-white/10">
                  <Filter className="w-4 h-4 mr-1 text-muted-gray" />
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All types</SelectItem>
                  {FILE_TYPE_FILTERS.filter((f) => f.value).map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tags.length > 0 && (
                <Select value={tagFilter || '__all__'} onValueChange={(v) => setTagFilter(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-[140px] h-8 bg-white/5 border-white/10">
                    <Tag className="w-4 h-4 mr-1 text-muted-gray" />
                    <SelectValue placeholder="All tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All tags</SelectItem>
                    {tags.filter(Boolean).map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Selection bar */}
            {selectedFileIds.size > 0 && (
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded">
                <span className="text-sm text-bone-white">
                  {selectedFileIds.size} selected
                </span>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
                <div className="flex-1" />
                {canEdit && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteFileDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </CardHeader>

          {/* File list content */}
          <ScrollArea className="flex-1">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="w-12 h-12 text-muted-gray mb-4" />
                <h3 className="text-lg font-medium text-bone-white mb-1">No files</h3>
                <p className="text-sm text-muted-gray max-w-xs">
                  {searchQuery || typeFilter || tagFilter
                    ? 'No files match your search criteria'
                    : 'Upload files to get started'}
                </p>
                {canEdit && !searchQuery && !typeFilter && !tagFilter && (
                  <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1" />
                    Upload Files
                  </Button>
                )}
              </div>
            ) : (
              <div>
                {/* Select all header */}
                <div className="flex items-center gap-3 p-3 border-b border-white/10 bg-white/5">
                  <Checkbox
                    checked={selectedFileIds.size === files.length && files.length > 0}
                    onCheckedChange={(checked) => (checked ? selectAllFiles() : clearSelection())}
                  />
                  <span className="text-xs text-muted-gray uppercase font-medium flex-1">Name</span>
                  <span className="text-xs text-muted-gray uppercase font-medium w-24">Date</span>
                </div>
                {files.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    isSelected={selectedFileIds.has(file.id)}
                    onSelect={(selected) => toggleFileSelection(file.id, selected)}
                    onClick={() => setPreviewFile(file)}
                    onContextMenu={(e) => handleFileContextMenu(file, e)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Upload progress bar */}
          {uploadProgress.size > 0 && (
            <div className="border-t border-white/10 max-h-48 overflow-auto">
              <div className="p-2 bg-white/5 border-b border-white/5">
                <span className="text-xs text-muted-gray font-medium">
                  Uploads ({uploadProgress.size})
                </span>
              </div>
              {Array.from(uploadProgress.values()).map((progress) => (
                <UploadProgressItem key={progress.fileId} progress={progress} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* File Preview Drawer */}
      <Sheet open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <SheetContent className="w-[400px] bg-charcoal-black border-white/10">
          {previewFile && (
            <>
              <SheetHeader>
                <SheetTitle className="text-bone-white flex items-center gap-2">
                  <FileIcon
                    extension={previewFile.extension}
                    mimeType={previewFile.mime_type}
                    className="w-5 h-5"
                  />
                  <span className="truncate">{previewFile.name}</span>
                </SheetTitle>
                <SheetDescription className="text-muted-gray">
                  {formatFileSize(previewFile.size_bytes)}
                  {previewFile.extension && ` • .${previewFile.extension.toUpperCase()}`}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Preview area for images/videos */}
                {previewFile.mime_type?.startsWith('image/') && previewFile.upload_status === 'COMPLETE' && (
                  <div className="aspect-video bg-white/5 rounded overflow-hidden">
                    <img
                      src={`/api/v1/backlot/projects/${projectId}/files/${previewFile.id}/preview`}
                      alt={previewFile.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* File details */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-gray">Original name</Label>
                    <p className="text-sm text-bone-white">{previewFile.original_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-gray">Type</Label>
                    <p className="text-sm text-bone-white">{previewFile.mime_type || 'Unknown'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-gray">Status</Label>
                    <p className="text-sm text-bone-white capitalize">{previewFile.upload_status?.toLowerCase()}</p>
                  </div>
                  {previewFile.uploaded_at && (
                    <div>
                      <Label className="text-xs text-muted-gray">Uploaded</Label>
                      <p className="text-sm text-bone-white">
                        {new Date(previewFile.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {previewFile.notes && (
                    <div>
                      <Label className="text-xs text-muted-gray">Notes</Label>
                      <p className="text-sm text-bone-white">{previewFile.notes}</p>
                    </div>
                  )}
                  {previewFile.tags && previewFile.tags.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-gray">Tags</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {previewFile.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                  <Button
                    className="w-full"
                    onClick={() => handleDownloadFile(previewFile)}
                    disabled={previewFile.upload_status !== 'COMPLETE'}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setEditingFile(previewFile);
                          setFileForm({
                            name: previewFile.name,
                            notes: previewFile.notes || '',
                            tags: previewFile.tags || [],
                          });
                          setShowFileEditDialog(true);
                        }}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => {
                          setSelectedFileIds(new Set([previewFile.id]));
                          setShowDeleteFileDialog(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
        <DialogContent className="bg-charcoal-black border-white/10">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Create Folder</DialogTitle>
            <DialogDescription className="text-muted-gray">
              {selectedFolderId
                ? 'Create a new subfolder in the current folder'
                : 'Create a new folder at the root level'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="folderName">Folder name</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || creatingFolder}>
              {creatingFolder ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog
        open={showRenameFolderDialog}
        onOpenChange={(open) => {
          setShowRenameFolderDialog(open);
          if (!open) setEditingFolder(null);
        }}
      >
        <DialogContent className="bg-charcoal-black border-white/10">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="renameFolderName">Folder name</Label>
              <Input
                id="renameFolderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameFolder} disabled={!newFolderName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Dialog */}
      <AlertDialog open={showDeleteFolderDialog} onOpenChange={setShowDeleteFolderDialog}>
        <AlertDialogContent className="bg-charcoal-black border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">Delete Folder?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              Are you sure you want to delete "{editingFolder?.name}"? Files in this folder will be
              moved to the root level.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteFolder}
              disabled={deletingFolder}
            >
              {deletingFolder ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Files Dialog */}
      <AlertDialog open={showDeleteFileDialog} onOpenChange={setShowDeleteFileDialog}>
        <AlertDialogContent className="bg-charcoal-black border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">Delete Files?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              Are you sure you want to delete {selectedFileIds.size} file
              {selectedFileIds.size !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteFiles}
              disabled={deletingFile}
            >
              {deletingFile ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit File Dialog */}
      <Dialog
        open={showFileEditDialog}
        onOpenChange={(open) => {
          setShowFileEditDialog(open);
          if (!open) setEditingFile(null);
        }}
      >
        <DialogContent className="bg-charcoal-black border-white/10">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Edit File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="fileName">Name</Label>
              <Input
                id="fileName"
                value={fileForm.name}
                onChange={(e) => setFileForm({ ...fileForm, name: e.target.value })}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <Label htmlFor="fileNotes">Notes</Label>
              <Input
                id="fileNotes"
                value={fileForm.notes}
                onChange={(e) => setFileForm({ ...fileForm, notes: e.target.value })}
                placeholder="Add notes..."
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1 mt-1 mb-2">
                {fileForm.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs cursor-pointer"
                    onClick={() =>
                      setFileForm({ ...fileForm, tags: fileForm.tags.filter((t) => t !== tag) })
                    }
                  >
                    {tag}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  className="bg-white/5 border-white/10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.target as HTMLInputElement;
                      const tag = input.value.trim();
                      if (tag && !fileForm.tags.includes(tag)) {
                        setFileForm({ ...fileForm, tags: [...fileForm.tags, tag] });
                        input.value = '';
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFileEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFile}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Confirmation Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-charcoal-black border-white/10">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Upload Files</DialogTitle>
            <DialogDescription className="text-muted-gray">
              {filesToUpload.length} file{filesToUpload.length !== 1 ? 's' : ''} selected
              {selectedFolderId && folders.find((f) => f.id === selectedFolderId)
                ? ` to "${folders.find((f) => f.id === selectedFolderId)?.name}"`
                : ' to root'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-64 overflow-auto">
            {filesToUpload.map((file, index) => (
              <div key={index} className="flex items-center gap-2 py-2 border-b border-white/5">
                <File className="w-4 h-4 text-muted-gray" />
                <span className="text-sm text-bone-white truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-gray">{formatFileSize(file.size)}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadDialog(false);
                setFilesToUpload([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => { setShowUploadDialog(false); handleUpload(); }}>
              <Upload className="w-4 h-4 mr-1" />
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Context Menu (using dropdown) */}
      {editingFolder && (
        <DropdownMenu
          open={!!editingFolder}
          onOpenChange={(open) => !open && setEditingFolder(null)}
        >
          <DropdownMenuTrigger className="hidden" />
          <DropdownMenuContent className="bg-charcoal-black border-white/10">
            <DropdownMenuItem
              onClick={() => {
                setNewFolderName(editingFolder.name);
                setShowRenameFolderDialog(true);
              }}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-400"
              onClick={() => setShowDeleteFolderDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default FilesView;
