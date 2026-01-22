/**
 * Set House Workspace Page
 * Main workspace for managing an organization's spaces and locations
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronLeft,
  Settings,
  Box,
  Layers,
  ArrowRightLeft,
  AlertTriangle,
  Wrench,
  Shield,
  QrCode,
  Clock,
  Store,
  Users,
  Calendar,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

import { useSetHouseOrganization } from '@/hooks/set-house';
import { cn } from '@/lib/utils';

// Import workspace views
import { SpacesView } from '@/components/set-house/workspace/SpacesView';
import { PackagesView } from '@/components/set-house/workspace/PackagesView';
import { TransactionsView } from '@/components/set-house/workspace/TransactionsView';
import { ClientsView } from '@/components/set-house/workspace/ClientsView';
import { IncidentsView } from '@/components/set-house/workspace/IncidentsView';
import { RepairsView } from '@/components/set-house/workspace/RepairsView';
import { StrikesView } from '@/components/set-house/workspace/StrikesView';
import { SettingsView } from '@/components/set-house/workspace/SettingsView';
import { LabelsView } from '@/components/set-house/workspace/LabelsView';
import { MarketplaceView } from '@/components/set-house/marketplace';
import { ExternalPlatformsView } from '@/components/set-house/workspace/ExternalPlatformsView';

type WorkspaceTab =
  | 'spaces'
  | 'packages'
  | 'transactions'
  | 'external'
  | 'marketplace'
  | 'clients'
  | 'incidents'
  | 'repairs'
  | 'strikes'
  | 'labels'
  | 'settings';

const TABS: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
  { id: 'spaces', label: 'Spaces', icon: <Box className="w-4 h-4" /> },
  { id: 'packages', label: 'Packages', icon: <Layers className="w-4 h-4" /> },
  { id: 'transactions', label: 'Transactions', icon: <ArrowRightLeft className="w-4 h-4" /> },
  { id: 'external', label: 'External', icon: <Calendar className="w-4 h-4" /> },
  { id: 'marketplace', label: 'Marketplace', icon: <Store className="w-4 h-4" /> },
  { id: 'clients', label: 'Clients', icon: <Users className="w-4 h-4" /> },
  { id: 'incidents', label: 'Incidents', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'repairs', label: 'Repairs', icon: <Wrench className="w-4 h-4" /> },
  { id: 'strikes', label: 'Strikes', icon: <Shield className="w-4 h-4" /> },
  { id: 'labels', label: 'Labels', icon: <QrCode className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export default function SetHouseWorkspacePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('spaces');

  const { organization, isLoading } = useSetHouseOrganization(orgId || null);

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
          <Building2 className="w-12 h-12 text-muted-gray mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-bone-white mb-2">Organization Not Found</h2>
          <p className="text-muted-gray mb-4">The organization you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/set-house')}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Set House
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
              <Button variant="ghost" size="sm" onClick={() => navigate('/set-house')}>
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
                    <Building2 className="w-5 h-5 text-accent-yellow" />
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

            {/* Quick stats placeholder */}
            <div className="flex items-center gap-4">
              {/* Add overdue badge here when hook is available */}
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

          <TabsContent value="spaces">
            <SpacesView orgId={orgId!} />
          </TabsContent>

          <TabsContent value="packages">
            <PackagesView orgId={orgId!} />
          </TabsContent>

          <TabsContent value="transactions">
            <TransactionsView orgId={orgId!} orgType={organization.org_type} />
          </TabsContent>

          <TabsContent value="external">
            <ExternalPlatformsView orgId={orgId!} />
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
