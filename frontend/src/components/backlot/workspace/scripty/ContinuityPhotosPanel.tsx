/**
 * ContinuityPhotosPanel - Photo management for continuity
 *
 * Features:
 * - Upload photos to S3
 * - Categorize photos (wardrobe, props, hair, makeup, etc.)
 * - Tag and search photos
 * - Side-by-side comparison
 */
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
} from '@/components/ui/dialog';
import {
  Plus,
  Image,
  Upload,
  Trash2,
  Star,
  StarOff,
  Tag,
  Search,
  X,
  ZoomIn,
  Columns,
  Loader2,
  Camera,
  Shirt,
  Brush,
  Sofa,
  Eye,
  Droplets,
  Cloud,
  Hand,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useContinuityPhotos, useUploadContinuityPhoto, useDeleteContinuityPhoto, useUpdateContinuityPhoto } from '@/hooks/backlot/useContinuity';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';

interface ContinuityPhotosPanelProps {
  projectId: string;
  sceneId: string | null;
  canEdit: boolean;
}

// Image compression options - defined outside component to avoid recreating on each render
const COMPRESSION_OPTIONS = {
  maxSizeMB: 2, // Max file size in MB
  maxWidthOrHeight: 2048, // Max dimension
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
};

// Photo categories with icons
const PHOTO_CATEGORIES = [
  { value: 'general', label: 'General', icon: Camera },
  { value: 'wardrobe', label: 'Wardrobe', icon: Shirt },
  { value: 'props', label: 'Props', icon: Sofa },
  { value: 'hair', label: 'Hair', icon: Brush },
  { value: 'makeup', label: 'Makeup', icon: Brush },
  { value: 'set_dressing', label: 'Set Dressing', icon: Sofa },
  { value: 'blood', label: 'Blood/FX', icon: Droplets },
  { value: 'weather', label: 'Weather', icon: Cloud },
  { value: 'hands', label: 'Hands', icon: Hand },
  { value: 'eyeline', label: 'Eyeline', icon: Eye },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

interface ContinuityPhoto {
  id: string;
  scene_id?: string;
  s3_key: string;
  s3_bucket: string;
  original_filename?: string;
  category: string;
  description?: string;
  is_reference: boolean;
  is_favorite: boolean;
  scene_number?: string;
  thumbnail_url?: string;
  full_url?: string;
  created_at: string;
  tags?: { tag: string }[];
}

const ContinuityPhotosPanel: React.FC<ContinuityPhotosPanelProps> = ({
  projectId,
  sceneId,
  canEdit,
}) => {
  const { toast } = useToast();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<ContinuityPhoto | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePhotos, setComparePhotos] = useState<ContinuityPhoto[]>([]);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('general');
  const [isUploading, setIsUploading] = useState(false);

  // Data hooks
  const { data: photos = [], isLoading: photosLoading, refetch } = useContinuityPhotos({
    projectId,
    sceneId: sceneId || undefined,
    category: filterCategory !== 'all' ? filterCategory : undefined,
  });

  const uploadPhoto = useUploadContinuityPhoto();
  const updatePhoto = useUpdateContinuityPhoto();
  const deletePhoto = useDeleteContinuityPhoto();

  // Handle file drop with compression
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!sceneId) {
      toast({
        title: 'No scene selected',
        description: 'Please select a scene to upload photos',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    for (const file of acceptedFiles) {
      try {
        // Compress image before upload
        let fileToUpload: File = file;
        const originalSize = file.size / 1024 / 1024; // MB

        // Only compress if file is larger than 1MB
        if (originalSize > 1) {
          toast({
            title: `Compressing ${file.name}...`,
            description: `Original size: ${originalSize.toFixed(2)}MB`
          });

          const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);
          const compressedSize = compressedFile.size / 1024 / 1024; // MB

          // Create a new File object with original name
          fileToUpload = new File([compressedFile], file.name, {
            type: compressedFile.type,
            lastModified: Date.now(),
          });

          toast({
            title: `Compressed ${file.name}`,
            description: `${originalSize.toFixed(2)}MB → ${compressedSize.toFixed(2)}MB (${Math.round((1 - compressedSize/originalSize) * 100)}% smaller)`
          });
        }

        await uploadPhoto.mutateAsync({
          project_id: projectId,
          scene_id: sceneId,
          file: fileToUpload,
          category: uploadCategory,
        });
        toast({ title: `Uploaded ${file.name}` });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : `Failed to upload ${file.name}`;
        toast({
          title: 'Upload failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    }

    setIsUploading(false);
    refetch();
  }, [projectId, sceneId, uploadCategory, uploadPhoto, toast, refetch]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    },
    disabled: !canEdit || !sceneId,
  });

  // Toggle favorite
  const handleToggleFavorite = async (photo: ContinuityPhoto) => {
    try {
      await updatePhoto.mutateAsync({
        id: photo.id,
        is_favorite: !photo.is_favorite,
      });
      refetch();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update photo';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Delete photo
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Delete this photo?')) return;

    try {
      await deletePhoto.mutateAsync({ id: photoId });
      toast({ title: 'Photo deleted' });
      refetch();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete photo';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Toggle compare selection
  const handleCompareToggle = (photo: ContinuityPhoto) => {
    if (comparePhotos.find(p => p.id === photo.id)) {
      setComparePhotos(comparePhotos.filter(p => p.id !== photo.id));
    } else if (comparePhotos.length < 2) {
      setComparePhotos([...comparePhotos, photo]);
    }
  };

  // Get category config
  const getCategoryConfig = (category: string) => {
    return PHOTO_CATEGORIES.find(c => c.value === category) || PHOTO_CATEGORIES[0];
  };

  // Filter photos
  const filteredPhotos = photos.filter((photo: ContinuityPhoto) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        photo.description?.toLowerCase().includes(query) ||
        photo.original_filename?.toLowerCase().includes(query) ||
        photo.tags?.some(t => t.tag.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // No scene selected
  if (!sceneId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-muted-gray">
        <Image className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm text-center">Select a scene to view photos</p>
      </div>
    );
  }

  return (
    <div data-testid="continuity-photos-panel" className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-muted-gray/20 shrink-0">
        <Select
          value={filterCategory}
          onValueChange={setFilterCategory}
        >
          <SelectTrigger data-testid="photos-category-filter" className="w-28 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Photos</SelectItem>
            {PHOTO_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                <div className="flex items-center gap-1">
                  <cat.icon className="w-3 h-3" />
                  {cat.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          data-testid="compare-mode-button"
          size="sm"
          variant={compareMode ? 'secondary' : 'ghost'}
          className="h-7 text-xs"
          onClick={() => {
            setCompareMode(!compareMode);
            setComparePhotos([]);
          }}
        >
          <Columns className="w-3 h-3 mr-1" />
          Compare
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-muted-gray/20 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-gray" />
          <Input
            data-testid="photos-search-input"
            placeholder="Search photos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-xs pl-7"
          />
        </div>
      </div>

      {/* Upload Area */}
      {canEdit && (
        <div className="px-3 py-2 shrink-0">
          <div
            {...getRootProps()}
            data-testid="photo-upload-area"
            className={cn(
              'border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer',
              isDragActive ? 'border-accent-yellow bg-accent-yellow/10' : 'border-muted-gray/30 hover:border-muted-gray/50',
              isUploading && 'opacity-50 cursor-wait'
            )}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-gray">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-gray">
                <Upload className="w-4 h-4" />
                <span>Drop photos or click to upload</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted-gray">Upload as:</span>
            <Select
              value={uploadCategory}
              onValueChange={setUploadCategory}
            >
              <SelectTrigger data-testid="upload-category-select" className="h-6 text-[10px] flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHOTO_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Photo Grid */}
      <ScrollArea className="flex-1">
        <div data-testid="photos-grid" className="p-2">
          {photosLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square bg-muted-gray/10 rounded-lg" />
              ))}
            </div>
          ) : filteredPhotos.length === 0 ? (
            <p className="text-sm text-muted-gray text-center py-4">
              No photos yet
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredPhotos.map((photo: ContinuityPhoto, index: number) => {
                const catConfig = getCategoryConfig(photo.category);
                const isSelectedForCompare = comparePhotos.find(p => p.id === photo.id);

                return (
                  <div
                    key={photo.id}
                    data-testid={`photo-item-${index}`}
                    className={cn(
                      'relative group aspect-square rounded-lg overflow-hidden bg-soft-black border cursor-pointer',
                      isSelectedForCompare ? 'border-accent-yellow ring-2 ring-accent-yellow' : 'border-muted-gray/20 hover:border-muted-gray/40'
                    )}
                    onClick={() => {
                      if (compareMode) {
                        handleCompareToggle(photo);
                      } else {
                        setSelectedPhoto(photo);
                      }
                    }}
                  >
                    {/* Photo */}
                    {photo.thumbnail_url || photo.full_url ? (
                      <img
                        src={photo.thumbnail_url || photo.full_url}
                        alt={photo.description || 'Continuity photo'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-8 h-8 text-muted-gray/40" />
                      </div>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <Badge
                          variant="outline"
                          className="text-[8px] bg-black/50 border-0 text-white"
                        >
                          <catConfig.icon className="w-2 h-2 mr-1" />
                          {catConfig.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        data-testid={`favorite-photo-${index}`}
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 bg-black/50 hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(photo);
                        }}
                      >
                        {photo.is_favorite ? (
                          <Star className="w-3 h-3 text-accent-yellow fill-accent-yellow" />
                        ) : (
                          <StarOff className="w-3 h-3 text-white" />
                        )}
                      </Button>
                      {canEdit && (
                        <Button
                          data-testid={`delete-photo-${index}`}
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 bg-black/50 hover:bg-red-500/70"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(photo.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </Button>
                      )}
                    </div>

                    {/* Favorite indicator */}
                    {photo.is_favorite && (
                      <Star className="absolute top-1 left-1 w-3 h-3 text-accent-yellow fill-accent-yellow" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Compare Mode Footer */}
      {compareMode && comparePhotos.length === 2 && (
        <div className="p-2 border-t border-muted-gray/20 shrink-0">
          <Button
            className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            onClick={() => {
              setShowCompareDialog(true);
            }}
          >
            <Columns className="w-4 h-4 mr-2" />
            View Comparison
          </Button>
        </div>
      )}

      {/* Photo Detail Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="text-bone-white">
              {selectedPhoto?.description || selectedPhoto?.original_filename || 'Photo'}
            </DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-soft-black rounded-lg overflow-hidden">
                {selectedPhoto.full_url ? (
                  <img
                    src={selectedPhoto.full_url}
                    alt={selectedPhoto.description || 'Continuity photo'}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-16 h-16 text-muted-gray/40" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">
                  {getCategoryConfig(selectedPhoto.category).label}
                </Badge>
                {selectedPhoto.is_favorite && (
                  <Badge className="bg-accent-yellow/20 text-accent-yellow">
                    <Star className="w-3 h-3 mr-1 fill-accent-yellow" />
                    Favorite
                  </Badge>
                )}
                {selectedPhoto.tags?.map((t) => (
                  <Badge key={t.tag} variant="outline" className="text-xs">
                    <Tag className="w-3 h-3 mr-1" />
                    {t.tag}
                  </Badge>
                ))}
              </div>
              {selectedPhoto.description && (
                <p className="text-sm text-muted-gray">{selectedPhoto.description}</p>
              )}
              <p className="text-xs text-muted-gray">
                Uploaded {new Date(selectedPhoto.created_at).toLocaleString()}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Compare Dialog */}
      <Dialog open={showCompareDialog} onOpenChange={(open) => {
        setShowCompareDialog(open);
        if (!open) {
          setCompareMode(false);
          setComparePhotos([]);
        }
      }}>
        <DialogContent className="max-w-5xl bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <Columns className="w-5 h-5" />
              Compare Photos
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {comparePhotos.map((photo, index) => (
              <div key={photo.id} className="space-y-2">
                <div className="text-xs text-muted-gray mb-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    Photo {index + 1}
                  </Badge>
                  {photo.original_filename && (
                    <span className="truncate">{photo.original_filename}</span>
                  )}
                </div>
                <div className="aspect-video bg-soft-black rounded-lg overflow-hidden border border-muted-gray/20">
                  {photo.full_url ? (
                    <img
                      src={photo.full_url}
                      alt={photo.description || 'Continuity photo'}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-16 h-16 text-muted-gray/40" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {getCategoryConfig(photo.category).label}
                  </Badge>
                  {photo.is_favorite && (
                    <Badge className="text-xs bg-accent-yellow/20 text-accent-yellow">
                      <Star className="w-2 h-2 mr-1 fill-accent-yellow" />
                      Favorite
                    </Badge>
                  )}
                  <span className="text-xs text-muted-gray ml-auto">
                    {new Date(photo.created_at).toLocaleDateString()}
                  </span>
                </div>
                {photo.description && (
                  <p className="text-xs text-muted-gray line-clamp-2">{photo.description}</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-muted-gray/20">
            <Button
              variant="outline"
              onClick={() => {
                setShowCompareDialog(false);
                // Keep compare mode active to select different photos
              }}
            >
              Select Different Photos
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowCompareDialog(false);
                setCompareMode(false);
                setComparePhotos([]);
              }}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContinuityPhotosPanel;
