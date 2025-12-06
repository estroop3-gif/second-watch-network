/**
 * Metrics & Exports Tab
 * Admin interface for analytics and data exports
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  Download,
  Users,
  Vote,
  Ticket,
  TrendingUp,
  Calendar,
  FileJson,
  FileSpreadsheet,
  Trophy,
  Eye
} from 'lucide-react';

interface CycleMetrics {
  id: string;
  name: string;
  status: string;
  totalSubmissions: number;
  approvedSubmissions: number;
  shortlistedSubmissions: number;
  rejectedSubmissions: number;
  totalVotes: number;
  uniqueVoters: number;
  totalTicketsIssued: number;
  ticketsUsed: number;
  participationRate: number;
}

const MetricsTab = () => {
  const [selectedCycleId, setSelectedCycleId] = useState<string>('all');

  // Fetch cycles
  const { data: cycles } = useQuery({
    queryKey: ['greenroom-cycles-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('greenroom_cycles')
        .select('id, name, status')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch overall metrics
  const { data: overallMetrics, isLoading } = useQuery({
    queryKey: ['greenroom-overall-metrics'],
    queryFn: async () => {
      const [cyclesRes, projectsRes, votesRes, ticketsRes] = await Promise.all([
        supabase.from('greenroom_cycles').select('id, status', { count: 'exact' }),
        supabase.from('greenroom_projects').select('id, status', { count: 'exact' }),
        supabase.from('greenroom_votes').select('id', { count: 'exact' }),
        supabase.from('greenroom_voting_tickets').select('id, tickets_used'),
      ]);

      const totalTicketsUsed = ticketsRes.data?.reduce((sum, t) => sum + (t.tickets_used || 0), 0) || 0;

      return {
        totalCycles: cyclesRes.count || 0,
        activeCycles: cyclesRes.data?.filter(c => c.status === 'active').length || 0,
        totalProjects: projectsRes.count || 0,
        totalVotes: votesRes.count || 0,
        totalTicketsUsed,
      };
    },
  });

  // Fetch cycle-specific metrics
  const { data: cycleMetrics } = useQuery({
    queryKey: ['greenroom-cycle-metrics', selectedCycleId],
    queryFn: async () => {
      if (selectedCycleId === 'all') {
        // Aggregate all cycles
        const cyclesList = cycles || [];
        const metricsPromises = cyclesList.map(async (cycle) => {
          return await fetchCycleMetrics(cycle.id, cycle.name, cycle.status);
        });

        return Promise.all(metricsPromises);
      } else {
        const cycle = cycles?.find(c => c.id === selectedCycleId);
        if (!cycle) return [];
        return [await fetchCycleMetrics(cycle.id, cycle.name, cycle.status)];
      }
    },
    enabled: !!cycles,
  });

  const fetchCycleMetrics = async (cycleId: string, cycleName: string, cycleStatus: string): Promise<CycleMetrics> => {
    const [projectsRes, votesRes, ticketsRes] = await Promise.all([
      supabase.from('greenroom_projects').select('id, status').eq('cycle_id', cycleId),
      supabase.from('greenroom_votes').select('id, user_id').eq('cycle_id', cycleId),
      supabase.from('greenroom_voting_tickets').select('id, user_id, tickets_remaining, tickets_used').eq('cycle_id', cycleId),
    ]);

    const projects = projectsRes.data || [];
    const votes = votesRes.data || [];
    const tickets = ticketsRes.data || [];

    const totalTickets = tickets.reduce((sum, t) => sum + (t.tickets_remaining || 0) + (t.tickets_used || 0), 0);
    const usedTickets = tickets.reduce((sum, t) => sum + (t.tickets_used || 0), 0);
    const uniqueVoters = new Set(votes.map(v => v.user_id)).size;
    const participationRate = totalTickets > 0 ? Math.round((usedTickets / totalTickets) * 100) : 0;

    return {
      id: cycleId,
      name: cycleName,
      status: cycleStatus,
      totalSubmissions: projects.length,
      approvedSubmissions: projects.filter(p => p.status === 'approved').length,
      shortlistedSubmissions: projects.filter(p => p.status === 'shortlisted').length,
      rejectedSubmissions: projects.filter(p => p.status === 'rejected').length,
      totalVotes: votes.length,
      uniqueVoters,
      totalTicketsIssued: totalTickets,
      ticketsUsed: usedTickets,
      participationRate,
    };
  };

  // Export functions
  const exportToJSON = async (type: 'cycles' | 'projects' | 'votes') => {
    try {
      let data;
      if (type === 'cycles') {
        const { data: result } = await supabase.from('greenroom_cycles').select('*');
        data = result;
      } else if (type === 'projects') {
        const { data: result } = await supabase
          .from('greenroom_projects')
          .select('*, cycle:greenroom_cycles(name)')
          .order('created_at', { ascending: false });
        data = result;
      } else {
        const { data: result } = await supabase
          .from('greenroom_votes')
          .select('*, project:greenroom_projects(title), cycle:greenroom_cycles(name)')
          .order('created_at', { ascending: false });
        data = result;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `greenroom-${type}-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type} exported successfully`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const exportToCSV = async (type: 'cycles' | 'projects' | 'votes') => {
    try {
      let data: any[];
      let headers: string[];

      if (type === 'cycles') {
        const { data: result } = await supabase.from('greenroom_cycles').select('*');
        data = result || [];
        headers = ['id', 'name', 'status', 'current_phase', 'submission_start', 'submission_end', 'voting_start', 'voting_end', 'created_at'];
      } else if (type === 'projects') {
        const { data: result } = await supabase
          .from('greenroom_projects')
          .select('id, title, logline, genre, format, status, is_featured, created_at, cycle_id');
        data = result || [];
        headers = ['id', 'title', 'logline', 'genre', 'format', 'status', 'is_featured', 'created_at', 'cycle_id'];
      } else {
        const { data: result } = await supabase
          .from('greenroom_votes')
          .select('id, user_id, project_id, cycle_id, tickets_used, created_at');
        data = result || [];
        headers = ['id', 'user_id', 'project_id', 'cycle_id', 'tickets_used', 'created_at'];
      }

      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `greenroom-${type}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type} exported successfully`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-600',
    voting: 'bg-blue-600',
    completed: 'bg-purple-600',
    archived: 'bg-gray-600',
    draft: 'bg-yellow-600',
  };

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gray-900 border-muted-gray">
          <CardContent className="p-4 text-center">
            <Calendar className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{overallMetrics?.totalCycles || 0}</div>
            <div className="text-xs text-muted-gray">Total Cycles</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-muted-gray">
          <CardContent className="p-4 text-center">
            <Eye className="h-6 w-6 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{overallMetrics?.activeCycles || 0}</div>
            <div className="text-xs text-muted-gray">Active Cycles</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-muted-gray">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{overallMetrics?.totalProjects || 0}</div>
            <div className="text-xs text-muted-gray">Total Projects</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-muted-gray">
          <CardContent className="p-4 text-center">
            <Vote className="h-6 w-6 text-purple-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{overallMetrics?.totalVotes || 0}</div>
            <div className="text-xs text-muted-gray">Total Votes</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-muted-gray">
          <CardContent className="p-4 text-center">
            <Ticket className="h-6 w-6 text-orange-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{overallMetrics?.totalTicketsUsed || 0}</div>
            <div className="text-xs text-muted-gray">Tickets Used</div>
          </CardContent>
        </Card>
      </div>

      {/* Cycle Filter */}
      <div className="flex items-center gap-4">
        <div>
          <Label className="text-xs text-muted-gray mb-1 block">Filter by Cycle</Label>
          <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-[250px] bg-gray-800 border-muted-gray">
              <SelectValue placeholder="All Cycles" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-muted-gray">
              <SelectItem value="all">All Cycles</SelectItem>
              {cycles?.map((cycle) => (
                <SelectItem key={cycle.id} value={cycle.id}>
                  {cycle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cycle Metrics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cycleMetrics?.map((metrics) => (
          <Card key={metrics.id} className="bg-gray-900 border-muted-gray">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{metrics.name}</CardTitle>
                <Badge className={statusColors[metrics.status] || 'bg-gray-600'}>
                  {metrics.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Submissions Breakdown */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-gray">Submissions</span>
                  <span className="text-sm font-medium">{metrics.totalSubmissions}</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline" className="border-emerald-600 text-emerald-500">
                    {metrics.approvedSubmissions} approved
                  </Badge>
                  <Badge variant="outline" className="border-blue-600 text-blue-500">
                    {metrics.shortlistedSubmissions} shortlisted
                  </Badge>
                  <Badge variant="outline" className="border-red-600 text-red-500">
                    {metrics.rejectedSubmissions} rejected
                  </Badge>
                </div>
              </div>

              {/* Voting Stats */}
              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-muted-gray/20">
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-500">{metrics.totalVotes}</div>
                  <div className="text-xs text-muted-gray">Votes</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-500">{metrics.uniqueVoters}</div>
                  <div className="text-xs text-muted-gray">Voters</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-500">{metrics.ticketsUsed}</div>
                  <div className="text-xs text-muted-gray">Tickets</div>
                </div>
              </div>

              {/* Participation Rate */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-gray">Participation Rate</span>
                  <span className="text-xs font-medium">{metrics.participationRate}%</span>
                </div>
                <Progress value={metrics.participationRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Export Section */}
      <Card className="bg-gray-900 border-muted-gray">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-emerald-500" />
            Export Data
          </CardTitle>
          <CardDescription>Download Green Room data for analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cycles Export */}
            <Card className="bg-gray-800 border-muted-gray/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="h-5 w-5 text-emerald-500" />
                  <div>
                    <div className="font-medium">Cycles Data</div>
                    <div className="text-xs text-muted-gray">All cycle configurations</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportToJSON('cycles')}
                    className="flex-1"
                  >
                    <FileJson className="h-4 w-4 mr-1" />
                    JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportToCSV('cycles')}
                    className="flex-1"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Projects Export */}
            <Card className="bg-gray-800 border-muted-gray/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="font-medium">Projects Data</div>
                    <div className="text-xs text-muted-gray">All submitted projects</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportToJSON('projects')}
                    className="flex-1"
                  >
                    <FileJson className="h-4 w-4 mr-1" />
                    JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportToCSV('projects')}
                    className="flex-1"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Votes Export */}
            <Card className="bg-gray-800 border-muted-gray/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Vote className="h-5 w-5 text-purple-500" />
                  <div>
                    <div className="font-medium">Votes Data</div>
                    <div className="text-xs text-muted-gray">All voting records</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportToJSON('votes')}
                    className="flex-1"
                  >
                    <FileJson className="h-4 w-4 mr-1" />
                    JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportToCSV('votes')}
                    className="flex-1"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetricsTab;
