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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ListTree,
  Star,
  StarOff
} from 'lucide-react';

interface Production {
  id: string;
  title: string | null;
  name: string | null;
  production_type: string | null;
  created_at: string;
  created_by_user: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  credit_count: number;
}

interface Credit {
  id: string;
  position: string;
  production_date: string | null;
  is_featured: boolean;
  user: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  production: {
    id: string;
    title: string | null;
    name: string | null;
    production_type: string | null;
  } | null;
  created_at: string;
}

const PAGE_SIZE = 25;

// Productions Sub-tab
const ProductionsSubTab = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-profile-productions', page, search],
    queryFn: () => api.listProfileProductionsAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: search || undefined,
    }),
  });

  const productions = data?.productions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProfileProductionAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profile-productions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-profile-content-stats'] });
      toast.success('Production deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete production'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search productions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 bg-zinc-800 border-zinc-700"
          />
        </div>
      </div>

      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400">Title</TableHead>
              <TableHead className="text-zinc-400">Added By</TableHead>
              <TableHead className="text-zinc-400">Type</TableHead>
              <TableHead className="text-zinc-400">Credits</TableHead>
              <TableHead className="text-zinc-400">Added</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : productions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                  No productions found
                </TableCell>
              </TableRow>
            ) : productions.map((prod: Production) => (
              <TableRow key={prod.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell className="font-medium text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                      <Clapperboard className="h-4 w-4 text-zinc-500" />
                    </div>
                    <span className="truncate max-w-xs">{prod.title || prod.name || 'Untitled'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {prod.created_by_user ? (
                    <Link to={`/profile/${prod.created_by_user.username}`} className="flex items-center gap-2 hover:text-accent-yellow">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={prod.created_by_user.avatar_url || ''} />
                        <AvatarFallback>{prod.created_by_user.full_name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{prod.created_by_user.full_name || prod.created_by_user.username}</span>
                    </Link>
                  ) : (
                    <span className="text-zinc-500">Unknown</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {prod.production_type || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-400">{prod.credit_count}</TableCell>
                <TableCell className="text-zinc-400">
                  {format(new Date(prod.created_at), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Production?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this production and all associated credits.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(prod.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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

// Credits Sub-tab
const CreditsSubTab = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [featuredFilter, setFeaturedFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-profile-credits', page, search, featuredFilter],
    queryFn: () => api.listProfileCreditsAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: search || undefined,
      is_featured: featuredFilter !== 'all' ? featuredFilter === 'featured' : undefined,
    }),
  });

  const credits = data?.credits || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProfileCreditAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profile-credits'] });
      queryClient.invalidateQueries({ queryKey: ['admin-profile-content-stats'] });
      toast.success('Credit deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete credit'),
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ id, is_featured }: { id: string; is_featured: boolean }) =>
      api.toggleProfileCreditFeatured(id, is_featured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profile-credits'] });
      toast.success('Credit updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update credit'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search by role..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 bg-zinc-800 border-zinc-700"
          />
        </div>
        <Button
          variant={featuredFilter === 'featured' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFeaturedFilter(f => f === 'featured' ? 'all' : 'featured')}
        >
          <Star className="h-4 w-4 mr-1" />
          Featured Only
        </Button>
      </div>

      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400">User</TableHead>
              <TableHead className="text-zinc-400">Role</TableHead>
              <TableHead className="text-zinc-400">Production</TableHead>
              <TableHead className="text-zinc-400">Year</TableHead>
              <TableHead className="text-zinc-400">Featured</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : credits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                  No credits found
                </TableCell>
              </TableRow>
            ) : credits.map((credit: Credit) => (
              <TableRow key={credit.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell>
                  {credit.user ? (
                    <Link to={`/profile/${credit.user.username}`} className="flex items-center gap-2 hover:text-accent-yellow">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={credit.user.avatar_url || ''} />
                        <AvatarFallback>{credit.user.full_name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{credit.user.full_name || credit.user.username}</span>
                    </Link>
                  ) : (
                    <span className="text-zinc-500">Unknown</span>
                  )}
                </TableCell>
                <TableCell className="font-medium text-white">{credit.position}</TableCell>
                <TableCell className="text-zinc-400 max-w-xs truncate">
                  {credit.production?.title || credit.production?.name || 'Unknown'}
                </TableCell>
                <TableCell className="text-zinc-400">
                  {credit.production_date ? format(new Date(credit.production_date), 'yyyy') : '-'}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFeaturedMutation.mutate({
                      id: credit.id,
                      is_featured: !credit.is_featured
                    })}
                  >
                    {credit.is_featured ? (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <StarOff className="h-4 w-4 text-zinc-500" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Credit?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove this credit from the user's profile.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(credit.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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

// Main Profile Content Tab
const ProfileContentTab = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-profile-content-stats'],
    queryFn: () => api.getProfileContentStats(),
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total_productions || 0}</div>
            <p className="text-sm text-zinc-400">Productions</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total_credits || 0}</div>
            <p className="text-sm text-zinc-400">Credits</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">{stats?.featured_credits || 0}</div>
            <p className="text-sm text-zinc-400">Featured</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.users_with_credits || 0}</div>
            <p className="text-sm text-zinc-400">Users with Credits</p>
          </CardContent>
        </Card>
      </div>

      {/* Sub-tabs */}
      <Tabs defaultValue="productions" className="w-full">
        <TabsList className="bg-zinc-900 border-zinc-800">
          <TabsTrigger value="productions" className="data-[state=active]:bg-zinc-800 gap-2">
            <Clapperboard className="h-4 w-4" />
            Productions
          </TabsTrigger>
          <TabsTrigger value="credits" className="data-[state=active]:bg-zinc-800 gap-2">
            <ListTree className="h-4 w-4" />
            Credits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="productions" className="mt-6">
          <ProductionsSubTab />
        </TabsContent>

        <TabsContent value="credits" className="mt-6">
          <CreditsSubTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfileContentTab;
