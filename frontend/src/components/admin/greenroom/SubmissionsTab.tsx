/**
 * Submissions & Review Tab
 * Admin interface for reviewing and moderating Green Room project submissions
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MoreVertical,
  Eye,
  CheckCircle,
  XCircle,
  Star,
  Flag,
  MessageSquare,
  ExternalLink,
  Filter
} from 'lucide-react';

interface Project {
  id: string;
  title: string;
  logline: string | null;
  genre: string | null;
  format: string | null;
  status: 'pending' | 'approved' | 'shortlisted' | 'rejected' | 'flagged';
  created_at: string;
  cycle_id: string;
  user_id: string;
  admin_notes: string | null;
  is_featured: boolean;
  cycle?: {
    name: string;
  };
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-600',
  approved: 'bg-emerald-600',
  shortlisted: 'bg-blue-600',
  rejected: 'bg-red-600',
  flagged: 'bg-orange-600',
};

const SubmissionsTab = () => {
  const queryClient = useQueryClient();
  const [selectedCycleId, setSelectedCycleId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  // Fetch cycles for filter dropdown
  const { data: cycles } = useQuery({
    queryKey: ['greenroom-cycles-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('greenroom_cycles')
        .select('id, name, status')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch projects with filters
  const { data: projects, isLoading } = useQuery({
    queryKey: ['greenroom-projects-admin', selectedCycleId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('greenroom_projects')
        .select(`
          *,
          cycle:greenroom_cycles(name),
          profile:profiles(display_name, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (selectedCycleId !== 'all') {
        query = query.eq('cycle_id', selectedCycleId);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Project[];
    },
  });

  // Update project status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('greenroom_projects')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greenroom-projects-admin'] });
      queryClient.invalidateQueries({ queryKey: ['greenroom-admin-stats'] });
      toast.success('Project status updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  // Update admin notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('greenroom_projects')
        .update({ admin_notes: notes })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greenroom-projects-admin'] });
      toast.success('Notes saved');
      setIsNotesOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save notes: ${error.message}`);
    },
  });

  // Toggle featured mutation
  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, featured }: { id: string; featured: boolean }) => {
      const { error } = await supabase
        .from('greenroom_projects')
        .update({ is_featured: featured })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greenroom-projects-admin'] });
      toast.success('Project featured status updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const handleViewDetails = (project: Project) => {
    setSelectedProject(project);
    setIsDetailsOpen(true);
  };

  const handleOpenNotes = (project: Project) => {
    setSelectedProject(project);
    setAdminNotes(project.admin_notes || '');
    setIsNotesOpen(true);
  };

  const handleSaveNotes = () => {
    if (selectedProject) {
      updateNotesMutation.mutate({ id: selectedProject.id, notes: adminNotes });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Count projects by status
  const statusCounts = projects?.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex gap-4">
          <div>
            <Label className="text-xs text-muted-gray mb-1 block">Cycle</Label>
            <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
              <SelectTrigger className="w-[200px] bg-gray-800 border-muted-gray">
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

          <div>
            <Label className="text-xs text-muted-gray mb-1 block">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-gray-800 border-muted-gray">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-muted-gray">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-2">
          <Badge variant="outline" className="border-yellow-600 text-yellow-500">
            {statusCounts.pending || 0} Pending
          </Badge>
          <Badge variant="outline" className="border-emerald-600 text-emerald-500">
            {statusCounts.approved || 0} Approved
          </Badge>
          <Badge variant="outline" className="border-blue-600 text-blue-500">
            {statusCounts.shortlisted || 0} Shortlisted
          </Badge>
          <Badge variant="outline" className="border-orange-600 text-orange-500">
            {statusCounts.flagged || 0} Flagged
          </Badge>
        </div>
      </div>

      {/* Projects Table */}
      <Card className="bg-gray-900 border-muted-gray">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray hover:bg-transparent">
                <TableHead>Project</TableHead>
                <TableHead>Submitter</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Featured</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-gray">
                    Loading submissions...
                  </TableCell>
                </TableRow>
              ) : projects?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-gray">
                    No submissions found.
                  </TableCell>
                </TableRow>
              ) : (
                projects?.map((project) => (
                  <TableRow key={project.id} className="border-muted-gray">
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {project.title}
                          {project.admin_notes && (
                            <MessageSquare className="h-3 w-3 text-muted-gray" />
                          )}
                        </div>
                        <div className="text-xs text-muted-gray truncate max-w-[250px]">
                          {project.logline || 'No logline'}
                        </div>
                        <div className="flex gap-2 mt-1">
                          {project.genre && (
                            <Badge variant="outline" className="text-xs">{project.genre}</Badge>
                          )}
                          {project.format && (
                            <Badge variant="outline" className="text-xs">{project.format}</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={project.profile?.avatar_url || ''} />
                          <AvatarFallback className="bg-emerald-600 text-xs">
                            {getInitials(project.profile?.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {project.profile?.display_name || 'Unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{project.cycle?.name || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={project.status}
                        onValueChange={(value) => updateStatusMutation.mutate({ id: project.id, status: value })}
                      >
                        <SelectTrigger className="w-[130px] h-8 bg-transparent border-none">
                          <Badge className={`${statusColors[project.status]} capitalize`}>
                            {project.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-muted-gray">
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="shortlisted">Shortlisted</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="flagged">Flagged</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFeaturedMutation.mutate({
                          id: project.id,
                          featured: !project.is_featured
                        })}
                        className={project.is_featured ? 'text-yellow-500' : 'text-muted-gray'}
                      >
                        <Star className={`h-4 w-4 ${project.is_featured ? 'fill-yellow-500' : ''}`} />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-gray">
                        {format(new Date(project.created_at), 'MMM d, yyyy')}
                      </span>
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
                          <DropdownMenuItem onClick={() => handleViewDetails(project)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenNotes(project)}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Admin Notes
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-muted-gray" />
                          <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'approved' })}>
                            <CheckCircle className="h-4 w-4 mr-2 text-emerald-500" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'shortlisted' })}>
                            <Star className="h-4 w-4 mr-2 text-blue-500" />
                            Shortlist
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'rejected' })}>
                            <XCircle className="h-4 w-4 mr-2 text-red-500" />
                            Reject
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'flagged' })}>
                            <Flag className="h-4 w-4 mr-2 text-orange-500" />
                            Flag for Review
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

      {/* Project Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="bg-gray-900 border-muted-gray max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProject?.title}</DialogTitle>
            <DialogDescription>
              Submitted by {selectedProject?.profile?.display_name || 'Unknown'}
            </DialogDescription>
          </DialogHeader>

          {selectedProject && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-gray">Logline</Label>
                <p className="text-sm mt-1">{selectedProject.logline || 'No logline provided'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-gray">Genre</Label>
                  <p className="text-sm mt-1">{selectedProject.genre || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-gray">Format</Label>
                  <p className="text-sm mt-1">{selectedProject.format || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-gray">Status</Label>
                  <div className="mt-1">
                    <Badge className={`${statusColors[selectedProject.status]} capitalize`}>
                      {selectedProject.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-gray">Cycle</Label>
                  <p className="text-sm mt-1">{selectedProject.cycle?.name || '—'}</p>
                </div>
              </div>

              {selectedProject.admin_notes && (
                <div>
                  <Label className="text-xs text-muted-gray">Admin Notes</Label>
                  <p className="text-sm mt-1 p-3 bg-gray-800 rounded-md">
                    {selectedProject.admin_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              Close
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setIsDetailsOpen(false);
                if (selectedProject) handleOpenNotes(selectedProject);
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Add Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Notes Dialog */}
      <Dialog open={isNotesOpen} onOpenChange={setIsNotesOpen}>
        <DialogContent className="bg-gray-900 border-muted-gray">
          <DialogHeader>
            <DialogTitle>Admin Notes</DialogTitle>
            <DialogDescription>
              Add internal notes for "{selectedProject?.title}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              placeholder="Add notes about this submission..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="bg-gray-800 border-muted-gray min-h-[150px]"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNotesOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSaveNotes}
              disabled={updateNotesMutation.isPending}
            >
              {updateNotesMutation.isPending ? 'Saving...' : 'Save Notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubmissionsTab;
