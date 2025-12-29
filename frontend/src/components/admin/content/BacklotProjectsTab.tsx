import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Search,
  Trash2,
  Pencil,
  Loader2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Users,
  FolderOpen,
  Clapperboard,
  MoreVertical,
  ExternalLink,
  FileText
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BacklotProject {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  project_type: string | null;
  status: string;
  logline: string | null;
  genre: string | null;
  visibility: string;
  created_at: string;
  owner: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  credit_count: number;
  file_count: number;
}

const PAGE_SIZE = 25;

const statusColors: Record<string, string> = {
  draft: 'bg-zinc-600',
  active: 'bg-green-600',
  complete: 'bg-blue-600',
  archived: 'bg-zinc-500',
};

const BacklotProjectsTab = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-backlot-projects', page, search, statusFilter, typeFilter],
    queryFn: () => api.listBacklotProjectsAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: search || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      project_type: typeFilter !== 'all' ? typeFilter : undefined,
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-backlot-stats'],
    queryFn: () => api.getBacklotStats(),
  });

  const { data: projectDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['admin-backlot-project', selectedProject],
    queryFn: () => api.getBacklotProjectAdmin(selectedProject!),
    enabled: !!selectedProject,
  });

  const projects = data?.projects || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBacklotProjectAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-backlot-projects'] });
      queryClient.invalidateQueries({ queryKey: ['admin-backlot-stats'] });
      toast.success('Project deleted');
      setSelectedProject(null);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete project'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateBacklotProjectStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-backlot-projects'] });
      queryClient.invalidateQueries({ queryKey: ['admin-backlot-stats'] });
      toast.success('Status updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update status'),
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total_projects || 0}</div>
            <p className="text-sm text-zinc-400">Total Projects</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{stats?.by_status?.active || 0}</div>
            <p className="text-sm text-zinc-400">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total_credits || 0}</div>
            <p className="text-sm text-zinc-400">Total Credits</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total_files || 0}</div>
            <p className="text-sm text-zinc-400">Total Files</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 bg-zinc-800 border-zinc-700"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="feature">Feature</SelectItem>
            <SelectItem value="short">Short</SelectItem>
            <SelectItem value="documentary">Documentary</SelectItem>
            <SelectItem value="series">Series</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Table */}
      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400">Project</TableHead>
              <TableHead className="text-zinc-400">Owner</TableHead>
              <TableHead className="text-zinc-400">Type</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="text-zinc-400">Team</TableHead>
              <TableHead className="text-zinc-400">Files</TableHead>
              <TableHead className="text-zinc-400">Created</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-zinc-500">
                  No projects found
                </TableCell>
              </TableRow>
            ) : projects.map((project: BacklotProject) => (
              <TableRow key={project.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell className="font-medium text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center">
                      <Clapperboard className="h-5 w-5 text-zinc-500" />
                    </div>
                    <div>
                      <p className="truncate max-w-xs">{project.title}</p>
                      {project.logline && (
                        <p className="text-xs text-zinc-500 truncate max-w-xs">{project.logline}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {project.owner ? (
                    <Link to={`/profile/${project.owner.username}`} className="flex items-center gap-2 hover:text-accent-yellow">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={project.owner.avatar_url || ''} />
                        <AvatarFallback>{project.owner.full_name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{project.owner.full_name || project.owner.username}</span>
                    </Link>
                  ) : (
                    <span className="text-zinc-500">Unknown</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {project.project_type || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={`${statusColors[project.status] || 'bg-zinc-600'} capitalize`}>
                    {project.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <Users className="h-4 w-4" />
                    {project.credit_count}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <FolderOpen className="h-4 w-4" />
                    {project.file_count}
                  </div>
                </TableCell>
                <TableCell className="text-zinc-400">
                  {format(new Date(project.created_at), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedProject(project.id)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/backlot/${project.id}`} target="_blank">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open in Backlot
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'active' })}>
                        Set Active
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'complete' })}>
                        Set Complete
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'archived' })}>
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem className="text-red-500" onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Project
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{project.title}" and all its credits and files.
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(project.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          Showing {total > 0 ? ((page - 1) * PAGE_SIZE) + 1 : 0} - {Math.min(page * PAGE_SIZE, total)} of {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-zinc-400">Page {page} of {totalPages || 1}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Project Details Sheet */}
      <Sheet open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{projectDetails?.title || 'Project Details'}</SheetTitle>
            <SheetDescription>{projectDetails?.logline || 'No logline'}</SheetDescription>
          </SheetHeader>

          {detailsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : projectDetails ? (
            <div className="mt-6 space-y-6">
              {/* Project Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-zinc-400">Status</p>
                    <Badge className={`${statusColors[projectDetails.status] || 'bg-zinc-600'} capitalize mt-1`}>
                      {projectDetails.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Type</p>
                    <p className="capitalize">{projectDetails.project_type || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Genre</p>
                    <p>{projectDetails.genre || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Visibility</p>
                    <p className="capitalize">{projectDetails.visibility || 'Private'}</p>
                  </div>
                </div>

                {projectDetails.description && (
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">Description</p>
                    <p className="text-sm">{projectDetails.description}</p>
                  </div>
                )}
              </div>

              {/* Owner */}
              {projectDetails.owner && (
                <div>
                  <p className="text-sm text-zinc-400 mb-2">Owner</p>
                  <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg">
                    <Avatar>
                      <AvatarImage src={projectDetails.owner.avatar_url || ''} />
                      <AvatarFallback>{projectDetails.owner.full_name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{projectDetails.owner.full_name || projectDetails.owner.username}</p>
                      <p className="text-sm text-zinc-400">{projectDetails.owner.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Credits */}
              <div>
                <p className="text-sm text-zinc-400 mb-2">Credits ({projectDetails.credits?.length || 0})</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {projectDetails.credits?.map((credit: any) => (
                    <div key={credit.id} className="flex items-center justify-between p-2 bg-zinc-900 rounded">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={credit.user?.avatar_url || ''} />
                          <AvatarFallback>{credit.user?.full_name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{credit.user?.full_name || credit.user?.username}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">{credit.role || credit.department}</Badge>
                    </div>
                  ))}
                  {(!projectDetails.credits || projectDetails.credits.length === 0) && (
                    <p className="text-sm text-zinc-500 text-center py-4">No credits</p>
                  )}
                </div>
              </div>

              {/* Recent Files */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-zinc-400">Recent Files ({projectDetails.file_count || 0})</p>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {projectDetails.recent_files?.map((file: any) => (
                    <div key={file.id} className="flex items-center gap-2 p-2 bg-zinc-900 rounded">
                      <FileText className="h-4 w-4 text-zinc-500" />
                      <span className="text-sm truncate flex-1">{file.file_name}</span>
                      <span className="text-xs text-zinc-500">{file.file_type}</span>
                    </div>
                  ))}
                  {(!projectDetails.recent_files || projectDetails.recent_files.length === 0) && (
                    <p className="text-sm text-zinc-500 text-center py-4">No files</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-zinc-800">
                <Button variant="outline" asChild className="flex-1">
                  <Link to={`/backlot/${projectDetails.id}`} target="_blank">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Backlot
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this project and all associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(projectDetails.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default BacklotProjectsTab;
