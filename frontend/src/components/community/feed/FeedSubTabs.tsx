/**
 * FeedSubTabs - Sub-tab navigation for Public Feed / Connections Feed
 */
import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, Users } from 'lucide-react';

export type FeedSubTab = 'public' | 'connections';

interface FeedSubTabsProps {
  activeTab: FeedSubTab;
  onTabChange: (tab: FeedSubTab) => void;
  isAuthenticated: boolean;
}

const FeedSubTabs: React.FC<FeedSubTabsProps> = ({
  activeTab,
  onTabChange,
  isAuthenticated,
}) => {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onTabChange(v as FeedSubTab)}
      className="w-full"
    >
      <TabsList className="bg-charcoal-black/50 border border-muted-gray/20 w-full justify-start">
        <TabsTrigger
          value="public"
          className="flex items-center gap-2 data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow"
        >
          <Globe className="w-4 h-4" />
          Public Feed
        </TabsTrigger>
        <TabsTrigger
          value="connections"
          disabled={!isAuthenticated}
          className="flex items-center gap-2 data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Users className="w-4 h-4" />
          Connections
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default FeedSubTabs;
