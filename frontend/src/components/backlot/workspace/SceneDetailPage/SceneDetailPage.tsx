/**
 * SceneDetailPage - Comprehensive scene hub view
 * Central hub for all scene-related data: shots, locations, dailies, budget, clearances, etc.
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Film,
  Camera,
  MapPin,
  Play,
  FileText,
  DollarSign,
  Receipt,
  ClipboardCheck,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Clapperboard,
} from 'lucide-react';
import { useSceneHub, SceneHubData } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

// Tab components
import SceneInfoTab from './tabs/SceneInfoTab';
import SceneShotsTab from './tabs/SceneShotsTab';
import SceneCoverageTab from './tabs/SceneCoverageTab';
import SceneCallSheetsTab from './tabs/SceneCallSheetsTab';
import SceneLocationsTab from './tabs/SceneLocationsTab';
import SceneDailiesTab from './tabs/SceneDailiesTab';
import SceneBudgetTab from './tabs/SceneBudgetTab';
import SceneReceiptsTab from './tabs/SceneReceiptsTab';
import SceneClearancesTab from './tabs/SceneClearancesTab';

interface SceneDetailPageProps {
  projectId: string;
  sceneId: string;
  canEdit: boolean;
  onBack: () => void;
}

export default function SceneDetailPage({
  projectId,
  sceneId,
  canEdit,
  onBack,
}: SceneDetailPageProps) {
  const { data: hub, isLoading, error } = useSceneHub(projectId, sceneId);
  const [activeTab, setActiveTab] = useState('info');

  if (isLoading) {
    return <SceneDetailPageSkeleton onBack={onBack} />;
  }

  if (error || !hub) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-gray hover:text-bone-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Scenes
        </Button>
        <Card className="bg-charcoal-black border-red-500/30">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-bone-white">Failed to load scene data</p>
            <p className="text-sm text-muted-gray mt-2">
              {error?.message || 'Please try again later'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { scene, coverage_summary, budget_summary, clearance_summary } = hub;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-muted-gray hover:text-bone-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-heading text-bone-white flex items-center gap-2">
                <Film className="w-6 h-6 text-accent-yellow" />
                Scene {scene.scene_number}
              </h1>
              {scene.needs_pickup && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                  Needs Pickup
                </Badge>
              )}
              {scene.is_shot && !scene.needs_pickup && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  Shot
                </Badge>
              )}
              {scene.is_scheduled && !scene.is_shot && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  Scheduled
                </Badge>
              )}
              {!scene.is_scheduled && !scene.is_shot && (
                <Badge className="bg-muted-gray/20 text-muted-gray border-muted-gray/30">
                  Planning
                </Badge>
              )}
            </div>
            {scene.slugline && (
              <p className="text-muted-gray mt-1">{scene.slugline}</p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <SummaryCard
          icon={<Camera className="w-5 h-5 text-blue-400" />}
          label="Shots"
          value={hub.shots.length}
          subtext={`${coverage_summary.covered_shots} covered`}
        />
        <SummaryCard
          icon={<Play className="w-5 h-5 text-purple-400" />}
          label="Dailies"
          value={hub.dailies_clips.length}
          subtext={`${coverage_summary.circle_takes} circled`}
        />
        <SummaryCard
          icon={<Calendar className="w-5 h-5 text-cyan-400" />}
          label="Call Sheets"
          value={hub.call_sheet_links.length}
        />
        <SummaryCard
          icon={<DollarSign className="w-5 h-5 text-green-400" />}
          label="Budget"
          value={`$${budget_summary.total_estimated.toLocaleString()}`}
          subtext={`${budget_summary.total_items} items`}
        />
        <SummaryCard
          icon={<Receipt className="w-5 h-5 text-yellow-400" />}
          label="Receipts"
          value={budget_summary.receipts_count}
          subtext={`$${budget_summary.total_receipts.toLocaleString()}`}
        />
        <SummaryCard
          icon={<ClipboardCheck className="w-5 h-5 text-teal-400" />}
          label="Clearances"
          value={`${clearance_summary.completion_percent}%`}
          subtext={`${clearance_summary.signed_count}/${clearance_summary.total_items} signed`}
        />
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-charcoal-black border border-muted-gray/20 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="info" className="data-[state=active]:bg-muted-gray/20">
            <FileText className="w-4 h-4 mr-2" />
            Info
          </TabsTrigger>
          <TabsTrigger value="shots" className="data-[state=active]:bg-muted-gray/20">
            <Camera className="w-4 h-4 mr-2" />
            Shots ({hub.shots.length})
          </TabsTrigger>
          <TabsTrigger value="coverage" className="data-[state=active]:bg-muted-gray/20">
            <Clapperboard className="w-4 h-4 mr-2" />
            Coverage
          </TabsTrigger>
          <TabsTrigger value="call-sheets" className="data-[state=active]:bg-muted-gray/20">
            <Calendar className="w-4 h-4 mr-2" />
            Call Sheets ({hub.call_sheet_links.length})
          </TabsTrigger>
          <TabsTrigger value="locations" className="data-[state=active]:bg-muted-gray/20">
            <MapPin className="w-4 h-4 mr-2" />
            Locations ({hub.locations.length})
          </TabsTrigger>
          <TabsTrigger value="dailies" className="data-[state=active]:bg-muted-gray/20">
            <Play className="w-4 h-4 mr-2" />
            Dailies ({hub.dailies_clips.length})
          </TabsTrigger>
          <TabsTrigger value="budget" className="data-[state=active]:bg-muted-gray/20">
            <DollarSign className="w-4 h-4 mr-2" />
            Budget
          </TabsTrigger>
          <TabsTrigger value="receipts" className="data-[state=active]:bg-muted-gray/20">
            <Receipt className="w-4 h-4 mr-2" />
            Receipts
          </TabsTrigger>
          <TabsTrigger value="clearances" className="data-[state=active]:bg-muted-gray/20">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            Clearances
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <SceneInfoTab hub={hub} canEdit={canEdit} projectId={projectId} />
        </TabsContent>

        <TabsContent value="shots" className="mt-4">
          <SceneShotsTab hub={hub} canEdit={canEdit} projectId={projectId} sceneId={sceneId} />
        </TabsContent>

        <TabsContent value="coverage" className="mt-4">
          <SceneCoverageTab hub={hub} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="call-sheets" className="mt-4">
          <SceneCallSheetsTab hub={hub} canEdit={canEdit} projectId={projectId} />
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          <SceneLocationsTab hub={hub} canEdit={canEdit} projectId={projectId} sceneId={sceneId} />
        </TabsContent>

        <TabsContent value="dailies" className="mt-4">
          <SceneDailiesTab hub={hub} canEdit={canEdit} projectId={projectId} />
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <SceneBudgetTab hub={hub} canEdit={canEdit} projectId={projectId} sceneId={sceneId} />
        </TabsContent>

        <TabsContent value="receipts" className="mt-4">
          <SceneReceiptsTab hub={hub} canEdit={canEdit} projectId={projectId} sceneId={sceneId} />
        </TabsContent>

        <TabsContent value="clearances" className="mt-4">
          <SceneClearancesTab hub={hub} canEdit={canEdit} projectId={projectId} sceneId={sceneId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <Card className="bg-charcoal-black border-muted-gray/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted-gray/10">{icon}</div>
          <div>
            <p className="text-xl font-bold text-bone-white">{value}</p>
            <p className="text-xs text-muted-gray">{label}</p>
            {subtext && (
              <p className="text-xs text-muted-gray/60">{subtext}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading Skeleton
function SceneDetailPageSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-gray hover:text-bone-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
