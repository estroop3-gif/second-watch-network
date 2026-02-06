/**
 * ReviewsView - List and manage review assets (Frame.io-style)
 * With multiple view types and status management
 */
import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  CloudUpload,
  FileVideo,
  X,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  List,
  Columns,
  Calendar,
  Share2,
  Globe,
  Link as LinkIcon,
  ExternalLink,
  Search,
} from 'lucide-react';
import { useReviewAssets } from '@/hooks/backlot/useReview';
import { useStandaloneAssets } from '@/hooks/backlot';
import {
  ReviewAsset,
  ReviewAssetInput,
  ReviewAssetEnhanced,
  ReviewAssetStatus,
  StandaloneAsset,
  formatTimecode,
} from '@/types/backlot';
import { formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
}

// Add Asset modal — uploads directly to S3 via standalone assets
const CreateAssetModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ReviewAssetInput) => Promise<ReviewAsset>;
  isLoading: boolean;
  projectId: string;
}> = ({ open, onClose, onSubmit, isLoading, projectId }) => {
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link from Assets state
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<StandaloneAsset | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const { assets: standaloneAssets = [], isLoading: assetsLoading } = useStandaloneAssets({
    projectId: (open && mode === 'link') ? projectId : null,
  });

  const filteredStandaloneAssets = standaloneAssets.filter((a) => {
    if (!assetSearchQuery) return true;
    const q = assetSearchQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.source_url?.toLowerCase().includes(q);
  });

  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    file: null,
    error: null,
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setMode('upload');
    setAssetSearchQuery('');
    setSelectedAsset(null);
    setIsLinking(false);
    setUploadState({ status: 'idle', progress: 0, file: null, error: null });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
    if (!validTypes.includes(file.type)) {
      setUploadState({ status: 'error', progress: 0, file: null, error: 'Please select a valid video file (MP4, MOV, AVI, WebM, MKV)' });
      return;
    }

    if (!name) {
      setName(file.name.replace(/\.[^/.]+$/, ''));
    }

    setUploadState({ status: 'selecting', progress: 0, file, error: null });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      if (!name) {
        setName(file.name.replace(/\.[^/.]+$/, ''));
      }
      setUploadState({ status: 'selecting', progress: 0, file, error: null });
    }
  }, [name]);

  const clearFile = () => {
    setUploadState({ status: 'idle', progress: 0, file: null, error: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadToS3 = (url: string, file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadState(prev => ({ ...prev, progress: Math.min((e.loaded / e.total) * 100, 99) }));
        }
      };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed with status ${xhr.status}`));
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(file);
    });
  };

  const handleUploadSubmit = async () => {
    if (!uploadState.file || !name) return;

    try {
      setUploadState(prev => ({ ...prev, status: 'uploading', progress: 0 }));

      // 1. Create the review asset (no video_url — version created by upload-url endpoint)
      const asset = await onSubmit({ name, description });

      // 2. Get presigned upload URL (creates standalone asset + review version)
      const { upload_url, version_id } = await api.getReviewVersionUploadUrl(
        asset.id,
        uploadState.file.name,
        uploadState.file.type || 'video/mp4',
      );

      // 3. Upload to S3
      await uploadToS3(upload_url, uploadState.file);

      // 4. Finalize
      setUploadState(prev => ({ ...prev, status: 'processing', progress: 100 }));
      await api.completeReviewVersionUpload(version_id);

      setUploadState(prev => ({ ...prev, status: 'complete' }));
      handleClose();
    } catch (error) {
      setUploadState(prev => ({ ...prev, status: 'error', error: 'Upload failed. Please try again.' }));
    }
  };

  const handleLinkSubmit = async () => {
    if (!selectedAsset) return;
    setIsLinking(true);
    try {
      const assetName = name || selectedAsset.name;
      const input: ReviewAssetInput = {
        name: assetName,
        description: description || selectedAsset.description || undefined,
        video_url: selectedAsset.source_url || undefined,
        video_provider: (selectedAsset.video_provider as any) || 'placeholder',
        external_video_id: selectedAsset.external_video_id || undefined,
        thumbnail_url: selectedAsset.thumbnail_url || undefined,
      };
      await onSubmit(input);
      handleClose();
    } catch (error) {
      console.error('Error linking asset:', error);
    } finally {
      setIsLinking(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-charcoal-black border-muted-gray/30 max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Add Asset</DialogTitle>
          <DialogDescription>
            Upload a video file or link an existing asset for review
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-2">
          <Button
            variant={mode === 'upload' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('upload')}
            className={mode === 'upload' ? 'bg-accent-yellow text-charcoal-black' : ''}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>
          <Button
            variant={mode === 'link' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('link')}
            className={mode === 'link' ? 'bg-accent-yellow text-charcoal-black' : ''}
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Link from Assets
          </Button>
        </div>

        {mode === 'upload' ? (
        <div className="space-y-4 mt-2">
          {/* Name */}
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
              onDragOver={(e) => e.preventDefault()}
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
                  <p className="font-medium text-bone-white truncate">{uploadState.file.name}</p>
                  <p className="text-sm text-muted-gray">{formatFileSize(uploadState.file.size)}</p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={clearFile}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Uploading / Processing */}
          {(uploadState.status === 'uploading' || uploadState.status === 'processing') && (
            <div className="border border-muted-gray/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-accent-yellow/10 flex items-center justify-center shrink-0">
                  <Loader2 className="w-5 h-5 text-accent-yellow animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-bone-white">
                    {uploadState.status === 'uploading' ? 'Uploading...' : 'Processing...'}
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

          {/* Complete */}
          {uploadState.status === 'complete' && (
            <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <p className="text-green-400">Upload complete!</p>
              </div>
            </div>
          )}

          {/* Error */}
          {uploadState.status === 'error' && (
            <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-400">{uploadState.error}</p>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={clearFile}>
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
              placeholder="Add notes about this asset..."
              className="bg-charcoal-black border-muted-gray/30"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading || uploadState.status === 'uploading'}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={isLoading || !name || !uploadState.file || uploadState.status === 'uploading' || uploadState.status === 'processing'}
            >
              {(uploadState.status === 'uploading' || uploadState.status === 'processing') ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
        ) : (
        /* Link from Assets mode */
        <div className="space-y-4 mt-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              value={assetSearchQuery}
              onChange={(e) => setAssetSearchQuery(e.target.value)}
              placeholder="Search assets..."
              className="pl-10 bg-charcoal-black border-muted-gray/30"
            />
          </div>

          {/* Asset list */}
          <div className="max-h-[300px] overflow-y-auto space-y-2 border border-muted-gray/20 rounded-lg p-2">
            {assetsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-accent-yellow animate-spin" />
              </div>
            ) : filteredStandaloneAssets.length === 0 ? (
              <div className="text-center py-8 text-muted-gray text-sm">
                No assets found. Add link assets in the Assets tab first.
              </div>
            ) : (
              filteredStandaloneAssets.map((asset) => (
                <div
                  key={asset.id}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                    selectedAsset?.id === asset.id
                      ? 'bg-accent-yellow/10 border border-accent-yellow/50'
                      : 'hover:bg-charcoal-black/50 border border-transparent'
                  )}
                  onClick={() => {
                    setSelectedAsset(asset);
                    if (!name) setName(asset.name);
                  }}
                >
                  <div className="w-10 h-10 rounded bg-charcoal-black flex items-center justify-center shrink-0">
                    {asset.source_url ? (
                      <Globe className="w-5 h-5 text-accent-yellow" />
                    ) : asset.thumbnail_url ? (
                      <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover rounded" />
                    ) : (
                      <Film className="w-5 h-5 text-muted-gray" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-bone-white truncate">{asset.name}</p>
                    <p className="text-xs text-muted-gray truncate">
                      {asset.source_url ? (
                        <span className="flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          {asset.video_provider || 'Link'}
                        </span>
                      ) : (
                        asset.file_name || asset.asset_type
                      )}
                    </p>
                  </div>
                  {selectedAsset?.id === asset.id && (
                    <CheckCircle2 className="w-5 h-5 text-accent-yellow shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Name override */}
          <div className="space-y-2">
            <Label htmlFor="link-name">Name</Label>
            <Input
              id="link-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Override asset name..."
              className="bg-charcoal-black border-muted-gray/30"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="link-description">Description (optional)</Label>
            <Textarea
              id="link-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes..."
              className="bg-charcoal-black border-muted-gray/30"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleLinkSubmit}
              disabled={!selectedAsset || isLinking}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isLinking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Link Asset
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
        )}
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
  const queryClient = useQueryClient();

  // UI state
  const [viewType, setViewType] = useState<ViewType>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<ReviewAsset | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Share link modal state
  const [showShareModal, setShowShareModal] = useState(false);

  // Data hooks
  const {
    assets,
    isLoading,
    error: assetsError,
    createAsset,
    updateAsset,
    deleteAsset,
  } = useReviewAssets({ projectId });

  // Handlers
  const handleCreateAsset = async (data: ReviewAssetInput): Promise<ReviewAsset> => {
    const asset = await createAsset.mutateAsync(data);
    return asset;
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
    await api.updateReviewAssetStatus(assetId, status);
    queryClient.invalidateQueries({ queryKey: ['backlot-review-assets'] });
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
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-bone-white flex items-center gap-2">
              <Film className="w-5 h-5 text-accent-yellow" />
              Review
            </h2>
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
                <Button size="sm" onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Asset
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading state */}
          {isLoading && (
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
          {!isLoading && assets.length === 0 && (
            <div className="text-center py-12">
              <Film className="w-12 h-12 text-muted-gray/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-bone-white mb-2">
                No review assets yet
              </h3>
              <p className="text-sm text-muted-gray mb-4">
                Add video cuts and clips to gather feedback with time-coded notes
              </p>
              {canEdit && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Add Asset
                </Button>
              )}
            </div>
          )}

          {/* Grid View */}
          {!isLoading && assets.length > 0 && viewType === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {assets.map((asset) => (
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
          {!isLoading && assets.length > 0 && viewType === 'list' && (
            <div className="flex flex-col gap-2">
              {assets.map((asset) => (
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
          {!isLoading && assets.length > 0 && viewType === 'kanban' && (
            <ReviewKanbanView
              assets={assets}
              canEdit={canEdit}
              onView={handleViewAsset}
              onEdit={setEditingAsset}
              onDelete={handleDeleteAsset}
              onStatusChange={handleStatusChange}
            />
          )}

          {/* Timeline View */}
          {!isLoading && assets.length > 0 && viewType === 'timeline' && (
            <ReviewTimelineView
              assets={assets}
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
        projectId={projectId}
      />

      <EditAssetModal
        asset={editingAsset}
        onClose={() => setEditingAsset(null)}
        onSubmit={handleUpdateAsset}
        isLoading={updateAsset.isPending}
      />

      <ExternalLinkModal
        projectId={projectId}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
};

export default ReviewsView;
