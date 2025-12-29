import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Star, StarOff, Power, PowerOff, Loader2, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const PAGE_SIZE = 25;

const CollabsAdminTab = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [featuredFilter, setFeaturedFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-community-collabs', page, search, statusFilter, featuredFilter],
    queryFn: () => api.listCollabsAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: search || undefined,
      is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
      is_featured: featuredFilter === 'all' ? undefined : featuredFilter === 'featured',
    }),
  });

  const collabs = data?.collabs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const featureMutation = useMutation({
    mutationFn: ({ collabId, isFeatured }: { collabId: string; isFeatured: boolean }) =>
      api.featureCollabAdmin(collabId, isFeatured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-collabs'] });
      toast.success('Collab updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update collab');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (collabId: string) => api.deactivateCollabAdmin(collabId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-collabs'] });
      toast.success('Collab deactivated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deactivate collab');
    },
  });

  const bulkDeactivateMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeactivateCollabsAdmin(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-collabs'] });
      toast.success(`Deactivated ${data.deactivated_count} collabs`);
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deactivate collabs');
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === collabs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(collabs.map(c => c.id));
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'job': 'bg-blue-500/20 text-blue-400',
      'collaboration': 'bg-green-500/20 text-green-400',
      'gig': 'bg-purple-500/20 text-purple-400',
      'volunteer': 'bg-yellow-500/20 text-yellow-400',
    };
    return colors[type] || 'bg-zinc-500/20 text-zinc-400';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-xl font-semibold text-white">Community Collabs</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search collabs..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10 w-64 bg-zinc-800 border-zinc-700"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}>
            <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={featuredFilter} onValueChange={(v) => {
            setFeaturedFilter(v);
            setPage(1);
          }}>
            <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Featured" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="regular">Not Featured</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-zinc-800 rounded-lg">
          <span className="text-sm text-zinc-400">
            {selectedIds.length} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Deactivate ${selectedIds.length} collabs?`)) {
                bulkDeactivateMutation.mutate(selectedIds);
              }
            }}
            disabled={bulkDeactivateMutation.isPending}
          >
            {bulkDeactivateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Deactivate Selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Clear Selection
          </Button>
        </div>
      )}

      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === collabs.length && collabs.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="text-zinc-400">Title</TableHead>
              <TableHead className="text-zinc-400">Type</TableHead>
              <TableHead className="text-zinc-400">Posted By</TableHead>
              <TableHead className="text-zinc-400">Created</TableHead>
              <TableHead className="text-zinc-400 text-center">Status</TableHead>
              <TableHead className="text-zinc-400 text-center">Featured</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collabs.map((collab) => (
              <TableRow key={collab.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(collab.id)}
                    onCheckedChange={() => toggleSelect(collab.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-white max-w-xs truncate">
                  {collab.title}
                </TableCell>
                <TableCell>
                  <Badge className={getTypeBadge(collab.type)}>
                    {collab.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-400">
                  {collab.profiles?.full_name || collab.profiles?.username || 'Unknown'}
                </TableCell>
                <TableCell className="text-zinc-400">
                  {formatDistanceToNow(new Date(collab.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-center">
                  {collab.is_active ? (
                    <Badge variant="outline" className="border-green-500 text-green-500">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-zinc-500 text-zinc-500">
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {collab.is_featured && (
                    <Star className="h-4 w-4 text-yellow-500 mx-auto fill-yellow-500" />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => featureMutation.mutate({
                        collabId: collab.id,
                        isFeatured: !collab.is_featured
                      })}
                      title={collab.is_featured ? 'Unfeature' : 'Feature'}
                    >
                      {collab.is_featured ? (
                        <StarOff className="h-4 w-4" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                    </Button>
                    {collab.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Deactivate this collab?')) {
                            deactivateMutation.mutate(collab.id);
                          }
                        }}
                        title="Deactivate"
                      >
                        <PowerOff className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          Showing {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, total)} of {total}
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
          <span className="text-sm text-zinc-400">
            Page {page} of {totalPages}
          </span>
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

export default CollabsAdminTab;
