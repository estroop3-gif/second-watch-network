/**
 * Community Management (Community Hub)
 * Admin interface for managing members, collabs, moderation, and community settings
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

// Tab Components
import MembersTab from "@/components/admin/community/MembersTab";
import CollabsAdminTab from "@/components/admin/community/CollabsAdminTab";
import ModerationTab from "@/components/admin/community/ModerationTab";
import SettingsTab from "@/components/admin/community/SettingsTab";

import {
  Users,
  Handshake,
  Shield,
  Settings,
  UserCheck,
  Briefcase,
  Flag,
  VolumeX
} from 'lucide-react';

const CommunityManagement = () => {
  const [activeTab, setActiveTab] = useState('members');

  // Fetch quick stats
  const { data: stats } = useQuery({
    queryKey: ['community-admin-stats'],
    queryFn: async () => {
      // Get user count
      const usersData = await api.listUsersAdmin({ limit: 1 });
      const totalMembers = usersData?.total || 0;

      // Get collabs count
      const collabsData = await api.listCollabsAdmin({ limit: 1, is_active: true });
      const activeCollabs = collabsData?.total || 0;

      // Get pending reports
      const reportsData = await api.listContentReports({ status: 'pending' });
      const pendingReports = Array.isArray(reportsData) ? reportsData.length : (reportsData?.reports?.length || 0);

      // Get active mutes
      const mutesData = await api.listActiveMutes();
      const activeMutes = Array.isArray(mutesData) ? mutesData.length : 0;

      return {
        totalMembers,
        activeCollabs,
        pendingReports,
        activeMutes,
      };
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-heading tracking-tighter -rotate-1">
            Community <span className="font-spray text-cyan-500">Hub</span>
          </h1>
          <p className="text-muted-gray mt-2">
            Manage members, collabs, and community settings
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4">
          <Card className="bg-gray-900 border-muted-gray">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-500">{stats?.totalMembers || 0}</div>
              <div className="text-xs text-muted-gray">Members</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-muted-gray">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-500">{stats?.activeCollabs || 0}</div>
              <div className="text-xs text-muted-gray">Collabs</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-muted-gray">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-500">{stats?.pendingReports || 0}</div>
              <div className="text-xs text-muted-gray">Reports</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-muted-gray">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-500">{stats?.activeMutes || 0}</div>
              <div className="text-xs text-muted-gray">Mutes</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-900">
          <TabsTrigger
            value="members"
            className="flex items-center gap-2 data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger
            value="collabs"
            className="flex items-center gap-2 data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
          >
            <Handshake className="h-4 w-4" />
            <span className="hidden sm:inline">Collabs</span>
          </TabsTrigger>
          <TabsTrigger
            value="moderation"
            className="flex items-center gap-2 data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
          >
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Moderation</span>
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="flex items-center gap-2 data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <TabsContent value="members" className="mt-6">
          <MembersTab />
        </TabsContent>

        <TabsContent value="collabs" className="mt-6">
          <CollabsAdminTab />
        </TabsContent>

        <TabsContent value="moderation" className="mt-6">
          <ModerationTab />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunityManagement;
