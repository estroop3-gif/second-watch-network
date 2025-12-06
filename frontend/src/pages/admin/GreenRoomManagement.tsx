/**
 * Green Room Admin Management
 * Admin interface for managing Green Room cycles, submissions, voting, and moderation
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  FileText,
  Vote,
  Star,
  BarChart3,
  Plus,
  RefreshCw
} from 'lucide-react';

// Tab Components
import CyclesTab from '@/components/admin/greenroom/CyclesTab';
import SubmissionsTab from '@/components/admin/greenroom/SubmissionsTab';
import RoundsTab from '@/components/admin/greenroom/RoundsTab';
import FeaturedTab from '@/components/admin/greenroom/FeaturedTab';
import MetricsTab from '@/components/admin/greenroom/MetricsTab';

const GreenRoomManagement = () => {
  const [activeTab, setActiveTab] = useState('cycles');

  // Fetch quick stats for the header
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['greenroom-admin-stats'],
    queryFn: async () => {
      const [cyclesRes, projectsRes, ticketsRes] = await Promise.all([
        supabase.from('greenroom_cycles').select('id', { count: 'exact' }),
        supabase.from('greenroom_projects').select('id', { count: 'exact' }),
        supabase.from('greenroom_voting_tickets').select('id', { count: 'exact' }),
      ]);

      return {
        totalCycles: cyclesRes.count || 0,
        totalProjects: projectsRes.count || 0,
        totalTickets: ticketsRes.count || 0,
      };
    },
  });

  // Get active cycle info
  const { data: activeCycle } = useQuery({
    queryKey: ['greenroom-active-cycle'],
    queryFn: async () => {
      const { data } = await supabase
        .from('greenroom_cycles')
        .select('*')
        .eq('status', 'active')
        .single();
      return data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-heading tracking-tighter -rotate-1">
            Green <span className="font-spray text-emerald-500">Room</span>
          </h1>
          <p className="text-muted-gray mt-2">
            Manage cycles, submissions, voting, and community engagement
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4">
          <Card className="bg-gray-900 border-muted-gray">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-500">{stats?.totalCycles || 0}</div>
              <div className="text-xs text-muted-gray">Cycles</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-muted-gray">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-500">{stats?.totalProjects || 0}</div>
              <div className="text-xs text-muted-gray">Projects</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-muted-gray">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-500">{stats?.totalTickets || 0}</div>
              <div className="text-xs text-muted-gray">Tickets</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active Cycle Banner */}
      {activeCycle && (
        <Card className="bg-emerald-900/20 border-emerald-600">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-600">Active Cycle</Badge>
              <span className="font-semibold">{activeCycle.name}</span>
              <span className="text-muted-gray text-sm">
                Phase: <span className="text-emerald-400 capitalize">{activeCycle.current_phase}</span>
              </span>
            </div>
            <Button variant="outline" size="sm" className="border-emerald-600 text-emerald-400 hover:bg-emerald-600/20">
              View Details
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-gray-900">
          <TabsTrigger
            value="cycles"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Cycles</span>
          </TabsTrigger>
          <TabsTrigger
            value="submissions"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Submissions</span>
          </TabsTrigger>
          <TabsTrigger
            value="rounds"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            <Vote className="h-4 w-4" />
            <span className="hidden sm:inline">Rounds</span>
          </TabsTrigger>
          <TabsTrigger
            value="featured"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Featured</span>
          </TabsTrigger>
          <TabsTrigger
            value="metrics"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Metrics</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <TabsContent value="cycles" className="mt-6">
          <CyclesTab />
        </TabsContent>

        <TabsContent value="submissions" className="mt-6">
          <SubmissionsTab />
        </TabsContent>

        <TabsContent value="rounds" className="mt-6">
          <RoundsTab />
        </TabsContent>

        <TabsContent value="featured" className="mt-6">
          <FeaturedTab />
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <MetricsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GreenRoomManagement;
