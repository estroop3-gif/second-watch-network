/**
 * Featured & Moderation Tab
 * Admin interface for featuring projects and content moderation
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Star,
  Flag,
  Shield,
  Eye,
  EyeOff,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Award
} from 'lucide-react';

interface Project {
  id: string;
  title: string;
  logline: string | null;
  status: string;
  is_featured: boolean;
  is_staff_pick: boolean;
  is_suspended: boolean;
  created_at: string;
  user_id: string;
  admin_notes: string | null;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  cycle?: {
    name: string;
  };
}

const FeaturedTab = () => {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('featured');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'unsuspend' | 'flag'>('suspend');
  const [actionReason, setActionReason] = useState('');

  // Helper to fetch all projects from all cycles
  const fetchAllProjects = async (): Promise<any[]> => {
    const cycles = await api.listGreenroomCycles();
    const allProjects: any[] = [];

    for (const cycle of (cycles || [])) {
      const projects = await api.listGreenroomProjects(cycle.id);
      if (projects) {
        allProjects.push(...projects.map((p: any) => ({ ...p, cycle: { name: cycle.name } })));
      }
    }

    return allProjects;
  };

  // Fetch featured projects
  const { data: featuredProjects, isLoading: featuredLoading } = useQuery({
    queryKey: ['greenroom-featured-projects'],
    queryFn: async () => {
      const allProjects = await fetchAllProjects();
      return allProjects.filter((p: any) => p.is_featured || p.is_staff_pick) as Project[];
    },
  });

  // Fetch flagged/suspended projects
  const { data: flaggedProjects, isLoading: flaggedLoading } = useQuery({
    queryKey: ['greenroom-flagged-projects'],
    queryFn: async () => {
      const allProjects = await fetchAllProjects();
      return allProjects.filter((p: any) => p.status === 'flagged' || p.is_suspended) as Project[];
    },
  });

  // Fetch all approved projects for featuring
  const { data: approvedProjects, isLoading: approvedLoading } = useQuery({
    queryKey: ['greenroom-approved-projects'],
    queryFn: async () => {
      const allProjects = await fetchAllProjects();
      return allProjects.filter((p: any) =>
        ['approved', 'shortlisted'].includes(p.status) && !p.is_suspended
      ) as Project[];
    },
  });

  // Toggle featured mutation
  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: 'is_featured' | 'is_staff_pick'; value: boolean }) => {
      const isFeatured = field === 'is_featured' ? value : false;
      const isStaffPick = field === 'is_staff_pick' ? value : false;
      await api.toggleGreenroomProjectFeatured(id, isFeatured, isStaffPick);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greenroom-featured-projects'] });
      queryClient.invalidateQueries({ queryKey: ['greenroom-approved-projects'] });
      toast.success('Project updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Suspend/unsuspend mutation
  const suspendMutation = useMutation({
    mutationFn: async ({ id, suspended, reason }: { id: string; suspended: boolean; reason?: string }) => {
      // Using the admin suspend endpoint
      const params = new URLSearchParams({
        suspended: suspended.toString(),
      });
      if (reason) params.append('reason', reason);

      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/greenroom/admin/projects/${id}/suspend?${params}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${api.getToken()}`,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greenroom-flagged-projects'] });
      queryClient.invalidateQueries({ queryKey: ['greenroom-approved-projects'] });
      toast.success('Project moderation action applied');
      setIsActionDialogOpen(false);
      setActionReason('');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Clear flag mutation
  const clearFlagMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.updateGreenroomProjectStatus(id, 'approved');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greenroom-flagged-projects'] });
      toast.success('Flag cleared');
    },
    onError: (error: Error) => {
      toast.error(`Failed to clear flag: ${error.message}`);
    },
  });

  const handleAction = (project: Project, type: 'suspend' | 'unsuspend' | 'flag') => {
    setSelectedProject(project);
    setActionType(type);
    setIsActionDialogOpen(true);
  };

  const handleConfirmAction = () => {
    if (!selectedProject) return;

    if (actionType === 'suspend') {
      suspendMutation.mutate({ id: selectedProject.id, suspended: true, reason: actionReason });
    } else if (actionType === 'unsuspend') {
      suspendMutation.mutate({ id: selectedProject.id, suspended: false });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="bg-gray-800">
          <TabsTrigger value="featured" className="data-[state=active]:bg-emerald-600">
            <Star className="h-4 w-4 mr-2" />
            Featured
          </TabsTrigger>
          <TabsTrigger value="moderation" className="data-[state=active]:bg-orange-600">
            <Shield className="h-4 w-4 mr-2" />
            Moderation Queue
          </TabsTrigger>
          <TabsTrigger value="browse" className="data-[state=active]:bg-blue-600">
            <Eye className="h-4 w-4 mr-2" />
            Browse Projects
          </TabsTrigger>
        </TabsList>

        {/* Featured Projects */}
        <TabsContent value="featured" className="mt-4">
          <Card className="bg-gray-900 border-muted-gray">
            <CardHeader>
              <CardTitle>Featured & Staff Picks</CardTitle>
              <CardDescription>Projects highlighted on the Green Room homepage</CardDescription>
            </CardHeader>
            <CardContent>
              {featuredLoading ? (
                <p className="text-center py-8 text-muted-gray">Loading...</p>
              ) : featuredProjects?.length === 0 ? (
                <p className="text-center py-8 text-muted-gray">No featured projects yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-muted-gray hover:bg-transparent">
                      <TableHead>Project</TableHead>
                      <TableHead>Submitter</TableHead>
                      <TableHead>Featured</TableHead>
                      <TableHead>Staff Pick</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {featuredProjects?.map((project) => (
                      <TableRow key={project.id} className="border-muted-gray">
                        <TableCell>
                          <div>
                            <div className="font-medium">{project.title}</div>
                            <div className="text-xs text-muted-gray">{project.cycle?.name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={project.profile?.avatar_url || ''} />
                              <AvatarFallback className="text-xs bg-emerald-600">
                                {getInitials(project.profile?.display_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{project.profile?.display_name || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFeaturedMutation.mutate({
                              id: project.id,
                              field: 'is_featured',
                              value: !project.is_featured
                            })}
                            className={project.is_featured ? 'text-yellow-500' : 'text-muted-gray'}
                          >
                            <Star className={`h-4 w-4 ${project.is_featured ? 'fill-yellow-500' : ''}`} />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFeaturedMutation.mutate({
                              id: project.id,
                              field: 'is_staff_pick',
                              value: !project.is_staff_pick
                            })}
                            className={project.is_staff_pick ? 'text-purple-500' : 'text-muted-gray'}
                          >
                            <Award className={`h-4 w-4 ${project.is_staff_pick ? 'fill-purple-500' : ''}`} />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              toggleFeaturedMutation.mutate({ id: project.id, field: 'is_featured', value: false });
                              toggleFeaturedMutation.mutate({ id: project.id, field: 'is_staff_pick', value: false });
                            }}
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Moderation Queue */}
        <TabsContent value="moderation" className="mt-4">
          <Card className="bg-gray-900 border-muted-gray">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Moderation Queue
              </CardTitle>
              <CardDescription>Flagged and suspended projects requiring review</CardDescription>
            </CardHeader>
            <CardContent>
              {flaggedLoading ? (
                <p className="text-center py-8 text-muted-gray">Loading...</p>
              ) : flaggedProjects?.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                  <p className="text-muted-gray">No items in moderation queue</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-muted-gray hover:bg-transparent">
                      <TableHead>Project</TableHead>
                      <TableHead>Submitter</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flaggedProjects?.map((project) => (
                      <TableRow key={project.id} className="border-muted-gray">
                        <TableCell>
                          <div>
                            <div className="font-medium">{project.title}</div>
                            <div className="text-xs text-muted-gray truncate max-w-[200px]">
                              {project.logline}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{project.profile?.display_name || 'Unknown'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {project.status === 'flagged' && (
                              <Badge className="bg-orange-600">Flagged</Badge>
                            )}
                            {project.is_suspended && (
                              <Badge className="bg-red-600">Suspended</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-gray truncate max-w-[150px] block">
                            {project.admin_notes || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {project.is_suspended ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-emerald-600 text-emerald-500"
                                onClick={() => handleAction(project, 'unsuspend')}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Restore
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => clearFlagMutation.mutate(project.id)}
                                >
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAction(project, 'suspend')}
                                >
                                  <EyeOff className="h-4 w-4 text-red-500" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Browse All Projects */}
        <TabsContent value="browse" className="mt-4">
          <Card className="bg-gray-900 border-muted-gray">
            <CardHeader>
              <CardTitle>All Approved Projects</CardTitle>
              <CardDescription>Select projects to feature or mark as staff picks</CardDescription>
            </CardHeader>
            <CardContent>
              {approvedLoading ? (
                <p className="text-center py-8 text-muted-gray">Loading...</p>
              ) : approvedProjects?.length === 0 ? (
                <p className="text-center py-8 text-muted-gray">No approved projects</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-muted-gray hover:bg-transparent">
                      <TableHead>Project</TableHead>
                      <TableHead>Submitter</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Feature</TableHead>
                      <TableHead>Staff Pick</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedProjects?.map((project) => (
                      <TableRow key={project.id} className="border-muted-gray">
                        <TableCell>
                          <div className="font-medium">{project.title}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{project.profile?.display_name || 'Unknown'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-gray">{project.cycle?.name || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFeaturedMutation.mutate({
                              id: project.id,
                              field: 'is_featured',
                              value: !project.is_featured
                            })}
                            className={project.is_featured ? 'text-yellow-500' : 'text-muted-gray'}
                          >
                            <Star className={`h-4 w-4 ${project.is_featured ? 'fill-yellow-500' : ''}`} />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFeaturedMutation.mutate({
                              id: project.id,
                              field: 'is_staff_pick',
                              value: !project.is_staff_pick
                            })}
                            className={project.is_staff_pick ? 'text-purple-500' : 'text-muted-gray'}
                          >
                            <Award className={`h-4 w-4 ${project.is_staff_pick ? 'fill-purple-500' : ''}`} />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-800 border-muted-gray">
                              <DropdownMenuItem onClick={() => handleAction(project, 'suspend')}>
                                <EyeOff className="h-4 w-4 mr-2 text-red-500" />
                                Suspend
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Confirmation Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="bg-gray-900 border-muted-gray">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'suspend' ? 'Suspend Project' : 'Restore Project'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'suspend'
                ? `This will hide "${selectedProject?.title}" from public view.`
                : `This will restore "${selectedProject?.title}" to public view.`
              }
            </DialogDescription>
          </DialogHeader>

          {actionType === 'suspend' && (
            <div className="space-y-4">
              <div>
                <Label>Reason for suspension</Label>
                <Textarea
                  placeholder="Explain why this project is being suspended..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="bg-gray-800 border-muted-gray"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className={actionType === 'suspend' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
              onClick={handleConfirmAction}
              disabled={suspendMutation.isPending}
            >
              {suspendMutation.isPending ? 'Processing...' : actionType === 'suspend' ? 'Suspend' : 'Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeaturedTab;
