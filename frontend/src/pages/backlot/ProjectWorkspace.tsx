/**
 * ProjectWorkspace - Main workspace for a Backlot project
 * Contains sidebar navigation and content area for different views
 * Uses lazy loading for view components to improve initial page load performance
 */
import React, { useState, Suspense, lazy, startTransition } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { VoiceProvider } from '@/context/VoiceContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  LayoutDashboard,
  Calendar,
  FileText,
  CheckSquare,
  MapPin,
  Package,
  Megaphone,
  Users,
  Award,
  Settings,
  Lock,
  Eye,
  Globe,
  Menu,
  X,
  Sparkles,
  DollarSign,
  CalendarDays,
  Receipt,
  Clapperboard,
  UserPlus,
  FileCheck,
  Camera,
  Target,
  Film,
  BarChart3,
  Radio,
} from 'lucide-react';
import { useProject, useProjectPermission, useViewConfig, useCanViewAsRole, useCanApprove, BACKLOT_ROLES, useTodayShootDay } from '@/hooks/backlot';
import { BacklotWorkspaceView, BacklotVisibility, BacklotProjectStatus } from '@/types/backlot';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Lazy loading fallback component
const ViewSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-48 bg-muted-gray/20" />
    <Skeleton className="h-4 w-64 bg-muted-gray/10" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48 bg-muted-gray/20" />
      ))}
    </div>
  </div>
);

// Eagerly loaded components (needed immediately or for modals)
import ProjectOverview from '@/components/backlot/workspace/ProjectOverview';
import AICopilotPanel from '@/components/backlot/workspace/AICopilotPanel';
import SceneDetailModal from '@/components/backlot/workspace/SceneDetailModal';
import ScriptImportModal from '@/components/backlot/workspace/ScriptImportModal';
import TaskDetailDrawer from '@/components/backlot/workspace/TaskDetailDrawer';
import TaskListShareModal from '@/components/backlot/workspace/TaskListShareModal';

// Lazy loaded view components - only loaded when the tab is accessed
const ScheduleView = lazy(() => import('@/components/backlot/workspace/ScheduleView'));
const CallSheetsView = lazy(() => import('@/components/backlot/workspace/CallSheetsView'));
const TasksView = lazy(() => import('@/components/backlot/workspace/TasksView'));
const LocationsView = lazy(() => import('@/components/backlot/workspace/LocationsView'));
const GearView = lazy(() => import('@/components/backlot/workspace/GearView'));
const BudgetView = lazy(() => import('@/components/backlot/workspace/BudgetView'));
const DailyBudgetView = lazy(() => import('@/components/backlot/workspace/DailyBudgetView'));
const ExpensesView = lazy(() => import('@/components/backlot/workspace/ExpensesView'));
const ClearancesView = lazy(() => import('@/components/backlot/workspace/ClearancesView'));
const UpdatesView = lazy(() => import('@/components/backlot/workspace/UpdatesView'));
const ContactsView = lazy(() => import('@/components/backlot/workspace/ContactsView'));
const ProjectSettings = lazy(() => import('@/components/backlot/workspace/ProjectSettings'));
const CreditsView = lazy(() => import('@/components/backlot/workspace/CreditsView'));
const ScriptView = lazy(() => import('@/components/backlot/workspace/ScriptView'));
const ShotListsView = lazy(() => import('@/components/backlot/workspace/ShotListsView'));
const ShotListDetailView = lazy(() => import('@/components/backlot/workspace/ShotListDetailView'));
const CoverageView = lazy(() => import('@/components/backlot/workspace/CoverageView'));
const AssetsView = lazy(() => import('@/components/backlot/workspace/AssetsView'));
const AnalyticsView = lazy(() => import('@/components/backlot/workspace/AnalyticsView'));
const TaskListDetailView = lazy(() => import('@/components/backlot/workspace/TaskListDetailView'));
const DailiesView = lazy(() => import('@/components/backlot/workspace/DailiesView'));
const RolesManagementView = lazy(() => import('@/components/backlot/workspace/RolesManagementView'));
const ScenesView = lazy(() => import('@/components/backlot/workspace/ScenesView'));
const SceneDetailView = lazy(() => import('@/components/backlot/workspace/SceneDetailView'));
const DaysView = lazy(() => import('@/components/backlot/workspace/DaysView'));
const DayDetailView = lazy(() => import('@/components/backlot/workspace/DayDetailView'));
const PeopleView = lazy(() => import('@/components/backlot/workspace/PeopleView'));
const PersonDetailView = lazy(() => import('@/components/backlot/workspace/PersonDetailView'));
const TimecardsView = lazy(() => import('@/components/backlot/workspace/TimecardsView'));
const TeamAccessView = lazy(() => import('@/components/backlot/workspace/TeamAccessView'));
const CameraLogView = lazy(() => import('@/components/backlot/workspace/CameraLogView'));
const CheckInView = lazy(() => import('@/components/backlot/workspace/CheckInView'));
const MySpacePanel = lazy(() => import('@/components/backlot/workspace/MySpacePanel'));
const ChurchToolsView = lazy(() => import('@/components/backlot/workspace/ChurchToolsView'));
const HotSetView = lazy(() => import('@/components/backlot/workspace/HotSetView'));
const InvoicesView = lazy(() => import('@/components/backlot/workspace/InvoicesView'));
const ComsView = lazy(() => import('@/components/backlot/workspace/ComsView'));
const ApprovalsView = lazy(() => import('@/components/backlot/workspace/ApprovalsView'));
const BudgetComparisonView = lazy(() => import('@/components/backlot/workspace/BudgetComparisonView'));

// Lazy loaded named exports (need wrapper)
const CastingCrewTab = lazy(() =>
  import('@/components/backlot/workspace/CastingCrewTab').then(m => ({ default: m.CastingCrewTab }))
);
const ReviewsView = lazy(() =>
  import('@/components/backlot/review').then(m => ({ default: m.ReviewsView }))
);
const ReviewDetailView = lazy(() =>
  import('@/components/backlot/review').then(m => ({ default: m.ReviewDetailView }))
);

import { SceneListItem, DayListItem, PersonListItem } from '@/hooks/backlot';
import { SquarePlay, Video, UserCog, Timer, Layers, CalendarCheck, Shield, Aperture, QrCode, Star, Church, ClipboardList, Flame, ClipboardCheck, Scale } from 'lucide-react';

const STATUS_LABELS: Record<BacklotProjectStatus, string> = {
  pre_production: 'Pre-Production',
  production: 'Production',
  post_production: 'Post-Production',
  completed: 'Completed',
  on_hold: 'On Hold',
  archived: 'Archived',
};

const STATUS_COLORS: Record<BacklotProjectStatus, string> = {
  pre_production: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  production: 'bg-green-500/20 text-green-400 border-green-500/30',
  post_production: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30',
  on_hold: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  archived: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
};

const VisibilityIcon: React.FC<{ visibility: BacklotVisibility }> = ({ visibility }) => {
  switch (visibility) {
    case 'private':
      return <Lock className="w-3 h-3" />;
    case 'unlisted':
      return <Eye className="w-3 h-3" />;
    case 'public':
      return <Globe className="w-3 h-3" />;
  }
};

interface NavItem {
  id: BacklotWorkspaceView;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Organized navigation by workflow category
const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Story & Script',
    items: [
      { id: 'script', label: 'Script', icon: Clapperboard },
      { id: 'scenes', label: 'Scenes', icon: Layers },
      { id: 'shot-lists', label: 'Shot Lists', icon: Camera },
      { id: 'coverage', label: 'Coverage', icon: Target },
    ],
  },
  {
    title: 'Planning & Scheduling',
    items: [
      { id: 'schedule', label: 'Schedule', icon: Calendar },
      { id: 'days', label: 'Shoot Days', icon: CalendarCheck },
      { id: 'call-sheets', label: 'Call Sheets', icon: FileText },
      { id: 'casting', label: 'Casting & Crew', icon: UserPlus },
      { id: 'people', label: 'Team', icon: Users },
      { id: 'locations', label: 'Locations', icon: MapPin },
      { id: 'gear', label: 'Gear', icon: Package },
    ],
  },
  {
    title: 'On Set & Dailies',
    items: [
      { id: 'hot-set', label: 'Production Day', icon: Flame },
      { id: 'camera', label: 'Camera', icon: Aperture },
      // { id: 'scripty', label: 'Scripty', icon: ClipboardList },  // Hidden for now
      { id: 'dailies', label: 'Dailies', icon: Video },
      { id: 'checkin', label: 'Check-In', icon: QrCode },
    ],
  },
  {
    title: 'Post & Review',
    items: [
      { id: 'review', label: 'Review', icon: SquarePlay },
      { id: 'assets', label: 'Assets', icon: Film },
    ],
  },
  {
    title: 'Budget & Finance',
    items: [
      { id: 'approvals', label: 'Approvals', icon: ClipboardCheck },
      { id: 'budget', label: 'Budget', icon: DollarSign },
      { id: 'daily-budget', label: 'Daily Budget', icon: CalendarDays },
      { id: 'timecards', label: 'Timecards', icon: Timer },
      { id: 'expenses', label: 'Expenses', icon: Receipt },
      { id: 'invoices', label: 'Invoices', icon: FileText },
      { id: 'budget-comparison', label: 'Comparison', icon: Scale, adminOnly: true },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
    ],
  },
  {
    title: 'Tasks & Collaboration',
    items: [
      { id: 'tasks', label: 'Tasks', icon: CheckSquare },
      { id: 'coms', label: 'Coms', icon: Radio },
      { id: 'updates', label: 'Updates', icon: Megaphone },
      { id: 'contacts', label: 'Contacts', icon: Users },
    ],
  },
  {
    title: 'Legal & Credits',
    items: [
      { id: 'clearances', label: 'Clearances', icon: FileCheck },
      { id: 'credits', label: 'Credits', icon: Award },
    ],
  },
  {
    title: 'Personal',
    items: [
      { id: 'my-space', label: 'My Space', icon: Star },
    ],
  },
  {
    title: 'Church Tools',
    items: [
      { id: 'church-tools', label: 'Church Tools', icon: Church },
    ],
  },
  {
    title: 'Project',
    items: [
      { id: 'access', label: 'Team & Access', icon: Shield, adminOnly: true },
      { id: 'roles', label: 'Team Roles', icon: UserCog, adminOnly: true },
      { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
    ],
  },
];

// Flatten for filtering (maintain backward compatibility)
const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(section => section.items);

const ProjectWorkspace: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<BacklotWorkspaceView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [showScriptImportModal, setShowScriptImportModal] = useState(false);
  const [selectedShotListId, setSelectedShotListId] = useState<string | null>(null);
  const [selectedTaskListId, setSelectedTaskListId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTaskShareModal, setShowTaskShareModal] = useState(false);
  const [selectedReviewAssetId, setSelectedReviewAssetId] = useState<string | null>(null);
  const [viewAsRole, setViewAsRole] = useState<string | null>(null);
  // New view states for scenes, days, people
  const [selectedSceneForView, setSelectedSceneForView] = useState<SceneListItem | null>(null);
  const [selectedDayForView, setSelectedDayForView] = useState<DayListItem | null>(null);
  const [selectedPersonForView, setSelectedPersonForView] = useState<PersonListItem | null>(null);

  const { data: project, isLoading: projectLoading } = useProject(projectId || null);
  const { data: permission, isLoading: permissionLoading } = useProjectPermission(projectId || null);
  const { data: viewConfig, isLoading: viewConfigLoading } = useViewConfig(projectId || null, viewAsRole);
  const { data: canViewAsRole } = useCanViewAsRole(projectId || null);
  const { todayDay, hasShootToday } = useTodayShootDay(projectId || null);
  const { canViewApprovalsDashboard } = useCanApprove(projectId || null);

  const isLoading = projectLoading || permissionLoading || viewConfigLoading;

  // Get tabs visibility from view config
  const tabsVisibility = viewConfig?.tabs || viewConfig?.config?.tabs || {};

  // Check if a tab is visible based on view config
  // Supports both boolean (legacy) and {view, edit} object formats
  const isTabVisible = (tabId: string): boolean => {
    // Admin always sees everything
    if (permission?.isAdmin) return true;
    // If no view config yet, show all
    if (!viewConfig) return true;
    // Check the tabs visibility map
    const tabValue = tabsVisibility[tabId];
    if (tabValue === undefined) return true;
    // Handle both boolean and object formats
    if (typeof tabValue === 'boolean') return tabValue;
    if (typeof tabValue === 'object' && tabValue !== null) {
      return tabValue.view !== false;
    }
    return tabValue !== false;
  };

  // Check if a tab is editable based on view config
  const isTabEditable = (tabId: string): boolean => {
    // Admin always has edit
    if (permission?.isAdmin) return true;
    // If no view config yet, use permission
    if (!viewConfig) return permission?.canEdit || false;
    // Check the tabs visibility map
    const tabValue = tabsVisibility[tabId];
    if (tabValue === undefined) return permission?.canEdit || false;
    // Handle both boolean and object formats
    if (typeof tabValue === 'boolean') return permission?.canEdit || false;
    if (typeof tabValue === 'object' && tabValue !== null) {
      return tabValue.edit === true;
    }
    return permission?.canEdit || false;
  };

  // Filter nav items based on both permissions and view config
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !permission?.isAdmin) return false;
    // Approvals tab only visible to users who can approve
    if (item.id === 'approvals' && !canViewApprovalsDashboard) return false;
    return isTabVisible(item.id);
  });

  const handleNavClick = (view: BacklotWorkspaceView) => {
    // Use startTransition to avoid "suspended while responding to synchronous input" error
    // when lazy-loaded components are being loaded
    startTransition(() => {
      setActiveView(view);
    });
    setSidebarOpen(false);
  };

  const handleGoToToday = () => {
    if (todayDay) {
      // Navigate to days view and select today's day
      startTransition(() => {
        setActiveView('days');
        // Convert production day to DayListItem format for the detail view
        setSelectedDayForView({
          id: todayDay.id,
          day_number: todayDay.day_number,
          date: todayDay.date,
          title: todayDay.title || null,
          is_completed: todayDay.is_completed,
          general_call_time: todayDay.general_call_time || null,
          location_name: todayDay.location_name || null,
          has_call_sheet: false, // Will be refreshed when view loads
          dailies_count: 0,
          task_count: 0,
          crew_count: 0,
        });
      });
    } else {
      // No shoot today, just go to days view
      startTransition(() => {
        setActiveView('days');
      });
    }
    setSidebarOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-6 w-96 mb-8" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-96" />
            <Skeleton className="h-96 col-span-3" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-heading text-bone-white mb-4">Project Not Found</h2>
          <p className="text-muted-gray mb-6">
            This project doesn't exist or you don't have access to it.
          </p>
          <Link to="/backlot">
            <Button className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
              Back to Backlot
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!permission?.canView) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 text-muted-gray mx-auto mb-4" />
          <h2 className="text-2xl font-heading text-bone-white mb-4">Access Denied</h2>
          <p className="text-muted-gray mb-6">You don't have permission to view this project.</p>
          <Link to="/backlot">
            <Button className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
              Back to Backlot
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <VoiceProvider projectId={project.id}>
    <div className="min-h-screen bg-charcoal-black">
      {/* Header - fixed below the main AppHeader (top-20 = 5rem = 80px) */}
      <header className="fixed top-20 left-0 right-0 z-40 h-14 bg-charcoal-black border-b border-muted-gray/20">
        <div className="container mx-auto px-4 h-full flex items-center gap-4">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>

          {/* Back Button */}
          <Link to="/backlot" className="text-muted-gray hover:text-bone-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>

          {/* Project Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-bone-white truncate">{project.title}</h1>
              <Badge
                variant="outline"
                className={`hidden sm:flex text-xs shrink-0 ${STATUS_COLORS[project.status]}`}
              >
                {STATUS_LABELS[project.status]}
              </Badge>
              <Badge
                variant="outline"
                className="hidden sm:flex text-xs shrink-0 border-muted-gray/30 items-center gap-1"
              >
                <VisibilityIcon visibility={project.visibility} />
                {project.visibility}
              </Badge>
            </div>
            {project.logline && (
              <p className="text-sm text-muted-gray truncate hidden md:block">{project.logline}</p>
            )}
          </div>

          {/* Go to Today Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoToToday}
            className={cn(
              'hidden sm:flex items-center gap-2 border-muted-gray/30',
              hasShootToday && 'border-green-500/50 text-green-400 hover:bg-green-500/10'
            )}
          >
            <CalendarCheck className="w-4 h-4" />
            {hasShootToday ? (
              <span>Day {todayDay?.day_number}</span>
            ) : (
              <span>Today</span>
            )}
          </Button>

          {/* View as Role (for admins/showrunners) */}
          {canViewAsRole && (
            <div className="hidden sm:flex items-center gap-2">
              <Select
                value={viewAsRole || 'my-view'}
                onValueChange={(v) => setViewAsRole(v === 'my-view' ? null : v)}
              >
                <SelectTrigger className={cn(
                  'w-36 h-8 text-xs border-muted-gray/30',
                  viewAsRole && 'border-orange-500/50 text-orange-400'
                )}>
                  <Eye className="w-3 h-3 mr-1" />
                  <SelectValue placeholder="View as..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my-view">My View</SelectItem>
                  {BACKLOT_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {viewAsRole && (
                <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">
                  Viewing as {BACKLOT_ROLES.find(r => r.value === viewAsRole)?.label}
                </Badge>
              )}
            </div>
          )}

          {/* AI Co-pilot Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCopilotOpen(!copilotOpen)}
            className={cn(
              'border-muted-gray/30 hidden sm:flex items-center gap-2',
              copilotOpen && 'border-accent-yellow text-accent-yellow'
            )}
          >
            <Sparkles className="w-4 h-4" />
            Co-pilot
          </Button>
        </div>
      </header>

      {/* Add pt-14 to account for fixed project header */}
      <div className="flex pt-14">
        {/* Sidebar - fixed below AppHeader (5rem) + project header (3.5rem) = 8.5rem */}
        <aside
          className={cn(
            'fixed top-[8.5rem] left-0 z-30 h-[calc(100vh-8.5rem)] w-64 bg-charcoal-black border-r border-muted-gray/20 transition-transform overflow-y-auto',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <nav className="p-4 pb-8">
            {NAV_SECTIONS.map((section, sectionIndex) => {
              // Filter items based on permissions and view config
              const visibleItems = section.items.filter((item) => {
                if (item.adminOnly && !permission?.isAdmin) return false;
                // Approvals tab only visible to users who can approve
                if (item.id === 'approvals' && !canViewApprovalsDashboard) return false;
                return isTabVisible(item.id);
              });
              if (visibleItems.length === 0) return null;

              return (
                <div key={section.title} className={cn(sectionIndex > 0 && 'mt-4')}>
                  {/* Section title - hide for Overview */}
                  {section.title !== 'Overview' && (
                    <h3 className="px-3 mb-1 text-xs font-medium text-muted-gray/60 uppercase tracking-wider">
                      {section.title}
                    </h3>
                  )}
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                          activeView === item.id
                            ? 'bg-accent-yellow/10 text-accent-yellow'
                            : 'text-muted-gray hover:text-bone-white hover:bg-muted-gray/10'
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main Content - add lg:ml-64 to account for fixed sidebar */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 lg:ml-64">
          <Suspense fallback={<ViewSkeleton />}>
          {activeView === 'overview' && (
            <ProjectOverview project={project} permission={permission} />
          )}
          {activeView === 'script' && (
            <ScriptView
              projectId={project.id}
              canEdit={permission?.canEdit || false}
              onSceneClick={(scene) => setSelectedSceneId(scene.id)}
              onImportClick={() => setShowScriptImportModal(true)}
            />
          )}
          {activeView === 'shot-lists' && (
            selectedShotListId ? (
              <ShotListDetailView
                shotListId={selectedShotListId}
                projectId={project.id}
                canEdit={permission?.canEdit || false}
                onBack={() => setSelectedShotListId(null)}
              />
            ) : (
              <ShotListsView
                projectId={project.id}
                canEdit={permission?.canEdit || false}
                onSelectShotList={(shotList) => setSelectedShotListId(shotList.id)}
              />
            )
          )}
          {activeView === 'coverage' && (
            <CoverageView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'scenes' && (
            selectedSceneForView ? (
              <SceneDetailView
                projectId={project.id}
                sceneId={selectedSceneForView.id}
                canEdit={permission?.canEdit || false}
                onBack={() => setSelectedSceneForView(null)}
              />
            ) : (
              <ScenesView
                projectId={project.id}
                canEdit={permission?.canEdit || false}
                onSelectScene={(scene) => setSelectedSceneForView(scene)}
              />
            )
          )}
          {activeView === 'schedule' && (
            <ScheduleView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'days' && (
            selectedDayForView ? (
              <DayDetailView
                projectId={project.id}
                dayId={selectedDayForView.id}
                canEdit={permission?.canEdit || false}
                onBack={() => setSelectedDayForView(null)}
              />
            ) : (
              <DaysView
                projectId={project.id}
                canEdit={permission?.canEdit || false}
                onSelectDay={(day) => setSelectedDayForView(day)}
              />
            )
          )}
          {activeView === 'call-sheets' && (
            <CallSheetsView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'casting' && (
            <CastingCrewTab projectId={project.id} />
          )}
          {activeView === 'people' && (
            selectedPersonForView ? (
              <PersonDetailView
                projectId={project.id}
                userId={selectedPersonForView.user_id}
                canEdit={permission?.canEdit || false}
                onBack={() => setSelectedPersonForView(null)}
              />
            ) : (
              <PeopleView
                projectId={project.id}
                canEdit={permission?.canEdit || false}
                onSelectPerson={(person) => setSelectedPersonForView(person)}
              />
            )
          )}
          {activeView === 'tasks' && (
            selectedTaskListId ? (
              <TaskListDetailView
                taskListId={selectedTaskListId}
                projectId={project.id}
                canEdit={permission?.canEdit || false}
                onBack={() => setSelectedTaskListId(null)}
                onOpenTask={(task) => setSelectedTaskId(task.id)}
                onOpenShare={() => setShowTaskShareModal(true)}
              />
            ) : (
              <TasksView
                projectId={project.id}
                canEdit={permission?.canEdit || false}
                onSelectTaskList={(taskList) => setSelectedTaskListId(taskList.id)}
              />
            )
          )}
          {activeView === 'review' && (
            selectedReviewAssetId ? (
              <ReviewDetailView
                assetId={selectedReviewAssetId}
                projectId={project.id}
                canEdit={permission?.canEdit || false}
                onBack={() => setSelectedReviewAssetId(null)}
              />
            ) : (
              <ReviewsView
                projectId={project.id}
                canEdit={permission?.canEdit || false}
                onSelectAsset={(asset) => setSelectedReviewAssetId(asset.id)}
              />
            )
          )}
          {activeView === 'dailies' && (
            <DailiesView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'camera' && (
            <CameraLogView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'scripty' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-heading text-bone-white">Scripty</h2>
                <p className="text-sm text-muted-gray">Script Supervisor's Continuity Workspace</p>
              </div>
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-accent-yellow/10 flex items-center justify-center mb-4">
                  <ClipboardList className="w-8 h-8 text-accent-yellow" />
                </div>
                <h3 className="text-xl font-semibold text-bone-white mb-2">Coming Soon</h3>
                <p className="text-muted-gray text-center max-w-md mb-8">
                  The complete Script Supervisor toolkit for on-set continuity management.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">📝 Lined Script</h4>
                    <p className="text-sm text-muted-gray">Draw coverage lines on your script pages with camera labels and take associations.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">🎬 Take Logger</h4>
                    <p className="text-sm text-muted-gray">Log takes in real-time with timecode, camera roll, and instant status marking.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">📋 Continuity Notes</h4>
                    <p className="text-sm text-muted-gray">Track props, wardrobe, hair/makeup, and action continuity per scene.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">📸 Continuity Photos</h4>
                    <p className="text-sm text-muted-gray">Capture and organize reference photos with tags and scene associations.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeView === 'checkin' && (
            <CheckInView projectId={project.id} canManage={permission?.isAdmin || false} />
          )}
          {activeView === 'hot-set' && (
            <HotSetView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'my-space' && (
            <MySpacePanel projectId={project.id} />
          )}
          {activeView === 'locations' && (
            <LocationsView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'gear' && (
            <GearView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'budget' && (
            <BudgetView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'daily-budget' && (
            <DailyBudgetView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'timecards' && (
            <TimecardsView
              projectId={project.id}
              canReview={permission?.isAdmin || false}
            />
          )}
          {activeView === 'expenses' && (
            <ExpensesView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'invoices' && (
            <InvoicesView
              projectId={project.id}
              canEdit={permission?.canEdit || false}
              canReview={permission?.isAdmin || false}
            />
          )}
          {activeView === 'analytics' && (
            <AnalyticsView projectId={project.id} />
          )}
          {activeView === 'budget-comparison' && (
            <BudgetComparisonView />
          )}
          {activeView === 'approvals' && (
            <ApprovalsView
              projectId={project.id}
              canEdit={permission?.canEdit || false}
              onNavigateToTab={(tab, subTab) => {
                startTransition(() => {
                  setActiveView(tab as BacklotWorkspaceView);
                });
              }}
            />
          )}
          {activeView === 'clearances' && (
            <ClearancesView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'assets' && (
            <AssetsView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'updates' && (
            <UpdatesView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'contacts' && (
            <ContactsView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'coms' && (
            <ComsView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'credits' && (
            <CreditsView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'access' && (
            <TeamAccessView projectId={project.id} />
          )}
          {activeView === 'roles' && (
            <RolesManagementView projectId={project.id} />
          )}
          {activeView === 'settings' && (
            <ProjectSettings project={project} permission={permission} />
          )}
          {activeView === 'church-tools' && (
            <ChurchToolsView projectId={project.id} />
          )}
          </Suspense>
        </main>

        {/* AI Co-pilot Panel */}
        <AICopilotPanel
          project={project}
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Script Modals */}
      <SceneDetailModal
        projectId={project.id}
        sceneId={selectedSceneId}
        isOpen={!!selectedSceneId}
        onClose={() => setSelectedSceneId(null)}
        canEdit={permission?.canEdit || false}
      />
      <ScriptImportModal
        projectId={project.id}
        isOpen={showScriptImportModal}
        onClose={() => setShowScriptImportModal(false)}
        onSuccess={() => {
          setShowScriptImportModal(false);
          // Navigate to script view to show the imported script
          startTransition(() => {
            setActiveView('script');
          });
        }}
      />

      {/* Task Modals */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        projectId={project.id}
        canEdit={permission?.canEdit || false}
        open={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onDelete={() => {
          setSelectedTaskId(null);
        }}
      />
      {selectedTaskListId && (
        <TaskListShareModal
          taskListId={selectedTaskListId}
          projectId={project.id}
          canManage={permission?.canEdit || false}
          open={showTaskShareModal}
          onOpenChange={setShowTaskShareModal}
        />
      )}
    </div>
    </VoiceProvider>
  );
};

export default ProjectWorkspace;
