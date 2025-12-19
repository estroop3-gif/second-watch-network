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
  Briefcase,
  Radio,
  Tv,
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
  Link,
  RefreshCw,
  Search,
  Check,
  List,
  BookmarkPlus,
} from 'lucide-react';
import { useCallSheets, useProductionDays, useCallSheetLocations, useCallSheetScenes, useProjectLocations, useScenesList, useScenes, useCallSheetSceneLinkMutations, useCallSheetTemplates, useCallSheetFullData, BacklotSavedCallSheetTemplate, CallSheetFullData } from '@/hooks/backlot';
import { CallSheetSourcePicker } from './CallSheetSourcePicker';
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
import { CallSheetPeopleManager } from './CallSheetPeopleManager';

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
  medical_corporate: <Briefcase className="w-5 h-5" />,
  news_eng: <Radio className="w-5 h-5" />,
  live_event: <Tv className="w-5 h-5" />,
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
  location_id?: string;  // FK to backlot_project_locations for syncing
  library_location_id?: string;  // ID of linked library location (for snapshot tracking)
  name: string;
  address: string;
  parking_instructions: string;
  basecamp_location: string;
  call_time: string;
  notes: string;
  // Clearance status (for display)
  clearance_status?: 'pending' | 'approved' | 'denied' | 'none';
  // Library sync tracking
  is_from_library?: boolean;  // True if linked from library
  needs_library_save?: boolean;  // True if should prompt to save to library
}

// Local scene state type
interface LocalScene {
  id?: string;
  linked_scene_id?: string;         // Project scene ID (if linked from project)
  is_linked: boolean;               // True = linked from project, False = manually created
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
  const [closeConfirmCount, setCloseConfirmCount] = useState(0);
  const { createCallSheet, updateCallSheet } = useCallSheets(projectId);
  const { days } = useProductionDays(projectId);
  const { locations: projectLocations, isLoading: projectLocationsLoading, createLocation: createLibraryLocation } = useProjectLocations(projectId);

  // Scene creation and linking hooks
  const { createScene } = useScenes({ projectId });
  const { linkScene } = useCallSheetSceneLinkMutations();

  // Location picker state
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationPickerIndex, setLocationPickerIndex] = useState<number | null>(null);

  // Save to Library dialog state
  const [showSaveToLibrary, setShowSaveToLibrary] = useState(false);
  const [saveToLibraryIndex, setSaveToLibraryIndex] = useState<number | null>(null);
  const [savingToLibrary, setSavingToLibrary] = useState(false);

  // Scene picker state
  const [showScenePicker, setShowScenePicker] = useState(false);
  const [sceneSearch, setSceneSearch] = useState('');
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set());
  const { data: projectScenesData, isLoading: projectScenesLoading } = useScenesList(projectId, { search: sceneSearch || undefined });
  const projectScenes = Array.isArray(projectScenesData) ? projectScenesData : [];

  // Source picker state (for starting from previous call sheet or template)
  const [selectedSource, setSelectedSource] = useState<{
    type: 'recent' | 'template';
    id: string;
    name: string;
  } | null>(null);
  const [sourceCallSheetId, setSourceCallSheetId] = useState<string | null>(null);
  const { templates: savedTemplates, incrementUseCount, createTemplate } = useCallSheetTemplates();
  const { data: sourceFullData, isLoading: isLoadingSourceData } = useCallSheetFullData(sourceCallSheetId);

  // All call sheets for source picker (recent ones)
  const { callSheets: recentCallSheets, isLoading: isLoadingRecentCallSheets } = useCallSheets(projectId);

  // Save as template dialog state
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

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

  // Get IDs of scenes already added to call sheet (to disable them in picker)
  const alreadyAddedSceneIds = new Set(
    scenes.filter(s => s.linked_scene_id).map(s => s.linked_scene_id!)
  );

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

  // Medical/Corporate template fields
  const [hipaaOfficer, setHipaaOfficer] = useState('');
  const [privacyNotes, setPrivacyNotes] = useState('');
  const [releaseStatus, setReleaseStatus] = useState('');
  const [restrictedAreas, setRestrictedAreas] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [facilityContact, setFacilityContact] = useState('');
  const [facilityPhone, setFacilityPhone] = useState('');

  // News/ENG template fields
  const [deadlineTime, setDeadlineTime] = useState('');
  const [storyAngle, setStoryAngle] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [subjectNotes, setSubjectNotes] = useState('');
  const [location2Name, setLocation2Name] = useState('');
  const [location2Address, setLocation2Address] = useState('');
  const [location3Name, setLocation3Name] = useState('');
  const [location3Address, setLocation3Address] = useState('');

  // Live Event template fields
  const [loadInTime, setLoadInTime] = useState('');
  const [rehearsalTime, setRehearsalTime] = useState('');
  const [doorsTime, setDoorsTime] = useState('');
  const [intermissionTime, setIntermissionTime] = useState('');
  const [strikeTime, setStrikeTime] = useState('');
  const [truckLocation, setTruckLocation] = useState('');
  const [videoVillage, setVideoVillage] = useState('');
  const [commChannel, setCommChannel] = useState('');
  const [tdName, setTdName] = useState('');
  const [tdPhone, setTdPhone] = useState('');
  const [stageManagerName, setStageManagerName] = useState('');
  const [stageManagerPhone, setStageManagerPhone] = useState('');
  const [cameraPlot, setCameraPlot] = useState('');
  const [showRundown, setShowRundown] = useState('');
  const [rainPlan, setRainPlan] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [broadcastNotes, setBroadcastNotes] = useState('');
  const [playbackNotes, setPlaybackNotes] = useState('');

  // Check if form has any data filled in
  const hasFormData = (): boolean => {
    return !!(
      title.trim() ||
      productionTitle.trim() ||
      productionCompany.trim() ||
      headerLogoUrl ||
      shootDayNumber ||
      totalShootDays ||
      crewCallTime !== '06:00' ||
      generalCallTime !== '07:00' ||
      firstShotTime !== '08:00' ||
      lunchTime !== '12:30' ||
      estimatedWrapTime !== '18:00' ||
      breakfastTime ||
      dinnerTime ||
      sunriseTime ||
      sunsetTime ||
      locations.some(l => l.name.trim() || l.address.trim()) ||
      scenes.length > 0 ||
      scheduleBlocks.some(b => b.time || b.activity) ||
      productionOfficePhone ||
      productionEmail ||
      directorName ||
      producerName ||
      firstAdName ||
      upmName ||
      customContacts.length > 0 ||
      Object.values(departmentNotes).some(n => n?.trim()) ||
      weatherForecast ||
      nearestHospital ||
      hospitalAddress ||
      setMedic ||
      fireSafetyOfficer ||
      safetyNotes ||
      generalNotes ||
      specialInstructions ||
      advanceSchedule
    );
  };

  // Apply data from a source (previous call sheet or template)
  const applySourceData = (data: BacklotCallSheet | CallSheetFullData | Record<string, unknown>, isFromSource = true) => {
    const d = data as Record<string, unknown>;

    // Template type
    if (d.template_type) {
      setTemplateType(d.template_type as BacklotCallSheetTemplate);
      setScheduleBlocks(getDefaultScheduleBlocks(d.template_type as BacklotCallSheetTemplate));
    }

    // Title - prefix with "Copy of" if from source
    if (d.title) {
      setTitle(isFromSource ? `Copy of ${d.title}` : String(d.title));
    }

    // Date - always set to today when copying
    if (isFromSource) {
      setDate(format(new Date(), 'yyyy-MM-dd'));
    } else if (d.date) {
      setDate(String(d.date));
    }

    // Production info
    if (d.production_title) setProductionTitle(String(d.production_title));
    if (d.production_company) setProductionCompany(String(d.production_company));
    if (d.header_logo_url) setHeaderLogoUrl(String(d.header_logo_url));

    // Clear shoot day when copying (will be new day)
    if (isFromSource) {
      setShootDayNumber('');
      setProductionDayId(null);
    } else {
      if (d.shoot_day_number) setShootDayNumber(d.shoot_day_number as number);
      if (d.total_shoot_days) setTotalShootDays(d.total_shoot_days as number);
    }
    if (d.total_shoot_days) setTotalShootDays(d.total_shoot_days as number);

    // Timing
    if (d.crew_call_time) setCrewCallTime(String(d.crew_call_time));
    if (d.general_call_time) setGeneralCallTime(String(d.general_call_time));
    if (d.first_shot_time) setFirstShotTime(String(d.first_shot_time));
    if (d.breakfast_time) setBreakfastTime(String(d.breakfast_time));
    if (d.lunch_time) setLunchTime(String(d.lunch_time));
    if (d.dinner_time) setDinnerTime(String(d.dinner_time));
    if (d.estimated_wrap_time) setEstimatedWrapTime(String(d.estimated_wrap_time));
    if (d.sunrise_time) setSunriseTime(String(d.sunrise_time));
    if (d.sunset_time) setSunsetTime(String(d.sunset_time));

    // Locations - copy without IDs to create new entries
    const locationsData = d.locations as LocalLocation[] | undefined;
    if (locationsData && locationsData.length > 0) {
      setLocations(locationsData.map((l, idx) => ({
        location_number: l.location_number || idx + 1,
        name: l.name || '',
        address: l.address || '',
        parking_instructions: l.parking_instructions || '',
        basecamp_location: l.basecamp_location || '',
        call_time: l.call_time || '',
        notes: l.notes || '',
        // Don't copy id, location_id, or library_location_id - these will be new entries
      })));
    }

    // Legacy location
    if (d.location_name) setLocationName(String(d.location_name));
    if (d.location_address) setLocationAddress(String(d.location_address));
    if (d.parking_notes) setParkingNotes(String(d.parking_notes));

    // Contacts
    if (d.production_office_phone) setProductionOfficePhone(String(d.production_office_phone));
    if (d.production_email) setProductionEmail(String(d.production_email));
    if (d.upm_name) setUpmName(String(d.upm_name));
    if (d.upm_phone) setUpmPhone(String(d.upm_phone));
    if (d.first_ad_name) setFirstAdName(String(d.first_ad_name));
    if (d.first_ad_phone) setFirstAdPhone(String(d.first_ad_phone));
    if (d.director_name) setDirectorName(String(d.director_name));
    if (d.director_phone) setDirectorPhone(String(d.director_phone));
    if (d.producer_name) setProducerName(String(d.producer_name));
    if (d.producer_phone) setProducerPhone(String(d.producer_phone));
    if (d.production_contact) setProductionContact(String(d.production_contact));
    if (d.production_phone) setProductionPhone(String(d.production_phone));

    // Schedule blocks
    const scheduleData = d.schedule_blocks as ScheduleBlock[] | undefined;
    if (scheduleData && scheduleData.length > 0) {
      setScheduleBlocks(scheduleData);
    }

    // Department notes
    const notesObj: Record<string, string> = {};
    const noteFields = ['camera_notes', 'sound_notes', 'grip_electric_notes', 'art_notes',
                       'wardrobe_notes', 'makeup_hair_notes', 'stunts_notes', 'vfx_notes',
                       'transport_notes', 'catering_notes'];
    noteFields.forEach(field => {
      if (d[field]) notesObj[field] = String(d[field]);
    });
    if (Object.keys(notesObj).length > 0) setDepartmentNotes(notesObj);

    // Custom contacts
    const customContactsData = d.custom_contacts as CallSheetCustomContact[] | undefined;
    if (customContactsData && customContactsData.length > 0) {
      setCustomContacts(customContactsData.map(c => ({
        id: c.id,
        role: c.role,
        name: c.name,
        phone: c.phone,
        email: c.email,
      })));
    }

    // Weather
    if (d.weather_forecast) setWeatherForecast(String(d.weather_forecast));
    if (d.weather_info) setWeatherInfo(String(d.weather_info));

    // Safety
    if (d.nearest_hospital) setNearestHospital(String(d.nearest_hospital));
    if (d.hospital_address) setHospitalAddress(String(d.hospital_address));
    if (d.set_medic) setSetMedic(String(d.set_medic));
    if (d.fire_safety_officer) setFireSafetyOfficer(String(d.fire_safety_officer));
    if (d.safety_notes) setSafetyNotes(String(d.safety_notes));
    if (d.hospital_name) setHospitalName(String(d.hospital_name));
    if (d.hospital_phone) setHospitalPhone(String(d.hospital_phone));

    // Additional
    if (d.general_notes) setGeneralNotes(String(d.general_notes));
    if (d.advance_schedule) setAdvanceSchedule(String(d.advance_schedule));
    if (d.special_instructions) setSpecialInstructions(String(d.special_instructions));

    // Medical/Corporate fields
    if (d.hipaa_officer) setHipaaOfficer(String(d.hipaa_officer));
    if (d.privacy_notes) setPrivacyNotes(String(d.privacy_notes));
    if (d.release_status) setReleaseStatus(String(d.release_status));
    if (d.restricted_areas) setRestrictedAreas(String(d.restricted_areas));
    if (d.dress_code) setDressCode(String(d.dress_code));
    if (d.client_name) setClientName(String(d.client_name));
    if (d.client_phone) setClientPhone(String(d.client_phone));
    if (d.facility_contact) setFacilityContact(String(d.facility_contact));
    if (d.facility_phone) setFacilityPhone(String(d.facility_phone));

    // News/ENG fields
    if (d.deadline_time) setDeadlineTime(String(d.deadline_time));
    if (d.story_angle) setStoryAngle(String(d.story_angle));
    if (d.reporter_name) setReporterName(String(d.reporter_name));
    if (d.reporter_phone) setReporterPhone(String(d.reporter_phone));
    if (d.subject_notes) setSubjectNotes(String(d.subject_notes));
    if (d.location_2_name) setLocation2Name(String(d.location_2_name));
    if (d.location_2_address) setLocation2Address(String(d.location_2_address));
    if (d.location_3_name) setLocation3Name(String(d.location_3_name));
    if (d.location_3_address) setLocation3Address(String(d.location_3_address));

    // Live Event fields
    if (d.load_in_time) setLoadInTime(String(d.load_in_time));
    if (d.rehearsal_time) setRehearsalTime(String(d.rehearsal_time));
    if (d.doors_time) setDoorsTime(String(d.doors_time));
    if (d.intermission_time) setIntermissionTime(String(d.intermission_time));
    if (d.strike_time) setStrikeTime(String(d.strike_time));
    if (d.truck_location) setTruckLocation(String(d.truck_location));
    if (d.video_village) setVideoVillage(String(d.video_village));
    if (d.comm_channel) setCommChannel(String(d.comm_channel));
    if (d.td_name) setTdName(String(d.td_name));
    if (d.td_phone) setTdPhone(String(d.td_phone));
    if (d.stage_manager_name) setStageManagerName(String(d.stage_manager_name));
    if (d.stage_manager_phone) setStageManagerPhone(String(d.stage_manager_phone));
    if (d.camera_plot) setCameraPlot(String(d.camera_plot));
    if (d.show_rundown) setShowRundown(String(d.show_rundown));
    if (d.rain_plan) setRainPlan(String(d.rain_plan));
    if (d.client_notes) setClientNotes(String(d.client_notes));
    if (d.broadcast_notes) setBroadcastNotes(String(d.broadcast_notes));
    if (d.playback_notes) setPlaybackNotes(String(d.playback_notes));

    // Scenes - copy without IDs, not linked
    const scenesData = d.scenes as LocalScene[] | undefined;
    if (scenesData && scenesData.length > 0) {
      setScenes(scenesData.map((s, idx) => ({
        scene_number: s.scene_number || '',
        segment_label: s.segment_label || '',
        page_count: s.page_count || '',
        set_name: s.set_name || '',
        int_ext: s.int_ext as BacklotIntExt || '',
        time_of_day: s.time_of_day as BacklotTimeOfDay || '',
        description: s.description || '',
        cast_ids: typeof s.cast_ids === 'string' ? s.cast_ids : (s.cast_ids as string[] || []).join(', '),
        sort_order: s.sort_order ?? idx,
        // Don't copy: id, linked_scene_id, is_linked
      })));
    }

    toast({
      title: 'Form prefilled',
      description: `Data loaded from ${selectedSource?.type === 'template' ? 'template' : 'previous call sheet'}. Review and modify as needed.`,
    });
  };

  // Handle selection of a recent call sheet
  const handleSelectRecentCallSheet = (cs: BacklotCallSheet) => {
    setSelectedSource({
      type: 'recent',
      id: cs.id,
      name: cs.title || 'Untitled',
    });
    setSourceCallSheetId(cs.id);
  };

  // Handle selection of a saved template
  const handleSelectTemplate = (template: BacklotSavedCallSheetTemplate) => {
    setSelectedSource({
      type: 'template',
      id: template.id,
      name: template.name,
    });
    // Apply template data directly (it's already in call_sheet_data)
    applySourceData(template.call_sheet_data, true);
    // Increment use count
    incrementUseCount.mutate(template.id);
  };

  // Handle clearing source selection
  const handleClearSource = () => {
    setSelectedSource(null);
    setSourceCallSheetId(null);
    // Reset form to defaults
    setTemplateType('feature');
    setTitle('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setProductionDayId(null);
    setProductionTitle('');
    setProductionCompany('');
    setHeaderLogoUrl('');
    setShootDayNumber('');
    setTotalShootDays('');
    setCrewCallTime('06:00');
    setGeneralCallTime('07:00');
    setFirstShotTime('08:00');
    setBreakfastTime('');
    setLunchTime('12:30');
    setDinnerTime('');
    setEstimatedWrapTime('18:00');
    setSunriseTime('');
    setSunsetTime('');
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
    setScheduleBlocks(getDefaultScheduleBlocks('feature'));
    setDepartmentNotes({});
    setCustomContacts([]);
    setWeatherForecast('');
    setWeatherInfo('');
    setNearestHospital('');
    setHospitalAddress('');
    setSetMedic('');
    setFireSafetyOfficer('');
    setSafetyNotes('');
    setHospitalName('');
    setHospitalPhone('');
    setGeneralNotes('');
    setAdvanceSchedule('');
    setSpecialInstructions('');
    setScenes([]);
    // Reset template-specific fields...
    setHipaaOfficer('');
    setPrivacyNotes('');
    setReleaseStatus('');
    setRestrictedAreas('');
    setDressCode('');
    setClientName('');
    setClientPhone('');
    setFacilityContact('');
    setFacilityPhone('');
    setDeadlineTime('');
    setStoryAngle('');
    setReporterName('');
    setReporterPhone('');
    setSubjectNotes('');
    setLocation2Name('');
    setLocation2Address('');
    setLocation3Name('');
    setLocation3Address('');
    setLoadInTime('');
    setRehearsalTime('');
    setDoorsTime('');
    setIntermissionTime('');
    setStrikeTime('');
    setTruckLocation('');
    setVideoVillage('');
    setCommChannel('');
    setTdName('');
    setTdPhone('');
    setStageManagerName('');
    setStageManagerPhone('');
    setCameraPlot('');
    setShowRundown('');
    setRainPlan('');
    setClientNotes('');
    setBroadcastNotes('');
    setPlaybackNotes('');
  };

  // Handle saving current form data as a template
  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: 'Template name required',
        description: 'Please enter a name for your template.',
        variant: 'destructive',
      });
      return;
    }

    setSavingTemplate(true);
    try {
      // Collect all form data into a template data object
      const callSheetData: Record<string, unknown> = {
        template_type: templateType,
        title: title || 'Template',
        production_title: productionTitle,
        production_company: productionCompany,
        header_logo_url: headerLogoUrl,
        total_shoot_days: totalShootDays,
        // Timing
        crew_call_time: crewCallTime,
        general_call_time: generalCallTime,
        first_shot_time: firstShotTime,
        breakfast_time: breakfastTime,
        lunch_time: lunchTime,
        dinner_time: dinnerTime,
        estimated_wrap_time: estimatedWrapTime,
        sunrise_time: sunriseTime,
        sunset_time: sunsetTime,
        // Locations (without IDs)
        locations: locations.filter(l => l.name || l.address).map(l => ({
          location_number: l.location_number,
          name: l.name,
          address: l.address,
          parking_instructions: l.parking_instructions,
          basecamp_location: l.basecamp_location,
          call_time: l.call_time,
          notes: l.notes,
        })),
        // Contacts
        production_office_phone: productionOfficePhone,
        production_email: productionEmail,
        upm_name: upmName,
        upm_phone: upmPhone,
        first_ad_name: firstAdName,
        first_ad_phone: firstAdPhone,
        director_name: directorName,
        director_phone: directorPhone,
        producer_name: producerName,
        producer_phone: producerPhone,
        production_contact: productionContact,
        production_phone: productionPhone,
        // Schedule
        schedule_blocks: scheduleBlocks.filter(b => b.time || b.activity),
        // Department notes
        ...departmentNotes,
        // Custom contacts
        custom_contacts: customContacts.filter(c => c.name || c.role),
        // Weather
        weather_forecast: weatherForecast,
        weather_info: weatherInfo,
        // Safety
        nearest_hospital: nearestHospital,
        hospital_address: hospitalAddress,
        set_medic: setMedic,
        fire_safety_officer: fireSafetyOfficer,
        safety_notes: safetyNotes,
        hospital_name: hospitalName,
        hospital_phone: hospitalPhone,
        // Additional
        general_notes: generalNotes,
        advance_schedule: advanceSchedule,
        special_instructions: specialInstructions,
        // Template-specific fields
        hipaa_officer: hipaaOfficer,
        privacy_notes: privacyNotes,
        release_status: releaseStatus,
        restricted_areas: restrictedAreas,
        dress_code: dressCode,
        client_name: clientName,
        client_phone: clientPhone,
        facility_contact: facilityContact,
        facility_phone: facilityPhone,
        deadline_time: deadlineTime,
        story_angle: storyAngle,
        reporter_name: reporterName,
        reporter_phone: reporterPhone,
        subject_notes: subjectNotes,
        location_2_name: location2Name,
        location_2_address: location2Address,
        location_3_name: location3Name,
        location_3_address: location3Address,
        load_in_time: loadInTime,
        rehearsal_time: rehearsalTime,
        doors_time: doorsTime,
        intermission_time: intermissionTime,
        strike_time: strikeTime,
        truck_location: truckLocation,
        video_village: videoVillage,
        comm_channel: commChannel,
        td_name: tdName,
        td_phone: tdPhone,
        stage_manager_name: stageManagerName,
        stage_manager_phone: stageManagerPhone,
        camera_plot: cameraPlot,
        show_rundown: showRundown,
        rain_plan: rainPlan,
        client_notes: clientNotes,
        broadcast_notes: broadcastNotes,
        playback_notes: playbackNotes,
        // Scenes (without IDs, not linked)
        scenes: scenes.filter(s => s.scene_number || s.set_name || s.description).map(s => ({
          scene_number: s.scene_number,
          segment_label: s.segment_label,
          page_count: s.page_count,
          set_name: s.set_name,
          int_ext: s.int_ext,
          time_of_day: s.time_of_day,
          description: s.description,
          cast_ids: s.cast_ids,
          sort_order: s.sort_order,
        })),
      };

      await createTemplate.mutateAsync({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        template_type: templateType,
        call_sheet_data: callSheetData,
      });

      toast({
        title: 'Template saved',
        description: `"${templateName}" has been saved to your templates.`,
      });

      setShowSaveTemplateDialog(false);
      setTemplateName('');
      setTemplateDescription('');
    } catch (error) {
      toast({
        title: 'Failed to save template',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  // Custom close handler with double confirmation if data exists
  const handleCloseAttempt = () => {
    if (hasFormData()) {
      if (closeConfirmCount === 0) {
        setCloseConfirmCount(1);
        toast({
          title: 'Unsaved Changes',
          description: 'You have unsaved changes. Click Cancel again to discard them.',
          variant: 'destructive',
        });
        return;
      } else if (closeConfirmCount === 1) {
        // Second confirmation
        if (confirm('Are you sure you want to close? All unsaved changes will be lost.')) {
          setCloseConfirmCount(0);
          onClose();
        }
        return;
      }
    }
    setCloseConfirmCount(0);
    onClose();
  };

  // Reset confirmation count and source selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setCloseConfirmCount(0);
      // Only reset source on fresh open (not in edit mode)
      if (!callSheet) {
        setSelectedSource(null);
        setSourceCallSheetId(null);
      }
    }
  }, [isOpen, callSheet]);

  // Apply source data when loaded from a recent call sheet
  useEffect(() => {
    if (sourceFullData && selectedSource?.type === 'recent') {
      applySourceData(sourceFullData, true);
    }
  }, [sourceFullData, selectedSource?.type]);

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

        // Medical/Corporate fields
        setHipaaOfficer(callSheet.hipaa_officer || '');
        setPrivacyNotes(callSheet.privacy_notes || '');
        setReleaseStatus(callSheet.release_status || '');
        setRestrictedAreas(callSheet.restricted_areas || '');
        setDressCode(callSheet.dress_code || '');
        setClientName(callSheet.client_name || '');
        setClientPhone(callSheet.client_phone || '');
        setFacilityContact(callSheet.facility_contact || '');
        setFacilityPhone(callSheet.facility_phone || '');

        // News/ENG fields
        setDeadlineTime(callSheet.deadline_time || '');
        setStoryAngle(callSheet.story_angle || '');
        setReporterName(callSheet.reporter_name || '');
        setReporterPhone(callSheet.reporter_phone || '');
        setSubjectNotes(callSheet.subject_notes || '');
        setLocation2Name(callSheet.location_2_name || '');
        setLocation2Address(callSheet.location_2_address || '');
        setLocation3Name(callSheet.location_3_name || '');
        setLocation3Address(callSheet.location_3_address || '');

        // Live Event fields
        setLoadInTime(callSheet.load_in_time || '');
        setRehearsalTime(callSheet.rehearsal_time || '');
        setDoorsTime(callSheet.doors_time || '');
        setIntermissionTime(callSheet.intermission_time || '');
        setStrikeTime(callSheet.strike_time || '');
        setTruckLocation(callSheet.truck_location || '');
        setVideoVillage(callSheet.video_village || '');
        setCommChannel(callSheet.comm_channel || '');
        setTdName(callSheet.td_name || '');
        setTdPhone(callSheet.td_phone || '');
        setStageManagerName(callSheet.stage_manager_name || '');
        setStageManagerPhone(callSheet.stage_manager_phone || '');
        setCameraPlot(callSheet.camera_plot || '');
        setShowRundown(callSheet.show_rundown || '');
        setRainPlan(callSheet.rain_plan || '');
        setClientNotes(callSheet.client_notes || '');
        setBroadcastNotes(callSheet.broadcast_notes || '');
        setPlaybackNotes(callSheet.playback_notes || '');

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

        // Medical/Corporate fields
        setHipaaOfficer('');
        setPrivacyNotes('');
        setReleaseStatus('');
        setRestrictedAreas('');
        setDressCode('');
        setClientName('');
        setClientPhone('');
        setFacilityContact('');
        setFacilityPhone('');

        // News/ENG fields
        setDeadlineTime('');
        setStoryAngle('');
        setReporterName('');
        setReporterPhone('');
        setSubjectNotes('');
        setLocation2Name('');
        setLocation2Address('');
        setLocation3Name('');
        setLocation3Address('');

        // Live Event fields
        setLoadInTime('');
        setRehearsalTime('');
        setDoorsTime('');
        setIntermissionTime('');
        setStrikeTime('');
        setTruckLocation('');
        setVideoVillage('');
        setCommChannel('');
        setTdName('');
        setTdPhone('');
        setStageManagerName('');
        setStageManagerPhone('');
        setCameraPlot('');
        setShowRundown('');
        setRainPlan('');
        setClientNotes('');
        setBroadcastNotes('');
        setPlaybackNotes('');

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

    // Snapshot data from library location
    updated[locationPickerIndex] = {
      ...updated[locationPickerIndex],
      library_location_id: projectLocation.id,
      is_from_library: true,
      needs_library_save: false,
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

  // Open Save to Library dialog for a location
  const handleOpenSaveToLibrary = (index: number) => {
    setSaveToLibraryIndex(index);
    setShowSaveToLibrary(true);
  };

  // Save location to project library
  const handleSaveToLibrary = async () => {
    if (saveToLibraryIndex === null) return;

    const location = locations[saveToLibraryIndex];
    if (!location.name) {
      toast({
        title: 'Missing Information',
        description: 'Please enter a location name before saving to library.',
        variant: 'destructive',
      });
      return;
    }

    setSavingToLibrary(true);
    try {
      // Parse address into components (basic split)
      const addressParts = location.address.split(',').map(s => s.trim());

      const newLocation = await createLibraryLocation.mutateAsync({
        name: location.name,
        address: addressParts[0] || '',
        city: addressParts[1] || '',
        state: addressParts[2] || '',
        parking_notes: location.parking_instructions,
        load_in_notes: location.notes,
        visibility: 'private',
      });

      // Update the local location to mark it as linked
      const updated = [...locations];
      updated[saveToLibraryIndex] = {
        ...updated[saveToLibraryIndex],
        library_location_id: newLocation.id,
        is_from_library: true,
        needs_library_save: false,
      };
      setLocations(updated);

      toast({
        title: 'Saved to Library',
        description: `"${location.name}" has been added to your project's location library.`,
      });

      setShowSaveToLibrary(false);
      setSaveToLibraryIndex(null);
    } catch (error) {
      console.error('Failed to save to library:', error);
      toast({
        title: 'Error',
        description: 'Failed to save location to library. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingToLibrary(false);
    }
  };

  // Sync location data from library (refresh snapshot)
  const handleSyncFromLibrary = (index: number) => {
    const location = locations[index];
    if (!location.library_location_id) return;

    const libraryLocation = projectLocations.find(l => l.id === location.library_location_id);
    if (!libraryLocation) {
      toast({
        title: 'Location Not Found',
        description: 'The linked library location no longer exists.',
        variant: 'destructive',
      });
      return;
    }

    const fullAddress = [
      libraryLocation.address,
      libraryLocation.city,
      libraryLocation.state,
      libraryLocation.zip,
    ].filter(Boolean).join(', ');

    const updated = [...locations];
    updated[index] = {
      ...updated[index],
      name: libraryLocation.name,
      address: fullAddress || '',
      parking_instructions: libraryLocation.parking_notes || '',
      notes: libraryLocation.load_in_notes || '',
    };
    setLocations(updated);

    toast({
      title: 'Synced from Library',
      description: `"${libraryLocation.name}" has been updated with library data.`,
    });
  };

  // Scene / Segment management
  // Add a new manually created scene
  const handleAddScene = () => {
    const nextOrder = scenes.length > 0
      ? Math.max(...scenes.map(s => s.sort_order)) + 1
      : 1;
    setScenes([...scenes, {
      is_linked: false,
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

  // Add scenes from project (linked scenes)
  const handleAddLinkedScenes = (selectedSceneIds: string[]) => {
    const newScenes: LocalScene[] = [];
    let nextOrder = scenes.length > 0
      ? Math.max(...scenes.map(s => s.sort_order)) + 1
      : 1;

    for (const sceneId of selectedSceneIds) {
      // Check if already added
      if (scenes.some(s => s.linked_scene_id === sceneId)) {
        continue;
      }

      const projectScene = projectScenes.find(s => s.id === sceneId);
      if (projectScene) {
        newScenes.push({
          is_linked: true,
          linked_scene_id: sceneId,
          scene_number: projectScene.scene_number || '',
          segment_label: '',
          page_count: projectScene.page_length?.toString() || '',
          set_name: projectScene.slugline || '',
          int_ext: (projectScene.int_ext as BacklotIntExt) || '',
          time_of_day: (projectScene.day_night as BacklotTimeOfDay) || '',
          description: '',
          cast_ids: '',
          sort_order: nextOrder++,
        });
      }
    }

    if (newScenes.length > 0) {
      setScenes([...scenes, ...newScenes]);
      toast({
        title: 'Scenes Added',
        description: `Added ${newScenes.length} scene${newScenes.length !== 1 ? 's' : ''} from project.`,
      });
    }
    setShowScenePicker(false);
    setSceneSearch('');
    setSelectedSceneIds(new Set());
  };

  // Sync a linked scene with latest project data
  const handleSyncScene = (index: number) => {
    const scene = scenes[index];
    if (!scene.is_linked || !scene.linked_scene_id) return;

    const projectScene = projectScenes.find(s => s.id === scene.linked_scene_id);
    if (projectScene) {
      const updated = [...scenes];
      updated[index] = {
        ...updated[index],
        scene_number: projectScene.scene_number || '',
        page_count: projectScene.page_length?.toString() || '',
        set_name: projectScene.slugline || '',
        int_ext: (projectScene.int_ext as BacklotIntExt) || '',
        time_of_day: (projectScene.day_night as BacklotTimeOfDay) || '',
      };
      setScenes(updated);
      toast({
        title: 'Scene Synced',
        description: `Scene ${projectScene.scene_number} updated from project.`,
      });
    }
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

      // Medical/Corporate template fields
      hipaa_officer: hipaaOfficer || undefined,
      privacy_notes: privacyNotes || undefined,
      release_status: releaseStatus || undefined,
      restricted_areas: restrictedAreas || undefined,
      dress_code: dressCode || undefined,
      client_name: clientName || undefined,
      client_phone: clientPhone || undefined,
      facility_contact: facilityContact || undefined,
      facility_phone: facilityPhone || undefined,

      // News/ENG template fields
      deadline_time: deadlineTime || undefined,
      story_angle: storyAngle || undefined,
      reporter_name: reporterName || undefined,
      reporter_phone: reporterPhone || undefined,
      subject_notes: subjectNotes || undefined,
      location_2_name: location2Name || undefined,
      location_2_address: location2Address || undefined,
      location_3_name: location3Name || undefined,
      location_3_address: location3Address || undefined,

      // Live Event template fields
      load_in_time: loadInTime || undefined,
      rehearsal_time: rehearsalTime || undefined,
      doors_time: doorsTime || undefined,
      intermission_time: intermissionTime || undefined,
      strike_time: strikeTime || undefined,
      truck_location: truckLocation || undefined,
      video_village: videoVillage || undefined,
      comm_channel: commChannel || undefined,
      td_name: tdName || undefined,
      td_phone: tdPhone || undefined,
      stage_manager_name: stageManagerName || undefined,
      stage_manager_phone: stageManagerPhone || undefined,
      camera_plot: cameraPlot || undefined,
      show_rundown: showRundown || undefined,
      rain_plan: rainPlan || undefined,
      client_notes: clientNotes || undefined,
      broadcast_notes: broadcastNotes || undefined,
      playback_notes: playbackNotes || undefined,

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

      toast({
        title: isEditMode ? 'Call sheet updated' : 'Call sheet created',
        description: `"${title}" has been ${isEditMode ? 'saved' : 'created'} successfully.`,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save call sheet:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save call sheet. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Helper function to save scenes via API
  const saveScenes = async (callSheetId: string) => {
    const token = await getAuthToken();
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

    // Get existing scenes from the call sheet (if edit mode)
    const existingSceneIds = new Set(
      (callSheet?.scenes || []).map(s => s.id)
    );

    // Track which scenes we've processed
    const processedIds = new Set<string>();

    // Process each local scene
    for (const scene of scenes) {
      if (scene.id && existingSceneIds.has(scene.id)) {
        // UPDATE: Existing scene in call sheet - update it directly
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

        await fetch(`${API_BASE_URL}/backlot/call-sheets/${callSheetId}/scenes/${scene.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(sceneInput),
        });
        processedIds.add(scene.id);
      } else if (scene.is_linked && scene.linked_scene_id) {
        // CREATE: Linked scene from project - create link to existing project scene
        await linkScene.mutateAsync({
          callSheetId,
          scene_id: scene.linked_scene_id,
          sequence: scene.sort_order,
          notes: scene.description || undefined,
        });
      } else {
        // CREATE: New manual scene - create in project first, then link
        // First create in project's main scenes table
        const newProjectScene = await createScene.mutateAsync({
          projectId,
          scene_number: scene.scene_number || undefined,
          slugline: scene.set_name || undefined,
          int_ext: scene.int_ext || undefined,
          day_night: scene.time_of_day || undefined,
          page_length: scene.page_count ? parseFloat(scene.page_count) : undefined,
        });

        // Then link the new scene to the call sheet
        await linkScene.mutateAsync({
          callSheetId,
          scene_id: newProjectScene.id,
          sequence: scene.sort_order,
          notes: scene.description || undefined,
        });
      }
    }

    // Delete scenes that were removed (in edit mode)
    if (isEditMode) {
      for (const existingId of existingSceneIds) {
        if (!processedIds.has(existingId)) {
          await fetch(`${API_BASE_URL}/backlot/call-sheets/${callSheetId}/scenes/${existingId}`, {
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
  const missingTitle = !title.trim();
  const missingDate = !date;
  const canSubmit = !missingTitle && !missingDate && !isPending;
  const availableTemplates = getAvailableTemplates();
  const visibleDepartments = template.departmentNotes.filter(d => d.visible);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] bg-charcoal-black border-muted-gray/30"
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
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
            <TabsList className="grid w-full grid-cols-7 bg-muted-gray/20">
              <TabsTrigger value="basic" className="text-xs">Basic Info</TabsTrigger>
              <TabsTrigger value="timing" className="text-xs">Timing</TabsTrigger>
              <TabsTrigger value="locations" className="text-xs">Locations</TabsTrigger>
              <TabsTrigger value="scenes" className="text-xs">Scenes</TabsTrigger>
              <TabsTrigger value="people" className="text-xs">Cast & Crew</TabsTrigger>
              <TabsTrigger value="contacts" className="text-xs">Contacts</TabsTrigger>
              <TabsTrigger value="more" className="text-xs">More</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-6 mt-4">
              {/* Source Picker - only show for new call sheets */}
              {!isEditMode && (
                <CallSheetSourcePicker
                  projectId={projectId}
                  recentCallSheets={recentCallSheets || []}
                  isLoadingRecent={isLoadingRecentCallSheets}
                  onSelectRecent={handleSelectRecentCallSheet}
                  onSelectTemplate={handleSelectTemplate}
                  onClear={handleClearSource}
                  selectedSource={selectedSource}
                />
              )}

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
                  <Label className={cn("text-bone-white", missingTitle && "text-red-400")}>
                    Title * {missingTitle && <span className="text-xs font-normal">(required)</span>}
                  </Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Day 1 Call Sheet"
                    className={cn(
                      "bg-charcoal-black",
                      missingTitle ? "border-red-500/50 focus:border-red-500" : "border-muted-gray/30"
                    )}
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
                  <Label className={cn("flex items-center gap-1", missingDate ? "text-red-400" : "text-bone-white")}>
                    <Calendar className="w-4 h-4" />
                    Date * {missingDate && <span className="text-xs font-normal">(required)</span>}
                  </Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={cn(
                      "bg-charcoal-black",
                      missingDate ? "border-red-500/50 focus:border-red-500" : "border-muted-gray/30"
                    )}
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
                <div className="flex items-center justify-between sticky top-0 z-10 bg-charcoal-black py-2 -mx-1 px-1">
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
                  <div key={index} className={cn(
                    "border rounded-lg p-4 space-y-4",
                    location.is_from_library
                      ? "border-accent-yellow/30 bg-accent-yellow/5"
                      : "border-muted-gray/30"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-accent-yellow border-accent-yellow/30">
                          Location {location.location_number}
                        </Badge>
                        {/* Library link indicator */}
                        {location.is_from_library ? (
                          <Badge variant="outline" className="text-green-400 border-green-400/30 text-xs">
                            <Link className="w-3 h-3 mr-1" />
                            Linked to Library
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-gray border-muted-gray/30 text-xs">
                            Not in Library
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Action buttons based on library status */}
                        {location.is_from_library ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSyncFromLibrary(index)}
                            className="text-accent-yellow hover:text-bone-white text-xs h-6 px-2"
                            title="Refresh data from library"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Sync
                          </Button>
                        ) : (
                          <>
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
                            {location.name && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenSaveToLibrary(index)}
                                className="text-green-400 hover:text-green-300 text-xs h-6 px-2"
                                title="Save this location to your library"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Save to Library
                              </Button>
                            )}
                          </>
                        )}
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

              {/* Save to Library Modal */}
              {showSaveToLibrary && saveToLibraryIndex !== null && (
                <Dialog open={showSaveToLibrary} onOpenChange={setShowSaveToLibrary}>
                  <DialogContent className="max-w-md bg-charcoal-black border-muted-gray/30">
                    <DialogHeader>
                      <DialogTitle className="text-bone-white flex items-center gap-2">
                        <Building className="w-5 h-5 text-green-400" />
                        Save to Location Library
                      </DialogTitle>
                      <DialogDescription className="text-muted-gray">
                        Add this location to your project's location library for reuse in future call sheets.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="bg-muted-gray/10 rounded-lg p-4 space-y-2">
                        <div className="font-medium text-bone-white">
                          {locations[saveToLibraryIndex]?.name || 'Unnamed Location'}
                        </div>
                        {locations[saveToLibraryIndex]?.address && (
                          <div className="text-sm text-muted-gray">
                            {locations[saveToLibraryIndex].address}
                          </div>
                        )}
                        {locations[saveToLibraryIndex]?.parking_instructions && (
                          <div className="text-xs text-muted-gray/70">
                            <span className="text-muted-gray">Parking:</span> {locations[saveToLibraryIndex].parking_instructions}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-gray">
                        Once saved, this location will appear in your project's location library and can be selected for other call sheets.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowSaveToLibrary(false)}
                        className="border-muted-gray/30"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveToLibrary}
                        disabled={savingToLibrary}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {savingToLibrary ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Save to Library
                          </>
                        )}
                      </Button>
                    </div>
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
                    Add scenes from project or create new ones
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowScenePicker(true)}
                    className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10"
                  >
                    <List className="w-4 h-4 mr-1" />
                    Add from Project
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddScene}
                    className="border-muted-gray/30"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create New
                  </Button>
                </div>
              </div>

              {scenes.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-muted-gray/30 rounded-lg">
                  <Clapperboard className="w-8 h-8 mx-auto text-muted-gray/50 mb-2" />
                  <p className="text-muted-gray text-sm">No scenes added yet</p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowScenePicker(true)}
                      className="text-accent-yellow border-accent-yellow/30"
                    >
                      <List className="w-4 h-4 mr-1" />
                      Add from Project
                    </Button>
                    <span className="text-muted-gray/50 text-sm">or</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAddScene}
                      className="text-muted-gray hover:text-bone-white"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create New
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {scenes.map((scene, index) => (
                    <div
                      key={scene.id || index}
                      className={cn(
                        "p-4 border rounded-lg",
                        scene.is_linked
                          ? "border-accent-yellow/30 bg-accent-yellow/5"
                          : "border-muted-gray/30 bg-muted-gray/5"
                      )}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn(
                            scene.is_linked
                              ? "text-accent-yellow border-accent-yellow/30"
                              : "text-bone-white border-muted-gray/30"
                          )}>
                            {scene.is_linked && <Link className="w-3 h-3 mr-1" />}
                            Scene {index + 1}
                          </Badge>
                          {scene.is_linked && (
                            <span className="text-xs text-muted-gray">Linked from project</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {scene.is_linked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSyncScene(index)}
                              className="text-accent-yellow hover:text-bone-white h-6 w-6"
                              title="Sync from project"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveScene(index)}
                            className="text-red-400 hover:text-red-300 h-6 w-6"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
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

              {/* Scene Picker Modal */}
              {showScenePicker && (
                <Dialog open={showScenePicker} onOpenChange={(open) => {
                  setShowScenePicker(open);
                  if (!open) {
                    setSceneSearch('');
                    setSelectedSceneIds(new Set());
                  }
                }}>
                  <DialogContent className="max-w-2xl bg-charcoal-black border-muted-gray/30">
                    <DialogHeader>
                      <DialogTitle className="text-bone-white flex items-center gap-2">
                        <Clapperboard className="w-5 h-5 text-accent-yellow" />
                        Add Scenes from Project
                      </DialogTitle>
                      <DialogDescription className="text-muted-gray">
                        Select scenes from your project's scene list to add to this call sheet
                      </DialogDescription>
                    </DialogHeader>

                    {/* Search input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                      <Input
                        value={sceneSearch}
                        onChange={(e) => setSceneSearch(e.target.value)}
                        placeholder="Search scenes by number or description..."
                        className="bg-charcoal-black border-muted-gray/30 pl-10"
                      />
                    </div>

                    <ScrollArea className="max-h-[400px]">
                      {projectScenesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-accent-yellow" />
                        </div>
                      ) : projectScenes.length === 0 ? (
                        <div className="text-center py-8">
                          <Clapperboard className="w-8 h-8 mx-auto text-muted-gray/50 mb-2" />
                          <p className="text-muted-gray text-sm">
                            {sceneSearch ? 'No scenes match your search' : 'No scenes in project'}
                          </p>
                          <p className="text-muted-gray/60 text-xs mt-1">
                            {sceneSearch ? 'Try a different search term' : 'Import a script or add scenes in the Scenes tab first'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 p-1">
                          {projectScenes.map((scene) => {
                            const isAlreadyAdded = alreadyAddedSceneIds.has(scene.id);
                            const isSelected = selectedSceneIds.has(scene.id);

                            return (
                              <button
                                key={scene.id}
                                onClick={() => {
                                  if (isAlreadyAdded) return;
                                  setSelectedSceneIds(prev => {
                                    const newSet = new Set(prev);
                                    if (isSelected) {
                                      newSet.delete(scene.id);
                                    } else {
                                      newSet.add(scene.id);
                                    }
                                    return newSet;
                                  });
                                }}
                                disabled={isAlreadyAdded}
                                className={cn(
                                  "w-full text-left p-3 rounded-lg border transition-colors",
                                  isAlreadyAdded
                                    ? "border-muted-gray/10 bg-muted-gray/5 opacity-50 cursor-not-allowed"
                                    : isSelected
                                      ? "border-accent-yellow bg-accent-yellow/10"
                                      : "border-muted-gray/20 hover:border-accent-yellow/50 hover:bg-accent-yellow/5"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  {/* Checkbox indicator */}
                                  <div className={cn(
                                    "w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5",
                                    isAlreadyAdded
                                      ? "border-muted-gray/30 bg-muted-gray/20"
                                      : isSelected
                                        ? "border-accent-yellow bg-accent-yellow"
                                        : "border-muted-gray/30"
                                  )}>
                                    {(isSelected || isAlreadyAdded) && (
                                      <Check className={cn(
                                        "w-3 h-3",
                                        isAlreadyAdded ? "text-muted-gray" : "text-charcoal-black"
                                      )} />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-medium text-bone-white">
                                        {scene.scene_number || '—'}
                                      </span>
                                      {scene.int_ext && (
                                        <Badge variant="outline" className="text-xs border-muted-gray/30">
                                          {scene.int_ext.toUpperCase()}
                                        </Badge>
                                      )}
                                      {scene.day_night && (
                                        <Badge variant="outline" className="text-xs border-muted-gray/30 flex items-center gap-1">
                                          {scene.day_night === 'day' ? (
                                            <Sun className="w-3 h-3" />
                                          ) : scene.day_night === 'night' ? (
                                            <Moon className="w-3 h-3" />
                                          ) : null}
                                          {scene.day_night.toUpperCase()}
                                        </Badge>
                                      )}
                                      {isAlreadyAdded && (
                                        <Badge className="bg-muted-gray/20 text-muted-gray text-xs">
                                          Already added
                                        </Badge>
                                      )}
                                    </div>
                                    {scene.slugline && (
                                      <div className="text-sm text-muted-gray mt-1 truncate">
                                        {scene.slugline}
                                      </div>
                                    )}
                                    {scene.page_length && (
                                      <div className="text-xs text-muted-gray/60 mt-1">
                                        {scene.page_length} pages
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>

                    <DialogFooter className="gap-2">
                      <div className="flex-1 text-sm text-muted-gray">
                        {selectedSceneIds.size > 0 && (
                          <span>{selectedSceneIds.size} scene{selectedSceneIds.size !== 1 ? 's' : ''} selected</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowScenePicker(false);
                          setSceneSearch('');
                          setSelectedSceneIds(new Set());
                        }}
                        className="border-muted-gray/30"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleAddLinkedScenes(Array.from(selectedSceneIds))}
                        disabled={selectedSceneIds.size === 0}
                        className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add {selectedSceneIds.size > 0 ? selectedSceneIds.size : ''} Scene{selectedSceneIds.size !== 1 ? 's' : ''}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            {/* People (Cast & Crew) Tab */}
            <TabsContent value="people" className="space-y-6 mt-4">
              {isEditMode && callSheet ? (
                <CallSheetPeopleManager
                  callSheetId={callSheet.id}
                  projectId={projectId}
                />
              ) : (
                <div className="border border-dashed border-muted-gray/30 rounded-lg p-8 text-center">
                  <Users className="w-12 h-12 text-muted-gray mx-auto mb-3" />
                  <p className="text-muted-gray mb-2">Save the call sheet first</p>
                  <p className="text-xs text-muted-gray">
                    Cast & crew can be added after creating the call sheet.
                  </p>
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

                {/* Medical/Corporate Template Section */}
                {templateType === 'medical_corporate' && (
                  <AccordionItem value="medical-corporate" className="border border-muted-gray/30 rounded-lg px-4">
                    <AccordionTrigger className="text-bone-white hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-blue-400" />
                        Privacy & Compliance
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-muted-gray">HIPAA Officer</Label>
                          <Input
                            value={hipaaOfficer}
                            onChange={(e) => setHipaaOfficer(e.target.value)}
                            placeholder="Name and contact"
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Release Status</Label>
                          <select
                            value={releaseStatus}
                            onChange={(e) => setReleaseStatus(e.target.value)}
                            className="w-full bg-charcoal-black border border-muted-gray/30 rounded-md px-3 py-2 text-bone-white"
                          >
                            <option value="">Select status...</option>
                            <option value="pending">Pending</option>
                            <option value="obtained">Obtained</option>
                            <option value="not_required">Not Required</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Dress Code</Label>
                          <Input
                            value={dressCode}
                            onChange={(e) => setDressCode(e.target.value)}
                            placeholder="e.g., Business casual, scrubs provided"
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Restricted Areas</Label>
                          <Input
                            value={restrictedAreas}
                            onChange={(e) => setRestrictedAreas(e.target.value)}
                            placeholder="Areas that are off-limits"
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-gray">Privacy Notes</Label>
                        <Textarea
                          value={privacyNotes}
                          onChange={(e) => setPrivacyNotes(e.target.value)}
                          placeholder="Special privacy considerations, patient confidentiality notes..."
                          className="bg-charcoal-black border-muted-gray/30 min-h-[80px]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Client Name</Label>
                          <Input
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            placeholder="Client/Company name"
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Client Phone</Label>
                          <Input
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            placeholder="(555) 123-4567"
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Facility Contact</Label>
                          <Input
                            value={facilityContact}
                            onChange={(e) => setFacilityContact(e.target.value)}
                            placeholder="On-site facility contact"
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Facility Phone</Label>
                          <Input
                            value={facilityPhone}
                            onChange={(e) => setFacilityPhone(e.target.value)}
                            placeholder="(555) 123-4567"
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* News/ENG Template Section */}
                {templateType === 'news_eng' && (
                  <AccordionItem value="news-eng" className="border border-muted-gray/30 rounded-lg px-4">
                    <AccordionTrigger className="text-bone-white hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-orange-400" />
                        Story & Deadline
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-muted-gray flex items-center gap-1">
                            <Clock className="w-4 h-4 text-red-400" />
                            Deadline Time
                          </Label>
                          <Input
                            type="time"
                            value={deadlineTime}
                            onChange={(e) => setDeadlineTime(e.target.value)}
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Reporter</Label>
                          <Input
                            value={reporterName}
                            onChange={(e) => setReporterName(e.target.value)}
                            placeholder="Reporter name"
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Reporter Phone</Label>
                          <Input
                            value={reporterPhone}
                            onChange={(e) => setReporterPhone(e.target.value)}
                            placeholder="(555) 123-4567"
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-gray">Story Angle</Label>
                        <Textarea
                          value={storyAngle}
                          onChange={(e) => setStoryAngle(e.target.value)}
                          placeholder="Story focus, key interview subjects, main points..."
                          className="bg-charcoal-black border-muted-gray/30 min-h-[80px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-gray">Subject Notes</Label>
                        <Textarea
                          value={subjectNotes}
                          onChange={(e) => setSubjectNotes(e.target.value)}
                          placeholder="Interview subjects, availability, contact info..."
                          className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                        />
                      </div>
                      <div className="border-t border-muted-gray/30 pt-4 mt-4">
                        <Label className="text-bone-white mb-3 block">Additional Locations</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Location 2 Name</Label>
                            <Input
                              value={location2Name}
                              onChange={(e) => setLocation2Name(e.target.value)}
                              placeholder="Second location"
                              className="bg-charcoal-black border-muted-gray/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Location 2 Address</Label>
                            <Input
                              value={location2Address}
                              onChange={(e) => setLocation2Address(e.target.value)}
                              placeholder="Address"
                              className="bg-charcoal-black border-muted-gray/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Location 3 Name</Label>
                            <Input
                              value={location3Name}
                              onChange={(e) => setLocation3Name(e.target.value)}
                              placeholder="Third location"
                              className="bg-charcoal-black border-muted-gray/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Location 3 Address</Label>
                            <Input
                              value={location3Address}
                              onChange={(e) => setLocation3Address(e.target.value)}
                              placeholder="Address"
                              className="bg-charcoal-black border-muted-gray/30"
                            />
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Live Event Template Section */}
                {templateType === 'live_event' && (
                  <AccordionItem value="live-event" className="border border-muted-gray/30 rounded-lg px-4">
                    <AccordionTrigger className="text-bone-white hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Tv className="w-4 h-4 text-purple-400" />
                        Show Timing & Technical
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Load In Time</Label>
                          <Input
                            type="time"
                            value={loadInTime}
                            onChange={(e) => setLoadInTime(e.target.value)}
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Rehearsal Time</Label>
                          <Input
                            type="time"
                            value={rehearsalTime}
                            onChange={(e) => setRehearsalTime(e.target.value)}
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Doors Time</Label>
                          <Input
                            type="time"
                            value={doorsTime}
                            onChange={(e) => setDoorsTime(e.target.value)}
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Intermission</Label>
                          <Input
                            type="time"
                            value={intermissionTime}
                            onChange={(e) => setIntermissionTime(e.target.value)}
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-gray">Strike Time</Label>
                          <Input
                            type="time"
                            value={strikeTime}
                            onChange={(e) => setStrikeTime(e.target.value)}
                            className="bg-charcoal-black border-muted-gray/30"
                          />
                        </div>
                      </div>

                      <div className="border-t border-muted-gray/30 pt-4 mt-4">
                        <Label className="text-bone-white mb-3 block">Venue & Technical</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Truck Location</Label>
                            <Input
                              value={truckLocation}
                              onChange={(e) => setTruckLocation(e.target.value)}
                              placeholder="Loading dock, lot, etc."
                              className="bg-charcoal-black border-muted-gray/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Video Village</Label>
                            <Input
                              value={videoVillage}
                              onChange={(e) => setVideoVillage(e.target.value)}
                              placeholder="Location of video village"
                              className="bg-charcoal-black border-muted-gray/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Comm Channel</Label>
                            <Input
                              value={commChannel}
                              onChange={(e) => setCommChannel(e.target.value)}
                              placeholder="Radio channel, freq"
                              className="bg-charcoal-black border-muted-gray/30"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-muted-gray/30 pt-4 mt-4">
                        <Label className="text-bone-white mb-3 block">Key Contacts</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Technical Director</Label>
                            <Input
                              value={tdName}
                              onChange={(e) => setTdName(e.target.value)}
                              placeholder="TD name"
                              className="bg-charcoal-black border-muted-gray/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-gray">TD Phone</Label>
                            <Input
                              value={tdPhone}
                              onChange={(e) => setTdPhone(e.target.value)}
                              placeholder="(555) 123-4567"
                              className="bg-charcoal-black border-muted-gray/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Stage Manager</Label>
                            <Input
                              value={stageManagerName}
                              onChange={(e) => setStageManagerName(e.target.value)}
                              placeholder="Stage Manager name"
                              className="bg-charcoal-black border-muted-gray/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Stage Manager Phone</Label>
                            <Input
                              value={stageManagerPhone}
                              onChange={(e) => setStageManagerPhone(e.target.value)}
                              placeholder="(555) 123-4567"
                              className="bg-charcoal-black border-muted-gray/30"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-muted-gray/30 pt-4 mt-4">
                        <Label className="text-bone-white mb-3 block">Show Documents</Label>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Camera Plot</Label>
                            <Textarea
                              value={cameraPlot}
                              onChange={(e) => setCameraPlot(e.target.value)}
                              placeholder="Camera positions, assignments, ISO feeds..."
                              className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Show Rundown</Label>
                            <Textarea
                              value={showRundown}
                              onChange={(e) => setShowRundown(e.target.value)}
                              placeholder="Run of show, segment order, cue list..."
                              className="bg-charcoal-black border-muted-gray/30 min-h-[80px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Rain Plan / Backup</Label>
                            <Textarea
                              value={rainPlan}
                              onChange={(e) => setRainPlan(e.target.value)}
                              placeholder="Contingency plans for weather or technical issues..."
                              className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-muted-gray/30 pt-4 mt-4">
                        <Label className="text-bone-white mb-3 block">Additional Notes</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Client Notes</Label>
                            <Textarea
                              value={clientNotes}
                              onChange={(e) => setClientNotes(e.target.value)}
                              placeholder="Client requirements, VIP info..."
                              className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-gray">Broadcast Notes</Label>
                            <Textarea
                              value={broadcastNotes}
                              onChange={(e) => setBroadcastNotes(e.target.value)}
                              placeholder="Streaming, broadcast requirements..."
                              className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                            />
                          </div>
                        </div>
                        <div className="space-y-2 mt-4">
                          <Label className="text-muted-gray">Playback Notes</Label>
                          <Textarea
                            value={playbackNotes}
                            onChange={(e) => setPlaybackNotes(e.target.value)}
                            placeholder="Video playback, graphics, teleprompter info..."
                            className="bg-charcoal-black border-muted-gray/30 min-h-[60px]"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

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

        <DialogFooter className="gap-2 items-center">
          {!canSubmit && !isPending && (
            <p className="text-xs text-red-400 mr-auto">
              Required: {[missingTitle && 'Title', missingDate && 'Date'].filter(Boolean).join(', ')}
            </p>
          )}
          {/* Save as Template button - only show when form has data */}
          {hasFormData() && (
            <Button
              variant="outline"
              onClick={() => {
                setTemplateName(title || '');
                setShowSaveTemplateDialog(true);
              }}
              disabled={isPending}
              className="border-muted-gray/30 mr-auto"
            >
              <BookmarkPlus className="w-4 h-4 mr-2" />
              Save as Template
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleCloseAttempt}
            disabled={isPending}
            className="border-muted-gray/30"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white disabled:opacity-50"
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

      {/* Save as Template Dialog */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent className="sm:max-w-md bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <BookmarkPlus className="w-5 h-5 text-amber-500" />
              Save as Template
            </DialogTitle>
            <DialogDescription>
              Save the current call sheet configuration as a reusable template.
              You can use this template to quickly create new call sheets.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-bone-white">Template Name *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Standard Feature Day"
                className="bg-charcoal-black border-muted-gray/30"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-bone-white">Description (optional)</Label>
              <Textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Brief description of what this template is for..."
                className="bg-charcoal-black border-muted-gray/30 resize-none"
                rows={3}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Template type: <span className="capitalize">{templateType.replace('_', ' ')}</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveTemplateDialog(false)}
              disabled={savingTemplate}
              className="border-muted-gray/30"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate || !templateName.trim()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {savingTemplate ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default CallSheetCreateEditModal;
