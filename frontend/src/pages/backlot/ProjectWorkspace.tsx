/**
 * ProjectWorkspace - Main workspace for a Backlot project
 * Contains sidebar navigation and content area for different views
 * Uses lazy loading for view components to improve initial page load performance
 */
import React, { useState, useEffect, Suspense, lazy, startTransition } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
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
  CalendarRange,
  Columns3,
  Images,
  Palette,
  Tv,
  FolderOpen,
  BookOpen,
  PanelLeftClose,
  PanelLeft,
  FileVideo,
  Truck,
} from 'lucide-react';
import { useWorkspaceInit, BACKLOT_ROLES, useViewConfig } from '@/hooks/backlot';
import { BacklotWorkspaceView, BacklotVisibility, BacklotProjectStatus } from '@/types/backlot';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';

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
const ScenesView = lazy(() => import('@/components/backlot/workspace/ScenesView'));
const SceneDetailView = lazy(() => import('@/components/backlot/workspace/SceneDetailView'));
const PeopleView = lazy(() => import('@/components/backlot/workspace/PeopleView'));
const PersonDetailView = lazy(() => import('@/components/backlot/workspace/PersonDetailView'));
const TimecardsView = lazy(() => import('@/components/backlot/workspace/TimecardsView'));
const TeamAccessView = lazy(() => import('@/components/backlot/workspace/TeamAccessView'));
const CameraLogView = lazy(() => import('@/components/backlot/workspace/CameraLogView'));
const CheckInView = lazy(() => import('@/components/backlot/workspace/CheckInView'));
const MySpacePanel = lazy(() => import('@/components/backlot/workspace/MySpacePanel'));
// ChurchToolsView - Coming Soon (lazy import removed)
const HotSetView = lazy(() => import('@/components/backlot/workspace/HotSetView'));
const InvoicesView = lazy(() => import('@/components/backlot/workspace/InvoicesView'));
const ComsView = lazy(() => import('@/components/backlot/workspace/ComsView'));
const ApprovalsView = lazy(() => import('@/components/backlot/workspace/ApprovalsView'));
const BudgetComparisonView = lazy(() => import('@/components/backlot/workspace/BudgetComparisonView'));
const DoodView = lazy(() => import('@/components/backlot/workspace/DoodView'));
const StoryboardView = lazy(() => import('@/components/backlot/workspace/StoryboardView'));
const EpisodeManagementView = lazy(() => import('@/components/backlot/workspace/EpisodeManagementView'));
const EpisodeDetailView = lazy(() => import('@/components/backlot/workspace/EpisodeDetailView'));
const MoodboardView = lazy(() => import('@/components/backlot/workspace/MoodboardView'));
const StoryManagementView = lazy(() => import('@/components/backlot/workspace/StoryManagementView'));
const ScriptSidesView = lazy(() => import('@/components/backlot/workspace/ScriptSidesView'));
const ScriptSidesExportsView = lazy(() => import('@/components/backlot/workspace/ScriptSidesExportsView'));
const StripboardView = lazy(() => import('@/components/backlot/workspace/StripboardView'));
const FilesView = lazy(() => import('@/components/backlot/workspace/FilesView'));
const ContinuityView = lazy(() => import('@/components/backlot/workspace/ContinuityView'));
const TranspoView = lazy(() => import('@/components/backlot/workspace/TranspoView'));

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

import { SceneListItem, PersonListItem } from '@/hooks/backlot';
import { SquarePlay, Video, Timer, Layers, Shield, Aperture, QrCode, Star, Church, ClipboardList, Flame, ClipboardCheck, Scale, ListOrdered, Clock, Workflow } from 'lucide-react';

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
  comingSoon?: boolean;
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
      { id: 'episode-management', label: 'Episodes', icon: Tv },
      { id: 'script-sides', label: 'Script Sides', icon: FileText },
      { id: 'story-management', label: 'Beat Sheet', icon: BookOpen },
    ],
  },
  {
    title: 'Pre-Production',
    items: [
      { id: 'day-out-of-days', label: 'Day out of Days', icon: CalendarRange },
      { id: 'strip-board', label: 'Strip Board', icon: Columns3 },
      { id: 'storyboard', label: 'Storyboard', icon: Images },
      { id: 'moodboard', label: 'Moodboard', icon: Palette },
    ],
  },
  {
    title: 'Planning & Scheduling',
    items: [
      { id: 'schedule', label: 'Schedule', icon: Calendar },
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
      { id: 'continuity', label: 'Continuity', icon: ClipboardCheck },
      { id: 'dailies', label: 'Dailies', icon: Video },
      // { id: 'checkin', label: 'Check-In', icon: QrCode },  // Hidden for now
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
      // { id: 'daily-budget', label: 'Daily Budget', icon: CalendarDays }, // Hidden for now
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
    title: 'Resources',
    items: [
      { id: 'files', label: 'Files', icon: FolderOpen },
    ],
  },
  {
    title: 'Coming Soon',
    items: [
      { id: 'transpo', label: 'Transpo Logistics', icon: Truck, comingSoon: true },
      { id: 'av-script', label: 'AV Script', icon: FileVideo, comingSoon: true },
      { id: 'run-of-show', label: 'Run of Show', icon: ListOrdered, comingSoon: true },
      { id: 'program-rundown', label: 'Program Rundown', icon: Clock, comingSoon: true },
      { id: 'media-pipeline', label: 'Media Pipeline', icon: Workflow, comingSoon: true },
      { id: 'church-tools', label: 'Church Tools', icon: Church, comingSoon: true },
    ],
  },
  {
    title: 'Project',
    items: [
      { id: 'access', label: 'Team & Access', icon: Shield, adminOnly: true },
      { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
    ],
  },
];

// Flatten for filtering (maintain backward compatibility)
const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(section => section.items);

// Sidebar cookie for persistence
const SIDEBAR_COOKIE_NAME = 'backlot-sidebar:state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const getInitialSidebarState = (): boolean => {
  if (typeof document === 'undefined') return true;
  const cookie = document.cookie.split('; ').find(row => row.startsWith(SIDEBAR_COOKIE_NAME));
  return cookie ? cookie.split('=')[1] !== 'collapsed' : true;
};

const ProjectWorkspace: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize activeView from URL or default to 'overview'
  const initialView = (searchParams.get('view') as BacklotWorkspaceView) || 'overview';
  const [activeView, setActiveViewState] = useState<BacklotWorkspaceView>(initialView);

  // Wrapper to update both state and URL
  const setActiveView = (view: BacklotWorkspaceView) => {
    setActiveViewState(view);
    setSearchParams((prev) => {
      if (view === 'overview') {
        prev.delete('view');
      } else {
        prev.set('view', view);
      }
      return prev;
    }, { replace: true });
  };
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile drawer state
  const [sidebarExpanded, setSidebarExpanded] = useState(getInitialSidebarState); // Desktop collapse state
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [showScriptImportModal, setShowScriptImportModal] = useState(false);
  const [selectedShotListId, setSelectedShotListId] = useState<string | null>(null);
  const [selectedTaskListId, setSelectedTaskListId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTaskShareModal, setShowTaskShareModal] = useState(false);
  const [selectedReviewAssetId, setSelectedReviewAssetIdState] = useState<string | null>(
    searchParams.get('reviewAssetId')
  );
  const setSelectedReviewAssetId = (id: string | null) => {
    setSelectedReviewAssetIdState(id);
    setSearchParams((prev) => {
      if (id) {
        prev.set('reviewAssetId', id);
      } else {
        prev.delete('reviewAssetId');
      }
      return prev;
    }, { replace: true });
  };
  const [viewAsRole, setViewAsRole] = useState<string | null>(null);
  // New view states for scenes, people
  const [selectedSceneForView, setSelectedSceneForView] = useState<SceneListItem | null>(null);
  const [selectedPersonForView, setSelectedPersonForView] = useState<PersonListItem | null>(null);
  // Clearances person filter state (from Casting & Crew navigation)
  const [clearancePersonFilter, setClearancePersonFilter] = useState<string | null>(null);
  const [clearancePersonFilterName, setClearancePersonFilterName] = useState<string | undefined>(undefined);
  // Call sheet navigation state (from Schedule view)
  const [initialCallSheetId, setInitialCallSheetId] = useState<string | null>(null);
  // Episode management state
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

  // Single combined API call — replaces 6 individual hooks
  const {
    project,
    permission,
    viewConfig: initViewConfig,
    canViewAsRole,
    todayDay,
    hasShootToday,
    canViewApprovalsDashboard,
    isLoading: workspaceLoading,
  } = useWorkspaceInit(projectId || null);

  // When admin uses "view as role", fetch the role-specific config (only fires when viewAsRole is set)
  const { data: roleViewConfig } = useViewConfig(viewAsRole ? (projectId || null) : null, viewAsRole);
  const viewConfig = viewAsRole ? roleViewConfig : initViewConfig;
  const { profile } = useEnrichedProfile();

  // Check if the alpha tester banner is visible (to adjust sidebar height)
  const isAlphaTester = profile?.is_alpha_tester === true;

  // Toggle sidebar expanded/collapsed state
  const toggleSidebar = () => {
    setSidebarExpanded(prev => {
      const newState = !prev;
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${newState ? 'expanded' : 'collapsed'}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      return newState;
    });
  };

  // Keyboard shortcut for sidebar toggle (Ctrl+B / Cmd+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isLoading = workspaceLoading;

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
    // Approvals tab only visible to users who can approve (or admins)
    if (item.id === 'approvals' && !canViewApprovalsDashboard && !permission?.isAdmin) return false;
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
    // Navigate to schedule view
    startTransition(() => {
      setActiveView('schedule');
    });
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
      <header className="fixed top-20 left-0 right-0 z-40 h-14 bg-charcoal-black border-b border-muted-gray/20 overflow-hidden">
        <div className="container mx-auto px-3 md:px-4 h-full flex items-center gap-2 md:gap-4">
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
                className={`hidden md:flex text-xs shrink-0 ${STATUS_COLORS[project.status]}`}
              >
                {STATUS_LABELS[project.status]}
              </Badge>
              <Badge
                variant="outline"
                className="hidden lg:flex text-xs shrink-0 border-muted-gray/30 items-center gap-1"
              >
                <VisibilityIcon visibility={project.visibility} />
                {project.visibility}
              </Badge>
            </div>
            {project.logline && (
              <p className="text-sm text-muted-gray truncate hidden lg:block">{project.logline}</p>
            )}
          </div>

          {/* Go to Today Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoToToday}
            className={cn(
              'hidden md:flex items-center gap-2 border-muted-gray/30',
              hasShootToday && 'border-green-500/50 text-green-400 hover:bg-green-500/10'
            )}
          >
            <Calendar className="w-4 h-4" />
            {hasShootToday ? (
              <span>Day {todayDay?.day_number}</span>
            ) : (
              <span>Today</span>
            )}
          </Button>

          {/* View as Role (for admins/showrunners) */}
          {canViewAsRole && (
            <div className="hidden lg:flex items-center gap-2">
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
              'border-muted-gray/30 hidden md:flex items-center gap-2',
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
        {/* Sidebar - fixed below AppHeader (5rem) + project header (3.5rem) = 8.5rem
            When alpha tester banner is visible, reduce height by 4rem (~64px) to avoid overlap */}
        <aside
          className={cn(
            'fixed top-[8.5rem] left-0 z-30 bg-charcoal-black border-r border-muted-gray/20 overflow-y-auto transition-all duration-200',
            sidebarExpanded ? 'w-64' : 'lg:w-16',
            isAlphaTester ? 'h-[calc(100vh-8.5rem-4rem)]' : 'h-[calc(100vh-8.5rem)]',
            sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
          )}
        >
          {/* Sidebar collapse toggle (desktop only) */}
          <div className="hidden lg:flex items-center justify-end p-2 border-b border-muted-gray/20">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded hover:bg-white/10 text-muted-gray hover:text-bone-white transition-colors"
                >
                  {sidebarExpanded ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {sidebarExpanded ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
              </TooltipContent>
            </Tooltip>
          </div>
          <nav className={cn('p-4 pb-8', !sidebarExpanded && 'lg:p-2 lg:pb-8')}>
            {NAV_SECTIONS.map((section, sectionIndex) => {
              // Filter items based on permissions and view config
              const visibleItems = section.items.filter((item) => {
                if (item.adminOnly && !permission?.isAdmin) return false;
                // Approvals tab only visible to users who can approve (or admins)
                if (item.id === 'approvals' && !canViewApprovalsDashboard && !permission?.isAdmin) return false;
                return isTabVisible(item.id);
              });
              if (visibleItems.length === 0) return null;

              return (
                <div key={section.title} className={cn(sectionIndex > 0 && 'mt-4', !sidebarExpanded && 'lg:mt-2')}>
                  {/* Section title - hide for Overview and when collapsed */}
                  {section.title !== 'Overview' && sidebarExpanded && (
                    <h3 className="px-3 mb-1 text-xs font-medium text-muted-gray/60 uppercase tracking-wider hidden lg:block">
                      {section.title}
                    </h3>
                  )}
                  {/* Mobile always shows section titles */}
                  {section.title !== 'Overview' && (
                    <h3 className="px-3 mb-1 text-xs font-medium text-muted-gray/60 uppercase tracking-wider lg:hidden">
                      {section.title}
                    </h3>
                  )}
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleNavClick(item.id)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                              !sidebarExpanded && 'lg:justify-center lg:px-2',
                              activeView === item.id
                                ? 'bg-accent-yellow/10 text-accent-yellow'
                                : 'text-muted-gray hover:text-bone-white hover:bg-muted-gray/10'
                            )}
                          >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            <span className={cn(!sidebarExpanded && 'lg:hidden', 'flex items-center gap-2')}>
                              {item.label}
                              {item.comingSoon && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-accent-yellow/50 text-accent-yellow">
                                  Soon
                                </Badge>
                              )}
                            </span>
                          </button>
                        </TooltipTrigger>
                        {!sidebarExpanded && (
                          <TooltipContent side="right" className="hidden lg:block">
                            {item.label}{item.comingSoon && ' (Coming Soon)'}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main Content - margin adjusts based on sidebar state */}
        <main className={cn(
          'flex-1 min-w-0 p-4 lg:p-6 transition-all duration-200',
          sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16'
        )}>
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
            <ScheduleView
              projectId={project.id}
              canEdit={permission?.canEdit || false}
              onViewCallSheet={(callSheetId) => {
                setInitialCallSheetId(callSheetId);
                startTransition(() => {
                  setActiveView('call-sheets');
                });
              }}
            />
          )}
          {activeView === 'call-sheets' && (
            <CallSheetsView
              projectId={project.id}
              canEdit={permission?.canEdit || false}
              initialCallSheetId={initialCallSheetId}
              onInitialCallSheetViewed={() => setInitialCallSheetId(null)}
            />
          )}
          {activeView === 'casting' && (
            <CastingCrewTab
              projectId={project.id}
              onNavigateToClearances={(personId, personName) => {
                setClearancePersonFilter(personId || null);
                setClearancePersonFilterName(personName);
                startTransition(() => {
                  setActiveView('clearances');
                });
              }}
            />
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
          {activeView === 'continuity' && (
            <ContinuityView projectId={project.id} canEdit={permission?.canEdit || false} />
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
            <ExpensesView
              projectId={project.id}
              canEdit={permission?.canEdit || false}
              onNavigateToTab={(tab, subTab) => {
                startTransition(() => {
                  setActiveView(tab as BacklotWorkspaceView);
                });
              }}
            />
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
            <ClearancesView
              projectId={project.id}
              canEdit={permission?.canEdit || false}
              personFilter={clearancePersonFilter}
              personFilterName={clearancePersonFilterName}
              onClearPersonFilter={() => {
                setClearancePersonFilter(null);
                setClearancePersonFilterName(undefined);
              }}
              prefillPersonId={clearancePersonFilter}
              prefillPersonName={clearancePersonFilterName}
            />
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
          {activeView === 'settings' && (
            <ProjectSettings project={project} permission={permission} />
          )}
          {activeView === 'church-tools' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-heading text-bone-white">Church Tools</h2>
                <p className="text-sm text-muted-gray">Specialized tools for church and ministry productions</p>
              </div>
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-charcoal-black/30 border border-muted-gray/30 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-accent-yellow/10 flex items-center justify-center mb-4">
                  <Church className="w-8 h-8 text-accent-yellow" />
                </div>
                <h3 className="text-xl font-semibold text-bone-white mb-2">Coming Soon</h3>
                <p className="text-muted-gray text-center max-w-md mb-8">
                  Purpose-built tools for church services, worship nights, and ministry events.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Service Planning</h4>
                    <p className="text-sm text-muted-gray">Plan worship services with song selection, scripture readings, and sermon notes.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Volunteer Scheduling</h4>
                    <p className="text-sm text-muted-gray">Manage tech team schedules, send reminders, and track availability.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Lyrics & Graphics</h4>
                    <p className="text-sm text-muted-gray">Manage song lyrics, lower thirds, and announcement graphics.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Multi-Campus Sync</h4>
                    <p className="text-sm text-muted-gray">Coordinate services across multiple campuses with shared resources.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Coming Soon Placeholder Tabs */}
          {activeView === 'day-out-of-days' && (
            <DoodView projectId={project.id} canEdit={isTabEditable('day-out-of-days')} />
          )}
          {activeView === 'strip-board' && (
            <StripboardView projectId={project.id} canEdit={isTabEditable('strip-board')} />
          )}
          {activeView === 'storyboard' && (
            <StoryboardView projectId={project.id} canEdit={isTabEditable('storyboard')} />
          )}
          {activeView === 'moodboard' && (
            <MoodboardView projectId={project.id} canEdit={isTabEditable('moodboard')} />
          )}
          {activeView === 'episode-management' && (
            selectedEpisodeId ? (
              <EpisodeDetailView
                projectId={project.id}
                episodeId={selectedEpisodeId}
                canEdit={isTabEditable('episode-management')}
                onBack={() => setSelectedEpisodeId(null)}
              />
            ) : (
              <EpisodeManagementView
                projectId={project.id}
                canEdit={isTabEditable('episode-management')}
                onSelectEpisode={(episodeId) => setSelectedEpisodeId(episodeId)}
              />
            )
          )}
          {activeView === 'files' && (
            <FilesView projectId={project.id} canEdit={isTabEditable('files')} />
          )}
          {activeView === 'script-sides' && (
            <ScriptSidesExportsView projectId={project.id} canEdit={isTabEditable('script-sides')} />
          )}
          {activeView === 'story-management' && (
            <StoryManagementView projectId={project.id} canEdit={isTabEditable('story-management')} />
          )}

          {/* Coming Soon: Transpo Logistics */}
          {activeView === 'transpo' && (
            <TranspoView projectId={project.id} />
          )}

          {/* Coming Soon: AV Script */}
          {activeView === 'av-script' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-heading text-bone-white">AV Script</h2>
                <p className="text-sm text-muted-gray">Audio-visual script format for video productions</p>
              </div>
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-charcoal-black/30 border border-muted-gray/30 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-accent-yellow/10 flex items-center justify-center mb-4">
                  <FileVideo className="w-8 h-8 text-accent-yellow" />
                </div>
                <h3 className="text-xl font-semibold text-bone-white mb-2">Coming Soon</h3>
                <p className="text-muted-gray text-center max-w-md mb-8">
                  Two-column AV script format with visual and audio descriptions side by side.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Two-Column Layout</h4>
                    <p className="text-sm text-muted-gray">Visual descriptions on the left, audio/dialogue on the right.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Time Codes</h4>
                    <p className="text-sm text-muted-gray">Precise timing for each segment with auto-duration calculations.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">B-Roll Notes</h4>
                    <p className="text-sm text-muted-gray">Mark sections for B-roll footage with shot descriptions.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Export Options</h4>
                    <p className="text-sm text-muted-gray">Export to PDF, teleprompter format, or spreadsheet.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Coming Soon: Run of Show */}
          {activeView === 'run-of-show' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-heading text-bone-white">Run of Show</h2>
                <p className="text-sm text-muted-gray">Live event schedule and timing management</p>
              </div>
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-charcoal-black/30 border border-muted-gray/30 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-accent-yellow/10 flex items-center justify-center mb-4">
                  <Radio className="w-8 h-8 text-accent-yellow" />
                </div>
                <h3 className="text-xl font-semibold text-bone-white mb-2">Coming Soon</h3>
                <p className="text-muted-gray text-center max-w-md mb-8">
                  Complete run of show planning for live events, broadcasts, and shows.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Timeline View</h4>
                    <p className="text-sm text-muted-gray">Visual timeline with drag-and-drop segment ordering.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Cue Sheets</h4>
                    <p className="text-sm text-muted-gray">Generate cue sheets for audio, video, and lighting teams.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Live Tracking</h4>
                    <p className="text-sm text-muted-gray">Real-time show progress with variance from planned times.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Multi-Role Views</h4>
                    <p className="text-sm text-muted-gray">Role-specific views for stage manager, talent, and crew.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Coming Soon: Media Pipeline */}
          {activeView === 'media-pipeline' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-heading text-bone-white">Media Pipeline</h2>
                <p className="text-sm text-muted-gray">Ingest, organize, and distribute your production media</p>
              </div>
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-charcoal-black/30 border border-muted-gray/30 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-accent-yellow/10 flex items-center justify-center mb-4">
                  <FolderOpen className="w-8 h-8 text-accent-yellow" />
                </div>
                <h3 className="text-xl font-semibold text-bone-white mb-2">Coming Soon</h3>
                <p className="text-muted-gray text-center max-w-md mb-8">
                  Complete media management from card ingest to final distribution.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Card Ingest</h4>
                    <p className="text-sm text-muted-gray">Offload camera cards with verification and naming conventions.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Asset Organization</h4>
                    <p className="text-sm text-muted-gray">Link sponsor videos, presentations, graphics, and deliverables.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Naming Templates</h4>
                    <p className="text-sm text-muted-gray">Enforce file naming conventions with project-specific templates.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Distribution</h4>
                    <p className="text-sm text-muted-gray">Package and deliver assets to clients, sponsors, and platforms.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Coming Soon: Program Rundown */}
          {activeView === 'program-rundown' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-heading text-bone-white">Program Rundown</h2>
                <p className="text-sm text-muted-gray">Real-time timers and show management for live events</p>
              </div>
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-charcoal-black/30 border border-muted-gray/30 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-accent-yellow/10 flex items-center justify-center mb-4">
                  <Timer className="w-8 h-8 text-accent-yellow" />
                </div>
                <h3 className="text-xl font-semibold text-bone-white mb-2">Coming Soon</h3>
                <p className="text-muted-gray text-center max-w-md mb-8">
                  Day-of show management with real-time timers and automatic adjustments.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Segment Timers</h4>
                    <p className="text-sm text-muted-gray">Rolling runtime with hard out alarms. Know exactly where you stand.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Auto Cut List</h4>
                    <p className="text-sm text-muted-gray">"If we're long" cut list that updates automatically as the show progresses.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Speaker Timer</h4>
                    <p className="text-sm text-muted-gray">On-stage confidence monitor mode with countdown and cues for talent.</p>
                  </div>
                  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
                    <h4 className="font-medium text-bone-white mb-2">Break & Doors</h4>
                    <p className="text-sm text-muted-gray">Break timers and doors open countdown for audience management.</p>
                  </div>
                </div>
              </div>
            </div>
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
