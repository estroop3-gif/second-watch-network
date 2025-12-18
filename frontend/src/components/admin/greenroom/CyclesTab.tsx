/**
 * Cycles Management Tab
 * Admin interface for creating, editing, and managing Green Room cycles
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreVertical,
  Edit,
  Archive,
  Play,
  Pause,
  Trash2,
  Calendar,
  Users,
  Vote,
  Eye
} from 'lucide-react';

interface Cycle {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'voting' | 'completed' | 'archived';
  current_phase: string | null;
  submission_start: string | null;
  submission_end: string | null;
  voting_start: string | null;
  voting_end: string | null;
  max_submissions_per_user: number;
  tickets_per_user: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-600',
  active: 'bg-emerald-600',
  voting: 'bg-blue-600',
  completed: 'bg-purple-600',
  archived: 'bg-gray-500',
};

const phaseColors: Record<string, string> = {
  submission: 'bg-yellow-600',
  shortlisting: 'bg-orange-600',
  voting: 'bg-blue-600',
  winner: 'bg-purple-600',
  development: 'bg-emerald-600',
};

const CyclesTab = () => {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    submission_start: '',
    submission_end: '',
    voting_start: '',
    voting_end: '',
    max_submissions_per_user: 1,
    tickets_per_user: 3,
  });

  // Fetch all cycles
  const { data: cycles, isLoading } = useQuery({
    queryKey: ['greenroom-cycles-admin'],
    queryFn: async () => {
      const data = await api.listGreenroomCycles();
      return data as Cycle[];
    },
  });

  // Create cycle mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await api.createGreenroomCycle({
        name: data.name,
        description: data.description || null,
        submission_start: data.submission_start || null,
        submission_end: data.submission_end || null,
        voting_start: data.voting_start || null,
        voting_end: data.voting_end || null,
        max_submissions_per_user: data.max_submissions_per_user,
        tickets_per_user: data.tickets_per_user,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greenroom-cycles-admin'] });
      queryClient.invalidateQueries({ queryKey: ['greenroom-admin-stats'] });
      toast.success('Cycle created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create cycle: ${error.message}`);
    },
  });

  // Update cycle mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Cycle> }) => {
      await api.updateGreenroomCycle(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greenroom-cycles-admin'] });
      queryClient.invalidateQueries({ queryKey: ['greenroom-active-cycle'] });
      toast.success('Cycle updated successfully');
      setEditingCycle(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update cycle: ${error.message}`);
    },
  });

  // Delete cycle mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteGreenroomCycle(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greenroom-cycles-admin'] });
      queryClient.invalidateQueries({ queryKey: ['greenroom-admin-stats'] });
      toast.success('Cycle deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete cycle: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      submission_start: '',
      submission_end: '',
      voting_start: '',
      voting_end: '',
      max_submissions_per_user: 1,
      tickets_per_user: 3,
    });
  };

  const handleEdit = (cycle: Cycle) => {
    setEditingCycle(cycle);
    setFormData({
      name: cycle.name,
      description: cycle.description || '',
      submission_start: cycle.submission_start?.slice(0, 16) || '',
      submission_end: cycle.submission_end?.slice(0, 16) || '',
      voting_start: cycle.voting_start?.slice(0, 16) || '',
      voting_end: cycle.voting_end?.slice(0, 16) || '',
      max_submissions_per_user: cycle.max_submissions_per_user,
      tickets_per_user: cycle.tickets_per_user,
    });
  };

  const handleStatusChange = (cycleId: string, newStatus: Cycle['status']) => {
    updateMutation.mutate({ id: cycleId, data: { status: newStatus } });
  };

  const handlePhaseChange = (cycleId: string, newPhase: string) => {
    updateMutation.mutate({ id: cycleId, data: { current_phase: newPhase } });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCycle) {
      updateMutation.mutate({
        id: editingCycle.id,
        data: {
          name: formData.name,
          description: formData.description || null,
          submission_start: formData.submission_start || null,
          submission_end: formData.submission_end || null,
          voting_start: formData.voting_start || null,
          voting_end: formData.voting_end || null,
          max_submissions_per_user: formData.max_submissions_per_user,
          tickets_per_user: formData.tickets_per_user,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading">Cycles Management</h2>
          <p className="text-muted-gray text-sm">Create and manage Green Room voting cycles</p>
        </div>
        <Dialog open={isCreateDialogOpen || !!editingCycle} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingCycle(null);
            resetForm();
          } else {
            setIsCreateDialogOpen(true);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              New Cycle
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-muted-gray max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingCycle ? 'Edit Cycle' : 'Create New Cycle'}</DialogTitle>
                <DialogDescription>
                  {editingCycle
                    ? 'Update the cycle details below'
                    : 'Set up a new voting cycle for the Green Room'
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Cycle Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Winter 2025 Cycle"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="bg-gray-800 border-muted-gray"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the theme or focus of this cycle..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="bg-gray-800 border-muted-gray"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="submission_start">Submission Start</Label>
                    <Input
                      id="submission_start"
                      type="datetime-local"
                      value={formData.submission_start}
                      onChange={(e) => setFormData({ ...formData, submission_start: e.target.value })}
                      className="bg-gray-800 border-muted-gray"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="submission_end">Submission End</Label>
                    <Input
                      id="submission_end"
                      type="datetime-local"
                      value={formData.submission_end}
                      onChange={(e) => setFormData({ ...formData, submission_end: e.target.value })}
                      className="bg-gray-800 border-muted-gray"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="voting_start">Voting Start</Label>
                    <Input
                      id="voting_start"
                      type="datetime-local"
                      value={formData.voting_start}
                      onChange={(e) => setFormData({ ...formData, voting_start: e.target.value })}
                      className="bg-gray-800 border-muted-gray"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="voting_end">Voting End</Label>
                    <Input
                      id="voting_end"
                      type="datetime-local"
                      value={formData.voting_end}
                      onChange={(e) => setFormData({ ...formData, voting_end: e.target.value })}
                      className="bg-gray-800 border-muted-gray"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="max_submissions">Max Submissions per User</Label>
                    <Input
                      id="max_submissions"
                      type="number"
                      min={1}
                      max={10}
                      value={formData.max_submissions_per_user}
                      onChange={(e) => setFormData({ ...formData, max_submissions_per_user: parseInt(e.target.value) })}
                      className="bg-gray-800 border-muted-gray"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tickets">Voting Tickets per User</Label>
                    <Input
                      id="tickets"
                      type="number"
                      min={1}
                      max={20}
                      value={formData.tickets_per_user}
                      onChange={(e) => setFormData({ ...formData, tickets_per_user: parseInt(e.target.value) })}
                      className="bg-gray-800 border-muted-gray"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingCycle(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingCycle ? 'Update Cycle' : 'Create Cycle'
                  }
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cycles Table */}
      <Card className="bg-gray-900 border-muted-gray">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray hover:bg-transparent">
                <TableHead>Cycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Voting</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-gray">
                    Loading cycles...
                  </TableCell>
                </TableRow>
              ) : cycles?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-gray">
                    No cycles yet. Create your first cycle to get started.
                  </TableCell>
                </TableRow>
              ) : (
                cycles?.map((cycle) => (
                  <TableRow key={cycle.id} className="border-muted-gray">
                    <TableCell>
                      <div>
                        <div className="font-medium">{cycle.name}</div>
                        {cycle.description && (
                          <div className="text-xs text-muted-gray truncate max-w-[200px]">
                            {cycle.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={cycle.status}
                        onValueChange={(value) => handleStatusChange(cycle.id, value as Cycle['status'])}
                      >
                        <SelectTrigger className="w-[120px] h-8 bg-transparent border-none">
                          <Badge className={`${statusColors[cycle.status]} capitalize`}>
                            {cycle.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-muted-gray">
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="voting">Voting</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={cycle.current_phase || 'submission'}
                        onValueChange={(value) => handlePhaseChange(cycle.id, value)}
                      >
                        <SelectTrigger className="w-[130px] h-8 bg-transparent border-none">
                          <Badge className={`${phaseColors[cycle.current_phase || 'submission']} capitalize`}>
                            {cycle.current_phase || 'submission'}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-muted-gray">
                          <SelectItem value="submission">Submission</SelectItem>
                          <SelectItem value="shortlisting">Shortlisting</SelectItem>
                          <SelectItem value="voting">Voting</SelectItem>
                          <SelectItem value="winner">Winner</SelectItem>
                          <SelectItem value="development">Development</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{formatDate(cycle.submission_start)}</div>
                        <div className="text-muted-gray">to {formatDate(cycle.submission_end)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{formatDate(cycle.voting_start)}</div>
                        <div className="text-muted-gray">to {formatDate(cycle.voting_end)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-gray" />
                          <span>{cycle.max_submissions_per_user} subs</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-gray">
                          <Vote className="h-3 w-3" />
                          <span>{cycle.tickets_per_user} tickets</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-gray-800 border-muted-gray">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-muted-gray" />
                          <DropdownMenuItem onClick={() => handleEdit(cycle)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Submissions
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-muted-gray" />
                          {cycle.status === 'draft' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(cycle.id, 'active')}>
                              <Play className="h-4 w-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          {cycle.status === 'active' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(cycle.id, 'voting')}>
                              <Vote className="h-4 w-4 mr-2" />
                              Start Voting
                            </DropdownMenuItem>
                          )}
                          {(cycle.status === 'active' || cycle.status === 'voting') && (
                            <DropdownMenuItem onClick={() => handleStatusChange(cycle.id, 'draft')}>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleStatusChange(cycle.id, 'archived')}>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-muted-gray" />
                          <DropdownMenuItem
                            className="text-red-500 focus:text-red-500"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this cycle? This action cannot be undone.')) {
                                deleteMutation.mutate(cycle.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CyclesTab;
