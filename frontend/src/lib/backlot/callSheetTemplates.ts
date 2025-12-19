/**
 * Call Sheet Template Registry
 *
 * Defines template configurations for different production types:
 * - Feature/Episodic Narrative
 * - Documentary
 * - Music Video
 * - Commercial/Branded Content
 *
 * Each template specifies:
 * - Required and optional fields
 * - Section visibility and labels
 * - Default values
 * - Field display order
 */

import { BacklotCallSheetTemplate } from '@/types/backlot';

// ============================================================================
// TYPES
// ============================================================================

export interface CallSheetFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'time' | 'date' | 'textarea' | 'number' | 'select' | 'boolean';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[];
  helpText?: string;
  maxLength?: number;
}

export interface CallSheetSectionConfig {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  visible: boolean;
  defaultExpanded?: boolean;
  fields: CallSheetFieldConfig[];
}

export interface SceneBreakdownConfig {
  enabled: boolean;
  label: string; // "Scene Breakdown" vs "Segment List" vs "Shot List"
  columns: {
    key: string;
    label: string;
    visible: boolean;
    width?: string;
  }[];
}

export interface CallSheetTemplateDefinition {
  type: BacklotCallSheetTemplate;
  name: string;
  description: string;
  icon: string;

  // Core info section
  coreFields: CallSheetFieldConfig[];

  // Configurable sections
  sections: CallSheetSectionConfig[];

  // Scene/segment breakdown configuration
  sceneBreakdown: SceneBreakdownConfig;

  // Department sections with custom labels
  departmentNotes: {
    id: string;
    label: string;
    visible: boolean;
    placeholder?: string;
  }[];

  // Default schedule blocks for this template type
  defaultScheduleBlocks: {
    time: string;
    activity: string;
  }[];
}

// ============================================================================
// SHARED FIELD DEFINITIONS
// ============================================================================

const TIME_OF_DAY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
  { value: 'dawn', label: 'Dawn' },
  { value: 'dusk', label: 'Dusk' },
  { value: 'golden_hour', label: 'Golden Hour' },
  { value: 'magic_hour', label: 'Magic Hour' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

const INT_EXT_OPTIONS = [
  { value: 'INT', label: 'INT (Interior)' },
  { value: 'EXT', label: 'EXT (Exterior)' },
  { value: 'INT/EXT', label: 'INT/EXT' },
  { value: 'EXT/INT', label: 'EXT/INT' },
];

// ============================================================================
// TEMPLATE: FEATURE / EPISODIC NARRATIVE
// ============================================================================

const FEATURE_TEMPLATE: CallSheetTemplateDefinition = {
  type: 'feature',
  name: 'Feature / Episodic',
  description: 'Full production call sheet for narrative films, TV series, and scripted content',
  icon: 'Film',

  coreFields: [
    { key: 'title', label: 'Call Sheet Title', type: 'text', required: true, placeholder: 'e.g., Day 1 - Warehouse Scenes' },
    { key: 'production_title', label: 'Production Title', type: 'text', placeholder: 'e.g., The Great Adventure' },
    { key: 'production_company', label: 'Production Company', type: 'text', placeholder: 'e.g., Studio XYZ Productions' },
    { key: 'date', label: 'Shoot Date', type: 'date', required: true },
    { key: 'shoot_day_number', label: 'Shoot Day #', type: 'number', placeholder: '1' },
    { key: 'total_shoot_days', label: 'of Total Days', type: 'number', placeholder: '30' },
  ],

  sections: [
    {
      id: 'timing',
      title: 'Call Times & Wrap',
      icon: 'Clock',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'crew_call_time', label: 'Crew Call', type: 'time', required: true, defaultValue: '06:00' },
        { key: 'general_call_time', label: 'General Call', type: 'time', defaultValue: '06:00' },
        { key: 'first_shot_time', label: 'First Shot / Camera Ready', type: 'time', defaultValue: '07:00' },
        { key: 'breakfast_time', label: 'Breakfast', type: 'time', defaultValue: '06:00' },
        { key: 'lunch_time', label: 'Lunch', type: 'time', defaultValue: '12:00' },
        { key: 'dinner_time', label: 'Second Meal / Dinner', type: 'time', defaultValue: '18:00' },
        { key: 'estimated_wrap_time', label: 'Estimated Wrap', type: 'time', defaultValue: '19:00' },
      ],
    },
    {
      id: 'location',
      title: 'Location Information',
      icon: 'MapPin',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'location_name', label: 'Location Name', type: 'text', placeholder: 'e.g., Sunset Studios Stage 12' },
        { key: 'location_address', label: 'Full Address', type: 'text', placeholder: '123 Production Way, Los Angeles, CA 90028' },
        { key: 'parking_instructions', label: 'Parking Instructions', type: 'textarea', placeholder: 'Crew parking in Lot B. Enter via Gate 3.' },
        { key: 'basecamp_location', label: 'Basecamp / Holding', type: 'text', placeholder: 'North Lot near craft services' },
      ],
    },
    {
      id: 'production_contact',
      title: 'Production Contact',
      icon: 'Phone',
      visible: true,
      fields: [
        { key: 'production_office_phone', label: 'Production Office', type: 'text', placeholder: '(555) 123-4567' },
        { key: 'production_email', label: 'Production Email', type: 'text', placeholder: 'production@example.com' },
        { key: 'upm_name', label: 'UPM / Line Producer', type: 'text', placeholder: 'Name' },
        { key: 'upm_phone', label: 'UPM Phone', type: 'text', placeholder: '(555) 123-4567' },
        { key: 'first_ad_name', label: '1st AD', type: 'text', placeholder: 'Name' },
        { key: 'first_ad_phone', label: '1st AD Phone', type: 'text', placeholder: '(555) 123-4567' },
      ],
    },
    {
      id: 'weather',
      title: 'Weather & Environment',
      icon: 'Cloud',
      visible: true,
      fields: [
        { key: 'weather_forecast', label: 'Weather Forecast', type: 'textarea', placeholder: 'Partly cloudy, High 75°F / Low 58°F, 10% chance of rain' },
        { key: 'sunrise_time', label: 'Sunrise', type: 'time' },
        { key: 'sunset_time', label: 'Sunset', type: 'time' },
      ],
    },
    {
      id: 'safety',
      title: 'Safety & Medical',
      icon: 'Shield',
      visible: true,
      fields: [
        { key: 'nearest_hospital', label: 'Nearest Hospital', type: 'text', placeholder: 'Name and address' },
        { key: 'hospital_address', label: 'Hospital Address', type: 'text', placeholder: '456 Medical Center Dr' },
        { key: 'set_medic', label: 'Set Medic', type: 'text', placeholder: 'Name and contact' },
        { key: 'fire_safety_officer', label: 'Fire Safety Officer', type: 'text', placeholder: 'Name and contact' },
        { key: 'safety_notes', label: 'Safety Notes / Hazards', type: 'textarea', placeholder: 'Special safety considerations for today\'s shoot' },
      ],
    },
    {
      id: 'additional',
      title: 'Additional Notes',
      icon: 'FileText',
      visible: true,
      fields: [
        { key: 'general_notes', label: 'General Notes', type: 'textarea', placeholder: 'Any additional information for the crew...' },
        { key: 'advance_schedule', label: 'Advance Schedule / Tomorrow', type: 'textarea', placeholder: 'Brief preview of next day\'s work' },
      ],
    },
  ],

  sceneBreakdown: {
    enabled: true,
    label: 'Scene Breakdown',
    columns: [
      { key: 'scene_number', label: 'Scene #', visible: true, width: '80px' },
      { key: 'set_name', label: 'Set / Location', visible: true, width: '180px' },
      { key: 'int_ext', label: 'I/E', visible: true, width: '70px' },
      { key: 'time_of_day', label: 'D/N', visible: true, width: '80px' },
      { key: 'page_count', label: 'Pages', visible: true, width: '60px' },
      { key: 'description', label: 'Description', visible: true },
      { key: 'cast_names', label: 'Cast', visible: true, width: '150px' },
    ],
  },

  departmentNotes: [
    { id: 'camera_notes', label: 'Camera Department', visible: true, placeholder: 'Camera package, special equipment, etc.' },
    { id: 'sound_notes', label: 'Sound Department', visible: true, placeholder: 'Sound requirements, playback, etc.' },
    { id: 'grip_electric_notes', label: 'Grip & Electric', visible: true, placeholder: 'Lighting package, power requirements, etc.' },
    { id: 'art_notes', label: 'Art Department / Props', visible: true, placeholder: 'Set dressing, props needed, etc.' },
    { id: 'wardrobe_notes', label: 'Wardrobe', visible: true, placeholder: 'Costume notes, fittings, etc.' },
    { id: 'makeup_hair_notes', label: 'Makeup & Hair', visible: true, placeholder: 'Special makeup, hair requirements, etc.' },
    { id: 'stunts_notes', label: 'Stunts / SFX', visible: false, placeholder: 'Stunt coordination, special effects, etc.' },
    { id: 'vfx_notes', label: 'VFX / Post', visible: false, placeholder: 'Visual effects requirements, tracking markers, etc.' },
    { id: 'transport_notes', label: 'Transportation', visible: true, placeholder: 'Picture cars, shuttles, equipment moves, etc.' },
    { id: 'catering_notes', label: 'Craft Services / Catering', visible: true, placeholder: 'Meal times, dietary needs, etc.' },
  ],

  defaultScheduleBlocks: [
    { time: '06:00 AM', activity: 'Crew Call - Breakfast Available' },
    { time: '07:00 AM', activity: 'Blocking & Rehearsal' },
    { time: '08:00 AM', activity: 'First Shot' },
    { time: '12:30 PM', activity: 'Lunch (1 hour)' },
    { time: '01:30 PM', activity: 'Back to Work' },
    { time: '06:00 PM', activity: 'Estimated Wrap' },
  ],
};

// ============================================================================
// TEMPLATE: DOCUMENTARY
// ============================================================================

const DOCUMENTARY_TEMPLATE: CallSheetTemplateDefinition = {
  type: 'documentary',
  name: 'Documentary',
  description: 'Flexible call sheet for documentary, reality, and unscripted productions',
  icon: 'Video',

  coreFields: [
    { key: 'title', label: 'Call Sheet Title', type: 'text', required: true, placeholder: 'e.g., Interview Day - John Smith' },
    { key: 'production_title', label: 'Production Title', type: 'text', placeholder: 'e.g., The Untold Story' },
    { key: 'production_company', label: 'Production Company', type: 'text' },
    { key: 'date', label: 'Shoot Date', type: 'date', required: true },
    { key: 'shoot_day_number', label: 'Day #', type: 'number', placeholder: '1' },
    { key: 'total_shoot_days', label: 'of Total', type: 'number' },
  ],

  sections: [
    {
      id: 'timing',
      title: 'Call Times',
      icon: 'Clock',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'crew_call_time', label: 'Crew Call', type: 'time', required: true, defaultValue: '08:00' },
        { key: 'general_call_time', label: 'Talent / Subject Call', type: 'time', defaultValue: '09:00' },
        { key: 'first_shot_time', label: 'Start Time', type: 'time', defaultValue: '09:30' },
        { key: 'lunch_time', label: 'Lunch', type: 'time', defaultValue: '12:30' },
        { key: 'estimated_wrap_time', label: 'Estimated Wrap', type: 'time', defaultValue: '17:00' },
      ],
    },
    {
      id: 'location',
      title: 'Location',
      icon: 'MapPin',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'location_name', label: 'Location', type: 'text', placeholder: 'e.g., Subject\'s Home / Office Name' },
        { key: 'location_address', label: 'Address', type: 'text' },
        { key: 'parking_instructions', label: 'Parking / Access', type: 'textarea', placeholder: 'Street parking available. Ring bell at front door.' },
      ],
    },
    {
      id: 'production_contact',
      title: 'Key Contacts',
      icon: 'Phone',
      visible: true,
      fields: [
        { key: 'producer_name', label: 'Producer', type: 'text' },
        { key: 'producer_phone', label: 'Producer Phone', type: 'text' },
        { key: 'director_name', label: 'Director', type: 'text' },
        { key: 'director_phone', label: 'Director Phone', type: 'text' },
        { key: 'production_email', label: 'Production Email', type: 'text' },
      ],
    },
    {
      id: 'subjects',
      title: 'Interview Subjects / Talent',
      icon: 'Users',
      description: 'Add subjects via the People section below',
      visible: true,
      fields: [
        { key: 'subject_notes', label: 'Subject Notes', type: 'textarea', placeholder: 'Background info, talking points, sensitivities, etc.' },
      ],
    },
    {
      id: 'safety',
      title: 'Safety & Medical',
      icon: 'Shield',
      visible: true,
      fields: [
        { key: 'nearest_hospital', label: 'Nearest Hospital', type: 'text' },
        { key: 'safety_notes', label: 'Safety Notes', type: 'textarea' },
      ],
    },
    {
      id: 'additional',
      title: 'Additional Notes',
      icon: 'FileText',
      visible: true,
      fields: [
        { key: 'general_notes', label: 'General Notes', type: 'textarea', placeholder: 'Any additional information...' },
        { key: 'advance_schedule', label: 'Tomorrow / Upcoming', type: 'textarea' },
      ],
    },
  ],

  sceneBreakdown: {
    enabled: true,
    label: 'Segment List',
    columns: [
      { key: 'segment_label', label: 'Segment', visible: true, width: '100px' },
      { key: 'set_name', label: 'Location / Setup', visible: true, width: '180px' },
      { key: 'int_ext', label: 'I/E', visible: true, width: '70px' },
      { key: 'description', label: 'Description / Content', visible: true },
      { key: 'cast_names', label: 'Subjects', visible: true, width: '150px' },
    ],
  },

  departmentNotes: [
    { id: 'camera_notes', label: 'Camera', visible: true, placeholder: 'Camera package, lenses, special gear...' },
    { id: 'sound_notes', label: 'Sound', visible: true, placeholder: 'Lavs, boom, room tone requirements...' },
    { id: 'grip_electric_notes', label: 'Lighting', visible: true, placeholder: 'Lighting kit, power needs...' },
    { id: 'art_notes', label: 'Art / Set Dressing', visible: false },
    { id: 'transport_notes', label: 'Transportation', visible: false },
    { id: 'catering_notes', label: 'Craft Services', visible: true },
  ],

  defaultScheduleBlocks: [
    { time: '08:00 AM', activity: 'Crew Call - Load In' },
    { time: '09:00 AM', activity: 'Lighting & Sound Setup' },
    { time: '10:00 AM', activity: 'Subject Arrives - Mic & Brief' },
    { time: '10:30 AM', activity: 'Interview Begins' },
    { time: '12:30 PM', activity: 'Lunch Break' },
    { time: '01:30 PM', activity: 'B-Roll / Additional Coverage' },
    { time: '04:00 PM', activity: 'Wrap & Load Out' },
  ],
};

// ============================================================================
// TEMPLATE: MUSIC VIDEO
// ============================================================================

const MUSIC_VIDEO_TEMPLATE: CallSheetTemplateDefinition = {
  type: 'music_video',
  name: 'Music Video',
  description: 'Streamlined call sheet for music videos, performance shoots, and concert filming',
  icon: 'Music',

  coreFields: [
    { key: 'title', label: 'Call Sheet Title', type: 'text', required: true, placeholder: 'e.g., "Song Title" Music Video' },
    { key: 'production_title', label: 'Artist / Song', type: 'text', placeholder: 'e.g., Artist Name - "Song Title"' },
    { key: 'production_company', label: 'Production Company / Label', type: 'text' },
    { key: 'date', label: 'Shoot Date', type: 'date', required: true },
    { key: 'shoot_day_number', label: 'Day #', type: 'number', placeholder: '1' },
    { key: 'total_shoot_days', label: 'of Total', type: 'number' },
  ],

  sections: [
    {
      id: 'timing',
      title: 'Call Times',
      icon: 'Clock',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'crew_call_time', label: 'Crew Call', type: 'time', required: true, defaultValue: '10:00' },
        { key: 'general_call_time', label: 'Talent Call', type: 'time', defaultValue: '12:00' },
        { key: 'first_shot_time', label: 'Playback / First Shot', type: 'time', defaultValue: '13:00' },
        { key: 'lunch_time', label: 'Lunch', type: 'time', defaultValue: '14:00' },
        { key: 'estimated_wrap_time', label: 'Estimated Wrap', type: 'time', defaultValue: '22:00' },
      ],
    },
    {
      id: 'location',
      title: 'Location',
      icon: 'MapPin',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'location_name', label: 'Location', type: 'text', placeholder: 'e.g., Downtown Warehouse / Studio Name' },
        { key: 'location_address', label: 'Address', type: 'text' },
        { key: 'parking_instructions', label: 'Parking / Load In', type: 'textarea' },
        { key: 'basecamp_location', label: 'Green Room / Holding', type: 'text' },
      ],
    },
    {
      id: 'production_contact',
      title: 'Key Contacts',
      icon: 'Phone',
      visible: true,
      fields: [
        { key: 'director_name', label: 'Director', type: 'text' },
        { key: 'director_phone', label: 'Director Phone', type: 'text' },
        { key: 'producer_name', label: 'Producer', type: 'text' },
        { key: 'producer_phone', label: 'Producer Phone', type: 'text' },
        { key: 'label_contact', label: 'Label Rep', type: 'text' },
        { key: 'artist_manager', label: 'Artist Manager', type: 'text' },
      ],
    },
    {
      id: 'playback',
      title: 'Playback & Audio',
      icon: 'Volume2',
      visible: true,
      fields: [
        { key: 'playback_notes', label: 'Playback Setup', type: 'textarea', placeholder: 'PA system, playback source, BPM, sync requirements...' },
      ],
    },
    {
      id: 'safety',
      title: 'Safety',
      icon: 'Shield',
      visible: true,
      fields: [
        { key: 'nearest_hospital', label: 'Nearest Hospital', type: 'text' },
        { key: 'safety_notes', label: 'Safety Notes', type: 'textarea', placeholder: 'Pyro, stunts, crowd safety, etc.' },
      ],
    },
    {
      id: 'additional',
      title: 'Additional Notes',
      icon: 'FileText',
      visible: true,
      fields: [
        { key: 'general_notes', label: 'General Notes', type: 'textarea' },
        { key: 'wardrobe_looks', label: 'Wardrobe Looks', type: 'textarea', placeholder: 'List of looks/outfits for the day' },
      ],
    },
  ],

  sceneBreakdown: {
    enabled: true,
    label: 'Shot List',
    columns: [
      { key: 'segment_label', label: 'Setup', visible: true, width: '80px' },
      { key: 'set_name', label: 'Set / Location', visible: true, width: '150px' },
      { key: 'description', label: 'Description / Look', visible: true },
      { key: 'cast_names', label: 'Talent', visible: true, width: '120px' },
    ],
  },

  departmentNotes: [
    { id: 'camera_notes', label: 'Camera', visible: true, placeholder: 'Camera package, specialty gear, drones...' },
    { id: 'grip_electric_notes', label: 'Lighting / Grip', visible: true, placeholder: 'Lighting design, rigging, effects...' },
    { id: 'art_notes', label: 'Art / Props', visible: true, placeholder: 'Set design, props, set pieces...' },
    { id: 'wardrobe_notes', label: 'Wardrobe / Styling', visible: true, placeholder: 'Looks, changes, stylist notes...' },
    { id: 'makeup_hair_notes', label: 'Makeup & Hair', visible: true, placeholder: 'Glam, special makeup, hair changes...' },
    { id: 'choreography_notes', label: 'Choreography', visible: true, placeholder: 'Dance rehearsal, blocking, extras coordination...' },
    { id: 'catering_notes', label: 'Craft Services', visible: true },
  ],

  defaultScheduleBlocks: [
    { time: '07:00 AM', activity: 'Crew Call - Load In' },
    { time: '09:00 AM', activity: 'Talent Arrives - Glam Begins' },
    { time: '11:00 AM', activity: 'Blocking & Rehearsal' },
    { time: '12:00 PM', activity: 'First Shot - Performance Setup' },
    { time: '01:30 PM', activity: 'Lunch' },
    { time: '02:30 PM', activity: 'Setup 2 - Narrative / B-Roll' },
    { time: '05:00 PM', activity: 'Setup 3 - Final Looks' },
    { time: '08:00 PM', activity: 'Estimated Wrap' },
  ],
};

// ============================================================================
// TEMPLATE: COMMERCIAL / BRANDED CONTENT
// ============================================================================

const COMMERCIAL_TEMPLATE: CallSheetTemplateDefinition = {
  type: 'commercial',
  name: 'Commercial / Branded',
  description: 'Professional call sheet for commercials, branded content, and advertising productions',
  icon: 'Megaphone',

  coreFields: [
    { key: 'title', label: 'Call Sheet Title', type: 'text', required: true, placeholder: 'e.g., Brand X - Hero Spot Day 1' },
    { key: 'production_title', label: 'Project / Campaign', type: 'text', placeholder: 'e.g., Brand X Summer Campaign' },
    { key: 'production_company', label: 'Production Company', type: 'text' },
    { key: 'date', label: 'Shoot Date', type: 'date', required: true },
    { key: 'shoot_day_number', label: 'Day #', type: 'number', placeholder: '1' },
    { key: 'total_shoot_days', label: 'of Total', type: 'number' },
  ],

  sections: [
    {
      id: 'timing',
      title: 'Call Times',
      icon: 'Clock',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'crew_call_time', label: 'Crew Call', type: 'time', required: true, defaultValue: '06:00' },
        { key: 'general_call_time', label: 'Talent Call', type: 'time', defaultValue: '07:00' },
        { key: 'client_call_time', label: 'Client / Agency Call', type: 'time', helpText: 'Time for client/agency arrivals', defaultValue: '09:00' },
        { key: 'first_shot_time', label: 'First Shot', type: 'time', defaultValue: '08:00' },
        { key: 'breakfast_time', label: 'Breakfast', type: 'time', defaultValue: '06:00' },
        { key: 'lunch_time', label: 'Lunch', type: 'time', defaultValue: '12:00' },
        { key: 'estimated_wrap_time', label: 'Estimated Wrap', type: 'time', defaultValue: '18:00' },
      ],
    },
    {
      id: 'location',
      title: 'Location',
      icon: 'MapPin',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'location_name', label: 'Location', type: 'text' },
        { key: 'location_address', label: 'Address', type: 'text' },
        { key: 'parking_instructions', label: 'Parking / Client Parking', type: 'textarea' },
        { key: 'basecamp_location', label: 'Video Village / Client Area', type: 'text' },
      ],
    },
    {
      id: 'production_contact',
      title: 'Key Contacts',
      icon: 'Phone',
      visible: true,
      fields: [
        { key: 'director_name', label: 'Director', type: 'text' },
        { key: 'director_phone', label: 'Director Phone', type: 'text' },
        { key: 'ep_name', label: 'Executive Producer', type: 'text' },
        { key: 'ep_phone', label: 'EP Phone', type: 'text' },
        { key: 'producer_name', label: 'Line Producer', type: 'text' },
        { key: 'producer_phone', label: 'Producer Phone', type: 'text' },
        { key: 'first_ad_name', label: '1st AD', type: 'text' },
        { key: 'first_ad_phone', label: '1st AD Phone', type: 'text' },
      ],
    },
    {
      id: 'client_agency',
      title: 'Client & Agency',
      icon: 'Building',
      visible: true,
      fields: [
        { key: 'client_name', label: 'Client / Brand', type: 'text', placeholder: 'Brand name' },
        { key: 'client_contact', label: 'Client Contact', type: 'text' },
        { key: 'agency_name', label: 'Agency', type: 'text' },
        { key: 'agency_contact', label: 'Agency Contact', type: 'text' },
        { key: 'agency_producer', label: 'Agency Producer', type: 'text' },
        { key: 'creative_director', label: 'Creative Director', type: 'text' },
      ],
    },
    {
      id: 'weather',
      title: 'Weather',
      icon: 'Cloud',
      visible: true,
      fields: [
        { key: 'weather_forecast', label: 'Weather Forecast', type: 'textarea' },
        { key: 'sunrise_time', label: 'Sunrise', type: 'time' },
        { key: 'sunset_time', label: 'Sunset', type: 'time' },
      ],
    },
    {
      id: 'safety',
      title: 'Safety & Medical',
      icon: 'Shield',
      visible: true,
      fields: [
        { key: 'nearest_hospital', label: 'Nearest Hospital', type: 'text' },
        { key: 'hospital_address', label: 'Hospital Address', type: 'text' },
        { key: 'set_medic', label: 'Set Medic', type: 'text' },
        { key: 'safety_notes', label: 'Safety Notes', type: 'textarea' },
      ],
    },
    {
      id: 'additional',
      title: 'Additional Notes',
      icon: 'FileText',
      visible: true,
      fields: [
        { key: 'general_notes', label: 'General Notes', type: 'textarea' },
        { key: 'brand_guidelines', label: 'Brand Guidelines / Restrictions', type: 'textarea', placeholder: 'Brand do\'s and don\'ts, product handling, etc.' },
        { key: 'advance_schedule', label: 'Tomorrow / Day 2', type: 'textarea' },
      ],
    },
  ],

  sceneBreakdown: {
    enabled: true,
    label: 'Shot List / Deliverables',
    columns: [
      { key: 'segment_label', label: 'Spot / Asset', visible: true, width: '100px' },
      { key: 'set_name', label: 'Set / Setup', visible: true, width: '150px' },
      { key: 'description', label: 'Description', visible: true },
      { key: 'cast_names', label: 'Talent', visible: true, width: '120px' },
    ],
  },

  departmentNotes: [
    { id: 'camera_notes', label: 'Camera', visible: true, placeholder: 'Camera package, format, frame rates...' },
    { id: 'sound_notes', label: 'Sound', visible: true },
    { id: 'grip_electric_notes', label: 'Lighting / Grip', visible: true },
    { id: 'art_notes', label: 'Art / Props', visible: true, placeholder: 'Product, hero shots, set design...' },
    { id: 'wardrobe_notes', label: 'Wardrobe / Styling', visible: true },
    { id: 'makeup_hair_notes', label: 'Makeup & Hair', visible: true },
    { id: 'food_styling_notes', label: 'Food Styling', visible: false, placeholder: 'If applicable - hero food, prep, etc.' },
    { id: 'vfx_notes', label: 'VFX / Post', visible: true, placeholder: 'Plates, tracking, post requirements...' },
    { id: 'transport_notes', label: 'Transportation', visible: true },
    { id: 'catering_notes', label: 'Craft / Catering', visible: true, placeholder: 'Include client meals if applicable' },
  ],

  defaultScheduleBlocks: [
    { time: '06:00 AM', activity: 'Crew Call - Breakfast Available' },
    { time: '07:00 AM', activity: 'Lighting & Set Prep' },
    { time: '08:00 AM', activity: 'Client / Agency Arrives' },
    { time: '09:00 AM', activity: 'Talent in Glam' },
    { time: '10:00 AM', activity: 'Blocking & First Shot' },
    { time: '12:30 PM', activity: 'Lunch (1 hour)' },
    { time: '01:30 PM', activity: 'Afternoon Setups' },
    { time: '05:00 PM', activity: 'Final Reviews with Client' },
    { time: '06:00 PM', activity: 'Estimated Wrap' },
  ],
};

// ============================================================================
// TEMPLATE: MEDICAL / CORPORATE VIDEO
// ============================================================================

const MEDICAL_CORPORATE_TEMPLATE: CallSheetTemplateDefinition = {
  type: 'medical_corporate',
  name: 'Medical / Corporate',
  description: 'Streamlined call sheet for dental videos, medical procedures, corporate training, and professional content',
  icon: 'Briefcase',

  coreFields: [
    { key: 'title', label: 'Call Sheet Title', type: 'text', required: true, placeholder: 'e.g., Dental Procedure - Dr. Smith' },
    { key: 'production_title', label: 'Video Title', type: 'text', placeholder: 'e.g., Root Canal Procedure Guide' },
    { key: 'production_company', label: 'Client / Organization', type: 'text', placeholder: 'e.g., Smith Dental Associates' },
    { key: 'date', label: 'Shoot Date', type: 'date', required: true },
    { key: 'shoot_day_number', label: 'Day #', type: 'number', placeholder: '1' },
    { key: 'total_shoot_days', label: 'of Total', type: 'number' },
  ],

  sections: [
    {
      id: 'timing',
      title: 'Schedule',
      icon: 'Clock',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'crew_call_time', label: 'Crew Call', type: 'time', required: true, defaultValue: '07:30' },
        { key: 'general_call_time', label: 'Client / Talent Call', type: 'time', defaultValue: '08:30' },
        { key: 'first_shot_time', label: 'Start Recording', type: 'time', defaultValue: '09:00' },
        { key: 'lunch_time', label: 'Lunch', type: 'time', defaultValue: '12:00' },
        { key: 'estimated_wrap_time', label: 'Estimated Wrap', type: 'time', defaultValue: '17:00' },
      ],
    },
    {
      id: 'location',
      title: 'Location',
      icon: 'MapPin',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'location_name', label: 'Facility Name', type: 'text', placeholder: 'e.g., Main Street Medical Center' },
        { key: 'location_address', label: 'Address', type: 'text' },
        { key: 'parking_instructions', label: 'Parking / Check-in', type: 'textarea', placeholder: 'Parking location, badge pickup, check-in procedures...' },
      ],
    },
    {
      id: 'production_contact',
      title: 'Key Contacts',
      icon: 'Phone',
      visible: true,
      fields: [
        { key: 'producer_name', label: 'Producer', type: 'text' },
        { key: 'producer_phone', label: 'Producer Phone', type: 'text' },
        { key: 'director_name', label: 'Director / DP', type: 'text' },
        { key: 'director_phone', label: 'Director Phone', type: 'text' },
        { key: 'production_email', label: 'Production Email', type: 'text' },
      ],
    },
    {
      id: 'privacy_compliance',
      title: 'Privacy & Compliance',
      icon: 'Shield',
      description: 'HIPAA and privacy considerations',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'hipaa_officer', label: 'HIPAA / Compliance Officer', type: 'text', placeholder: 'Name and contact' },
        { key: 'privacy_notes', label: 'Privacy Requirements', type: 'textarea', placeholder: 'No patient faces visible, blur monitors, PHI precautions...' },
        { key: 'release_status', label: 'Release Status', type: 'textarea', placeholder: 'Talent releases, patient consent forms, facility agreements...' },
        { key: 'restricted_areas', label: 'Restricted Areas', type: 'textarea', placeholder: 'Areas off-limits to crew, patient areas, etc.' },
      ],
    },
    {
      id: 'client_contact',
      title: 'Client / Facility Contact',
      icon: 'Building',
      visible: true,
      fields: [
        { key: 'client_name', label: 'Client Contact', type: 'text', placeholder: 'Primary client contact name' },
        { key: 'client_phone', label: 'Client Phone', type: 'text' },
        { key: 'facility_contact', label: 'Facility Contact', type: 'text', placeholder: 'On-site facility liaison' },
        { key: 'facility_phone', label: 'Facility Phone', type: 'text' },
      ],
    },
    {
      id: 'safety',
      title: 'Safety',
      icon: 'Heart',
      visible: true,
      fields: [
        { key: 'nearest_hospital', label: 'Nearest ER', type: 'text' },
        { key: 'safety_notes', label: 'Safety Notes', type: 'textarea', placeholder: 'PPE requirements, sterile areas, equipment restrictions...' },
      ],
    },
    {
      id: 'additional',
      title: 'Notes',
      icon: 'FileText',
      visible: true,
      fields: [
        { key: 'general_notes', label: 'General Notes', type: 'textarea' },
        { key: 'dress_code', label: 'Dress Code', type: 'textarea', placeholder: 'Scrubs provided, no logos, closed-toe shoes, etc.' },
      ],
    },
  ],

  sceneBreakdown: {
    enabled: true,
    label: 'Shot List',
    columns: [
      { key: 'segment_label', label: 'Shot', visible: true, width: '80px' },
      { key: 'set_name', label: 'Setup / Location', visible: true, width: '180px' },
      { key: 'description', label: 'Description', visible: true },
      { key: 'cast_names', label: 'Talent', visible: true, width: '120px' },
    ],
  },

  departmentNotes: [
    { id: 'camera_notes', label: 'Camera', visible: true, placeholder: 'Single camera setup, lens choice, stabilization...' },
    { id: 'sound_notes', label: 'Audio', visible: true, placeholder: 'Lav mics, room tone, ambient noise considerations...' },
    { id: 'grip_electric_notes', label: 'Lighting', visible: true, placeholder: 'Minimal lighting, natural light supplementation...' },
    { id: 'art_notes', label: 'Set / Props', visible: false },
    { id: 'wardrobe_notes', label: 'Wardrobe', visible: false },
    { id: 'makeup_hair_notes', label: 'Makeup', visible: false },
    { id: 'transport_notes', label: 'Transportation', visible: false },
    { id: 'catering_notes', label: 'Craft Services', visible: true, placeholder: 'Client providing meals, crew lunch, dietary needs...' },
  ],

  defaultScheduleBlocks: [
    { time: '08:00 AM', activity: 'Crew Call - Load In' },
    { time: '08:30 AM', activity: 'Equipment Setup' },
    { time: '09:00 AM', activity: 'Lighting & Sound Check' },
    { time: '09:30 AM', activity: 'Talent / Subject Arrives' },
    { time: '10:00 AM', activity: 'Begin Recording' },
    { time: '12:00 PM', activity: 'Lunch Break' },
    { time: '01:00 PM', activity: 'Afternoon Session' },
    { time: '04:00 PM', activity: 'Wrap & Load Out' },
  ],
};

// ============================================================================
// TEMPLATE: NEWS / ENG (Electronic News Gathering)
// ============================================================================

const NEWS_ENG_TEMPLATE: CallSheetTemplateDefinition = {
  type: 'news_eng',
  name: 'News / ENG',
  description: 'Fast-turnaround call sheet for news packages, ENG crews, and rapid-deployment shoots',
  icon: 'Radio',

  coreFields: [
    { key: 'title', label: 'Assignment', type: 'text', required: true, placeholder: 'e.g., City Council Meeting Coverage' },
    { key: 'production_title', label: 'Story / Package', type: 'text', placeholder: 'e.g., Budget Vote Package' },
    { key: 'production_company', label: 'Outlet / Client', type: 'text' },
    { key: 'date', label: 'Date', type: 'date', required: true },
  ],

  sections: [
    {
      id: 'timing',
      title: 'Times',
      icon: 'Clock',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'crew_call_time', label: 'Meet Time', type: 'time', required: true, defaultValue: '08:00' },
        { key: 'first_shot_time', label: 'Event Start', type: 'time', defaultValue: '09:00' },
        { key: 'estimated_wrap_time', label: 'Expected Finish', type: 'time', defaultValue: '17:00' },
        { key: 'deadline_time', label: 'Deadline', type: 'time', helpText: 'File/feed deadline', defaultValue: '18:00' },
      ],
    },
    {
      id: 'location',
      title: 'Primary Location',
      icon: 'MapPin',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'location_name', label: 'Location', type: 'text', placeholder: 'e.g., City Hall' },
        { key: 'location_address', label: 'Address', type: 'text' },
        { key: 'parking_instructions', label: 'Parking / Access', type: 'textarea', placeholder: 'Media parking, credentials, entry point...' },
      ],
    },
    {
      id: 'additional_locations',
      title: 'Additional Stops',
      icon: 'Navigation',
      visible: true,
      fields: [
        { key: 'location_2_name', label: 'Location 2', type: 'text' },
        { key: 'location_2_address', label: 'Address', type: 'text' },
        { key: 'location_3_name', label: 'Location 3', type: 'text' },
        { key: 'location_3_address', label: 'Address', type: 'text' },
      ],
    },
    {
      id: 'production_contact',
      title: 'Contacts',
      icon: 'Phone',
      visible: true,
      fields: [
        { key: 'producer_name', label: 'Assignment Editor / Producer', type: 'text' },
        { key: 'producer_phone', label: 'Desk Phone', type: 'text' },
        { key: 'reporter_name', label: 'Reporter', type: 'text' },
        { key: 'reporter_phone', label: 'Reporter Cell', type: 'text' },
      ],
    },
    {
      id: 'subjects',
      title: 'Interview Subjects',
      icon: 'Users',
      visible: true,
      fields: [
        { key: 'subject_notes', label: 'Scheduled Interviews', type: 'textarea', placeholder: 'Name, title, time, topic...' },
      ],
    },
    {
      id: 'additional',
      title: 'Notes',
      icon: 'FileText',
      visible: true,
      fields: [
        { key: 'story_angle', label: 'Story Angle / Focus', type: 'textarea', placeholder: 'Key points, story focus, must-get shots...' },
        { key: 'general_notes', label: 'Additional Notes', type: 'textarea' },
      ],
    },
  ],

  sceneBreakdown: {
    enabled: true,
    label: 'Segments',
    columns: [
      { key: 'segment_label', label: 'Segment', visible: true, width: '100px' },
      { key: 'set_name', label: 'Location', visible: true, width: '150px' },
      { key: 'description', label: 'Content / SOT', visible: true },
      { key: 'cast_names', label: 'Subject', visible: true, width: '120px' },
    ],
  },

  departmentNotes: [
    { id: 'camera_notes', label: 'Camera / Gear', visible: true, placeholder: 'ENG camera, tripod, extra batteries, media...' },
    { id: 'sound_notes', label: 'Audio', visible: true, placeholder: 'Wireless mics, stick mic, IFB...' },
    { id: 'grip_electric_notes', label: 'Lighting', visible: false },
    { id: 'art_notes', label: 'Art', visible: false },
    { id: 'wardrobe_notes', label: 'Wardrobe', visible: false },
    { id: 'makeup_hair_notes', label: 'Makeup', visible: false },
    { id: 'transport_notes', label: 'Vehicle', visible: true, placeholder: 'News van, live truck, vehicle assignment...' },
    { id: 'catering_notes', label: 'Meals', visible: false },
  ],

  defaultScheduleBlocks: [
    { time: '10:00 AM', activity: 'Meet at Location 1' },
    { time: '10:30 AM', activity: 'Setup & Interviews' },
    { time: '12:00 PM', activity: 'Move to Location 2' },
    { time: '12:30 PM', activity: 'B-Roll & Standup' },
    { time: '02:00 PM', activity: 'Travel Back / File' },
    { time: '04:00 PM', activity: 'Deadline' },
  ],
};

// ============================================================================
// TEMPLATE: LIVE EVENT / MULTI-CAM
// ============================================================================

const LIVE_EVENT_TEMPLATE: CallSheetTemplateDefinition = {
  type: 'live_event',
  name: 'Live Event / Multi-Cam',
  description: 'Multi-camera call sheet for concerts, conferences, sports, and live productions',
  icon: 'Tv',

  coreFields: [
    { key: 'title', label: 'Show / Event', type: 'text', required: true, placeholder: 'e.g., Annual Conference Day 1' },
    { key: 'production_title', label: 'Event Name', type: 'text', placeholder: 'e.g., TechCon 2024' },
    { key: 'production_company', label: 'Production Company / Client', type: 'text' },
    { key: 'date', label: 'Event Date', type: 'date', required: true },
    { key: 'shoot_day_number', label: 'Day #', type: 'number', placeholder: '1' },
    { key: 'total_shoot_days', label: 'of Total', type: 'number' },
  ],

  sections: [
    {
      id: 'timing',
      title: 'Key Times',
      icon: 'Clock',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'crew_call_time', label: 'Crew Call', type: 'time', required: true, defaultValue: '12:00' },
        { key: 'load_in_time', label: 'Load In', type: 'time', defaultValue: '08:00' },
        { key: 'rehearsal_time', label: 'Rehearsal / Sound Check', type: 'time', defaultValue: '16:00' },
        { key: 'doors_time', label: 'Doors Open', type: 'time', defaultValue: '18:00' },
        { key: 'first_shot_time', label: 'Show Start / Downbeat', type: 'time', defaultValue: '19:00' },
        { key: 'intermission_time', label: 'Intermission', type: 'time', defaultValue: '20:00' },
        { key: 'estimated_wrap_time', label: 'Show End', type: 'time', defaultValue: '22:00' },
        { key: 'strike_time', label: 'Strike Complete', type: 'time', defaultValue: '00:00' },
      ],
    },
    {
      id: 'location',
      title: 'Venue',
      icon: 'Building',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'location_name', label: 'Venue Name', type: 'text', placeholder: 'e.g., Convention Center Hall A' },
        { key: 'location_address', label: 'Address', type: 'text' },
        { key: 'parking_instructions', label: 'Crew Parking / Load In', type: 'textarea', placeholder: 'Loading dock, truck parking, crew entrance...' },
        { key: 'basecamp_location', label: 'Production Office / Green Room', type: 'text' },
      ],
    },
    {
      id: 'truck_info',
      title: 'Truck / Control Room',
      icon: 'Monitor',
      visible: true,
      fields: [
        { key: 'truck_location', label: 'Truck Location', type: 'text', placeholder: 'Location of production truck' },
        { key: 'video_village', label: 'Video Village / Client Monitor', type: 'text' },
        { key: 'comm_channel', label: 'Comm Channels', type: 'textarea', placeholder: 'PL channels, IFB frequencies, radio channels...' },
      ],
    },
    {
      id: 'production_contact',
      title: 'Key Personnel',
      icon: 'Phone',
      visible: true,
      fields: [
        { key: 'director_name', label: 'Director', type: 'text' },
        { key: 'director_phone', label: 'Director Phone', type: 'text' },
        { key: 'producer_name', label: 'Producer', type: 'text' },
        { key: 'producer_phone', label: 'Producer Phone', type: 'text' },
        { key: 'td_name', label: 'Technical Director', type: 'text' },
        { key: 'td_phone', label: 'TD Phone', type: 'text' },
        { key: 'stage_manager_name', label: 'Stage Manager', type: 'text' },
        { key: 'stage_manager_phone', label: 'SM Phone', type: 'text' },
      ],
    },
    {
      id: 'camera_positions',
      title: 'Camera Positions',
      icon: 'Camera',
      description: 'Camera assignments by position',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'camera_plot', label: 'Camera Plot / Assignments', type: 'textarea', placeholder: 'CAM 1: Wide Stage Left - [Operator]\nCAM 2: Tight Center - [Operator]\nCAM 3: Handheld - [Operator]...' },
      ],
    },
    {
      id: 'run_of_show',
      title: 'Run of Show',
      icon: 'List',
      description: 'Cue sheet / show rundown',
      visible: true,
      defaultExpanded: true,
      fields: [
        { key: 'show_rundown', label: 'Show Rundown', type: 'textarea', placeholder: 'Detailed show rundown with cues and timing...' },
      ],
    },
    {
      id: 'weather',
      title: 'Weather (Outdoor)',
      icon: 'Cloud',
      visible: false,
      fields: [
        { key: 'weather_forecast', label: 'Forecast', type: 'textarea' },
        { key: 'rain_plan', label: 'Rain Plan / Weather Hold', type: 'textarea' },
      ],
    },
    {
      id: 'safety',
      title: 'Safety & Medical',
      icon: 'Shield',
      visible: true,
      fields: [
        { key: 'nearest_hospital', label: 'Nearest Hospital', type: 'text' },
        { key: 'set_medic', label: 'On-Site Medic', type: 'text' },
        { key: 'safety_notes', label: 'Safety Notes', type: 'textarea', placeholder: 'Pyro cues, rigging, crowd control, cable runs...' },
      ],
    },
    {
      id: 'additional',
      title: 'Additional Notes',
      icon: 'FileText',
      visible: true,
      fields: [
        { key: 'general_notes', label: 'Production Notes', type: 'textarea' },
        { key: 'client_notes', label: 'Client Requirements', type: 'textarea', placeholder: 'Deliverables, branding requirements, special requests...' },
      ],
    },
  ],

  sceneBreakdown: {
    enabled: true,
    label: 'Show Cues / Segments',
    columns: [
      { key: 'segment_label', label: 'Cue #', visible: true, width: '80px' },
      { key: 'set_name', label: 'Time', visible: true, width: '80px' },
      { key: 'description', label: 'Segment / Cue', visible: true },
      { key: 'cast_names', label: 'Talent / Act', visible: true, width: '150px' },
    ],
  },

  departmentNotes: [
    { id: 'camera_notes', label: 'Camera', visible: true, placeholder: 'Camera package, ISO records, special gear...' },
    { id: 'sound_notes', label: 'Audio', visible: true, placeholder: 'Audio console, RF coordination, IEMs, broadcast mix...' },
    { id: 'grip_electric_notes', label: 'Lighting / Video', visible: true, placeholder: 'Lighting design, video walls, graphics...' },
    { id: 'broadcast_notes', label: 'Broadcast / Stream', visible: true, placeholder: 'Transmission path, streaming platform, backup...' },
    { id: 'playback_notes', label: 'Playback / Graphics', visible: true, placeholder: 'Playback sources, graphics package, lower thirds...' },
    { id: 'art_notes', label: 'Staging', visible: false },
    { id: 'transport_notes', label: 'Transportation', visible: true, placeholder: 'Truck call, equipment moves, strike plan...' },
    { id: 'catering_notes', label: 'Craft Services', visible: true, placeholder: 'Crew meals, green room catering...' },
  ],

  defaultScheduleBlocks: [
    { time: '06:00 AM', activity: 'Truck Call - Load In Begins' },
    { time: '08:00 AM', activity: 'Camera Setup & Cable' },
    { time: '10:00 AM', activity: 'Tech Check - All Cameras' },
    { time: '12:00 PM', activity: 'Lunch' },
    { time: '01:00 PM', activity: 'Rehearsal / Sound Check' },
    { time: '04:00 PM', activity: 'Final Checks' },
    { time: '05:00 PM', activity: 'Doors Open' },
    { time: '06:00 PM', activity: 'Show Start' },
    { time: '09:00 PM', activity: 'Show End' },
    { time: '11:00 PM', activity: 'Strike Complete' },
  ],
};

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

export const CALL_SHEET_TEMPLATES: Record<BacklotCallSheetTemplate, CallSheetTemplateDefinition> = {
  feature: FEATURE_TEMPLATE,
  documentary: DOCUMENTARY_TEMPLATE,
  music_video: MUSIC_VIDEO_TEMPLATE,
  commercial: COMMERCIAL_TEMPLATE,
  medical_corporate: MEDICAL_CORPORATE_TEMPLATE,
  news_eng: NEWS_ENG_TEMPLATE,
  live_event: LIVE_EVENT_TEMPLATE,
};

/**
 * Get template definition by type
 */
export function getTemplateDefinition(type: BacklotCallSheetTemplate): CallSheetTemplateDefinition {
  return CALL_SHEET_TEMPLATES[type] || CALL_SHEET_TEMPLATES.feature;
}

/**
 * Get all available template types
 */
export function getAvailableTemplates(): { type: BacklotCallSheetTemplate; name: string; description: string; icon: string }[] {
  return Object.values(CALL_SHEET_TEMPLATES).map(t => ({
    type: t.type,
    name: t.name,
    description: t.description,
    icon: t.icon,
  }));
}

/**
 * Get visible department notes for a template
 */
export function getVisibleDepartmentNotes(type: BacklotCallSheetTemplate) {
  const template = getTemplateDefinition(type);
  return template.departmentNotes.filter(d => d.visible);
}

/**
 * Get visible sections for a template
 */
export function getVisibleSections(type: BacklotCallSheetTemplate) {
  const template = getTemplateDefinition(type);
  return template.sections.filter(s => s.visible);
}

/**
 * Get scene breakdown columns for a template
 */
export function getSceneBreakdownColumns(type: BacklotCallSheetTemplate) {
  const template = getTemplateDefinition(type);
  return template.sceneBreakdown.columns.filter(c => c.visible);
}

/**
 * Check if scene breakdown is enabled for a template
 */
export function isSceneBreakdownEnabled(type: BacklotCallSheetTemplate): boolean {
  const template = getTemplateDefinition(type);
  return template.sceneBreakdown.enabled;
}

/**
 * Get default schedule blocks for a template
 */
export function getDefaultScheduleBlocks(type: BacklotCallSheetTemplate) {
  const template = getTemplateDefinition(type);
  return template.defaultScheduleBlocks;
}

export default CALL_SHEET_TEMPLATES;
