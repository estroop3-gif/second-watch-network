/**
 * ChurchToolPage - Generic placeholder page for Church Production Tools
 * Provides list/detail views with empty states for all tool types
 *
 * TODO: Implement full functionality for each tool
 * - Wire up data fetching with hooks
 * - Add create/edit modals
 * - Implement detail views
 * - Add filtering and search
 */
import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Calendar,
  Users,
  Video,
  CalendarDays,
  Wrench,
  CheckSquare,
  Church,
  GraduationCap,
  Scissors,
  FileText,
  BookOpen,
  HardDrive,
  Radio,
  ClipboardCheck,
  Play,
  Zap,
  Construction,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ToolConfig {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  viewProfile: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  createButtonLabel: string;
}

const TOOL_CONFIGS: Record<string, ToolConfig> = {
  // Section A: Service Planning
  'services': {
    title: 'Service Run Sheet',
    description: 'Plan and organize service elements, cues, and timing',
    icon: FileText,
    color: 'blue',
    viewProfile: 'service_run_sheet',
    emptyStateTitle: 'No Service Plans Yet',
    emptyStateDescription: 'Create your first service plan to get started with run sheets',
    createButtonLabel: 'New Service Plan',
  },
  'rehearsals': {
    title: 'Rehearsal Planner',
    description: 'Schedule and manage rehearsals for upcoming services',
    icon: Calendar,
    color: 'blue',
    viewProfile: 'rehearsal_planner',
    emptyStateTitle: 'No Rehearsals Scheduled',
    emptyStateDescription: 'Schedule rehearsals for your service plans',
    createButtonLabel: 'Schedule Rehearsal',
  },
  'tech-positions': {
    title: 'Tech Position Roster',
    description: 'Assign volunteers to technical positions for services',
    icon: Users,
    color: 'blue',
    viewProfile: 'tech_position_roster',
    emptyStateTitle: 'No Positions Assigned',
    emptyStateDescription: 'Assign volunteers to tech positions for upcoming services',
    createButtonLabel: 'Assign Position',
  },

  // Section B: Volunteers & Training
  'volunteers': {
    title: 'Volunteer Scheduling',
    description: 'Schedule and manage volunteer shifts',
    icon: Users,
    color: 'green',
    viewProfile: 'volunteer_scheduling',
    emptyStateTitle: 'No Volunteer Shifts',
    emptyStateDescription: 'Create volunteer shifts to start scheduling your team',
    createButtonLabel: 'Create Shift',
  },
  'training': {
    title: 'Training Tracker',
    description: 'Track volunteer training progress and certifications',
    icon: GraduationCap,
    color: 'green',
    viewProfile: 'training_tracker',
    emptyStateTitle: 'No Training Modules',
    emptyStateDescription: 'Add training modules for your volunteers',
    createButtonLabel: 'Add Module',
  },
  'skills': {
    title: 'Skills Directory',
    description: 'Browse and search volunteer skills and expertise',
    icon: BookOpen,
    color: 'green',
    viewProfile: 'skills_directory',
    emptyStateTitle: 'No Skills Registered',
    emptyStateDescription: 'Volunteers can add their skills to be discovered',
    createButtonLabel: 'Add Skill',
  },
  'position-cards': {
    title: 'Position Quick Cards',
    description: 'Quick reference cards for each volunteer position',
    icon: FileText,
    color: 'green',
    viewProfile: 'position_quick_cards',
    emptyStateTitle: 'No Position Cards',
    emptyStateDescription: 'Create quick reference cards for volunteer positions',
    createButtonLabel: 'Create Card',
  },

  // Section C: Content & Requests
  'clip-requests': {
    title: 'Clip Request Portal',
    description: 'Request video clips from services and events',
    icon: Scissors,
    color: 'purple',
    viewProfile: 'clip_request_portal',
    emptyStateTitle: 'No Clip Requests',
    emptyStateDescription: 'Submit requests for video clips from services',
    createButtonLabel: 'Request Clip',
  },
  'story-leads': {
    title: 'Story Lead Box',
    description: 'Submit and track story ideas for video content',
    icon: FileText,
    color: 'purple',
    viewProfile: 'story_lead_box',
    emptyStateTitle: 'No Story Leads',
    emptyStateDescription: 'Submit story ideas for the content team',
    createButtonLabel: 'Submit Story',
  },
  'content-shoots': {
    title: 'Content Shoot Planner',
    description: 'Plan and coordinate content production shoots',
    icon: Video,
    color: 'purple',
    viewProfile: 'content_shoot_planner',
    emptyStateTitle: 'No Shoots Planned',
    emptyStateDescription: 'Plan your next content production shoot',
    createButtonLabel: 'Plan Shoot',
  },
  'announcements': {
    title: 'Announcement Slide Manager',
    description: 'Manage announcement slides for services',
    icon: Play,
    color: 'purple',
    viewProfile: 'announcement_slide_manager',
    emptyStateTitle: 'No Announcements',
    emptyStateDescription: 'Create announcements for upcoming services',
    createButtonLabel: 'Create Announcement',
  },

  // Section D: Calendar & Briefs
  'calendar': {
    title: 'Master Calendar',
    description: 'View and manage all church events and services',
    icon: CalendarDays,
    color: 'amber',
    viewProfile: 'master_calendar',
    emptyStateTitle: 'No Events',
    emptyStateDescription: 'Add events to your master calendar',
    createButtonLabel: 'Add Event',
  },
  'briefs': {
    title: 'Creative Brief Builder',
    description: 'Create and manage creative briefs for projects',
    icon: FileText,
    color: 'amber',
    viewProfile: 'creative_brief_builder',
    emptyStateTitle: 'No Creative Briefs',
    emptyStateDescription: 'Create a creative brief for your next project',
    createButtonLabel: 'Create Brief',
  },
  'licenses': {
    title: 'License Library',
    description: 'Track licenses, subscriptions, and renewals',
    icon: BookOpen,
    color: 'amber',
    viewProfile: 'license_library',
    emptyStateTitle: 'No Licenses Tracked',
    emptyStateDescription: 'Add licenses and subscriptions to track',
    createButtonLabel: 'Add License',
  },

  // Section E: Gear & Routing
  'rooms': {
    title: 'Room Reservation Board',
    description: 'Reserve rooms and spaces for events',
    icon: CalendarDays,
    color: 'cyan',
    viewProfile: 'room_reservation_board',
    emptyStateTitle: 'No Rooms Configured',
    emptyStateDescription: 'Add rooms to enable reservations',
    createButtonLabel: 'Add Room',
  },
  'gear': {
    title: 'Gear Inventory',
    description: 'Manage production equipment and assets',
    icon: HardDrive,
    color: 'cyan',
    viewProfile: 'gear_inventory',
    emptyStateTitle: 'No Gear Items',
    emptyStateDescription: 'Add equipment to your inventory',
    createButtonLabel: 'Add Gear',
  },
  'patch-matrix': {
    title: 'AV Patch Matrix',
    description: 'Document audio/video signal routing',
    icon: Radio,
    color: 'cyan',
    viewProfile: 'av_patch_matrix',
    emptyStateTitle: 'No Patch Matrices',
    emptyStateDescription: 'Create a patch matrix for your venue',
    createButtonLabel: 'Create Matrix',
  },
  'camera-plots': {
    title: 'Camera Plot Maker',
    description: 'Plan camera positions for events',
    icon: Video,
    color: 'cyan',
    viewProfile: 'camera_plot_maker',
    emptyStateTitle: 'No Camera Plots',
    emptyStateDescription: 'Create camera position plots for your venue',
    createButtonLabel: 'Create Plot',
  },

  // Section F: Sunday Readiness
  'checklists': {
    title: 'Preflight Checklists',
    description: 'Pre-service checklists for all departments',
    icon: ClipboardCheck,
    color: 'rose',
    viewProfile: 'preflight_checklists',
    emptyStateTitle: 'No Checklists',
    emptyStateDescription: 'Create preflight checklists for your team',
    createButtonLabel: 'Create Checklist',
  },
  'stream-qc': {
    title: 'Stream QC Log',
    description: 'Track stream quality and issues',
    icon: Play,
    color: 'rose',
    viewProfile: 'stream_qc_log',
    emptyStateTitle: 'No QC Sessions',
    emptyStateDescription: 'Start a QC session to log stream quality',
    createButtonLabel: 'Start QC Session',
  },
  'macros': {
    title: 'Macro Library',
    description: 'Store and share automation macros',
    icon: Zap,
    color: 'rose',
    viewProfile: 'macro_library',
    emptyStateTitle: 'No Macros',
    emptyStateDescription: 'Add macros for quick automation tasks',
    createButtonLabel: 'Add Macro',
  },
};

const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

export default function ChurchToolPage() {
  const { tool } = useParams<{ tool: string }>();
  const navigate = useNavigate();
  const config = tool ? TOOL_CONFIGS[tool] : null;

  if (!config) {
    return (
      <div className="min-h-screen bg-charcoal-black text-white p-6 flex items-center justify-center">
        <Card className="bg-charcoal-black/50 border-muted-gray/20 max-w-md">
          <CardContent className="p-6 text-center">
            <Construction className="w-12 h-12 text-muted-gray mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Tool Not Found</h2>
            <p className="text-muted-gray mb-4">
              The requested tool could not be found.
            </p>
            <Button onClick={() => navigate('/church')}>
              Back to Church Tools
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const IconComponent = config.icon;
  const colorClass = COLOR_CLASSES[config.color] || COLOR_CLASSES.blue;

  return (
    <div className="min-h-screen bg-charcoal-black text-white">
      {/* Header */}
      <div className="border-b border-muted-gray/20 bg-charcoal-black/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/church')}
                className="text-muted-gray hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg border ${colorClass}`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">{config.title}</h1>
                  <p className="text-sm text-muted-gray">{config.description}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-muted-gray/50 text-muted-gray">
                {config.viewProfile}
              </Badge>
              <Button className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
                <Plus className="w-4 h-4 mr-2" />
                {config.createButtonLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-muted-gray/20">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                placeholder="Search..."
                className="pl-10 bg-charcoal-black/50 border-muted-gray/30"
              />
            </div>
            <Button variant="outline" size="sm" className="border-muted-gray/30">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Content - Empty State */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <Card className="bg-charcoal-black/30 border-muted-gray/20 border-dashed">
          <CardContent className="p-12 text-center">
            <div className={`w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center ${colorClass}`}>
              <IconComponent className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{config.emptyStateTitle}</h2>
            <p className="text-muted-gray mb-6 max-w-md mx-auto">
              {config.emptyStateDescription}
            </p>
            <Button className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
              <Plus className="w-4 h-4 mr-2" />
              {config.createButtonLabel}
            </Button>

            {/* Under Construction Notice */}
            <div className="mt-8 pt-8 border-t border-muted-gray/20">
              <div className="flex items-center justify-center gap-2 text-muted-gray">
                <Construction className="w-5 h-5" />
                <span className="text-sm">
                  This tool is under construction. Full functionality coming soon.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
