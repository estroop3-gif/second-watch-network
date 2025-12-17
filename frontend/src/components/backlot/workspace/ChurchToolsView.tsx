/**
 * ChurchToolsView - Embedded view for Church Production Tools within Backlot
 * Links to the full Church Tools suite
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  ExternalLink,
} from 'lucide-react';

interface ChurchToolsViewProps {
  projectId: string;
}

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
  }[];
}

const TOOL_SECTIONS: ToolSection[] = [
  {
    id: 'services',
    title: 'Service Planning',
    description: 'Plan services and assign positions',
    icon: Calendar,
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    tools: [
      { name: 'Service Run Sheet', path: '/church/services', icon: FileText },
      { name: 'Rehearsal Planner', path: '/church/rehearsals', icon: Calendar },
      { name: 'Tech Assignments', path: '/church/tech-positions', icon: Users },
    ],
  },
  {
    id: 'people',
    title: 'Volunteers & Training',
    description: 'Manage team and training',
    icon: Users,
    color: 'from-green-500/20 to-green-600/10 border-green-500/30',
    tools: [
      { name: 'Volunteer Scheduling', path: '/church/volunteers', icon: Users },
      { name: 'Training Tracker', path: '/church/training', icon: GraduationCap },
      { name: 'Skills Directory', path: '/church/skills', icon: BookOpen },
    ],
  },
  {
    id: 'content',
    title: 'Content & Requests',
    description: 'Clips, stories, and announcements',
    icon: Video,
    color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    tools: [
      { name: 'Clip Request Portal', path: '/church/clip-requests', icon: Scissors },
      { name: 'Story Lead Box', path: '/church/story-leads', icon: FileText },
      { name: 'Announcements', path: '/church/announcements', icon: Play },
    ],
  },
  {
    id: 'planning',
    title: 'Calendar & Briefs',
    description: 'Events, briefs, and licenses',
    icon: CalendarDays,
    color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    tools: [
      { name: 'Master Calendar', path: '/church/calendar', icon: CalendarDays },
      { name: 'Creative Briefs', path: '/church/briefs', icon: FileText },
      { name: 'License Library', path: '/church/licenses', icon: BookOpen },
    ],
  },
  {
    id: 'resources',
    title: 'Gear & Routing',
    description: 'Equipment and room management',
    icon: Wrench,
    color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    tools: [
      { name: 'Room Reservations', path: '/church/rooms', icon: CalendarDays },
      { name: 'Gear Inventory', path: '/church/gear', icon: HardDrive },
      { name: 'AV Patch Matrix', path: '/church/patch-matrix', icon: Radio },
    ],
  },
  {
    id: 'readiness',
    title: 'Sunday Readiness',
    description: 'Checklists and QC tools',
    icon: CheckSquare,
    color: 'from-rose-500/20 to-rose-600/10 border-rose-500/30',
    tools: [
      { name: 'Preflight Checklists', path: '/church/checklists', icon: ClipboardCheck },
      { name: 'Stream QC Log', path: '/church/stream-qc', icon: Play },
      { name: 'Macro Library', path: '/church/macros', icon: Zap },
    ],
  },
];

export default function ChurchToolsView({ projectId }: ChurchToolsViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Church className="w-6 h-6 text-accent-yellow" />
          <div>
            <h2 className="text-xl font-bold text-white">Church Production Tools</h2>
            <p className="text-sm text-muted-gray">
              Comprehensive tools for church media and production teams
            </p>
          </div>
        </div>
        <Link to="/church">
          <Button variant="outline" className="border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/10">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Full Suite
          </Button>
        </Link>
      </div>

      {/* Tool Sections Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TOOL_SECTIONS.map((section) => (
          <Card
            key={section.id}
            className={`bg-gradient-to-br ${section.color} border hover:border-accent-yellow/50 transition-colors`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-charcoal-black/50 rounded-lg">
                  <section.icon className="w-4 h-4 text-white" />
                </div>
                <CardTitle className="text-sm text-white">{section.title}</CardTitle>
              </div>
              <CardDescription className="text-muted-gray text-xs">
                {section.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {section.tools.map((tool) => (
                  <Link
                    key={tool.path}
                    to={tool.path}
                    className="flex items-center justify-between p-1.5 rounded-md bg-charcoal-black/30 hover:bg-charcoal-black/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <tool.icon className="w-3 h-3 text-muted-gray group-hover:text-white" />
                      <span className="text-xs text-white">{tool.name}</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-gray group-hover:text-accent-yellow" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Banner */}
      <Card className="bg-charcoal-black/30 border-muted-gray/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-yellow/10 rounded-lg">
              <Church className="w-5 h-5 text-accent-yellow" />
            </div>
            <div>
              <p className="text-sm text-white font-medium">Church Tools is separate from project context</p>
              <p className="text-xs text-muted-gray">
                These tools are organization-wide and not tied to this specific project
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-accent-yellow/50 text-accent-yellow">
            Beta
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
