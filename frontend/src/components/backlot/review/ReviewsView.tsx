/**
 * ReviewsView - List and manage review assets (Frame.io-style)
 * With folder organization, multiple view types, and status management
 */
import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Film,
  Plus,
  MessageSquare,
  Clock,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Loader2,
  Upload,
  Layers,
  Play,
  Link2,
  CloudUpload,
  FileVideo,
  X,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  List,
  Columns,
  Calendar,
  PanelLeftClose,
  PanelLeft,
  FolderPlus,
  Share2,
} from 'lucide-react';
import { useReviewAssets, useReviewFolders, useReviewFolder } from '@/hooks/backlot/useReview';
import {
  ReviewAsset,
  ReviewAssetInput,
  ReviewAssetEnhanced,
  ReviewFolder,
  ReviewFolderInput,
  ReviewAssetStatus,
  formatTimecode,
} from '@/types/backlot';
import { formatDistanceToNow } from 'date-fns';
import { FolderTree, FolderBreadcrumbs, CreateFolderModal } from './folders';
import { ReviewKanbanView, ReviewTimelineView } from './views';
import { ExternalLinkModal } from './external';

// View types
type ViewType = 'grid' | 'list' | 'kanban' | 'timeline';

// Status display config
const STATUS_CONFIG: Record<ReviewAssetStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-muted-gray', bgColor: 'bg-muted-gray/20' },
  in_review: { label: 'In Review', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  changes_requested: { label: 'Changes', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  approved: { label: 'Approved', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  final: { label: 'Final', color: 'text-accent-yellow', bgColor: 'bg-accent-yellow/20' },
};

interface ReviewsViewProps {
  projectId: string;
  canEdit: boolean;
  onSelectAsset?: (asset: ReviewAsset) => void;
}

// Asset card component - updated with status
const ReviewAssetCard: React.FC<{
  asset: ReviewAsset | ReviewAssetEnhanced;
  canEdit: boolean;
  onView: (asset: ReviewAsset) => void;
  onEdit: (asset: ReviewAsset) => void;
  onDelete: (id: string) => void;
  onStatusChange?: (assetId: string, status: ReviewAssetStatus) => void;
  compact?: boolean;
}> = ({ asset, canEdit, onView, onEdit, onDelete, onStatusChange, compact }) => {
  const duration = asset.active_version?.duration_seconds;
  const enhancedAsset = asset as ReviewAssetEnhanced;
  const status = enhancedAsset.status || 'draft';
  const statusConfig = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden hover:border-muted-gray/40 transition-colors cursor-pointer group",
        compact && "flex"
      )}
      onClick={() => onView(asset)}
    >
      {/* Thumbnail */}
      <div className={cn(
        "bg-charcoal-black relative",
        compact ? "w-32 h-20 flex-shrink-0" : "aspect-video"
      )}>
        {asset.thumbnail_url ? (
          <img
            src={asset.thumbnail_url}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className={cn("text-muted-gray/50", compact ? "w-8 h-8" : "w-12 h-12")} />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className={cn(
            "rounded-full bg-white/20 backdrop-blur flex items-center justify-center",
            compact ? "w-8 h-8" : "w-14 h-14"
          )}>
            <Play className={cn("text-white fill-white ml-0.5", compact ? "w-4 h-4" : "w-7 h-7")} />
          </div>
        </div>

        {/* Duration badge */}
        {duration !== null && duration !== undefined && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white font-mono">
            {formatTimecode(duration)}
          </div>
        )}

        {/* Version badge */}
        {!compact && asset.version_count !== undefined && asset.version_count > 1 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
            <Layers className="w-3 h-3" />
            {asset.version_count} versions
          </div>
        )}
      </div>

      {/* Info */}
      <div className={cn("p-3", compact && "flex-1 min-w-0 flex flex-col justify-center")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "font-medium text-bone-white truncate",
              compact && "text-sm"
            )}>{asset.name}</h4>
            {!compact && asset.active_version?.name && (
              <p className="text-xs text-muted-gray">
                Active: {asset.active_version.name}
              </p>
            )}
          </div>

          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(asset); }}>
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(asset); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {onStatusChange && (
                  <>
                    <DropdownMenuSeparator />
                    {(Object.keys(STATUS_CONFIG) as ReviewAssetStatus[]).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={(e) => { e.stopPropagation(); onStatusChange(asset.id, s); }}
                        className={cn(status === s && 'bg-white/5')}
                      >
                        <span className={cn(
                          'w-2 h-2 rounded-full mr-2',
                          STATUS_CONFIG[s].bgColor
                        )} />
                        {STATUS_CONFIG[s].label}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDelete(asset.id); }}
                  className="text-red-400"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Status + Stats */}
        <div className={cn(
          "flex items-center gap-2 mt-2 text-xs",
          compact && "flex-wrap"
        )}>
          {/* Status badge */}
          <span className={cn(
            'px-1.5 py-0.5 rounded text-xs font-medium',
            statusConfig.bgColor,
            statusConfig.color
          )}>
            {statusConfig.label}
          </span>

          {asset.note_count !== undefined && asset.note_count > 0 && (
            <div className="flex items-center gap-1 text-muted-gray">
              <MessageSquare className="w-3 h-3" />
              {asset.note_count}
            </div>
          )}
          {!compact && (
            <div className="flex items-center gap-1 text-muted-gray">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(asset.updated_at), { addSuffix: true })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Upload state types
type UploadStatus = 'idle' | 'selecting' | 'uploading' | 'processing' | 'complete' | 'error';

interface UploadState {
  status: UploadStatus;
  progress: number;
  file: File | null;
  error: string | null;
  vimeoId: string | null;
}

// Create asset modal with Upload + Link tabs
const CreateAssetModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ReviewAssetInput) => Promise<void>;
  isLoading: boolean;
}> = ({ open, onClose, onSubmit, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'link'>('upload');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [vimeoUrl, setVimeoUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    file: null,
    error: null,
    vimeoId: null,
  });

  // Reset form
  const resetForm = () => {
    setName('');
    setDescription('');
    setVideoUrl('');
    setVimeoUrl('');
    setUploadState({
      status: 'idle',
      progress: 0,
      file: null,
      error: null,
      vimeoId: null,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
    if (!validTypes.includes(file.type)) {
      setUploadState({
        status: 'error',
        progress: 0,
        file: null,
        error: 'Please select a valid video file (MP4, MOV, AVI, WebM, MKV)',
        vimeoId: null,
      });
      return;
    }

    // Auto-fill name from filename if empty
    if (!name) {
      const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      setName(fileName);
    }

    setUploadState({
      status: 'selecting',
      progress: 0,
      file,
      error: null,
      vimeoId: null,
    });
  };

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      if (!name) {
        const fileName = file.name.replace(/\.[^/.]+$/, '');
        setName(fileName);
      }
      setUploadState({
        status: 'selecting',
        progress: 0,
        file,
        error: null,
        vimeoId: null,
      });
    }
  }, [name]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Clear selected file
  const clearFile = () => {
    setUploadState({
      status: 'idle',
      progress: 0,
      file: null,
      error: null,
      vimeoId: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Simulate Vimeo upload (placeholder for real implementation)
  const simulateVimeoUpload = async (): Promise<string> => {
    // TODO: Replace with actual Vimeo API integration
    // This would use the Vimeo Upload API:
    // 1. POST to /me/videos to create upload ticket
    // 2. Upload file using tus protocol to upload_link
    // 3. Poll for transcode completion
    // 4. Return the Vimeo video ID

    return new Promise((resolve, reject) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);

          // Simulate processing phase
          setUploadState(prev => ({ ...prev, status: 'processing', progress: 100 }));

          setTimeout(() => {
            // Generate fake Vimeo ID for now
            const fakeVimeoId = `${Date.now()}`;
            resolve(fakeVimeoId);
          }, 1500);
        }
        setUploadState(prev => ({ ...prev, progress: Math.min(progress, 99) }));
      }, 200);
    });
  };

  // Handle upload submission
  const handleUploadSubmit = async () => {
    if (!uploadState.file || !name) return;

    try {
      setUploadState(prev => ({ ...prev, status: 'uploading' }));

      // For now, we'll use a placeholder approach:
      // In production, this would upload to Vimeo and get the video ID
      const vimeoId = await simulateVimeoUpload();

      setUploadState(prev => ({
        ...prev,
        status: 'complete',
        vimeoId,
      }));

      // Submit with Vimeo provider (placeholder URL for now)
      // When Vimeo is integrated, video_url would be the Vimeo player URL
      await onSubmit({
        name,
        description,
        video_url: `https://player.vimeo.com/video/${vimeoId}`, // Placeholder
        video_provider: 'vimeo',
        external_video_id: vimeoId,
      });

      handleClose();
    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        error: 'Upload failed. Please try again.',
      }));
    }
  };

  // Handle link submission
  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Detect if it's a Vimeo URL
    const vimeoMatch = videoUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);

    if (vimeoMatch) {
      await onSubmit({
        name,
        description,
        video_url: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
        video_provider: 'vimeo',
        external_video_id: vimeoMatch[1],
      });
    } else {
      await onSubmit({
        name,
        description,
        video_url: videoUrl,
        video_provider: 'placeholder',
      });
    }

    handleClose();
  };

  // Parse Vimeo URL for direct link option
  const handleVimeoUrlChange = (url: string) => {
    setVimeoUrl(url);
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (match) {
      setVideoUrl(`https://player.vimeo.com/video/${match[1]}`);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-charcoal-black border-muted-gray/30 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Add Review Asset</DialogTitle>
          <DialogDescription>
            Upload a video or paste a link for review
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'link')}>
          <TabsList className="grid w-full grid-cols-2 bg-charcoal-black/50">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <CloudUpload className="w-4 h-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Link
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-4 mt-4">
            {/* Name field */}
            <div className="space-y-2">
              <Label htmlFor="upload-name">Name</Label>
              <Input
                id="upload-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Scene 1 - Rough Cut"
                className="bg-charcoal-black border-muted-gray/30"
              />
            </div>

            {/* Drop zone */}
            {uploadState.status === 'idle' && (
              <div
                className="border-2 border-dashed border-muted-gray/30 rounded-lg p-8 text-center hover:border-accent-yellow/50 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <CloudUpload className="w-12 h-12 text-muted-gray/50 mx-auto mb-3" />
                <p className="text-bone-white font-medium mb-1">
                  Drag & drop your video here
                </p>
                <p className="text-sm text-muted-gray mb-3">
                  or click to browse
                </p>
                <p className="text-xs text-muted-gray">
                  MP4, MOV, AVI, WebM up to 10GB
                </p>
              </div>
            )}

            {/* Selected file */}
            {uploadState.status === 'selecting' && uploadState.file && (
              <div className="border border-muted-gray/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded bg-accent-yellow/10 flex items-center justify-center shrink-0">
                    <FileVideo className="w-5 h-5 text-accent-yellow" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-bone-white truncate">
                      {uploadState.file.name}
                    </p>
                    <p className="text-sm text-muted-gray">
                      {formatFileSize(uploadState.file.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={clearFile}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Uploading state */}
            {(uploadState.status === 'uploading' || uploadState.status === 'processing') && (
              <div className="border border-muted-gray/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-accent-yellow/10 flex items-center justify-center shrink-0">
                    {uploadState.status === 'uploading' ? (
                      <Loader2 className="w-5 h-5 text-accent-yellow animate-spin" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-accent-yellow animate-spin" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-bone-white">
                      {uploadState.status === 'uploading' ? 'Uploading to Vimeo...' : 'Processing...'}
                    </p>
                    <p className="text-sm text-muted-gray">
                      {uploadState.status === 'uploading'
                        ? `${Math.round(uploadState.progress)}% complete`
                        : 'Preparing video for playback'}
                    </p>
                  </div>
                </div>
                <Progress value={uploadState.progress} className="h-2" />
              </div>
            )}

            {/* Complete state */}
            {uploadState.status === 'complete' && (
              <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <p className="text-green-400">Upload complete!</p>
                </div>
              </div>
            )}

            {/* Error state */}
            {uploadState.status === 'error' && (
              <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className="text-red-400">{uploadState.error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={clearFile}
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="upload-description">Description (optional)</Label>
              <Textarea
                id="upload-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add context about this review asset..."
                className="bg-charcoal-black border-muted-gray/30"
                rows={2}
              />
            </div>

            {/* Vimeo notice */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-sm">
              <p className="text-blue-400">
                Videos are hosted on Vimeo for reliable streaming and review.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading || uploadState.status === 'uploading'}>
                Cancel
              </Button>
              <Button
                onClick={handleUploadSubmit}
                disabled={
                  isLoading ||
                  !name ||
                  !uploadState.file ||
                  uploadState.status === 'uploading' ||
                  uploadState.status === 'processing'
                }
              >
                {(uploadState.status === 'uploading' || uploadState.status === 'processing') ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload & Add
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* Link Tab */}
          <TabsContent value="link" className="mt-4">
            <form onSubmit={handleLinkSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="link-name">Name</Label>
                <Input
                  id="link-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Scene 1 - Rough Cut"
                  className="bg-charcoal-black border-muted-gray/30"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="video_url">Video URL</Label>
                <Input
                  id="video_url"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://vimeo.com/123456789 or direct MP4 link"
                  className="bg-charcoal-black border-muted-gray/30"
                  required
                />
                <p className="text-xs text-muted-gray">
                  Paste a Vimeo URL, YouTube URL, or direct video link (MP4, WebM)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="link-description">Description (optional)</Label>
                <Textarea
                  id="link-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add context about this review asset..."
                  className="bg-charcoal-black border-muted-gray/30"
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading || !name || !videoUrl}>
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Asset
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Edit asset modal
const EditAssetModal: React.FC<{
  asset: ReviewAsset | null;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string }) => Promise<void>;
  isLoading: boolean;
}> = ({ asset, onClose, onSubmit, isLoading }) => {
  const [name, setName] = useState(asset?.name || '');
  const [description, setDescription] = useState(asset?.description || '');

  React.useEffect(() => {
    if (asset) {
      setName(asset.name);
      setDescription(asset.description || '');
    }
  }, [asset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ name, description });
  };

  return (
    <Dialog open={!!asset} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Edit Review Asset</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-charcoal-black border-muted-gray/30"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-charcoal-black border-muted-gray/30"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// View type switcher component
const ViewTypeSwitcher: React.FC<{
  viewType: ViewType;
  onViewTypeChange: (type: ViewType) => void;
}> = ({ viewType, onViewTypeChange }) => {
  const views: { type: ViewType; icon: React.ReactNode; label: string }[] = [
    { type: 'grid', icon: <LayoutGrid className="w-4 h-4" />, label: 'Grid' },
    { type: 'list', icon: <List className="w-4 h-4" />, label: 'List' },
    { type: 'kanban', icon: <Columns className="w-4 h-4" />, label: 'Kanban' },
    { type: 'timeline', icon: <Calendar className="w-4 h-4" />, label: 'Timeline' },
  ];

  return (
    <div className="flex items-center gap-1 bg-charcoal-dark/50 rounded-lg p-1">
      {views.map((v) => (
        <button
          key={v.type}
          onClick={() => onViewTypeChange(v.type)}
          className={cn(
            'p-2 rounded transition-colors',
            viewType === v.type
              ? 'bg-accent-yellow/20 text-accent-yellow'
              : 'text-muted-gray hover:text-bone-white hover:bg-white/5'
          )}
          title={v.label}
        >
          {v.icon}
        </button>
      ))}
    </div>
  );
};

export const ReviewsView: React.FC<ReviewsViewProps> = ({
  projectId,
  canEdit,
  onSelectAsset,
}) => {
  // UI state
  const [showSidebar, setShowSidebar] = useState(true);
  const [viewType, setViewType] = useState<ViewType>('grid');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<ReviewAsset | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Folder modal state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ReviewFolder | null>(null);
  const [parentFolderIdForCreate, setParentFolderIdForCreate] = useState<string | null>(null);

  // Share link modal state
  const [showShareModal, setShowShareModal] = useState(false);

  // Data hooks
  const {
    assets,
    isLoading: assetsLoading,
    error: assetsError,
    createAsset,
    updateAsset,
    deleteAsset,
  } = useReviewAssets({ projectId });

  const {
    folders,
    rootAssets,
    isLoading: foldersLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    updateAssetStatus,
  } = useReviewFolders({ projectId });

  const {
    folder: currentFolder,
    subfolders,
    assets: folderAssets,
    breadcrumbs,
    isLoading: folderLoading,
  } = useReviewFolder({ folderId: selectedFolderId });

  const isLoading = assetsLoading || foldersLoading;

  // Get current assets based on folder selection
  const displayAssets: (ReviewAsset | ReviewAssetEnhanced)[] = selectedFolderId
    ? folderAssets
    : rootAssets.length > 0 ? rootAssets : assets;

  // Handlers
  const handleCreateAsset = async (data: ReviewAssetInput) => {
    await createAsset.mutateAsync(data);
    setShowCreateModal(false);
  };

  const handleUpdateAsset = async (data: { name: string; description: string }) => {
    if (!editingAsset) return;
    await updateAsset.mutateAsync({ id: editingAsset.id, ...data });
    setEditingAsset(null);
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm('Delete this review asset and all its versions and notes?')) return;
    setDeletingId(id);
    try {
      await deleteAsset.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewAsset = (asset: ReviewAsset) => {
    onSelectAsset?.(asset);
  };

  const handleStatusChange = async (assetId: string, status: ReviewAssetStatus) => {
    await updateAssetStatus.mutateAsync({ assetId, status });
  };

  // Folder handlers
  const handleCreateFolder = (parentId: string | null) => {
    setParentFolderIdForCreate(parentId);
    setEditingFolder(null);
    setShowFolderModal(true);
  };

  const handleEditFolder = (folder: ReviewFolder) => {
    setEditingFolder(folder);
    setParentFolderIdForCreate(null);
    setShowFolderModal(true);
  };

  const handleDeleteFolder = async (folder: ReviewFolder) => {
    if (!confirm(`Delete folder "${folder.name}"? Contents will be moved to the parent folder.`)) return;
    await deleteFolder.mutateAsync(folder.id);
    if (selectedFolderId === folder.id) {
      setSelectedFolderId(folder.parent_folder_id);
    }
  };

  const handleFolderSubmit = async (data: ReviewFolderInput) => {
    if (editingFolder) {
      await updateFolder.mutateAsync({ id: editingFolder.id, ...data });
    } else {
      await createFolder.mutateAsync(data);
    }
  };

  if (assetsError) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          Failed to load review assets. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Folder Sidebar */}
      {showSidebar && (
        <div className="w-64 border-r border-white/10 flex-shrink-0">
          <FolderTree
            folders={folders}
            rootAssets={rootAssets}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            onCreateFolder={handleCreateFolder}
            onEditFolder={handleEditFolder}
            onDeleteFolder={handleDeleteFolder}
            isLoading={foldersLoading}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {/* Toggle sidebar */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded hover:bg-white/5 text-muted-gray hover:text-bone-white transition-colors"
              title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              {showSidebar ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeft className="w-5 h-5" />
              )}
            </button>

            {/* Breadcrumbs or Title */}
            {selectedFolderId && breadcrumbs.length > 0 ? (
              <FolderBreadcrumbs
                breadcrumbs={breadcrumbs}
                onNavigate={setSelectedFolderId}
              />
            ) : (
              <div>
                <h2 className="text-lg font-semibold text-bone-white flex items-center gap-2">
                  <Film className="w-5 h-5 text-accent-yellow" />
                  Review
                </h2>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* View Type Switcher */}
            <ViewTypeSwitcher
              viewType={viewType}
              onViewTypeChange={setViewType}
            />

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Share button - available to all users with edit access */}
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShareModal(true)}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              )}

              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateFolder(selectedFolderId)}
                  >
                    <FolderPlus className="w-4 h-4 mr-2" />
                    New Folder
                  </Button>
                  <Button size="sm" onClick={() => setShowCreateModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Asset
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading state */}
          {(isLoading || folderLoading) && (
            <div className={cn(
              "gap-4",
              viewType === 'grid'
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : viewType === 'list'
                ? "flex flex-col"
                : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            )}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden">
                  <Skeleton className="aspect-video" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !folderLoading && displayAssets.length === 0 && (
            <div className="text-center py-12">
              <Film className="w-12 h-12 text-muted-gray/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-bone-white mb-2">
                {selectedFolderId ? 'This folder is empty' : 'No review assets yet'}
              </h3>
              <p className="text-sm text-muted-gray mb-4">
                {selectedFolderId
                  ? 'Add assets to this folder or create subfolders'
                  : 'Add video cuts and clips to gather feedback with time-coded notes'}
              </p>
              {canEdit && (
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={() => handleCreateFolder(selectedFolderId)}>
                    <FolderPlus className="w-4 h-4 mr-2" />
                    New Folder
                  </Button>
                  <Button onClick={() => setShowCreateModal(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Add Asset
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Grid View */}
          {!isLoading && !folderLoading && displayAssets.length > 0 && viewType === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayAssets.map((asset) => (
                <ReviewAssetCard
                  key={asset.id}
                  asset={asset}
                  canEdit={canEdit}
                  onView={handleViewAsset}
                  onEdit={setEditingAsset}
                  onDelete={handleDeleteAsset}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}

          {/* List View */}
          {!isLoading && !folderLoading && displayAssets.length > 0 && viewType === 'list' && (
            <div className="flex flex-col gap-2">
              {displayAssets.map((asset) => (
                <ReviewAssetCard
                  key={asset.id}
                  asset={asset}
                  canEdit={canEdit}
                  onView={handleViewAsset}
                  onEdit={setEditingAsset}
                  onDelete={handleDeleteAsset}
                  onStatusChange={handleStatusChange}
                  compact
                />
              ))}
            </div>
          )}

          {/* Kanban View */}
          {!isLoading && !folderLoading && displayAssets.length > 0 && viewType === 'kanban' && (
            <ReviewKanbanView
              assets={displayAssets}
              canEdit={canEdit}
              onView={handleViewAsset}
              onEdit={setEditingAsset}
              onDelete={handleDeleteAsset}
              onStatusChange={handleStatusChange}
            />
          )}

          {/* Timeline View */}
          {!isLoading && !folderLoading && displayAssets.length > 0 && viewType === 'timeline' && (
            <ReviewTimelineView
              assets={displayAssets}
              canEdit={canEdit}
              onView={handleViewAsset}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateAssetModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateAsset}
        isLoading={createAsset.isPending}
      />

      <EditAssetModal
        asset={editingAsset}
        onClose={() => setEditingAsset(null)}
        onSubmit={handleUpdateAsset}
        isLoading={updateAsset.isPending}
      />

      <CreateFolderModal
        isOpen={showFolderModal}
        onClose={() => {
          setShowFolderModal(false);
          setEditingFolder(null);
          setParentFolderIdForCreate(null);
        }}
        onSubmit={handleFolderSubmit}
        folder={editingFolder}
        parentFolderId={parentFolderIdForCreate}
        isLoading={createFolder.isPending || updateFolder.isPending}
      />

      <ExternalLinkModal
        projectId={projectId}
        folder={currentFolder}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
};

export default ReviewsView;
