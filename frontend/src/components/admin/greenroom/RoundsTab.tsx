/**
 * Rounds & Voting Control Tab
 * Admin interface for managing voting rounds and ticket distribution
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Vote,
  Ticket,
  Users,
  Plus,
  RefreshCw,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

interface TicketStats {
  total_tickets: number;
  used_tickets: number;
  unique_voters: number;
}

interface CycleWithStats {
  id: string;
  name: string;
  status: string;
  current_phase: string;
  tickets_per_user: number;
  voting_start: string | null;
  voting_end: string | null;
}

const RoundsTab = () => {
  const queryClient = useQueryClient();
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    user_id: '',
    tickets_to_add: 0,
    reason: '',
  });

  // Fetch cycles
  const { data: cycles } = useQuery({
    queryKey: ['greenroom-cycles-voting'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('greenroom_cycles')
        .select('id, name, status, current_phase, tickets_per_user, voting_start, voting_end')
        .in('status', ['active', 'voting', 'completed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CycleWithStats[];
    },
  });

  // Auto-select first cycle
  React.useEffect(() => {
    if (cycles?.length && !selectedCycleId) {
      setSelectedCycleId(cycles[0].id);
    }
  }, [cycles, selectedCycleId]);

  // Fetch ticket stats for selected cycle
  const { data: ticketStats, isLoading: statsLoading } = useQuery({
    queryKey: ['greenroom-ticket-stats', selectedCycleId],
    queryFn: async () => {
      if (!selectedCycleId) return null;

      // Get total tickets issued for this cycle
      const { data: tickets, error: ticketsError } = await supabase
        .from('greenroom_voting_tickets')
        .select('id, user_id, tickets_remaining, tickets_used')
        .eq('cycle_id', selectedCycleId);

      if (ticketsError) throw ticketsError;

      const total = tickets?.reduce((sum, t) => sum + (t.tickets_remaining || 0) + (t.tickets_used || 0), 0) || 0;
      const used = tickets?.reduce((sum, t) => sum + (t.tickets_used || 0), 0) || 0;
      const uniqueVoters = new Set(tickets?.filter(t => (t.tickets_used || 0) > 0).map(t => t.user_id)).size;

      return {
        total_tickets: total,
        used_tickets: used,
        unique_voters: uniqueVoters,
      } as TicketStats;
    },
    enabled: !!selectedCycleId,
  });

  // Fetch individual ticket holders
  const { data: ticketHolders, isLoading: holdersLoading } = useQuery({
    queryKey: ['greenroom-ticket-holders', selectedCycleId],
    queryFn: async () => {
      if (!selectedCycleId) return [];

      const { data, error } = await supabase
        .from('greenroom_voting_tickets')
        .select(`
          *,
          profile:profiles(display_name, avatar_url)
        `)
        .eq('cycle_id', selectedCycleId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCycleId,
  });

  // Fetch vote distribution by project
  const { data: voteDistribution } = useQuery({
    queryKey: ['greenroom-vote-distribution', selectedCycleId],
    queryFn: async () => {
      if (!selectedCycleId) return [];

      const { data, error } = await supabase
        .from('greenroom_votes')
        .select(`
          project_id,
          tickets_used,
          project:greenroom_projects(title)
        `)
        .eq('cycle_id', selectedCycleId);

      if (error) throw error;

      // Aggregate votes by project
      const projectVotes: Record<string, { title: string; votes: number }> = {};
      data?.forEach(vote => {
        const projectId = vote.project_id;
        if (!projectVotes[projectId]) {
          projectVotes[projectId] = {
            title: vote.project?.title || 'Unknown',
            votes: 0,
          };
        }
        projectVotes[projectId].votes += vote.tickets_used || 1;
      });

      return Object.entries(projectVotes)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.votes - a.votes);
    },
    enabled: !!selectedCycleId,
  });

  // Adjust tickets mutation
  const adjustTicketsMutation = useMutation({
    mutationFn: async (data: typeof adjustmentData) => {
      // First check if user has tickets for this cycle
      const { data: existing } = await supabase
        .from('greenroom_voting_tickets')
        .select('id, tickets_remaining')
        .eq('cycle_id', selectedCycleId)
        .eq('user_id', data.user_id)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('greenroom_voting_tickets')
          .update({
            tickets_remaining: (existing.tickets_remaining || 0) + data.tickets_to_add,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('greenroom_voting_tickets')
          .insert({
            cycle_id: selectedCycleId,
            user_id: data.user_id,
            tickets_remaining: data.tickets_to_add,
            tickets_used: 0,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greenroom-ticket-stats'] });
      queryClient.invalidateQueries({ queryKey: ['greenroom-ticket-holders'] });
      toast.success('Tickets adjusted successfully');
      setIsAdjustDialogOpen(false);
      setAdjustmentData({ user_id: '', tickets_to_add: 0, reason: '' });
    },
    onError: (error: Error) => {
      toast.error(`Failed to adjust tickets: ${error.message}`);
    },
  });

  // Update cycle phase mutation
  const updatePhaseMutation = useMutation({
    mutationFn: async ({ cycleId, phase }: { cycleId: string; phase: string }) => {
      const { error } = await supabase
        .from('greenroom_cycles')
        .update({ current_phase: phase })
        .eq('id', cycleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greenroom-cycles-voting'] });
      toast.success('Cycle phase updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update phase: ${error.message}`);
    },
  });

  const selectedCycle = cycles?.find(c => c.id === selectedCycleId);
  const usagePercentage = ticketStats
    ? Math.round((ticketStats.used_tickets / Math.max(ticketStats.total_tickets, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Cycle Selector & Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <Label className="text-xs text-muted-gray mb-1 block">Select Cycle</Label>
          <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-[250px] bg-gray-800 border-muted-gray">
              <SelectValue placeholder="Select a cycle" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-muted-gray">
              {cycles?.map((cycle) => (
                <SelectItem key={cycle.id} value={cycle.id}>
                  {cycle.name} ({cycle.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCycle && (
          <div className="flex gap-2">
            {selectedCycle.current_phase !== 'voting' && (
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => updatePhaseMutation.mutate({ cycleId: selectedCycleId, phase: 'voting' })}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Voting
              </Button>
            )}
            {selectedCycle.current_phase === 'voting' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => updatePhaseMutation.mutate({ cycleId: selectedCycleId, phase: 'shortlisting' })}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Voting
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => updatePhaseMutation.mutate({ cycleId: selectedCycleId, phase: 'winner' })}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  End & Announce
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {selectedCycle && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-muted-gray">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <Ticket className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{ticketStats?.total_tickets || 0}</div>
                  <div className="text-xs text-muted-gray">Total Tickets</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-muted-gray">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600/20 rounded-lg">
                  <Vote className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{ticketStats?.used_tickets || 0}</div>
                  <div className="text-xs text-muted-gray">Tickets Used</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-muted-gray">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600/20 rounded-lg">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{ticketStats?.unique_voters || 0}</div>
                  <div className="text-xs text-muted-gray">Unique Voters</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-muted-gray">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-600/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{usagePercentage}%</div>
                  <div className="text-xs text-muted-gray">Usage Rate</div>
                </div>
              </div>
              <Progress value={usagePercentage} className="mt-2 h-1" />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vote Distribution */}
        <Card className="bg-gray-900 border-muted-gray">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Vote Distribution
            </CardTitle>
            <CardDescription>Current vote counts by project</CardDescription>
          </CardHeader>
          <CardContent>
            {voteDistribution?.length === 0 ? (
              <p className="text-muted-gray text-center py-8">No votes yet</p>
            ) : (
              <div className="space-y-3">
                {voteDistribution?.slice(0, 10).map((project, idx) => (
                  <div key={project.id} className="flex items-center gap-3">
                    <span className="text-muted-gray text-sm w-6">{idx + 1}.</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {project.title}
                        </span>
                        <Badge className="bg-emerald-600">{project.votes}</Badge>
                      </div>
                      <Progress
                        value={(project.votes / (voteDistribution[0]?.votes || 1)) * 100}
                        className="mt-1 h-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket Holders */}
        <Card className="bg-gray-900 border-muted-gray">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Ticket className="h-5 w-5 text-blue-500" />
                Ticket Holders
              </CardTitle>
              <CardDescription>Users with voting tickets</CardDescription>
            </div>
            <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-4 w-4 mr-1" />
                  Adjust
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-muted-gray">
                <DialogHeader>
                  <DialogTitle>Adjust User Tickets</DialogTitle>
                  <DialogDescription>
                    Add or remove tickets for a specific user
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label>User ID</Label>
                    <Input
                      placeholder="Enter user ID"
                      value={adjustmentData.user_id}
                      onChange={(e) => setAdjustmentData({ ...adjustmentData, user_id: e.target.value })}
                      className="bg-gray-800 border-muted-gray"
                    />
                  </div>
                  <div>
                    <Label>Tickets to Add/Remove</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 3 or -1"
                      value={adjustmentData.tickets_to_add}
                      onChange={(e) => setAdjustmentData({ ...adjustmentData, tickets_to_add: parseInt(e.target.value) || 0 })}
                      className="bg-gray-800 border-muted-gray"
                    />
                    <p className="text-xs text-muted-gray mt-1">Use negative numbers to remove tickets</p>
                  </div>
                  <div>
                    <Label>Reason (optional)</Label>
                    <Input
                      placeholder="Why are you adjusting?"
                      value={adjustmentData.reason}
                      onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                      className="bg-gray-800 border-muted-gray"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => adjustTicketsMutation.mutate(adjustmentData)}
                    disabled={!adjustmentData.user_id || adjustTicketsMutation.isPending}
                  >
                    {adjustTicketsMutation.isPending ? 'Adjusting...' : 'Apply Adjustment'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {holdersLoading ? (
              <p className="text-muted-gray text-center py-8">Loading...</p>
            ) : ticketHolders?.length === 0 ? (
              <p className="text-muted-gray text-center py-8">No tickets issued yet</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {ticketHolders?.map((holder) => (
                  <div key={holder.id} className="flex items-center justify-between py-2 border-b border-muted-gray/20 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{holder.profile?.display_name || holder.user_id.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm text-emerald-500">{holder.tickets_remaining || 0}</span>
                        <span className="text-muted-gray text-xs"> remaining</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-blue-500">{holder.tickets_used || 0}</span>
                        <span className="text-muted-gray text-xs"> used</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RoundsTab;
