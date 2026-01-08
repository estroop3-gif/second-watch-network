/**
 * Gear House Workspace Page
 * Main workspace for managing an organization's equipment
 */
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Package,
  ChevronLeft,
  Settings,
  Users,
  Box,
  Layers,
  ArrowRightLeft,
  AlertTriangle,
  Wrench,
  Shield,
  QrCode,
  BarChart3,
  Clock,
  Building2,
  Store,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

import { useGearOrganization, useGearAssetStats, useGearOverdue } from '@/hooks/gear';
import type { GearOrganization } from '@/types/gear';
import { cn } from '@/lib/utils';

// Import workspace views
import { AssetsView } from '@/components/gear/workspace/AssetsView';
import { KitsView } from '@/components/gear/workspace/KitsView';
import { TransactionsView } from '@/components/gear/workspace/TransactionsView';
import { ClientsView } from '@/components/gear/workspace/ClientsView';
import { IncidentsView } from '@/components/gear/workspace/IncidentsView';
import { RepairsView } from '@/components/gear/workspace/RepairsView';
import { StrikesView } from '@/components/gear/workspace/StrikesView';
import { SettingsView } from '@/components/gear/workspace/SettingsView';
import { LabelsView } from '@/components/gear/workspace/LabelsView';
import { MarketplaceView } from '@/components/gear/marketplace';

type WorkspaceTab =
  | 'assets'
  | 'kits'
  | 'transactions'
  | 'marketplace'
  | 'clients'
  | 'incidents'
  | 'repairs'
  | 'strikes'
  | 'labels'
  | 'settings';

const TABS: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
  { id: 'assets', label: 'Assets', icon: <Box className="w-4 h-4" /> },
  { id: 'kits', label: 'Kits', icon: <Layers className="w-4 h-4" /> },
  { id: 'transactions', label: 'Transactions', icon: <ArrowRightLeft className="w-4 h-4" /> },
  { id: 'marketplace', label: 'Marketplace', icon: <Store className="w-4 h-4" /> },
  { id: 'clients', label: 'Clients', icon: <Building2 className="w-4 h-4" /> },
  { id: 'incidents', label: 'Incidents', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'repairs', label: 'Repairs', icon: <Wrench className="w-4 h-4" /> },
  { id: 'strikes', label: 'Strikes', icon: <Shield className="w-4 h-4" /> },
  { id: 'labels', label: 'Labels', icon: <QrCode className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export default function GearWorkspacePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('assets');

  const { organization, isLoading } = useGearOrganization(orgId || null);
  const { data: overdueData } = useGearOverdue(orgId || null);
  const overdueCount = overdueData?.length ?? 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-16 w-64" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-charcoal-black p-6 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-muted-gray mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-bone-white mb-2">Organization Not Found</h2>
          <p className="text-muted-gray mb-4">The organization you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/gear')}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Gear House
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <div className="border-b border-muted-gray/30 bg-charcoal-black/80 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/gear')}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                {organization.logo_url ? (
                  <img
                    src={organization.logo_url}
                    alt={organization.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center">
                    <Package className="w-5 h-5 text-accent-yellow" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-bone-white">{organization.name}</h1>
                  {organization.description && (
                    <p className="text-sm text-muted-gray line-clamp-1">
                      {organization.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-4">
              {overdueCount > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border">
                  <Clock className="w-3 h-3 mr-1" />
                  {overdueCount} Overdue
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WorkspaceTab)}>
          <TabsList className="bg-charcoal-black/50 border border-muted-gray/30 mb-6">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-accent-yellow/20 data-[state=active]:text-accent-yellow"
              >
                {tab.icon}
                <span className="ml-2">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="assets">
            <AssetsView orgId={orgId!} />
          </TabsContent>

          <TabsContent value="kits">
            <KitsView orgId={orgId!} />
          </TabsContent>

          <TabsContent value="transactions">
            <TransactionsView orgId={orgId!} orgType={organization.org_type} />
          </TabsContent>

          <TabsContent value="marketplace">
            <MarketplaceView orgId={orgId!} onGoToSettings={() => setActiveTab('settings')} />
          </TabsContent>

          <TabsContent value="clients">
            <ClientsView orgId={orgId!} orgType={organization.org_type} />
          </TabsContent>

          <TabsContent value="incidents">
            <IncidentsView orgId={orgId!} />
          </TabsContent>

          <TabsContent value="repairs">
            <RepairsView orgId={orgId!} />
          </TabsContent>

          <TabsContent value="strikes">
            <StrikesView orgId={orgId!} />
          </TabsContent>

          <TabsContent value="labels">
            <LabelsView orgId={orgId!} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsView orgId={orgId!} organization={organization} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
