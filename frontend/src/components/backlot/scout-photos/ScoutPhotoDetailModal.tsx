/**
 * ScoutPhotoDetailModal - Modal for viewing scout photo details
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Camera,
  Sun,
  Moon,
  Volume2,
  Zap,
  Car,
  DoorOpen,
  AlertTriangle,
  Compass,
  Clock,
  Cloud,
  Star,
  Edit2,
  Trash2,
  Loader2,
  Calendar,
  Eye,
  ExternalLink,
  X,
} from 'lucide-react';
import { useScoutPhotoMutations } from '@/hooks/backlot';
import { BacklotScoutPhoto } from '@/types/backlot';
import { useToast } from '@/hooks/use-toast';

interface ScoutPhotoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  photo: BacklotScoutPhoto | null;
  locationId: string;
  canEdit?: boolean;
  onEdit?: (photo: BacklotScoutPhoto) => void;
}

export function ScoutPhotoDetailModal({
  isOpen,
  onClose,
  photo,
  locationId,
  canEdit = false,
  onEdit,
}: ScoutPhotoDetailModalProps) {
  const { toast } = useToast();
  const { deleteScoutPhoto, setAsPrimary } = useScoutPhotoMutations(locationId);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);

  if (!photo) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteScoutPhoto.mutateAsync(photo.id);
      toast({
        title: 'Photo Deleted',
        description: 'Scout photo has been removed.',
      });
      onClose();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to delete photo.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetPrimary = async () => {
    setIsSettingPrimary(true);
    try {
      await setAsPrimary.mutateAsync(photo.id);
      toast({
        title: 'Primary Photo Set',
        description: `"${photo.angle_label || 'Photo'}" is now the primary image.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to set as primary.',
      });
    } finally {
      setIsSettingPrimary(false);
    }
  };

  // Format time of day display
  const formatTimeOfDay = (time: string | null) => {
    if (!time) return null;
    return time.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Get time icon
  const getTimeIcon = (time: string | null) => {
    if (!time) return null;
    switch (time) {
      case 'night':
      case 'blue_hour':
        return <Moon className="w-4 h-4" />;
      case 'golden_hour':
        return <Sun className="w-4 h-4 text-amber-400" />;
      default:
        return <Sun className="w-4 h-4" />;
    }
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const hasAngleVantageInfo = photo.angle_label || photo.vantage_type || photo.camera_facing || photo.interior_exterior;
  const hasTimeConditionsInfo = photo.time_of_day || photo.shoot_date || photo.weather;
  const hasPracticalNotes = photo.light_notes || photo.sound_notes || photo.access_notes ||
                            photo.power_notes || photo.parking_notes || photo.restrictions_notes;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] bg-charcoal-black border-muted-gray/30 p-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Image Section */}
          <div className="lg:w-1/2 bg-black flex items-center justify-center relative">
            <img
              src={photo.image_url}
              alt={photo.angle_label || 'Scout photo'}
              className="w-full h-full object-contain max-h-[50vh] lg:max-h-[80vh]"
            />

            {/* Primary badge */}
            {photo.is_primary && (
              <div className="absolute top-4 left-4">
                <Badge className="bg-accent-yellow text-charcoal-black">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  Primary Photo
                </Badge>
              </div>
            )}

            {/* Open full size link */}
            <a
              href={photo.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-4 right-4 p-2 bg-charcoal-black/80 rounded-lg hover:bg-charcoal-black transition-colors"
              title="Open full size"
            >
              <ExternalLink className="w-4 h-4 text-bone-white" />
            </a>
          </div>

          {/* Details Section */}
          <div className="lg:w-1/2 flex flex-col">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-bone-white flex items-center gap-2 text-xl">
                <Camera className="w-5 h-5 text-accent-yellow" />
                {photo.angle_label || 'Scout Photo'}
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-6">
                {/* Angle & Vantage Section */}
                {hasAngleVantageInfo && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-gray uppercase tracking-wide flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Angle & Vantage
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {photo.vantage_type && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-gray">Vantage Type</span>
                          <p className="text-bone-white capitalize">{photo.vantage_type}</p>
                        </div>
                      )}
                      {photo.camera_facing && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-gray flex items-center gap-1">
                            <Compass className="w-3 h-3" />
                            Camera Facing
                          </span>
                          <p className="text-bone-white capitalize">{photo.camera_facing.replace('-', ' ')}</p>
                        </div>
                      )}
                      {photo.interior_exterior && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-gray">Interior/Exterior</span>
                          <p className="text-bone-white capitalize">{photo.interior_exterior}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Time & Conditions Section */}
                {hasTimeConditionsInfo && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-gray uppercase tracking-wide flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Time & Conditions
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {photo.time_of_day && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-gray flex items-center gap-1">
                            {getTimeIcon(photo.time_of_day)}
                            Time of Day
                          </span>
                          <p className="text-bone-white">{formatTimeOfDay(photo.time_of_day)}</p>
                        </div>
                      )}
                      {photo.shoot_date && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-gray flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Shoot Date
                          </span>
                          <p className="text-bone-white">{formatDate(photo.shoot_date)}</p>
                        </div>
                      )}
                      {photo.weather && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-gray flex items-center gap-1">
                            <Cloud className="w-3 h-3" />
                            Weather
                          </span>
                          <p className="text-bone-white capitalize">{photo.weather}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Practical Notes Section */}
                {hasPracticalNotes && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
                      Practical Notes
                    </h4>
                    <div className="space-y-3">
                      {photo.light_notes && (
                        <div className="p-3 bg-muted-gray/10 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Sun className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-medium text-amber-400">Light</span>
                          </div>
                          <p className="text-bone-white text-sm">{photo.light_notes}</p>
                        </div>
                      )}

                      {photo.sound_notes && (
                        <div className="p-3 bg-muted-gray/10 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Volume2 className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-medium text-blue-400">Sound</span>
                          </div>
                          <p className="text-bone-white text-sm">{photo.sound_notes}</p>
                        </div>
                      )}

                      {photo.power_notes && (
                        <div className="p-3 bg-muted-gray/10 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-4 h-4 text-yellow-400" />
                            <span className="text-sm font-medium text-yellow-400">Power</span>
                          </div>
                          <p className="text-bone-white text-sm">{photo.power_notes}</p>
                        </div>
                      )}

                      {photo.parking_notes && (
                        <div className="p-3 bg-muted-gray/10 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Car className="w-4 h-4 text-green-400" />
                            <span className="text-sm font-medium text-green-400">Parking</span>
                          </div>
                          <p className="text-bone-white text-sm">{photo.parking_notes}</p>
                        </div>
                      )}

                      {photo.access_notes && (
                        <div className="p-3 bg-muted-gray/10 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <DoorOpen className="w-4 h-4 text-purple-400" />
                            <span className="text-sm font-medium text-purple-400">Access</span>
                          </div>
                          <p className="text-bone-white text-sm">{photo.access_notes}</p>
                        </div>
                      )}

                      {photo.restrictions_notes && (
                        <div className="p-3 bg-muted-gray/10 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-sm font-medium text-red-400">Restrictions</span>
                          </div>
                          <p className="text-bone-white text-sm">{photo.restrictions_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* General Notes */}
                {photo.general_notes && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
                      General Notes
                    </h4>
                    <p className="text-bone-white text-sm">{photo.general_notes}</p>
                  </div>
                )}

                {/* Created/Updated info */}
                <div className="pt-4 border-t border-muted-gray/20">
                  <div className="text-xs text-muted-gray">
                    {photo.created_at && (
                      <p>Added: {formatDate(photo.created_at)}</p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Footer with actions */}
            <DialogFooter className="p-4 border-t border-muted-gray/20">
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex gap-2">
                  {canEdit && !photo.is_primary && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSetPrimary}
                      disabled={isSettingPrimary}
                      className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10"
                    >
                      {isSettingPrimary ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Star className="w-4 h-4 mr-1" />
                      )}
                      Set as Primary
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  {canEdit && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit?.(photo)}
                        className="border-muted-gray/30"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-charcoal-black border-muted-gray/30">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-bone-white">
                              Delete Scout Photo
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-gray">
                              Are you sure you want to delete this scout photo? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-transparent border-muted-gray/30 text-bone-white hover:bg-muted-gray/10">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDelete}
                              disabled={isDeleting}
                              className="bg-red-500 text-white hover:bg-red-600"
                            >
                              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="text-muted-gray"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ScoutPhotoDetailModal;
