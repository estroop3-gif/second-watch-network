/**
 * CallSheetCreateEditModal - Template-aware modal for creating and editing call sheets
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  FileText,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  Heart,
  Car,
  Cloud,
  Info,
  Film,
  Video,
  Music,
  Megaphone,
  Camera,
  Volume2,
  Lightbulb,
  Palette,
  Shirt,
  Sparkles,
  Flame,
  Wand2,
  Truck,
  Coffee,
  Users,
  Building,
  ChevronRight,
  ImageIcon,
  Upload,
  X,
  Clapperboard,
  Sun,
  Moon,
} from 'lucide-react';
import { useCallSheets, useProductionDays, useCallSheetLocations, useCallSheetScenes, useProjectLocations } from '@/hooks/backlot';
import { api } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
import { useToast } from '@/hooks/use-toast';
import {
  BacklotCallSheet,
  BacklotCallSheetTemplate,
  BacklotCallSheetScene,
  BacklotIntExt,
  BacklotTimeOfDay,
  CallSheetInput,
  ScheduleBlock,
  CallSheetLocationInput,
  BacklotCallSheetLocation,
  CallSheetCustomContact,
  CallSheetSceneInput,
  BacklotLocation,
} from '@/types/backlot';
import {
  getTemplateDefinition,
  getAvailableTemplates,
  getDefaultScheduleBlocks,
  CallSheetTemplateDefinition,
} from '@/lib/backlot/callSheetTemplates';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CallSheetCreateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  callSheet?: BacklotCallSheet | null;
}

// Icon mapping for template types
const TEMPLATE_ICONS: Record<BacklotCallSheetTemplate, React.ReactNode> = {
  feature: <Film className="w-5 h-5" />,
  documentary: <Video className="w-5 h-5" />,
  music_video: <Music className="w-5 h-5" />,
  commercial: <Megaphone className="w-5 h-5" />,
};

// Icon mapping for department notes
const DEPARTMENT_ICONS: Record<string, React.ReactNode> = {
  camera_notes: <Camera className="w-4 h-4" />,
  sound_notes: <Volume2 className="w-4 h-4" />,
  grip_electric_notes: <Lightbulb className="w-4 h-4" />,
  art_notes: <Palette className="w-4 h-4" />,
  wardrobe_notes: <Shirt className="w-4 h-4" />,
  makeup_hair_notes: <Sparkles className="w-4 h-4" />,
  stunts_notes: <Flame className="w-4 h-4" />,
  vfx_notes: <Wand2 className="w-4 h-4" />,
  transport_notes: <Truck className="w-4 h-4" />,
  catering_notes: <Coffee className="w-4 h-4" />,
};

// Local location state type
interface LocalLocation {
  id?: string;
  location_number: number;
  name: string;
  address: string;
  parking_instructions: string;
  basecamp_location: string;
  call_time: string;
  notes: string;
}

// Local scene state type
interface LocalScene {
  id?: string;
  scene_number: string;
  segment_label: string;
  page_count: string;
  set_name: string;
  int_ext: BacklotIntExt | '';
  time_of_day: BacklotTimeOfDay | '';
  description: string;
  cast_ids: string;
  sort_order: number;
}

const CallSheetCreateEditModal: React.FC<CallSheetCreateEditModalProps> = ({
  isOpen,
  onClose,
  projectId,
  callSheet,
}) => {
  const { toast } = useToast();
  const isEditMode = !!callSheet;
  const { createCallSheet, updateCallSheet } = useCallSheets(projectId);
  const { days } = useProductionDays(projectId);
  const { locations: projectLocations, isLoading: projectLocationsLoading } = useProjectLocations(projectId);

  // Location picker state
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationPickerIndex, setLocationPickerIndex] = useState<number | null>(null);

  // Template selection
  const [templateType, setTemplateType] = useState<BacklotCallSheetTemplate>('feature');
  const [template, setTemplate] = useState<CallSheetTemplateDefinition>(getTemplateDefinition('feature'));

  // Basic form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [productionDayId, setProductionDayId] = useState<string | null>(null);
  const [productionTitle, setProductionTitle] = useState('');
  const [productionCompany, setProductionCompany] = useState('');
  const [headerLogoUrl, setHeaderLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [shootDayNumber, setShootDayNumber] = useState<number | ''>('');
  const [totalShootDays, setTotalShootDays] = useState<number | ''>('');

  // Timing
  const [crewCallTime, setCrewCallTime] = useState('');
  const [generalCallTime, setGeneralCallTime] = useState('');
  const [firstShotTime, setFirstShotTime] = useState('');
  const [breakfastTime, setBreakfastTime] = useState('');
  const [lunchTime, setLunchTime] = useState('');
  const [dinnerTime, setDinnerTime] = useState('');
  const [estimatedWrapTime, setEstimatedWrapTime] = useState('');
  const [sunriseTime, setSunriseTime] = useState('');
  const [sunsetTime, setSunsetTime] = useState('');

  // Multiple locations
  const [locations, setLocations] = useState<LocalLocation[]>([]);

  // Scenes / Segments
  const [scenes, setScenes] = useState<LocalScene[]>([]);

  // Legacy single location (for backward compatibility)
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [parkingNotes, setParkingNotes] = useState('');

  // Contacts
  const [productionOfficePhone, setProductionOfficePhone] = useState('');
  const [productionEmail, setProductionEmail] = useState('');
  const [upmName, setUpmName] = useState('');
  const [upmPhone, setUpmPhone] = useState('');
  const [firstAdName, setFirstAdName] = useState('');
  const [firstAdPhone, setFirstAdPhone] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [directorPhone, setDirectorPhone] = useState('');
  const [producerName, setProducerName] = useState('');
  const [producerPhone, setProducerPhone] = useState('');

  // Schedule
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);

  // Department Notes
  const [departmentNotes, setDepartmentNotes] = useState<Record<string, string>>({});

  // Custom Contacts
  const [customContacts, setCustomContacts] = useState<CallSheetCustomContact[]>([]);

  // Weather
  const [weatherForecast, setWeatherForecast] = useState('');

  // Safety
  const [nearestHospital, setNearestHospital] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [setMedic, setSetMedic] = useState('');
  const [fireSafetyOfficer, setFireSafetyOfficer] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');

  // Additional
  const [generalNotes, setGeneralNotes] = useState('');
  const [advanceSchedule, setAdvanceSchedule] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Legacy fields for compatibility
  const [productionContact, setProductionContact] = useState('');
  const [productionPhone, setProductionPhone] = useState('');
  const [weatherInfo, setWeatherInfo] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalPhone, setHospitalPhone] = useState('');

  // Update template when type changes
  useEffect(() => {
    setTemplate(getTemplateDefinition(templateType));
  }, [templateType]);

  // Reset form when modal opens or callSheet changes
  useEffect(() => {
    if (isOpen) {
      if (callSheet) {
        // Edit mode - populate form
        setTemplateType((callSheet.template_type as BacklotCallSheetTemplate) || 'feature');
        setTitle(callSheet.title);
        setDate(callSheet.date);
        setProductionDayId(callSheet.production_day_id);
        setProductionTitle(callSheet.production_title || '');
        setProductionCompany(callSheet.production_company || '');
        setHeaderLogoUrl(callSheet.header_logo_url || '');
        setShootDayNumber(callSheet.shoot_day_number || '');
        setTotalShootDays(callSheet.total_shoot_days || '');

        // Timing
        setCrewCallTime(callSheet.crew_call_time || '');
        setGeneralCallTime(callSheet.general_call_time || '');
        setFirstShotTime(callSheet.first_shot_time || '');
        setBreakfastTime(callSheet.breakfast_time || '');
        setLunchTime(callSheet.lunch_time || '');
        setDinnerTime(callSheet.dinner_time || '');
        setEstimatedWrapTime(callSheet.estimated_wrap_time || '');
        setSunriseTime(callSheet.sunrise_time || '');
        setSunsetTime(callSheet.sunset_time || '');

        // Legacy location
        setLocationName(callSheet.location_name || '');
        setLocationAddress(callSheet.location_address || '');
        setParkingNotes(callSheet.parking_notes || '');

        // Locations will be loaded separately if in edit mode
        if (callSheet.locations && callSheet.locations.length > 0) {
          setLocations(callSheet.locations.map(l => ({
            id: l.id,
            location_number: l.location_number,
            name: l.name,
            address: l.address || '',
            parking_instructions: l.parking_instructions || '',
            basecamp_location: l.basecamp_location || '',
            call_time: l.call_time || '',
            notes: l.notes || '',
          })));
        } else if (callSheet.location_name) {
          // Convert legacy single location to new format
          setLocations([{
            location_number: 1,
            name: callSheet.location_name || '',
            address: callSheet.location_address || '',
            parking_instructions: callSheet.parking_notes || callSheet.parking_instructions || '',
            basecamp_location: callSheet.basecamp_location || '',
            call_time: '',
            notes: '',
          }]);
        } else {
          setLocations([]);
        }

        // Contacts
        setProductionOfficePhone(callSheet.production_office_phone || '');
        setProductionEmail(callSheet.production_email || '');
        setUpmName(callSheet.upm_name || '');
        setUpmPhone(callSheet.upm_phone || '');
        setFirstAdName(callSheet.first_ad_name || '');
        setFirstAdPhone(callSheet.first_ad_phone || '');
        setDirectorName(callSheet.director_name || '');
        setDirectorPhone(callSheet.director_phone || '');
        setProducerName(callSheet.producer_name || '');
        setProducerPhone(callSheet.producer_phone || '');

        // Legacy contacts
        setProductionContact(callSheet.production_contact || '');
        setProductionPhone(callSheet.production_phone || '');

        // Schedule
        setScheduleBlocks(callSheet.schedule_blocks || []);

        // Department notes
        const notes: Record<string, string> = {};
        if (callSheet.camera_notes) notes.camera_notes = callSheet.camera_notes;
        if (callSheet.sound_notes) notes.sound_notes = callSheet.sound_notes;
        if (callSheet.grip_electric_notes) notes.grip_electric_notes = callSheet.grip_electric_notes;
        if (callSheet.art_notes) notes.art_notes = callSheet.art_notes;
        if (callSheet.wardrobe_notes) notes.wardrobe_notes = callSheet.wardrobe_notes;
        if (callSheet.makeup_hair_notes) notes.makeup_hair_notes = callSheet.makeup_hair_notes;
        if (callSheet.stunts_notes) notes.stunts_notes = callSheet.stunts_notes;
        if (callSheet.vfx_notes) notes.vfx_notes = callSheet.vfx_notes;
        if (callSheet.transport_notes) notes.transport_notes = callSheet.transport_notes;
        if (callSheet.catering_notes) notes.catering_notes = callSheet.catering_notes;
        setDepartmentNotes(notes);

        // Custom contacts
        setCustomContacts(callSheet.custom_contacts || []);

        // Weather
        setWeatherForecast(callSheet.weather_forecast || '');
        setWeatherInfo(callSheet.weather_info || '');

        // Safety
        setNearestHospital(callSheet.nearest_hospital || '');
        setHospitalAddress(callSheet.hospital_address || '');
        setSetMedic(callSheet.set_medic || '');
        setFireSafetyOfficer(callSheet.fire_safety_officer || '');
        setSafetyNotes(callSheet.safety_notes || '');
        setHospitalName(callSheet.hospital_name || '');
        setHospitalPhone(callSheet.hospital_phone || '');

        // Additional
        setGeneralNotes(callSheet.general_notes || '');
        setAdvanceSchedule(callSheet.advance_schedule || '');
        setSpecialInstructions(callSheet.special_instructions || '');

        // Scenes - load from call sheet if available
        if (callSheet.scenes && callSheet.scenes.length > 0) {
          setScenes(callSheet.scenes.map((s, idx) => ({
            id: s.id,
            scene_number: s.scene_number || '',
            segment_label: s.segment_label || '',
            page_count: s.page_count || '',
            set_name: s.set_name || '',
            int_ext: (s.int_ext as BacklotIntExt) || '',
            time_of_day: (s.time_of_day as BacklotTimeOfDay) || '',
            description: s.description || '',
            cast_ids: s.cast_ids?.join(', ') || '',
            sort_order: s.sort_order ?? idx,
          })));
        } else {
          setScenes([]);
        }
      } else {
        // Create mode - reset form with template defaults
        setTemplateType('feature');
        setTitle('');
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setProductionDayId(null);
        setProductionTitle('');
        setProductionCompany('');
        setHeaderLogoUrl('');
        setShootDayNumber('');
        setTotalShootDays('');

        // Timing defaults
        setCrewCallTime('06:00');
        setGeneralCallTime('07:00');
        setFirstShotTime('08:00');
        setBreakfastTime('');
        setLunchTime('12:30');
        setDinnerTime('');
        setEstimatedWrapTime('18:00');
        setSunriseTime('');
        setSunsetTime('');

        // Empty locations - user will add
        setLocations([{
          location_number: 1,
          name: '',
          address: '',
          parking_instructions: '',
          basecamp_location: '',
          call_time: '',
          notes: '',
        }]);
        setLocationName('');
        setLocationAddress('');
        setParkingNotes('');

        // Contacts
        setProductionOfficePhone('');
        setProductionEmail('');
        setUpmName('');
        setUpmPhone('');
        setFirstAdName('');
        setFirstAdPhone('');
        setDirectorName('');
        setDirectorPhone('');
        setProducerName('');
        setProducerPhone('');
        setProductionContact('');
        setProductionPhone('');

        // Default schedule from template
        setScheduleBlocks(getDefaultScheduleBlocks('feature'));

        // Department notes
        setDepartmentNotes({});

        // Custom contacts
        setCustomContacts([]);

        // Weather
        setWeatherForecast('');
        setWeatherInfo('');

        // Safety
        setNearestHospital('');
        setHospitalAddress('');
        setSetMedic('');
        setFireSafetyOfficer('');
        setSafetyNotes('');
        setHospitalName('');
        setHospitalPhone('');

        // Additional
        setGeneralNotes('');
        setAdvanceSchedule('');
        setSpecialInstructions('');

        // Scenes - start empty
        setScenes([]);
      }
    }
  }, [isOpen, callSheet]);

  // Auto-populate from production day selection
  useEffect(() => {
    if (productionDayId && !isEditMode) {
      const selectedDay = days.find((d) => d.id === productionDayId);
      if (selectedDay) {
        setDate(selectedDay.date);
        if (selectedDay.general_call_time) {
          setGeneralCallTime(selectedDay.general_call_time);
        }
        if (selectedDay.location_name && locations.length > 0 && !locations[0].name) {
          const updatedLocations = [...locations];
          updatedLocations[0] = {
            ...updatedLocations[0],
            name: selectedDay.location_name || '',
            address: selectedDay.location_address || '',
          };
          setLocations(updatedLocations);
        }
        if (!title) {
          setTitle(selectedDay.title || `Day ${selectedDay.day_number} Call Sheet`);
        }
        if (!shootDayNumber) {
          setShootDayNumber(selectedDay.day_number);
        }
      }
    }
  }, [productionDayId, days, isEditMode, title, locations, shootDayNumber]);

  // Location management
  const handleAddLocation = () => {
    const nextNumber = locations.length > 0
      ? Math.max(...locations.map(l => l.location_number)) + 1
      : 1;
    setLocations([...locations, {
      location_number: nextNumber,
      name: '',
      address: '',
      parking_instructions: '',
      basecamp_location: '',
      call_time: '',
      notes: '',
    }]);
  };

  const handleRemoveLocation = (index: number) => {
    if (locations.length > 1) {
      setLocations(locations.filter((_, i) => i !== index));
    }
  };

  const handleUpdateLocation = (index: number, field: keyof LocalLocation, value: string | number) => {
    const updated = [...locations];
    updated[index] = { ...updated[index], [field]: value };
    setLocations(updated);
  };

  // Open location picker for a specific location slot
  const handleOpenLocationPicker = (index: number) => {
    setLocationPickerIndex(index);
    setShowLocationPicker(true);
  };

  // Select a location from the project library and populate the form
  const handleSelectProjectLocation = (projectLocation: BacklotLocation) => {
    if (locationPickerIndex === null) return;

    const updated = [...locations];
    const fullAddress = [
      projectLocation.address,
      projectLocation.city,
      projectLocation.state,
      projectLocation.zip,
    ].filter(Boolean).join(', ');

    updated[locationPickerIndex] = {
      ...updated[locationPickerIndex],
      name: projectLocation.name,
      address: fullAddress || '',
      parking_instructions: projectLocation.parking_notes || '',
      notes: projectLocation.load_in_notes || '',
    };
    setLocations(updated);
    setShowLocationPicker(false);
    setLocationPickerIndex(null);

    toast({
      title: 'Location Selected',
      description: `"${projectLocation.name}" has been added to this call sheet.`,
    });
  };

  // Scene / Segment management
  const handleAddScene = () => {
    const nextOrder = scenes.length > 0
      ? Math.max(...scenes.map(s => s.sort_order)) + 1
      : 1;
    setScenes([...scenes, {
      scene_number: '',
      segment_label: '',
      page_count: '',
      set_name: '',
      int_ext: '',
      time_of_day: '',
      description: '',
      cast_ids: '',
      sort_order: nextOrder,
    }]);
  };

  const handleRemoveScene = (index: number) => {
    setScenes(scenes.filter((_, i) => i !== index));
  };

  const handleUpdateScene = (index: number, field: keyof LocalScene, value: string | number) => {
    const updated = [...scenes];
    updated[index] = { ...updated[index], [field]: value };
    setScenes(updated);
  };

  // Schedule management
  const handleAddScheduleBlock = () => {
    setScheduleBlocks([...scheduleBlocks, { time: '', activity: '' }]);
  };

  const handleRemoveScheduleBlock = (index: number) => {
    setScheduleBlocks(scheduleBlocks.filter((_, i) => i !== index));
  };

  const handleUpdateScheduleBlock = (index: number, field: keyof ScheduleBlock, value: string) => {
    const updated = [...scheduleBlocks];
    updated[index] = { ...updated[index], [field]: value };
    setScheduleBlocks(updated);
  };

  // Department notes management
  const handleUpdateDepartmentNote = (noteId: string, value: string) => {
    setDepartmentNotes({ ...departmentNotes, [noteId]: value });
  };

  // Custom contacts management
  const handleAddCustomContact = () => {
    setCustomContacts([...customContacts, {
      id: `temp-${Date.now()}`,
      title: '',
      name: '',
      phone: '',
      email: '',
    }]);
  };

  const handleRemoveCustomContact = (index: number) => {
    setCustomContacts(customContacts.filter((_, i) => i !== index));
  };

  const handleUpdateCustomContact = (index: number, field: keyof CallSheetCustomContact, value: string) => {
    const updated = [...customContacts];
    updated[index] = { ...updated[index], [field]: value };
    setCustomContacts(updated);
  };

  // Logo upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select an image file (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Logo image must be smaller than 2MB',
        variant: 'destructive',
      });
      return;
    }

    setLogoUploading(true);

    try {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      // Upload to S3 via API
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/upload-call-sheet-logo`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      setHeaderLogoUrl(result.logo_url);

      toast({
        title: 'Logo Uploaded',
        description: 'Logo has been uploaded successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload logo',
        variant: 'destructive',
      });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setHeaderLogoUrl('');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !date) return;

    // Use the primary location for legacy fields
    const primaryLocation = locations.find(l => l.location_number === 1) || locations[0];

    const input: CallSheetInput = {
      title: title.trim(),
      date,
      production_day_id: productionDayId || undefined,
      template_type: templateType,
      production_title: productionTitle || undefined,
      production_company: productionCompany || undefined,
      header_logo_url: headerLogoUrl || undefined,
      shoot_day_number: shootDayNumber ? Number(shootDayNumber) : undefined,
      total_shoot_days: totalShootDays ? Number(totalShootDays) : undefined,

      // Timing
      crew_call_time: crewCallTime || undefined,
      general_call_time: generalCallTime || undefined,
      first_shot_time: firstShotTime || undefined,
      breakfast_time: breakfastTime || undefined,
      lunch_time: lunchTime || undefined,
      dinner_time: dinnerTime || undefined,
      estimated_wrap_time: estimatedWrapTime || undefined,
      sunrise_time: sunriseTime || undefined,
      sunset_time: sunsetTime || undefined,

      // Legacy location fields (from primary location)
      location_name: primaryLocation?.name || locationName || undefined,
      location_address: primaryLocation?.address || locationAddress || undefined,
      parking_notes: primaryLocation?.parking_instructions || parkingNotes || undefined,
      parking_instructions: primaryLocation?.parking_instructions || undefined,
      basecamp_location: primaryLocation?.basecamp_location || undefined,

      // Contacts
      production_office_phone: productionOfficePhone || undefined,
      production_email: productionEmail || undefined,
      upm_name: upmName || undefined,
      upm_phone: upmPhone || undefined,
      first_ad_name: firstAdName || undefined,
      first_ad_phone: firstAdPhone || undefined,
      director_name: directorName || undefined,
      director_phone: directorPhone || undefined,
      producer_name: producerName || undefined,
      producer_phone: producerPhone || undefined,
      production_contact: productionContact || undefined,
      production_phone: productionPhone || undefined,

      // Schedule
      schedule_blocks: scheduleBlocks.filter((b) => b.time && b.activity),

      // Department notes
      camera_notes: departmentNotes.camera_notes || undefined,
      sound_notes: departmentNotes.sound_notes || undefined,
      grip_electric_notes: departmentNotes.grip_electric_notes || undefined,
      art_notes: departmentNotes.art_notes || undefined,
      wardrobe_notes: departmentNotes.wardrobe_notes || undefined,
      makeup_hair_notes: departmentNotes.makeup_hair_notes || undefined,
      stunts_notes: departmentNotes.stunts_notes || undefined,
      vfx_notes: departmentNotes.vfx_notes || undefined,
      transport_notes: departmentNotes.transport_notes || undefined,
      catering_notes: departmentNotes.catering_notes || undefined,

      // Weather
      weather_forecast: weatherForecast || undefined,
      weather_info: weatherInfo || undefined,

      // Safety
      nearest_hospital: nearestHospital || undefined,
      hospital_address: hospitalAddress || undefined,
      hospital_name: hospitalName || undefined,
      hospital_phone: hospitalPhone || undefined,
      set_medic: setMedic || undefined,
      fire_safety_officer: fireSafetyOfficer || undefined,
      safety_notes: safetyNotes || undefined,

      // Additional
      general_notes: generalNotes || undefined,
      advance_schedule: advanceSchedule || undefined,
      special_instructions: specialInstructions || undefined,

      // Custom contacts (filter out empty entries)
      custom_contacts: customContacts.filter(c => c.name.trim() || c.title.trim()).length > 0
        ? customContacts.filter(c => c.name.trim() || c.title.trim())
        : undefined,
    };

    try {
      let savedCallSheetId: string;

      if (isEditMode && callSheet) {
        await updateCallSheet.mutateAsync({ id: callSheet.id, ...input });
        savedCallSheetId = callSheet.id;
      } else {
        const newCallSheet = await createCallSheet.mutateAsync({ projectId, ...input });
        savedCallSheetId = newCallSheet.id;
      }

      // Save scenes if any were added/modified
      if (scenes.length > 0 || (isEditMode && callSheet?.scenes && callSheet.scenes.length > 0)) {
        await saveScenes(savedCallSheetId);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save call sheet:', error);
    }
  };

  // Helper function to save scenes via API
  const saveScenes = async (callSheetId: string) => {
    const token = await getAuthToken();
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

    // Get existing scenes from the call sheet (if edit mode)
    const existingSceneIds = new Set(
      (callSheet?.scenes || []).map(s => s.id)
    );

    // Track which scenes we've processed
    const processedIds = new Set<string>();

    // Process each local scene
    for (const scene of scenes) {
      const sceneInput: CallSheetSceneInput = {
        scene_number: scene.scene_number || undefined,
        segment_label: scene.segment_label || undefined,
        page_count: scene.page_count || undefined,
        set_name: scene.set_name || undefined,
        int_ext: scene.int_ext || undefined,
        time_of_day: scene.time_of_day || undefined,
        description: scene.description || undefined,
        cast_ids: scene.cast_ids ? scene.cast_ids.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        sort_order: scene.sort_order,
      };

      if (scene.id && existingSceneIds.has(scene.id)) {
        // Update existing scene
        await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/scenes/${scene.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(sceneInput),
        });
        processedIds.add(scene.id);
      } else {
        // Create new scene
        await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/scenes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(sceneInput),
        });
      }
    }

    // Delete scenes that were removed (in edit mode)
    if (isEditMode) {
      for (const existingId of existingSceneIds) {
        if (!processedIds.has(existingId)) {
          await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/scenes/${existingId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
      }
    }
  };

  // Helper to get auth token
  const getAuthToken = (): string => {
    const token = api.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    return token;
  };

  const isPending = createCallSheet.isPending || updateCallSheet.isPending;
  const canSubmit = title.trim() && date && !isPending;
  const availableTemplates = getAvailableTemplates();
  const visibleDepartments = template.departmentNotes.filter(d => d.visible);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-bone-white">
            <FileText className="w-5 h-5 text-accent-yellow" />
            {isEditMode ? 'Edit Call Sheet' : 'Create Call Sheet'}
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            {isEditMode
              ? 'Update call sheet details and schedule'
              : 'Create a new call sheet for your production team'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-6 bg-muted-gray/20">
              <TabsTrigger value="basic" className="text-xs">Basic Info</TabsTrigger>
              <TabsTrigger value="timing" className="text-xs">Timing</TabsTrigger>
              <TabsTrigger value="locations" className="text-xs">Locations</TabsTrigger>
              <TabsTrigger value="scenes" className="text-xs">Scenes</TabsTrigger>
              <TabsTrigger value="contacts" className="text-xs">Contacts</TabsTrigger>
              <TabsTrigger value="more" className="text-xs">More</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-6 mt-4">
              {/* Template Selection - only show for new call sheets */}
              {!isEditMode && (
                <div className="space-y-3">
                  <Label className="text-bone-white">Template Type</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {availableTemplates.map((t) => (
                      <button
                        key={t.type}
                        onClick={() => {
                          setTemplateType(t.type);
                          setScheduleBlocks(getDefaultScheduleBlocks(t.type));
                        }}
                        className={cn(
                          'flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors text-left',
                          templateType === t.type
                            ? 'border-accent-yellow bg-accent-yellow/10'
                            : 'border-muted-gray/30 hover:border-muted-gray/50'
                        )}
                      >
                        <div className={cn(
                          templateType === t.type ? 'text-accent-yellow' : 'text-muted-gray'
                        )}>
                          {TEMPLATE_ICONS[t.type]}
                        </div>
                        <div className="text-center">
                          <div className={cn(
                            'text-sm font-medium',
                            templateType === t.type ? 'text-bone-white' : 'text-muted-gray'
                          )}>
                            {t.name}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Production Day Link */}
              {days.length > 0 && !isEditMode && (
                <div className="space-y-2">
                  <Label className="text-bone-white">Link to Production Day (Optional)</Label>
                  <select
                    value={productionDayId || ''}
                    onChange={(e) => setProductionDayId(e.target.value || null)}
                    className="w-full bg-charcoal-black border border-muted-gray/30 rounded-md px-3 py-2 text-bone-white"
                  >
                    <option value="">No linked production day</option>
                    {days.map((day) => (
                      <option key={day.id} value={day.id}>
                        Day {day.day_number} - {format(new Date(day.date), 'MMM d, yyyy')}
                        {day.title && ` - ${day.title}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Core Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label className="text-bone-white">Title *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Day 1 Call Sheet"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-bone-white">Production Title</Label>
                  <Input
                    value={productionTitle}
                    onChange={(e) => setProductionTitle(e.target.value)}
                    placeholder="Project Name"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-bone-white">Production Company</Label>
                  <Input
                    value={productionCompany}
                    onChange={(e) => setProductionCompany(e.target.value)}
                    placeholder="Studio Name"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>

                {/* Logo Upload - spans full width */}
                <div className="space-y-2 col-span-2">
                  <Label className="text-bone-white flex items-center gap-1">
                    <ImageIcon className="w-4 h-4" />
                    Header Logo (Optional)
                  </Label>
                  <div className="flex items-center gap-4">
                    {headerLogoUrl ? (
                      <div className="relative">
                        <img
                          src={headerLogoUrl}
                          alt="Logo preview"
                          className="h-16 max-w-[200px] object-contain border border-muted-gray/30 rounded-md p-2 bg-charcoal-black"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500/80 hover:bg-red-500 text-white"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-muted-gray/50 rounded-md cursor-pointer hover:border-accent-yellow/50 hover:bg-accent-yellow/5 transition-colors">
                        {logoUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-accent-yellow" />
                        ) : (
                          <Upload className="w-4 h-4 text-muted-gray" />
                        )}
                        <span className="text-sm text-muted-gray">
                          {logoUploading ? 'Uploading...' : 'Upload Logo'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={logoUploading}
                          className="hidden"
                        />
                      </label>
                    )}
                    <p className="text-xs text-muted-gray">
                      Logo will appear on PDF call sheets. PNG or JPG, max 2MB.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-bone-white flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Date *
                  </Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-bone-white">Shoot Day</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={shootDayNumber}
                      onChange={(e) => setShootDayNumber(e.target.value ? Number(e.target.value) : '')}
                      placeholder="#"
                      className="bg-charcoal-black border-muted-gray/30 w-20"
                    />
                    <span className="text-muted-gray">of</span>
                    <Input
                      type="number"
                      value={totalShootDays}
                      onChange={(e) => setTotalShootDays(e.target.value ? Number(e.target.value) : '')}
                      placeholder="#"
                      className="bg-charcoal-black border-muted-gray/30 w-20"
                    />
                    <span className="text-muted-gray">total days</span>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-bone-white flex items-center gap-1">
                    <Clock className="w-4 h-4 text-accent-yellow" />
                    Day Schedule
                  </Label>
                  <div className="flex items-center gap-2">
                    {/* Quick add preset buttons */}
                    <div className="hidden md:flex items-center gap-1">
                      {[
                        { label: 'Crew', time: '06:00', activity: 'Crew Call' },
                        { label: '1st Shot', time: '08:00', activity: 'First Shot' },
                        { label: 'Lunch', time: '12:30', activity: 'Lunch (1 Hour)' },
                        { label: 'Wrap', time: '18:00', activity: 'Estimated Wrap' },
                      ].map((preset) => (
                        <Button
                          key={preset.label}
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Check if this activity already exists
                            const exists = scheduleBlocks.some(
                              b => b.activity.toLowerCase().includes(preset.activity.toLowerCase().split(' ')[0])
                            );
                            if (!exists) {
                              setScheduleBlocks([...scheduleBlocks, { time: preset.time, activity: preset.activity }]);
                            }
                          }}
                          className="text-xs text-muted-gray hover:text-accent-yellow px-2 h-7"
                        >
                          +{preset.label}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddScheduleBlock}
                      className="border-muted-gray/30"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {scheduleBlocks.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-muted-gray/30 rounded-lg">
                      <Clock className="w-6 h-6 mx-auto text-muted-gray/50 mb-2" />
                      <p className="text-muted-gray text-sm">No schedule items yet</p>
                      <p className="text-muted-gray/60 text-xs mt-1">
                        Use the quick add buttons or click "Add Item" to build your schedule
                      </p>
                    </div>
                  ) : (
                    scheduleBlocks.map((block, index) => (
                      <div key={index} className="group border border-muted-gray/20 rounded-lg p-2 hover:border-muted-gray/40 transition-colors">
                        <div className="flex gap-2 items-start">
                          <Input
                            type="time"
                            value={block.time}
                            onChange={(e) => handleUpdateScheduleBlock(index, 'time', e.target.value)}
                            className="bg-charcoal-black border-muted-gray/30 w-28 h-8 text-sm font-mono"
                          />
                          <Input
                            value={block.activity}
                            onChange={(e) => handleUpdateScheduleBlock(index, 'activity', e.target.value)}
                            placeholder="Activity description"
                            className="bg-charcoal-black border-muted-gray/30 flex-1 h-8 text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveScheduleBlock(index)}
                            className="text-red-400 hover:text-red-300 shrink-0 h-8 w-8 opacity-50 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        {/* Notes field - collapsible */}
                        <div className="mt-2">
                          <Input
                            value={block.notes || ''}
                            onChange={(e) => {
                              const updated = [...scheduleBlocks];
                              updated[index] = { ...updated[index], notes: e.target.value };
                              setScheduleBlocks(updated);
                            }}
                            placeholder="Additional notes (optional)"
                            className="bg-charcoal-black/50 border-muted-gray/20 h-7 text-xs text-muted-gray placeholder:text-muted-gray/40"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {scheduleBlocks.length > 0 && (
                  <p className="text-xs text-muted-gray/60">
                    Tip: Schedule will be displayed chronologically on the call sheet PDF
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Timing Tab */}
            <TabsContent value="timing" className="space-y-6 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-bone-white">Crew Call</Label>
                  <Input
                    type="time"
                    value={crewCallTime}
                    onChange={(e) => setCrewCallTime(e.target.value)}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-bone-white">General Call</Label>
                  <Input
                    type="time"
                    value={generalCallTime}
                    onChange={(e) => setGeneralCallTime(e.target.value)}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-bone-white">First Shot</Label>
                  <Input
                    type="time"
                    value={firstShotTime}
                    onChange={(e) => setFirstShotTime(e.target.value)}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-gray">Breakfast</Label>
                  <Input
                    type="time"
                    value={breakfastTime}
                    onChange={(e) => setBreakfastTime(e.target.value)}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-gray">Lunch</Label>
                  <Input
                    type="time"
                    value={lunchTime}
                    onChange={(e) => setLunchTime(e.target.value)}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-gray">Dinner/2nd Meal</Label>
                  <Input
                    type="time"
                    value={dinnerTime}
                    onChange={(e) => setDinnerTime(e.target.value)}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-bone-white">Estimated Wrap</Label>
                  <Input
                    type="time"
                    value={estimatedWrapTime}
                    onChange={(e) => setEstimatedWrapTime(e.target.value)}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-gray">Sunrise</Label>
                  <Input
                    type="time"
                    value={sunriseTime}
                    onChange={(e) => setSunriseTime(e.target.value)}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-gray">Sunset</Label>
                  <Input
                    type="time"
                    value={sunsetTime}
                    onChange={(e) => setSunsetTime(e.target.value)}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
              </div>

              {/* Weather */}
              <div className="space-y-2">
                <Label className="text-bone-white flex items-center gap-1">
                  <Cloud className="w-4 h-4" />
                  Weather Forecast
                </Label>
                <Textarea
                  value={weatherForecast}
                  onChange={(e) => setWeatherForecast(e.target.value)}
                  placeholder="Partly cloudy, High 75°F / Low 58°F, 10% chance of rain"
                  className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                />
              </div>
            </TabsContent>

            {/* Locations Tab */}
            <TabsContent value="locations" className="space-y-6 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-bone-white flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-accent-yellow" />
                    Shoot Locations
                  </Label>
                  {projectLocations.length > 0 && (
                    <p className="text-xs text-muted-gray mt-1">
                      {projectLocations.length} location{projectLocations.length !== 1 ? 's' : ''} in project library
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddLocation}
                  className="border-muted-gray/30"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Location
                </Button>
              </div>

              <div className="space-y-4">
                {locations.map((location, index) => (
                  <div key={index} className="border border-muted-gray/30 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-accent-yellow border-accent-yellow/30">
                          Location {location.location_number}
                        </Badge>
                        {projectLocations.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenLocationPicker(index)}
                            className="text-accent-yellow hover:text-bone-white text-xs h-6 px-2"
                          >
                            <Building className="w-3 h-3 mr-1" />
                            Select from Library
                          </Button>
                        )}
                      </div>
                      {locations.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLocation(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-gray">Location Name</Label>
                        <Input
                          value={location.name}
                          onChange={(e) => handleUpdateLocation(index, 'name', e.target.value)}
                          placeholder="Main Studio"
                          className="bg-charcoal-black border-muted-gray/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-gray">Call Time (if different)</Label>
                        <Input
                          type="time"
                          value={location.call_time}
                          onChange={(e) => handleUpdateLocation(index, 'call_time', e.target.value)}
                          className="bg-charcoal-black border-muted-gray/30"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-gray">Address</Label>
                      <Input
                        value={location.address}
                        onChange={(e) => handleUpdateLocation(index, 'address', e.target.value)}
                        placeholder="123 Film Street, Hollywood, CA 90028"
                        className="bg-charcoal-black border-muted-gray/30"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-gray flex items-center gap-1">
                          <Car className="w-4 h-4" />
                          Parking
                        </Label>
                        <Textarea
                          value={location.parking_instructions}
                          onChange={(e) => handleUpdateLocation(index, 'parking_instructions', e.target.value)}
                          placeholder="Parking instructions..."
                          className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-gray">Basecamp / Holding</Label>
                        <Textarea
                          value={location.basecamp_location}
                          onChange={(e) => handleUpdateLocation(index, 'basecamp_location', e.target.value)}
                          placeholder="Basecamp location..."
                          className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Location Picker Modal */}
              {showLocationPicker && (
                <Dialog open={showLocationPicker} onOpenChange={setShowLocationPicker}>
                  <DialogContent className="max-w-lg bg-charcoal-black border-muted-gray/30">
                    <DialogHeader>
                      <DialogTitle className="text-bone-white flex items-center gap-2">
                        <Building className="w-5 h-5 text-accent-yellow" />
                        Select Location from Library
                      </DialogTitle>
                      <DialogDescription className="text-muted-gray">
                        Choose a location from your project's location library
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[400px]">
                      {projectLocationsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-accent-yellow" />
                        </div>
                      ) : projectLocations.length === 0 ? (
                        <div className="text-center py-8">
                          <MapPin className="w-8 h-8 mx-auto text-muted-gray/50 mb-2" />
                          <p className="text-muted-gray text-sm">No locations in project library</p>
                          <p className="text-muted-gray/60 text-xs mt-1">
                            Add locations in the Locations tab first
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 p-1">
                          {projectLocations.map((loc) => (
                            <button
                              key={loc.id}
                              onClick={() => handleSelectProjectLocation(loc)}
                              className="w-full text-left p-3 rounded-lg border border-muted-gray/20 hover:border-accent-yellow/50 hover:bg-accent-yellow/5 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-bone-white">{loc.name}</div>
                                  {loc.address && (
                                    <div className="text-sm text-muted-gray mt-1">
                                      {[loc.address, loc.city, loc.state].filter(Boolean).join(', ')}
                                    </div>
                                  )}
                                  {loc.region_tag && (
                                    <Badge variant="outline" className="mt-2 text-xs border-muted-gray/30">
                                      {loc.region_tag}
                                    </Badge>
                                  )}
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-gray mt-1" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            {/* Scenes / Segments Tab */}
            <TabsContent value="scenes" className="space-y-6 mt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Label className="text-bone-white flex items-center gap-2">
                    <Clapperboard className="w-4 h-4 text-accent-yellow" />
                    Scenes / Segments
                  </Label>
                  <p className="text-sm text-muted-gray mt-1">
                    Add scenes or segments to shoot on this day
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddScene}
                  className="border-muted-gray/30"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Scene
                </Button>
              </div>

              {scenes.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-muted-gray/30 rounded-lg">
                  <Clapperboard className="w-8 h-8 mx-auto text-muted-gray/50 mb-2" />
                  <p className="text-muted-gray text-sm">No scenes added yet</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddScene}
                    className="mt-2 text-accent-yellow"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add First Scene
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {scenes.map((scene, index) => (
                    <div
                      key={scene.id || index}
                      className="p-4 border border-muted-gray/30 rounded-lg bg-muted-gray/5"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant="outline" className="text-accent-yellow border-accent-yellow/30">
                          Scene {index + 1}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveScene(index)}
                          className="text-red-400 hover:text-red-300 h-6 w-6"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-gray">Scene #</Label>
                          <Input
                            value={scene.scene_number}
                            onChange={(e) => handleUpdateScene(index, 'scene_number', e.target.value)}
                            placeholder="1A"
                            className="bg-charcoal-black border-muted-gray/30 h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-gray">Pages</Label>
                          <Input
                            value={scene.page_count}
                            onChange={(e) => handleUpdateScene(index, 'page_count', e.target.value)}
                            placeholder="2 1/8"
                            className="bg-charcoal-black border-muted-gray/30 h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-gray">INT/EXT</Label>
                          <select
                            value={scene.int_ext}
                            onChange={(e) => handleUpdateScene(index, 'int_ext', e.target.value)}
                            className="w-full h-8 bg-charcoal-black border border-muted-gray/30 rounded-md px-2 text-sm text-bone-white"
                          >
                            <option value="">-</option>
                            <option value="int">INT</option>
                            <option value="ext">EXT</option>
                            <option value="int_ext">INT/EXT</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-gray">Time of Day</Label>
                          <select
                            value={scene.time_of_day}
                            onChange={(e) => handleUpdateScene(index, 'time_of_day', e.target.value)}
                            className="w-full h-8 bg-charcoal-black border border-muted-gray/30 rounded-md px-2 text-sm text-bone-white"
                          >
                            <option value="">-</option>
                            <option value="day">DAY</option>
                            <option value="night">NIGHT</option>
                            <option value="dawn">DAWN</option>
                            <option value="dusk">DUSK</option>
                            <option value="morning">MORNING</option>
                            <option value="afternoon">AFTERNOON</option>
                            <option value="evening">EVENING</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-gray">Set / Location Name</Label>
                          <Input
                            value={scene.set_name}
                            onChange={(e) => handleUpdateScene(index, 'set_name', e.target.value)}
                            placeholder="JOHN'S APARTMENT - LIVING ROOM"
                            className="bg-charcoal-black border-muted-gray/30 h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-gray">Cast IDs</Label>
                          <Input
                            value={scene.cast_ids}
                            onChange={(e) => handleUpdateScene(index, 'cast_ids', e.target.value)}
                            placeholder="1, 2, 5"
                            className="bg-charcoal-black border-muted-gray/30 h-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        <Label className="text-xs text-muted-gray">Description / Synopsis</Label>
                        <Textarea
                          value={scene.description}
                          onChange={(e) => handleUpdateScene(index, 'description', e.target.value)}
                          placeholder="John confronts Mary about the missing files..."
                          className="bg-charcoal-black border-muted-gray/30 min-h-[50px] text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Contacts Tab */}
            <TabsContent value="contacts" className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-bone-white">Production Office Phone</Label>
                  <Input
                    value={productionOfficePhone}
                    onChange={(e) => setProductionOfficePhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-bone-white">Production Email</Label>
                  <Input
                    value={productionEmail}
                    onChange={(e) => setProductionEmail(e.target.value)}
                    placeholder="production@example.com"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {/* Director */}
                <div className="space-y-2">
                  <Label className="text-muted-gray">Director</Label>
                  <Input
                    value={directorName}
                    onChange={(e) => setDirectorName(e.target.value)}
                    placeholder="Name"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-gray">Director Phone</Label>
                  <Input
                    value={directorPhone}
                    onChange={(e) => setDirectorPhone(e.target.value)}
                    placeholder="Phone"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                {/* Producer */}
                <div className="space-y-2">
                  <Label className="text-muted-gray">Producer</Label>
                  <Input
                    value={producerName}
                    onChange={(e) => setProducerName(e.target.value)}
                    placeholder="Name"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-gray">Producer Phone</Label>
                  <Input
                    value={producerPhone}
                    onChange={(e) => setProducerPhone(e.target.value)}
                    placeholder="Phone"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                {/* 1st AD */}
                <div className="space-y-2">
                  <Label className="text-muted-gray">1st AD</Label>
                  <Input
                    value={firstAdName}
                    onChange={(e) => setFirstAdName(e.target.value)}
                    placeholder="Name"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-gray">1st AD Phone</Label>
                  <Input
                    value={firstAdPhone}
                    onChange={(e) => setFirstAdPhone(e.target.value)}
                    placeholder="Phone"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                {/* UPM */}
                <div className="space-y-2">
                  <Label className="text-muted-gray">UPM / Line Producer</Label>
                  <Input
                    value={upmName}
                    onChange={(e) => setUpmName(e.target.value)}
                    placeholder="Name"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-gray">UPM Phone</Label>
                  <Input
                    value={upmPhone}
                    onChange={(e) => setUpmPhone(e.target.value)}
                    placeholder="Phone"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
              </div>

              {/* Custom Contacts Section */}
              <div className="pt-4 border-t border-muted-gray/20">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-bone-white flex items-center gap-1">
                    <Users className="w-4 h-4 text-accent-yellow" />
                    Additional Contacts
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomContact}
                    className="border-muted-gray/30"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Contact
                  </Button>
                </div>
                <div className="space-y-3">
                  {customContacts.map((contact, index) => (
                    <div key={contact.id || index} className="border border-muted-gray/30 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-gray">Contact {index + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCustomContact(index)}
                          className="text-red-400 hover:text-red-300 h-7 w-7 p-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-gray">Role / Title</Label>
                          <Input
                            value={contact.title}
                            onChange={(e) => handleUpdateCustomContact(index, 'title', e.target.value)}
                            placeholder="e.g., Location Manager"
                            className="bg-charcoal-black border-muted-gray/30 h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-gray">Name</Label>
                          <Input
                            value={contact.name}
                            onChange={(e) => handleUpdateCustomContact(index, 'name', e.target.value)}
                            placeholder="Full Name"
                            className="bg-charcoal-black border-muted-gray/30 h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-gray">Phone</Label>
                          <Input
                            value={contact.phone || ''}
                            onChange={(e) => handleUpdateCustomContact(index, 'phone', e.target.value)}
                            placeholder="(555) 123-4567"
                            className="bg-charcoal-black border-muted-gray/30 h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-gray">Email</Label>
                          <Input
                            value={contact.email || ''}
                            onChange={(e) => handleUpdateCustomContact(index, 'email', e.target.value)}
                            placeholder="email@example.com"
                            className="bg-charcoal-black border-muted-gray/30 h-9 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {customContacts.length === 0 && (
                    <p className="text-sm text-muted-gray text-center py-3">
                      No additional contacts. Click "Add Contact" to add custom contacts like Location Managers, Stunt Coordinators, etc.
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* More Tab - Department Notes, Safety, Additional */}
            <TabsContent value="more" className="space-y-6 mt-4">
              <Accordion type="multiple" defaultValue={['safety']} className="space-y-2">
                {/* Department Notes */}
                <AccordionItem value="departments" className="border border-muted-gray/30 rounded-lg px-4">
                  <AccordionTrigger className="text-bone-white hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-accent-yellow" />
                      Department Notes
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    {visibleDepartments.map((dept) => (
                      <div key={dept.id} className="space-y-2">
                        <Label className="text-muted-gray flex items-center gap-1">
                          {DEPARTMENT_ICONS[dept.id] || <ChevronRight className="w-4 h-4" />}
                          {dept.label}
                        </Label>
                        <Textarea
                          value={departmentNotes[dept.id] || ''}
                          onChange={(e) => handleUpdateDepartmentNote(dept.id, e.target.value)}
                          placeholder={dept.placeholder || `Notes for ${dept.label}...`}
                          className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                        />
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>

                {/* Safety */}
                <AccordionItem value="safety" className="border border-muted-gray/30 rounded-lg px-4">
                  <AccordionTrigger className="text-bone-white hover:no-underline">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      Safety & Medical
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-gray flex items-center gap-1">
                          <Heart className="w-4 h-4 text-emerald-400" />
                          Nearest Hospital
                        </Label>
                        <Input
                          value={nearestHospital}
                          onChange={(e) => setNearestHospital(e.target.value)}
                          placeholder="Hospital Name"
                          className="bg-charcoal-black border-muted-gray/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-gray">Hospital Address</Label>
                        <Input
                          value={hospitalAddress}
                          onChange={(e) => setHospitalAddress(e.target.value)}
                          placeholder="456 Medical Center Dr"
                          className="bg-charcoal-black border-muted-gray/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-gray">Set Medic</Label>
                        <Input
                          value={setMedic}
                          onChange={(e) => setSetMedic(e.target.value)}
                          placeholder="Name and contact"
                          className="bg-charcoal-black border-muted-gray/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-gray">Fire Safety Officer</Label>
                        <Input
                          value={fireSafetyOfficer}
                          onChange={(e) => setFireSafetyOfficer(e.target.value)}
                          placeholder="Name and contact"
                          className="bg-charcoal-black border-muted-gray/30"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-gray">Safety Notes / Hazards</Label>
                      <Textarea
                        value={safetyNotes}
                        onChange={(e) => setSafetyNotes(e.target.value)}
                        placeholder="Special safety considerations for today's shoot..."
                        className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Additional Notes */}
                <AccordionItem value="additional" className="border border-muted-gray/30 rounded-lg px-4">
                  <AccordionTrigger className="text-bone-white hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-accent-yellow" />
                      Additional Notes
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-muted-gray">General Notes</Label>
                      <Textarea
                        value={generalNotes}
                        onChange={(e) => setGeneralNotes(e.target.value)}
                        placeholder="Any additional information for the crew..."
                        className="bg-charcoal-black border-muted-gray/30 min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-gray">Special Instructions</Label>
                      <Textarea
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="Special notes or instructions..."
                        className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-gray">Advance Schedule / Tomorrow</Label>
                      <Textarea
                        value={advanceSchedule}
                        onChange={(e) => setAdvanceSchedule(e.target.value)}
                        placeholder="Brief preview of next day's work..."
                        className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="border-muted-gray/30"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditMode ? 'Saving...' : 'Creating...'}
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                {isEditMode ? 'Save Changes' : 'Create Call Sheet'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CallSheetCreateEditModal;
