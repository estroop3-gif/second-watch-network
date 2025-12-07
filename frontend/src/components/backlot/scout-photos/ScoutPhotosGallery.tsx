/**
 * ScoutPhotosGallery - Gallery component for displaying location scout photos
 */
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Camera,
  Plus,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Zap,
  Car,
  Clock,
  Eye,
  Star,
  Loader2,
  ImageIcon,
  Filter,
} from 'lucide-react';
import {
  useScoutPhotos,
  useScoutPhotoMutations,
  VANTAGE_TYPES,
  TIME_OF_DAY_OPTIONS,
  INTERIOR_EXTERIOR_OPTIONS,
} from '@/hooks/backlot';
import { BacklotScoutPhoto, ScoutPhotoFilters } from '@/types/backlot';
import { useToast } from '@/hooks/use-toast';

interface ScoutPhotosGalleryProps {
  locationId: string;
  onAddPhoto: () => void;
  onViewPhoto: (photo: BacklotScoutPhoto) => void;
  canEdit?: boolean;
}

export function ScoutPhotosGallery({
  locationId,
  onAddPhoto,
  onViewPhoto,
  canEdit = false,
}: ScoutPhotosGalleryProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ScoutPhotoFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error } = useScoutPhotos(locationId, filters);
  const { setAsPrimary } = useScoutPhotoMutations(locationId);

  const photos = data?.photos || [];

  const handleSetPrimary = async (photo: BacklotScoutPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await setAsPrimary.mutateAsync(photo.id);
      toast({
        title: 'Primary Photo Set',
        description: `"${photo.angle_label || 'Photo'}" is now the primary image.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to set primary photo.',
      });
    }
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = filters.vantage_type || filters.time_of_day || filters.interior_exterior;

  // Get icon for time of day
  const getTimeIcon = (time: string | null) => {
    if (!time) return null;
    switch (time) {
      case 'night':
      case 'blue_hour':
        return <Moon className="w-3 h-3" />;
      case 'golden_hour':
        return <Sun className="w-3 h-3 text-amber-400" />;
      default:
        return <Sun className="w-3 h-3" />;
    }
  };

  // Check if photo has specific notes
  const hasNotes = (photo: BacklotScoutPhoto, type: string) => {
    switch (type) {
      case 'light':
        return !!photo.light_notes;
      case 'sound':
        return !!photo.sound_notes;
      case 'power':
        return !!photo.power_notes;
      case 'parking':
        return !!photo.parking_notes;
      default:
        return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-accent-yellow" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-400">
        Failed to load scout photos
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-bone-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-accent-yellow" />
            Scout Photos
            {photos.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {photos.length}
              </Badge>
            )}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`text-muted-gray hover:text-bone-white ${showFilters ? 'bg-muted-gray/20' : ''}`}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filter
            {hasActiveFilters && (
              <span className="ml-1 w-2 h-2 rounded-full bg-accent-yellow" />
            )}
          </Button>
        </div>

        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddPhoto}
            className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Scout Photo
          </Button>
        )}
      </div>

      {/* Filters row */}
      {showFilters && (
        <div className="flex items-center gap-3 p-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/20">
          <Select
            value={filters.vantage_type || 'all'}
            onValueChange={(v) => setFilters({ ...filters, vantage_type: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="w-32 h-8 bg-charcoal-black border-muted-gray/30">
              <SelectValue placeholder="Vantage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vantage</SelectItem>
              {VANTAGE_TYPES.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.time_of_day || 'all'}
            onValueChange={(v) => setFilters({ ...filters, time_of_day: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="w-36 h-8 bg-charcoal-black border-muted-gray/30">
              <SelectValue placeholder="Time of Day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Times</SelectItem>
              {TIME_OF_DAY_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.interior_exterior || 'all'}
            onValueChange={(v) => setFilters({ ...filters, interior_exterior: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="w-32 h-8 bg-charcoal-black border-muted-gray/30">
              <SelectValue placeholder="Int/Ext" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {INTERIOR_EXTERIOR_OPTIONS.map((ie) => (
                <SelectItem key={ie.value} value={ie.value}>
                  {ie.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-gray hover:text-bone-white h-8"
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Photos grid */}
      {photos.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-muted-gray/30 rounded-lg">
          <ImageIcon className="w-12 h-12 mx-auto text-muted-gray/40 mb-3" />
          <p className="text-muted-gray mb-2">No scout photos yet</p>
          <p className="text-sm text-muted-gray/60 mb-4">
            Add photos to help filmmakers evaluate this location
          </p>
          {canEdit && (
            <Button
              variant="outline"
              onClick={onAddPhoto}
              className="border-accent-yellow/30 text-accent-yellow"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add First Photo
            </Button>
          )}
        </div>
      ) : (
        <ScrollArea className="h-[500px] pr-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => onViewPhoto(photo)}
                className="group relative aspect-[4/3] rounded-lg overflow-hidden border border-muted-gray/20 hover:border-accent-yellow/50 cursor-pointer transition-all hover:ring-2 hover:ring-accent-yellow/20"
              >
                {/* Image */}
                <img
                  src={photo.thumbnail_url || photo.image_url}
                  alt={photo.angle_label || 'Scout photo'}
                  className="w-full h-full object-cover"
                />

                {/* Primary badge */}
                {photo.is_primary && (
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-accent-yellow text-charcoal-black text-xs">
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      Primary
                    </Badge>
                  </div>
                )}

                {/* Overlay with info */}
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    {/* Angle label */}
                    <div className="font-medium text-bone-white text-sm truncate mb-1">
                      {photo.angle_label || 'Untitled'}
                    </div>

                    {/* Tags row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {photo.vantage_type && (
                        <Badge variant="outline" className="text-xs border-muted-gray/50 py-0">
                          {photo.vantage_type}
                        </Badge>
                      )}
                      {photo.time_of_day && (
                        <Badge variant="outline" className="text-xs border-muted-gray/50 py-0 flex items-center gap-1">
                          {getTimeIcon(photo.time_of_day)}
                          {photo.time_of_day.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>

                    {/* Notes indicators */}
                    <div className="flex items-center gap-2 mt-2">
                      {hasNotes(photo, 'light') && (
                        <Sun className="w-3.5 h-3.5 text-amber-400" title="Light notes" />
                      )}
                      {hasNotes(photo, 'sound') && (
                        <Volume2 className="w-3.5 h-3.5 text-blue-400" title="Sound notes" />
                      )}
                      {hasNotes(photo, 'power') && (
                        <Zap className="w-3.5 h-3.5 text-yellow-400" title="Power notes" />
                      )}
                      {hasNotes(photo, 'parking') && (
                        <Car className="w-3.5 h-3.5 text-green-400" title="Parking notes" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Set as primary button */}
                {canEdit && !photo.is_primary && (
                  <button
                    onClick={(e) => handleSetPrimary(photo, e)}
                    className="absolute top-2 right-2 p-1.5 bg-charcoal-black/80 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent-yellow hover:text-charcoal-black"
                    title="Set as primary"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}

                {/* View overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-charcoal-black/60 rounded-full p-2">
                    <Eye className="w-5 h-5 text-bone-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export default ScoutPhotosGallery;
