/**
 * Members Management Tab
 * Admin interface for viewing and managing community members
 */
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Star,
  StarOff,
  MoreVertical,
  User,
  Eye,
  Shield,
  Loader2,
  Users,
  GripVertical
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const PAGE_SIZE = 25;

const roleColors: Record<string, string> = {
  admin: 'bg-red-600',
  moderator: 'bg-orange-600',
  filmmaker: 'bg-cyan-600',
  partner: 'bg-purple-600',
  premium: 'bg-yellow-600',
  free: 'bg-gray-600',
};

const MembersTab = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [featuredFilter, setFeaturedFilter] = useState<string>('all');
  const [activeView, setActiveView] = useState<'all' | 'featured'>('all');

  // Fetch all users
  const { data, isLoading } = useQuery({
    queryKey: ['admin-members', page, search, roleFilter, featuredFilter],
    queryFn: () => api.listUsersAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: search || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      is_featured: featuredFilter === 'all' ? undefined : featuredFilter === 'featured',
    }),
  });

  // Fetch featured users
  const { data: featuredUsers, isLoading: featuredLoading } = useQuery({
    queryKey: ['admin-featured-users'],
    queryFn: () => api.listFeaturedUsers(),
  });

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Feature toggle mutation
  const featureMutation = useMutation({
    mutationFn: ({ userId, isFeatured }: { userId: string; isFeatured: boolean }) =>
      api.toggleUserFeatured(userId, isFeatured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-members'] });
      queryClient.invalidateQueries({ queryKey: ['admin-featured-users'] });
      toast.success('Member updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update member');
    },
  });

  const getRoleBadges = (user: any) => {
    const badges = [];
    if (user.is_admin) badges.push({ label: 'Admin', color: roleColors.admin });
    if (user.is_moderator) badges.push({ label: 'Mod', color: roleColors.moderator });
    if (user.is_filmmaker) badges.push({ label: 'Filmmaker', color: roleColors.filmmaker });
    if (user.is_partner) badges.push({ label: 'Partner', color: roleColors.partner });
    if (user.is_premium) badges.push({ label: 'Premium', color: roleColors.premium });
    if (badges.length === 0) badges.push({ label: 'Member', color: roleColors.free });
    return badges;
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          variant={activeView === 'all' ? 'default' : 'outline'}
          onClick={() => setActiveView('all')}
          className={activeView === 'all' ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
        >
          <Users className="h-4 w-4 mr-2" />
          All Members
        </Button>
        <Button
          variant={activeView === 'featured' ? 'default' : 'outline'}
          onClick={() => setActiveView('featured')}
          className={activeView === 'featured' ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
        >
          <Star className="h-4 w-4 mr-2" />
          Featured ({featuredUsers?.length || 0})
        </Button>
      </div>

      {activeView === 'all' ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search by name, username, email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 bg-zinc-800 border-zinc-700"
              />
            </div>

            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="moderator">Moderators</SelectItem>
                <SelectItem value="filmmaker">Filmmakers</SelectItem>
                <SelectItem value="partner">Partners</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>

            <Select value={featuredFilter} onValueChange={(v) => { setFeaturedFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Featured" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="featured">Featured Only</SelectItem>
                <SelectItem value="not_featured">Not Featured</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Members Table */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Member</TableHead>
                    <TableHead className="text-zinc-400">Roles</TableHead>
                    <TableHead className="text-zinc-400">Location</TableHead>
                    <TableHead className="text-zinc-400">Joined</TableHead>
                    <TableHead className="text-zinc-400">Featured</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                        No members found
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user: any) => (
                      <TableRow key={user.id} className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.avatar_url} />
                              <AvatarFallback className="bg-cyan-900 text-cyan-200">
                                {getInitials(user.full_name || user.username)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.full_name || 'No name'}</div>
                              <div className="text-sm text-zinc-400">@{user.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {getRoleBadges(user).map((badge, idx) => (
                              <Badge key={idx} className={`${badge.color} text-white text-xs`}>
                                {badge.label}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {user.location || '—'}
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {user.created_at
                            ? formatDistanceToNow(new Date(user.created_at), { addSuffix: true })
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => featureMutation.mutate({
                              userId: user.id,
                              isFeatured: !user.is_featured
                            })}
                            disabled={featureMutation.isPending}
                            className={user.is_featured ? 'text-yellow-400 hover:text-yellow-300' : 'text-zinc-400 hover:text-yellow-400'}
                          >
                            {user.is_featured ? (
                              <Star className="h-5 w-5 fill-current" />
                            ) : (
                              <StarOff className="h-5 w-5" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-zinc-700" />
                              <DropdownMenuItem
                                onClick={() => window.open(`/profile/${user.username}`, '_blank')}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => window.open(`/admin/users?id=${user.id}`, '_blank')}
                              >
                                <User className="h-4 w-4 mr-2" />
                                Manage User
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Shield className="h-4 w-4 mr-2" />
                                Moderation History
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

          {/* Pagination */}
          {totalPages > 1 && (
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
                  className="border-zinc-700"
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
                  className="border-zinc-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Featured Members Grid */
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400" />
              Featured Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {featuredLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-400" />
              </div>
            ) : !featuredUsers?.length ? (
              <div className="text-center py-8 text-zinc-400">
                No featured members yet. Star members from the All Members view to feature them.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredUsers.map((user: any, index: number) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-4 rounded-lg bg-zinc-800 border border-zinc-700"
                  >
                    <div className="flex items-center justify-center w-6 text-zinc-500">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <span className="text-zinc-500 text-sm font-mono w-6">{index + 1}</span>
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-cyan-900 text-cyan-200">
                        {getInitials(user.full_name || user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.full_name}</div>
                      <div className="text-sm text-zinc-400 truncate">@{user.username}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => featureMutation.mutate({
                        userId: user.id,
                        isFeatured: false
                      })}
                      className="text-yellow-400 hover:text-red-400"
                    >
                      <StarOff className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MembersTab;
