/**
 * AddScoutPhotoModal - Modal for adding/editing scout photos
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Upload,
  Sun,
  Volume2,
  Zap,
  Car,
  DoorOpen,
  AlertTriangle,
  Compass,
  Clock,
  Cloud,
  Image as ImageIcon,
  Loader2,
  X,
  Star,
} from 'lucide-react';
import {
  useScoutPhotoMutations,
  VANTAGE_TYPES,
  TIME_OF_DAY_OPTIONS,
  WEATHER_OPTIONS,
  INTERIOR_EXTERIOR_OPTIONS,
  CAMERA_FACING_OPTIONS,
  ANGLE_LABEL_SUGGESTIONS,
} from '@/hooks/backlot';
import { BacklotScoutPhoto, BacklotScoutPhotoInput } from '@/types/backlot';
import { useToast } from '@/hooks/use-toast';

interface AddScoutPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string;
  editPhoto?: BacklotScoutPhoto | null;
}

export function AddScoutPhotoModal({
  isOpen,
  onClose,
  locationId,
  editPhoto,
}: AddScoutPhotoModalProps) {
  const { toast } = useToast();
  const { createScoutPhoto, updateScoutPhoto } = useScoutPhotoMutations(locationId);
  const isEditing = !!editPhoto;

  // Form state
  const [imageUrl, setImageUrl] = useState('');
  const [angleLabel, setAngleLabel] = useState('');
  const [vantageType, setVantageType] = useState<string>('');
  const [cameraFacing, setCameraFacing] = useState<string>('');
  const [timeOfDay, setTimeOfDay] = useState<string>('');
  const [shootDate, setShootDate] = useState('');
  const [weather, setWeather] = useState<string>('');
  const [interiorExterior, setInteriorExterior] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [lightNotes, setLightNotes] = useState('');
  const [soundNotes, setSoundNotes] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [powerNotes, setPowerNotes] = useState('');
  const [parkingNotes, setParkingNotes] = useState('');
  const [restrictionsNotes, setRestrictionsNotes] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (editPhoto) {
      setImageUrl(editPhoto.image_url || '');
      setAngleLabel(editPhoto.angle_label || '');
      setVantageType(editPhoto.vantage_type || '');
      setCameraFacing(editPhoto.camera_facing || '');
      setTimeOfDay(editPhoto.time_of_day || '');
      setShootDate(editPhoto.shoot_date || '');
      setWeather(editPhoto.weather || '');
      setInteriorExterior(editPhoto.interior_exterior || '');
      setIsPrimary(editPhoto.is_primary || false);
      setLightNotes(editPhoto.light_notes || '');
      setSoundNotes(editPhoto.sound_notes || '');
      setAccessNotes(editPhoto.access_notes || '');
      setPowerNotes(editPhoto.power_notes || '');
      setParkingNotes(editPhoto.parking_notes || '');
      setRestrictionsNotes(editPhoto.restrictions_notes || '');
      setGeneralNotes(editPhoto.general_notes || '');
    } else {
      resetForm();
    }
  }, [editPhoto, isOpen]);

  const resetForm = () => {
    setImageUrl('');
    setAngleLabel('');
    setVantageType('');
    setCameraFacing('');
    setTimeOfDay('');
    setShootDate('');
    setWeather('');
    setInteriorExterior('');
    setIsPrimary(false);
    setLightNotes('');
    setSoundNotes('');
    setAccessNotes('');
    setPowerNotes('');
    setParkingNotes('');
    setRestrictionsNotes('');
    setGeneralNotes('');
  };

  const handleSubmit = async () => {
    if (!imageUrl.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please provide an image URL.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const input: BacklotScoutPhotoInput = {
        image_url: imageUrl,
        angle_label: angleLabel || null,
        vantage_type: vantageType || null,
        camera_facing: cameraFacing || null,
        time_of_day: timeOfDay || null,
        shoot_date: shootDate || null,
        weather: weather || null,
        interior_exterior: interiorExterior || null,
        is_primary: isPrimary,
        light_notes: lightNotes || null,
        sound_notes: soundNotes || null,
        access_notes: accessNotes || null,
        power_notes: powerNotes || null,
        parking_notes: parkingNotes || null,
        restrictions_notes: restrictionsNotes || null,
        general_notes: generalNotes || null,
      };

      if (isEditing && editPhoto) {
        await updateScoutPhoto.mutateAsync({ photoId: editPhoto.id, ...input });
        toast({
          title: 'Photo Updated',
          description: 'Scout photo has been updated successfully.',
        });
      } else {
        await createScoutPhoto.mutateAsync(input);
        toast({
          title: 'Photo Added',
          description: 'Scout photo has been added to this location.',
        });
      }

      onClose();
      resetForm();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to save scout photo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-accent-yellow" />
            {isEditing ? 'Edit Scout Photo' : 'Add Scout Photo'}
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Add a photo with production-relevant metadata to help filmmakers evaluate this location.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Image URL */}
            <div className="space-y-2">
              <Label className="text-bone-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-accent-yellow" />
                Image URL *
              </Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="bg-charcoal-black border-muted-gray/30"
              />
              {imageUrl && (
                <div className="relative mt-2 rounded-lg overflow-hidden border border-muted-gray/30 max-w-xs">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-40 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Angle Label with suggestions */}
            <div className="space-y-2">
              <Label className="text-bone-white">Angle Label</Label>
              <Input
                value={angleLabel}
                onChange={(e) => setAngleLabel(e.target.value)}
                placeholder="e.g., Front Entrance, Kitchen, Backyard"
                className="bg-charcoal-black border-muted-gray/30"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {ANGLE_LABEL_SUGGESTIONS.slice(0, 8).map((suggestion) => (
                  <Badge
                    key={suggestion}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent-yellow/10 hover:border-accent-yellow/50 text-xs"
                    onClick={() => setAngleLabel(suggestion)}
                  >
                    {suggestion}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Row: Vantage Type, Camera Facing, Int/Ext */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-bone-white text-sm">Vantage Type</Label>
                <Select value={vantageType || 'none'} onValueChange={(v) => setVantageType(v === 'none' ? '' : v)}>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {VANTAGE_TYPES.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-bone-white text-sm flex items-center gap-1">
                  <Compass className="w-3 h-3" />
                  Camera Facing
                </Label>
                <Select value={cameraFacing || 'none'} onValueChange={(v) => setCameraFacing(v === 'none' ? '' : v)}>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue placeholder="Direction..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {CAMERA_FACING_OPTIONS.map((cf) => (
                      <SelectItem key={cf.value} value={cf.value}>
                        {cf.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-bone-white text-sm">Interior/Exterior</Label>
                <Select value={interiorExterior || 'none'} onValueChange={(v) => setInteriorExterior(v === 'none' ? '' : v)}>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {INTERIOR_EXTERIOR_OPTIONS.map((ie) => (
                      <SelectItem key={ie.value} value={ie.value}>
                        {ie.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row: Time of Day, Shoot Date, Weather */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-bone-white text-sm flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Time of Day
                </Label>
                <Select value={timeOfDay || 'none'} onValueChange={(v) => setTimeOfDay(v === 'none' ? '' : v)}>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {TIME_OF_DAY_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-bone-white text-sm">Shoot Date</Label>
                <Input
                  type="date"
                  value={shootDate}
                  onChange={(e) => setShootDate(e.target.value)}
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-bone-white text-sm flex items-center gap-1">
                  <Cloud className="w-3 h-3" />
                  Weather
                </Label>
                <Select value={weather || 'none'} onValueChange={(v) => setWeather(v === 'none' ? '' : v)}>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {WEATHER_OPTIONS.map((w) => (
                      <SelectItem key={w.value} value={w.value}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Primary toggle */}
            <div className="flex items-center justify-between p-3 bg-muted-gray/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-accent-yellow" />
                <span className="text-bone-white text-sm">Set as Primary Photo</span>
              </div>
              <Switch
                checked={isPrimary}
                onCheckedChange={setIsPrimary}
              />
            </div>

            {/* Practical Notes Section */}
            <div className="border-t border-muted-gray/20 pt-4 mt-4">
              <h4 className="text-bone-white font-medium mb-4">Practical Notes for Production</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-gray text-sm flex items-center gap-1">
                    <Sun className="w-3 h-3 text-amber-400" />
                    Light Notes
                  </Label>
                  <Textarea
                    value={lightNotes}
                    onChange={(e) => setLightNotes(e.target.value)}
                    placeholder="e.g., North-facing windows, soft natural light until 4pm"
                    className="bg-charcoal-black border-muted-gray/30 min-h-[60px] text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-gray text-sm flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-blue-400" />
                    Sound Notes
                  </Label>
                  <Textarea
                    value={soundNotes}
                    onChange={(e) => setSoundNotes(e.target.value)}
                    placeholder="e.g., Road noise during rush hour, very quiet at night"
                    className="bg-charcoal-black border-muted-gray/30 min-h-[60px] text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-gray text-sm flex items-center gap-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    Power Notes
                  </Label>
                  <Textarea
                    value={powerNotes}
                    onChange={(e) => setPowerNotes(e.target.value)}
                    placeholder="e.g., 100A tie-in available, house power only on exterior"
                    className="bg-charcoal-black border-muted-gray/30 min-h-[60px] text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-gray text-sm flex items-center gap-1">
                    <Car className="w-3 h-3 text-green-400" />
                    Parking Notes
                  </Label>
                  <Textarea
                    value={parkingNotes}
                    onChange={(e) => setParkingNotes(e.target.value)}
                    placeholder="e.g., Crew parking for 10 vehicles in lot, no street parking after 6pm"
                    className="bg-charcoal-black border-muted-gray/30 min-h-[60px] text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-gray text-sm flex items-center gap-1">
                    <DoorOpen className="w-3 h-3 text-purple-400" />
                    Access Notes
                  </Label>
                  <Textarea
                    value={accessNotes}
                    onChange={(e) => setAccessNotes(e.target.value)}
                    placeholder="e.g., Truck access via back alley, elevator to all floors"
                    className="bg-charcoal-black border-muted-gray/30 min-h-[60px] text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-gray text-sm flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    Restrictions Notes
                  </Label>
                  <Textarea
                    value={restrictionsNotes}
                    onChange={(e) => setRestrictionsNotes(e.target.value)}
                    placeholder="e.g., No filming after 10pm, no pyrotechnics, drone requires permit"
                    className="bg-charcoal-black border-muted-gray/30 min-h-[60px] text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label className="text-muted-gray text-sm">General Notes</Label>
                <Textarea
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Any other relevant information about this specific view/angle..."
                  className="bg-charcoal-black border-muted-gray/30 min-h-[60px] text-sm"
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="border-muted-gray/30"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !imageUrl.trim()}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Add Photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddScoutPhotoModal;
