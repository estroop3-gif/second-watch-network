/**
 * ProjectWorkspace - Main workspace for a Backlot project
 * Contains sidebar navigation and content area for different views
 */
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { useProject, useProjectPermission } from '@/hooks/backlot';
import { BacklotWorkspaceView, BacklotVisibility, BacklotProjectStatus } from '@/types/backlot';
import { cn } from '@/lib/utils';

// View Components
import ProjectOverview from '@/components/backlot/workspace/ProjectOverview';
import ScheduleView from '@/components/backlot/workspace/ScheduleView';
import CallSheetsView from '@/components/backlot/workspace/CallSheetsView';
import TasksView from '@/components/backlot/workspace/TasksView';
import LocationsView from '@/components/backlot/workspace/LocationsView';
import GearView from '@/components/backlot/workspace/GearView';
import BudgetView from '@/components/backlot/workspace/BudgetView';
import DailyBudgetView from '@/components/backlot/workspace/DailyBudgetView';
import ReceiptsView from '@/components/backlot/workspace/ReceiptsView';
import ClearancesView from '@/components/backlot/workspace/ClearancesView';
import UpdatesView from '@/components/backlot/workspace/UpdatesView';
import ContactsView from '@/components/backlot/workspace/ContactsView';
import ProjectSettings from '@/components/backlot/workspace/ProjectSettings';
import CreditsView from '@/components/backlot/workspace/CreditsView';
import AICopilotPanel from '@/components/backlot/workspace/AICopilotPanel';
import ScriptView from '@/components/backlot/workspace/ScriptView';
import SceneDetailModal from '@/components/backlot/workspace/SceneDetailModal';
import ScriptImportModal from '@/components/backlot/workspace/ScriptImportModal';
import { CastingCrewTab } from '@/components/backlot/workspace/CastingCrewTab';
import ShotListsView from '@/components/backlot/workspace/ShotListsView';
import ShotListDetailView from '@/components/backlot/workspace/ShotListDetailView';
import CoverageView from '@/components/backlot/workspace/CoverageView';
import AssetsView from '@/components/backlot/workspace/AssetsView';
import AnalyticsView from '@/components/backlot/workspace/AnalyticsView';
import TaskListDetailView from '@/components/backlot/workspace/TaskListDetailView';
import TaskDetailDrawer from '@/components/backlot/workspace/TaskDetailDrawer';
import TaskListShareModal from '@/components/backlot/workspace/TaskListShareModal';

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

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'script', label: 'Script', icon: Clapperboard },
  { id: 'shot-lists', label: 'Shot Lists', icon: Camera },
  { id: 'coverage', label: 'Coverage', icon: Target },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'call-sheets', label: 'Call Sheets', icon: FileText },
  { id: 'casting', label: 'Casting & Crew', icon: UserPlus },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'gear', label: 'Gear', icon: Package },
  { id: 'budget', label: 'Budget', icon: DollarSign },
  { id: 'daily-budget', label: 'Daily Budget', icon: CalendarDays },
  { id: 'receipts', label: 'Receipts', icon: Receipt },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
  { id: 'clearances', label: 'Clearances', icon: FileCheck },
  { id: 'assets', label: 'Assets', icon: Film },
  { id: 'updates', label: 'Updates', icon: Megaphone },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'credits', label: 'Credits', icon: Award },
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
];

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

  const { data: project, isLoading: projectLoading } = useProject(projectId || null);
  const { data: permission, isLoading: permissionLoading } = useProjectPermission(projectId || null);

  const isLoading = projectLoading || permissionLoading;

  // Filter nav items based on permissions
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !permission?.isAdmin) return false;
    return true;
  });

  const handleNavClick = (view: BacklotWorkspaceView) => {
    setActiveView(view);
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
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-charcoal-black/95 backdrop-blur border-b border-muted-gray/20">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
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

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed lg:sticky top-[57px] left-0 z-30 h-[calc(100vh-57px)] w-64 bg-charcoal-black border-r border-muted-gray/20 transition-transform lg:translate-x-0 overflow-y-auto',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <nav className="p-4 space-y-1 pb-8">
            {visibleNavItems.map((item) => (
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
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
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
          {activeView === 'schedule' && (
            <ScheduleView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'call-sheets' && (
            <CallSheetsView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'casting' && (
            <CastingCrewTab projectId={project.id} />
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
          {activeView === 'receipts' && (
            <ReceiptsView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'analytics' && (
            <AnalyticsView projectId={project.id} />
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
          {activeView === 'credits' && (
            <CreditsView projectId={project.id} canEdit={permission?.canEdit || false} />
          )}
          {activeView === 'settings' && (
            <ProjectSettings project={project} permission={permission} />
          )}
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
        onSuccess={() => setShowScriptImportModal(false)}
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
  );
};

export default ProjectWorkspace;
