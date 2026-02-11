import { useState, useRef, useMemo } from 'react';
import {
  Play, FileText, Upload, Plus, Search, Eye, Pencil, Trash2,
  Loader2, Clock, Film, Presentation, GraduationCap, FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  useTrainingResources,
  useCreateTrainingResource,
  useUpdateTrainingResource,
  useDeleteTrainingResource,
  useUploadTrainingFile,
} from '@/hooks/crm/useTraining';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'general', label: 'General' },
  { value: 'tools', label: 'Tools' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'best-practices', label: 'Best Practices' },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: 'border-blue-400/40 text-blue-400',
  tools: 'border-purple-400/40 text-purple-400',
  onboarding: 'border-green-400/40 text-green-400',
  'best-practices': 'border-accent-yellow/40 text-accent-yellow',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch|embed)|youtu\.be\/)/.test(url);
}

function isVimeoUrl(url: string): boolean {
  return /vimeo\.com\//.test(url);
}

function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
}

function getVimeoEmbedUrl(url: string): string {
  const match = url.match(/vimeo\.com\/(\d+)/);
  if (match) return `https://player.vimeo.com/video/${match[1]}`;
  return url;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrainingResource {
  id: string;
  title: string;
  description?: string;
  resource_type: 'video' | 'presentation';
  url: string;
  thumbnail_url?: string;
  category?: string;
  duration_seconds?: number;
  duration?: number;
  file_size_bytes?: number;
  file_size?: number;
  view_count?: number;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Training = () => {
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin', 'sales_admin']);
  const { toast } = useToast();

  // Filters
  const [activeTab, setActiveTab] = useState('videos');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingResource, setEditingResource] = useState<TrainingResource | null>(null);
  const [viewingVideo, setViewingVideo] = useState<TrainingResource | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formResourceType, setFormResourceType] = useState<'video' | 'presentation'>('video');
  const [formUrl, setFormUrl] = useState('');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [formDurationMinutes, setFormDurationMinutes] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data hooks
  const { data, isLoading } = useTrainingResources({
    type: activeTab === 'videos' ? 'video' : activeTab === 'presentations' ? 'presentation' : undefined,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    search: search || undefined,
  });

  const createResource = useCreateTrainingResource();
  const updateResource = useUpdateTrainingResource();
  const deleteResource = useDeleteTrainingResource();
  const uploadFile = useUploadTrainingFile();

  const resources = data?.resources || data || [];
  const resourceList: TrainingResource[] = Array.isArray(resources) ? resources : [];

  // Filtered list for "All" tab already handled by the API; for typed tabs, filter client-side as fallback
  const filteredResources = useMemo(() => {
    if (activeTab === 'all') return resourceList;
    const typeFilter = activeTab === 'videos' ? 'video' : 'presentation';
    return resourceList.filter((r) => r.resource_type === typeFilter);
  }, [resourceList, activeTab]);

  // ---------------------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------------------

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategory('general');
    setFormResourceType('video');
    setFormUrl('');
    setFormThumbnailUrl('');
    setFormDurationMinutes('');
    setFormFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingResource(null);
    setShowCreateDialog(true);
  };

  const openEditDialog = (resource: TrainingResource) => {
    setEditingResource(resource);
    setFormTitle(resource.title);
    setFormDescription(resource.description || '');
    setFormCategory(resource.category || 'general');
    setFormResourceType(resource.resource_type);
    setFormUrl(resource.url || '');
    setFormThumbnailUrl(resource.thumbnail_url || '');
    const dur = resource.duration_seconds || resource.duration || 0;
    setFormDurationMinutes(dur > 0 ? String(Math.round(dur / 60)) : '');
    setFormFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowCreateDialog(true);
  };

  const closeCreateDialog = () => {
    setShowCreateDialog(false);
    setEditingResource(null);
    resetForm();
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title for the resource.', variant: 'destructive' });
      return;
    }

    try {
      let fileUrl = formUrl;

      if (formFile) {
        const uploadResult = await uploadFile.mutateAsync(formFile);
        fileUrl = uploadResult?.url || uploadResult?.file_url || fileUrl;
      }

      if (!fileUrl) {
        toast({ title: 'URL or file required', description: 'Please provide a URL or upload a file.', variant: 'destructive' });
        return;
      }

      const payload: any = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory,
        resource_type: formResourceType,
        url: fileUrl,
      };

      if (formThumbnailUrl.trim()) {
        payload.thumbnail_url = formThumbnailUrl.trim();
      }

      if (formResourceType === 'video' && formDurationMinutes) {
        const minutes = parseFloat(formDurationMinutes);
        if (!isNaN(minutes) && minutes > 0) {
          payload.duration_seconds = Math.round(minutes * 60);
        }
      }

      if (editingResource) {
        await updateResource.mutateAsync({ id: editingResource.id, ...payload });
        toast({ title: 'Resource updated', description: `${formTitle} has been updated.` });
      } else {
        await createResource.mutateAsync(payload);
        toast({ title: 'Resource created', description: `${formTitle} has been added.` });
      }

      closeCreateDialog();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save resource.', variant: 'destructive' });
    }
  };

  const handleDelete = async (resource: TrainingResource) => {
    if (!confirm(`Delete "${resource.title}"? This action cannot be undone.`)) return;
    try {
      await deleteResource.mutateAsync(resource.id);
      toast({ title: 'Resource deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete resource.', variant: 'destructive' });
    }
  };

  const handleCardClick = (resource: TrainingResource) => {
    if (resource.resource_type === 'video') {
      setViewingVideo(resource);
    } else if (resource.url) {
      window.open(resource.url, '_blank', 'noopener,noreferrer');
    }
  };

  // ---------------------------------------------------------------------------
  // Resource card rendering
  // ---------------------------------------------------------------------------

  const renderResourceCard = (resource: TrainingResource) => {
    const isVideo = resource.resource_type === 'video';
    const duration = resource.duration_seconds || resource.duration || 0;
    const fileSize = resource.file_size_bytes || resource.file_size || 0;

    return (
      <Card
        key={resource.id}
        className="bg-[#1a1a1a] border-muted-gray/30 hover:border-muted-gray/50 transition-colors cursor-pointer group overflow-hidden"
        onClick={() => handleCardClick(resource)}
      >
        {/* Thumbnail / Icon area */}
        {isVideo ? (
          <div className="relative aspect-video bg-[#2a2a2a] overflow-hidden">
            {resource.thumbnail_url ? (
              <img
                src={resource.thumbnail_url}
                alt={resource.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Film className="h-10 w-10 text-muted-gray/30" />
              </div>
            )}
            {/* Play overlay */}
            <div className="absolute inset-0 bg-charcoal-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-accent-yellow flex items-center justify-center">
                <Play className="h-6 w-6 text-charcoal-black ml-0.5" />
              </div>
            </div>
            {/* Duration badge */}
            {duration > 0 && (
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-xs font-medium bg-charcoal-black/80 text-bone-white flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(duration)}
              </span>
            )}
          </div>
        ) : (
          <div className="aspect-video bg-[#2a2a2a] flex items-center justify-center">
            <div className="text-center">
              <Presentation className="h-12 w-12 text-accent-yellow/50 mx-auto mb-2" />
              {fileSize > 0 && (
                <span className="text-xs text-muted-gray">{formatFileSize(fileSize)}</span>
              )}
            </div>
          </div>
        )}

        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-bone-white truncate">{resource.title}</h3>
              {resource.description && (
                <p className="text-xs text-muted-gray mt-1 line-clamp-2">{resource.description}</p>
              )}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); openEditDialog(resource); }}
                  className="p-1.5 rounded text-muted-gray hover:text-accent-yellow hover:bg-accent-yellow/10 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(resource); }}
                  className="p-1.5 rounded text-muted-gray hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-3">
            {resource.category && (
              <Badge
                variant="outline"
                className={`text-xs ${CATEGORY_COLORS[resource.category] || 'border-muted-gray/30 text-muted-gray'}`}
              >
                {resource.category}
              </Badge>
            )}
            {isVideo && resource.view_count !== undefined && resource.view_count !== null && (
              <span className="flex items-center gap-1 text-xs text-muted-gray">
                <Eye className="h-3 w-3" />
                {resource.view_count}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // ---------------------------------------------------------------------------
  // Empty states
  // ---------------------------------------------------------------------------

  const renderEmpty = (type: 'video' | 'presentation' | 'all') => {
    const Icon = type === 'video' ? Film : type === 'presentation' ? Presentation : FolderOpen;
    const label = type === 'video' ? 'training videos' : type === 'presentation' ? 'presentations' : 'resources';
    return (
      <div className="text-center py-16">
        <Icon className="h-12 w-12 text-muted-gray/30 mx-auto mb-3" />
        <p className="text-muted-gray">No {label} found.</p>
        {search && <p className="text-muted-gray/60 text-sm mt-1">Try adjusting your search or filters.</p>}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Grid for a given set of resources
  // ---------------------------------------------------------------------------

  const renderGrid = (items: TrainingResource[], emptyType: 'video' | 'presentation' | 'all') => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-16 text-muted-gray gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading resources...
        </div>
      );
    }

    if (items.length === 0) return renderEmpty(emptyType);

    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {items.map(renderResourceCard)}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Video Player Dialog
  // ---------------------------------------------------------------------------

  const renderVideoPlayerDialog = () => {
    if (!viewingVideo) return null;

    const url = viewingVideo.url || '';
    const isYT = isYouTubeUrl(url);
    const isVim = isVimeoUrl(url);
    const isEmbed = isYT || isVim;
    const embedUrl = isYT ? getYouTubeEmbedUrl(url) : isVim ? getVimeoEmbedUrl(url) : url;

    return (
      <Dialog open={!!viewingVideo} onOpenChange={(open) => { if (!open) setViewingVideo(null); }}>
        <DialogContent className="max-w-3xl bg-charcoal-black border-muted-gray/50 p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>{viewingVideo.title}</DialogTitle>
            <DialogDescription>Video player for {viewingVideo.title}</DialogDescription>
          </DialogHeader>

          {/* Player */}
          <div className="aspect-video bg-black w-full">
            {isEmbed ? (
              <iframe
                src={embedUrl}
                title={viewingVideo.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={url}
                controls
                autoPlay
                className="w-full h-full"
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          {/* Info below player */}
          <div className="p-5">
            <h2 className="text-lg font-semibold text-bone-white">{viewingVideo.title}</h2>
            {viewingVideo.description && (
              <p className="text-sm text-muted-gray mt-2">{viewingVideo.description}</p>
            )}
            <div className="flex items-center gap-3 mt-3">
              {viewingVideo.category && (
                <Badge
                  variant="outline"
                  className={`text-xs ${CATEGORY_COLORS[viewingVideo.category] || 'border-muted-gray/30 text-muted-gray'}`}
                >
                  {viewingVideo.category}
                </Badge>
              )}
              {(viewingVideo.duration_seconds || viewingVideo.duration) && (
                <span className="flex items-center gap-1 text-xs text-muted-gray">
                  <Clock className="h-3 w-3" />
                  {formatDuration(viewingVideo.duration_seconds || viewingVideo.duration)}
                </span>
              )}
              {viewingVideo.view_count !== undefined && viewingVideo.view_count !== null && (
                <span className="flex items-center gap-1 text-xs text-muted-gray">
                  <Eye className="h-3 w-3" />
                  {viewingVideo.view_count} views
                </span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // ---------------------------------------------------------------------------
  // Create / Edit Dialog
  // ---------------------------------------------------------------------------

  const isSaving = createResource.isPending || updateResource.isPending || uploadFile.isPending;

  const renderCreateDialog = () => (
    <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) closeCreateDialog(); }}>
      <DialogContent className="max-w-lg bg-charcoal-black border-muted-gray/50 max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-accent-yellow flex items-center gap-2">
            {editingResource ? <Pencil className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
            {editingResource ? 'Edit Training Resource' : 'Add Training Resource'}
          </DialogTitle>
          <DialogDescription className="text-muted-gray text-sm">
            {editingResource
              ? 'Update the details of this training resource.'
              : 'Upload a new video or presentation for the sales team.'}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 p-6 pt-4 space-y-4">
          {/* Resource Type */}
          <div>
            <Label className="text-bone-white/70 text-xs font-medium mb-1">Resource Type</Label>
            <div className="flex gap-4 mt-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="resource_type"
                  value="video"
                  checked={formResourceType === 'video'}
                  onChange={() => setFormResourceType('video')}
                  className="accent-accent-yellow"
                />
                <Film className="h-4 w-4 text-muted-gray" />
                <span className="text-sm text-bone-white">Video</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="resource_type"
                  value="presentation"
                  checked={formResourceType === 'presentation'}
                  onChange={() => setFormResourceType('presentation')}
                  className="accent-accent-yellow"
                />
                <Presentation className="h-4 w-4 text-muted-gray" />
                <span className="text-sm text-bone-white">Presentation</span>
              </label>
            </div>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="form-title" className="text-bone-white/70 text-xs font-medium">Title</Label>
            <Input
              id="form-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. CRM Walkthrough"
              className="mt-1 bg-charcoal-black border-muted-gray/30 text-bone-white"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="form-desc" className="text-bone-white/70 text-xs font-medium">Description</Label>
            <Textarea
              id="form-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Brief description of this resource..."
              className="mt-1 bg-charcoal-black border-muted-gray/30 text-bone-white"
              rows={3}
            />
          </div>

          {/* Category */}
          <div>
            <Label className="text-bone-white/70 text-xs font-medium">Category</Label>
            <Select value={formCategory} onValueChange={setFormCategory}>
              <SelectTrigger className="mt-1 bg-charcoal-black border-muted-gray/30 text-bone-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="tools">Tools</SelectItem>
                <SelectItem value="onboarding">Onboarding</SelectItem>
                <SelectItem value="best-practices">Best Practices</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* URL input */}
          {formResourceType === 'video' && (
            <div>
              <Label htmlFor="form-url" className="text-bone-white/70 text-xs font-medium">
                URL (YouTube/Vimeo or direct link)
              </Label>
              <Input
                id="form-url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="mt-1 bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
          )}

          {/* File Upload */}
          <div>
            <Label className="text-bone-white/70 text-xs font-medium">
              {formResourceType === 'video' ? 'Or Upload File' : 'Upload File'}
            </Label>
            <div
              className="mt-1 border border-dashed border-muted-gray/30 rounded-lg p-4 text-center cursor-pointer hover:border-accent-yellow/40 transition-colors bg-[#2a2a2a]"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={formResourceType === 'video' ? 'video/*' : '.pdf,.pptx,.ppt,.key,.odp'}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setFormFile(file);
                }}
              />
              {formFile ? (
                <div className="flex items-center justify-center gap-2 text-sm text-bone-white">
                  <FileText className="h-4 w-4 text-accent-yellow" />
                  <span className="truncate max-w-[200px]">{formFile.name}</span>
                  <span className="text-muted-gray/60">({formatFileSize(formFile.size)})</span>
                </div>
              ) : (
                <div className="text-muted-gray text-sm">
                  <Upload className="h-5 w-5 mx-auto mb-1" />
                  Click to select a file
                </div>
              )}
            </div>
          </div>

          {/* Thumbnail URL (video only) */}
          {formResourceType === 'video' && (
            <div>
              <Label htmlFor="form-thumb" className="text-bone-white/70 text-xs font-medium">
                Thumbnail URL (optional)
              </Label>
              <Input
                id="form-thumb"
                value={formThumbnailUrl}
                onChange={(e) => setFormThumbnailUrl(e.target.value)}
                placeholder="https://img.youtube.com/vi/.../hqdefault.jpg"
                className="mt-1 bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
          )}

          {/* Duration in minutes (video only) */}
          {formResourceType === 'video' && (
            <div>
              <Label htmlFor="form-duration" className="text-bone-white/70 text-xs font-medium">
                Duration (minutes)
              </Label>
              <Input
                id="form-duration"
                type="number"
                value={formDurationMinutes}
                onChange={(e) => setFormDurationMinutes(e.target.value)}
                placeholder="e.g. 6"
                className="mt-1 bg-charcoal-black border-muted-gray/30 text-bone-white"
                min={0}
                step="0.5"
              />
              {formDurationMinutes && parseFloat(formDurationMinutes) > 0 && (
                <p className="text-xs text-muted-gray mt-1">
                  = {formatDuration(Math.round(parseFloat(formDurationMinutes) * 60))}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={closeCreateDialog}
              className="border-muted-gray/30 text-bone-white hover:bg-muted-gray/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !formTitle.trim() || (!formUrl.trim() && !formFile)}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingResource ? 'Save Changes' : 'Add Resource'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading text-accent-yellow flex items-center gap-3">
            <GraduationCap className="h-8 w-8" />
            Training & Resources
          </h1>
          <p className="text-muted-gray mt-1">
            Videos, presentations, and learning materials for the sales team
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={openCreateDialog}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Resource
          </Button>
        )}
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="pl-10 bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray/50"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48 bg-charcoal-black border-muted-gray/30 text-bone-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted-gray/10 border border-muted-gray/20">
          <TabsTrigger
            value="videos"
            className="data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow text-muted-gray"
          >
            <Film className="h-4 w-4 mr-2" />
            Videos
          </TabsTrigger>
          <TabsTrigger
            value="presentations"
            className="data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow text-muted-gray"
          >
            <Presentation className="h-4 w-4 mr-2" />
            Presentations
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow text-muted-gray"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="mt-6">
          {renderGrid(filteredResources, 'video')}
        </TabsContent>

        <TabsContent value="presentations" className="mt-6">
          {renderGrid(filteredResources, 'presentation')}
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          {renderGrid(filteredResources, 'all')}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {renderCreateDialog()}
      {renderVideoPlayerDialog()}
    </div>
  );
};

export default Training;
