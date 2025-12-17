/**
 * ChurchToolsHome - Main landing page for Church Production Tools
 * Provides navigation to all 6 tool sections
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Users,
  Video,
  CalendarDays,
  Wrench,
  CheckSquare,
  ChevronRight,
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
} from 'lucide-react';

interface ToolSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  tools: {
    name: string;
    path: string;
    icon: React.ElementType;
    viewProfile: string;
  }[];
}

const TOOL_SECTIONS: ToolSection[] = [
  {
    id: 'services',
    title: 'A. Service Planning & Positions',
    description: 'Plan services, manage rehearsals, and assign tech positions',
    icon: Calendar,
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    tools: [
      { name: 'Service Run Sheet', path: '/church/services', icon: FileText, viewProfile: 'service_run_sheet' },
      { name: 'Rehearsal Planner', path: '/church/rehearsals', icon: Calendar, viewProfile: 'rehearsal_planner' },
      { name: 'Tech Assignments', path: '/church/tech-positions', icon: Users, viewProfile: 'tech_position_roster' },
    ],
  },
  {
    id: 'people',
    title: 'B. Volunteers & Training',
    description: 'Schedule volunteers, track training, and manage skills',
    icon: Users,
    color: 'from-green-500/20 to-green-600/10 border-green-500/30',
    tools: [
      { name: 'Volunteer Scheduling', path: '/church/volunteers', icon: Users, viewProfile: 'volunteer_scheduling' },
      { name: 'Training Tracker', path: '/church/training', icon: GraduationCap, viewProfile: 'training_tracker' },
      { name: 'Skills Directory', path: '/church/skills', icon: BookOpen, viewProfile: 'skills_directory' },
      { name: 'Position Quick Cards', path: '/church/position-cards', icon: FileText, viewProfile: 'position_quick_cards' },
    ],
  },
  {
    id: 'content',
    title: 'C. Content & Requests',
    description: 'Request clips, submit story ideas, plan shoots, manage announcements',
    icon: Video,
    color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    tools: [
      { name: 'Clip Request Portal', path: '/church/clip-requests', icon: Scissors, viewProfile: 'clip_request_portal' },
      { name: 'Story Lead Box', path: '/church/story-leads', icon: FileText, viewProfile: 'story_lead_box' },
      { name: 'Content Shoot Planner', path: '/church/content-shoots', icon: Video, viewProfile: 'content_shoot_planner' },
      { name: 'Announcement Slides', path: '/church/announcements', icon: Play, viewProfile: 'announcement_slide_manager' },
    ],
  },
  {
    id: 'planning',
    title: 'D. Calendar & Briefs',
    description: 'Master calendar, creative briefs, and license management',
    icon: CalendarDays,
    color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    tools: [
      { name: 'Master Calendar', path: '/church/calendar', icon: CalendarDays, viewProfile: 'master_calendar' },
      { name: 'Creative Brief Builder', path: '/church/briefs', icon: FileText, viewProfile: 'creative_brief_builder' },
      { name: 'License Library', path: '/church/licenses', icon: BookOpen, viewProfile: 'license_library' },
    ],
  },
  {
    id: 'resources',
    title: 'E. Gear & Routing',
    description: 'Inventory, reservations, patch matrices, and camera plots',
    icon: Wrench,
    color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    tools: [
      { name: 'Room Reservations', path: '/church/rooms', icon: CalendarDays, viewProfile: 'room_reservation_board' },
      { name: 'Gear Inventory', path: '/church/gear', icon: HardDrive, viewProfile: 'gear_inventory' },
      { name: 'AV Patch Matrix', path: '/church/patch-matrix', icon: Radio, viewProfile: 'av_patch_matrix' },
      { name: 'Camera Plot Maker', path: '/church/camera-plots', icon: Video, viewProfile: 'camera_plot_maker' },
    ],
  },
  {
    id: 'readiness',
    title: 'F. Sunday Readiness',
    description: 'Preflight checklists, stream QC, and macro library',
    icon: CheckSquare,
    color: 'from-rose-500/20 to-rose-600/10 border-rose-500/30',
    tools: [
      { name: 'Preflight Checklists', path: '/church/checklists', icon: ClipboardCheck, viewProfile: 'preflight_checklists' },
      { name: 'Stream QC Log', path: '/church/stream-qc', icon: Play, viewProfile: 'stream_qc_log' },
      { name: 'Macro Library', path: '/church/macros', icon: Zap, viewProfile: 'macro_library' },
    ],
  },
];

export default function ChurchToolsHome() {
  return (
    <div className="min-h-screen bg-charcoal-black text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Church className="w-8 h-8 text-accent-yellow" />
          <h1 className="text-3xl font-bold">Church Production Tools</h1>
        </div>
        <p className="text-muted-gray">
          Comprehensive tools for church media and production teams
        </p>
      </div>

      {/* Tool Sections Grid */}
      <div className="max-w-7xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {TOOL_SECTIONS.map((section) => (
          <Card
            key={section.id}
            className={`bg-gradient-to-br ${section.color} border hover:border-accent-yellow/50 transition-colors`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-charcoal-black/50 rounded-lg">
                  <section.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg text-white">{section.title}</CardTitle>
                  <CardDescription className="text-muted-gray text-sm">
                    {section.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {section.tools.map((tool) => (
                  <Link
                    key={tool.path}
                    to={tool.path}
                    className="flex items-center justify-between p-2 rounded-lg bg-charcoal-black/30 hover:bg-charcoal-black/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <tool.icon className="w-4 h-4 text-muted-gray group-hover:text-white" />
                      <span className="text-sm text-white">{tool.name}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-gray group-hover:text-accent-yellow" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats (placeholder for future) */}
      <div className="max-w-7xl mx-auto mt-8">
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-white mb-1">Getting Started</h3>
                <p className="text-sm text-muted-gray">
                  Select a tool above to begin. Each tool supports view profiles for role-based access.
                </p>
              </div>
              <Badge variant="outline" className="border-accent-yellow/50 text-accent-yellow">
                Beta
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
