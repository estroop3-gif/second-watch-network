import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tv,
  Clapperboard,
  UserCircle,
  Settings
} from 'lucide-react';

// Import tab components
import FastChannelTab from '@/components/admin/content/FastChannelTab';
import BacklotProjectsTab from '@/components/admin/content/BacklotProjectsTab';
import ProfileContentTab from '@/components/admin/content/ProfileContentTab';
import PublicProfileConfig from '@/components/admin/content/PublicProfileConfig';

const ContentManagement = () => {
  const [activeTab, setActiveTab] = useState('fast-channel');

  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-8 -rotate-1">
        Content <span className="font-spray text-accent-yellow">Management</span>
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-zinc-900 border-zinc-800 mb-6">
          <TabsTrigger value="fast-channel" className="data-[state=active]:bg-zinc-800 gap-2">
            <Tv className="h-4 w-4" />
            Fast Channel
          </TabsTrigger>
          <TabsTrigger value="backlot" className="data-[state=active]:bg-zinc-800 gap-2">
            <Clapperboard className="h-4 w-4" />
            Backlot Projects
          </TabsTrigger>
          <TabsTrigger value="profile-content" className="data-[state=active]:bg-zinc-800 gap-2">
            <UserCircle className="h-4 w-4" />
            Profile Content
          </TabsTrigger>
          <TabsTrigger value="profile-config" className="data-[state=active]:bg-zinc-800 gap-2">
            <Settings className="h-4 w-4" />
            Public Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fast-channel" className="mt-0">
          <FastChannelTab />
        </TabsContent>

        <TabsContent value="backlot" className="mt-0">
          <BacklotProjectsTab />
        </TabsContent>

        <TabsContent value="profile-content" className="mt-0">
          <ProfileContentTab />
        </TabsContent>

        <TabsContent value="profile-config" className="mt-0">
          <PublicProfileConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContentManagement;
