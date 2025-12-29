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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Film,
  ListVideo,
  Calendar,
  Plus,
  Search,
  Trash2,
  Pencil,
  Loader2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Clock,
  Star,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FastChannelContent {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string;
  duration_seconds: number;
  content_type: string;
  genre: string[] | null;
  rating: string | null;
  year: number | null;
  director: string | null;
  is_active: boolean;
  created_at: string;
}

interface Playlist {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  is_featured: boolean;
  sort_order: number;
  item_count: number;
  created_at: string;
}

interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_live: boolean;
  stream_url: string | null;
}

const PAGE_SIZE = 20;

// Content Library Component
const ContentLibrary = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-fast-channel-content', page, search, typeFilter, activeFilter],
    queryFn: () => api.listFastChannelContent({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: search || undefined,
      content_type: typeFilter !== 'all' ? typeFilter : undefined,
      is_active: activeFilter !== 'all' ? activeFilter === 'active' : undefined,
    }),
  });

  const content = data?.content || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFastChannelContent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fast-channel-content'] });
      toast.success('Content deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete content'),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, is_active }: { ids: string[]; is_active: boolean }) =>
      api.bulkUpdateFastChannelContent(ids, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fast-channel-content'] });
      toast.success('Content updated');
      setSelectedIds([]);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update content'),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === content.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(content.map(c => c.id));
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search content..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 bg-zinc-800 border-zinc-700"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="film">Films</SelectItem>
              <SelectItem value="short">Shorts</SelectItem>
              <SelectItem value="episode">Episodes</SelectItem>
              <SelectItem value="trailer">Trailers</SelectItem>
              <SelectItem value="promo">Promos</SelectItem>
              <SelectItem value="interstitial">Interstitials</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={(v) => { setActiveFilter(v); setPage(1); }}>
            <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ContentUploadDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-zinc-800 rounded-lg">
          <span className="text-sm text-zinc-400">{selectedIds.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, is_active: true })}>
            Activate
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, is_active: false })}>
            Deactivate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            Clear
          </Button>
        </div>
      )}

      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === content.length && content.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="text-zinc-400">Title</TableHead>
              <TableHead className="text-zinc-400">Type</TableHead>
              <TableHead className="text-zinc-400">Duration</TableHead>
              <TableHead className="text-zinc-400">Year</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="text-zinc-400">Added</TableHead>
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
            ) : content.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-zinc-500">
                  No content found
                </TableCell>
              </TableRow>
            ) : content.map((item: FastChannelContent) => (
              <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-white">
                  <div className="flex items-center gap-3">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt="" className="w-16 h-9 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-9 bg-zinc-700 rounded flex items-center justify-center">
                        <Film className="h-4 w-4 text-zinc-500" />
                      </div>
                    )}
                    <div>
                      <p className="truncate max-w-xs">{item.title}</p>
                      {item.director && <p className="text-xs text-zinc-500">Dir: {item.director}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{item.content_type}</Badge>
                </TableCell>
                <TableCell className="text-zinc-400">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {formatDuration(item.duration_seconds)}
                </TableCell>
                <TableCell className="text-zinc-400">{item.year || '-'}</TableCell>
                <TableCell>
                  <Badge variant={item.is_active ? "default" : "secondary"} className={item.is_active ? "bg-green-600" : ""}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-400">
                  {format(new Date(item.created_at), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-500"
                        onClick={() => {
                          if (confirm('Delete this content?')) {
                            deleteMutation.mutate(item.id);
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
    </div>
  );
};

// Content Upload Dialog
const ContentUploadDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    video_url: '',
    thumbnail_url: '',
    duration_seconds: 0,
    content_type: 'film',
    director: '',
    year: new Date().getFullYear(),
    rating: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createFastChannelContent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fast-channel-content'] });
      toast.success('Content added');
      onOpenChange(false);
      setFormData({
        title: '', description: '', video_url: '', thumbnail_url: '',
        duration_seconds: 0, content_type: 'film', director: '',
        year: new Date().getFullYear(), rating: '',
      });
    },
    onError: (error: any) => toast.error(error.message || 'Failed to add content'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Content
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Fast Channel Content</DialogTitle>
          <DialogDescription>Add new content to the Fast Channel library.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Video URL *</label>
            <Input
              value={formData.video_url}
              onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
              placeholder="https://..."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Content Type *</label>
              <Select
                value={formData.content_type}
                onValueChange={(v) => setFormData({ ...formData, content_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="film">Film</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="episode">Episode</SelectItem>
                  <SelectItem value="trailer">Trailer</SelectItem>
                  <SelectItem value="promo">Promo</SelectItem>
                  <SelectItem value="interstitial">Interstitial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Duration (seconds) *</label>
              <Input
                type="number"
                value={formData.duration_seconds}
                onChange={(e) => setFormData({ ...formData, duration_seconds: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Director</label>
              <Input
                value={formData.director}
                onChange={(e) => setFormData({ ...formData, director: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Year</label>
              <Input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Thumbnail URL</label>
            <Input
              value={formData.thumbnail_url}
              onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Content
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Playlists Component
const PlaylistsManager = () => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: playlists, isLoading } = useQuery({
    queryKey: ['admin-fast-channel-playlists'],
    queryFn: () => api.listFastChannelPlaylists(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFastChannelPlaylist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fast-channel-playlists'] });
      toast.success('Playlist deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete playlist'),
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ id, is_featured }: { id: string; is_featured: boolean }) =>
      api.updateFastChannelPlaylist(id, { is_featured }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fast-channel-playlists'] });
      toast.success('Playlist updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update playlist'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">VOD Playlists</h3>
        <PlaylistCreateDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists?.map((playlist: Playlist) => (
            <Card key={playlist.id} className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {playlist.name}
                      {playlist.is_featured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {playlist.item_count} items
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => toggleFeaturedMutation.mutate({
                          id: playlist.id,
                          is_featured: !playlist.is_featured
                        })}
                      >
                        <Star className="h-4 w-4 mr-2" />
                        {playlist.is_featured ? 'Unfeature' : 'Feature'}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-500"
                        onClick={() => {
                          if (confirm('Delete this playlist?')) {
                            deleteMutation.mutate(playlist.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400 line-clamp-2">
                  {playlist.description || 'No description'}
                </p>
              </CardContent>
            </Card>
          ))}

          {(!playlists || playlists.length === 0) && (
            <div className="col-span-full text-center py-12 text-zinc-500">
              No playlists yet. Create one to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Playlist Create Dialog
const PlaylistCreateDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    thumbnail_url: '',
    is_featured: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createFastChannelPlaylist(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fast-channel-playlists'] });
      toast.success('Playlist created');
      onOpenChange(false);
      setFormData({ name: '', slug: '', description: '', thumbnail_url: '', is_featured: false });
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create playlist'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    createMutation.mutate({ ...formData, slug });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Playlist
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Playlist</DialogTitle>
          <DialogDescription>Create a new VOD playlist for organizing content.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Slug</label>
            <Input
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="auto-generated-from-name"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Thumbnail URL</label>
            <Input
              value={formData.thumbnail_url}
              onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.is_featured}
              onCheckedChange={(checked) => setFormData({ ...formData, is_featured: !!checked })}
            />
            <label className="text-sm">Featured playlist</label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Playlist
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Channel Schedule Component (simplified)
const ChannelSchedule = () => {
  const { data: channels, isLoading } = useQuery({
    queryKey: ['admin-fast-channels'],
    queryFn: () => api.listFastChannels(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const mainChannel = channels?.[0];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Linear Schedule</h3>
          <p className="text-sm text-zinc-400">
            {mainChannel?.name || 'Second Watch Network'} - {mainChannel?.is_live ? 'Live' : 'Offline'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mainChannel?.is_live ? (
            <Badge className="bg-red-600">
              <Play className="h-3 w-3 mr-1" />
              Live
            </Badge>
          ) : (
            <Badge variant="secondary">
              <Pause className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          )}
        </div>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6">
          <div className="text-center py-12 text-zinc-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">Schedule programming coming soon</p>
            <p className="text-sm">Drag and drop content to build your 24/7 schedule</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Fast Channel Tab
const FastChannelTab = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Fast Channel Management</h2>
          <p className="text-sm text-zinc-400">Manage linear streaming and VOD content</p>
        </div>
      </div>

      <Tabs defaultValue="library" className="w-full">
        <TabsList className="bg-zinc-900 border-zinc-800">
          <TabsTrigger value="library" className="data-[state=active]:bg-zinc-800 gap-2">
            <Film className="h-4 w-4" />
            Content Library
          </TabsTrigger>
          <TabsTrigger value="schedule" className="data-[state=active]:bg-zinc-800 gap-2">
            <Calendar className="h-4 w-4" />
            Linear Schedule
          </TabsTrigger>
          <TabsTrigger value="playlists" className="data-[state=active]:bg-zinc-800 gap-2">
            <ListVideo className="h-4 w-4" />
            Playlists
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-6">
          <ContentLibrary />
        </TabsContent>

        <TabsContent value="schedule" className="mt-6">
          <ChannelSchedule />
        </TabsContent>

        <TabsContent value="playlists" className="mt-6">
          <PlaylistsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FastChannelTab;
