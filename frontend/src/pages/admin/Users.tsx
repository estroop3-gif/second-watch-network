import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoreHorizontal, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EditRolesDialog from '@/components/admin/EditRolesDialog';
import DeleteUserConfirmationDialog from '@/components/admin/DeleteUserConfirmationDialog';
import UserStatsHeader from '@/components/admin/UserStatsHeader';
import UserFilters, { FilterState } from '@/components/admin/UserFilters';
import UserDetailDrawer from '@/components/admin/UserDetailDrawer';
import BulkActionsBar from '@/components/admin/BulkActionsBar';

interface User {
  id: string;
  email: string;
  created_at: string;
  full_name?: string;
  profile: {
    username: string;
    roles: string[];
    avatar_url: string;
    is_banned: boolean;
  };
}

const PAGE_SIZES = [25, 50, 100];

const UserManagement = () => {
  const queryClient = useQueryClient();

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    roles: [],
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Dialog states
  const [isRolesDialogOpen, setIsRolesDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  // Query with filters and pagination
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', page, pageSize, filters],
    queryFn: () =>
      api.getAllUsersAdmin({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        search: filters.search || undefined,
        roles: filters.roles.length > 0 ? filters.roles.join(',') : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      }),
  });

  const users = data?.users || [];
  const totalUsers = data?.total || 0;
  const totalPages = data?.pages || 1;

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page on filter change
    setSelectedIds([]); // Clear selection on filter change
  }, []);

  const handleOpenRolesDialog = (user: User) => {
    setSelectedUser(user);
    setIsRolesDialogOpen(true);
  };

  const handleOpenDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleRowClick = (userId: string) => {
    setDetailUserId(userId);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u.id));
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      await api.banUser(userId, ban);
    },
    onSuccess: (_, { ban }) => {
      toast.success(`User has been successfully ${ban ? 'banned' : 'unbanned'}.`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-stats'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update ban status: ${error.message}`);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.deleteUser(userId);
    },
    onSuccess: () => {
      toast.success('User has been permanently deleted.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-stats'] });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to delete user: ${error.message}`);
    },
  });

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl md:text-5xl font-heading tracking-tighter">
          User <span className="text-accent-yellow">Management</span>
        </h1>
        <p className="text-muted-gray mt-1">Manage platform users, roles, and permissions</p>
      </motion.div>

      {/* Stats Header */}
      <UserStatsHeader />

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <UserFilters onFiltersChange={handleFiltersChange} initialFilters={filters} />
      </motion.div>

      {/* Results info and page size */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-gray">
          {isLoading ? (
            'Loading...'
          ) : (
            <>
              Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalUsers)} of{' '}
              <span className="text-bone-white">{totalUsers.toLocaleString()}</span> users
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-gray">Per page:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[70px] bg-charcoal-black border-muted-gray text-bone-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-charcoal-black border-muted-gray">
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={size.toString()} className="text-bone-white">
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="border-2 border-muted-gray bg-charcoal-black/50"
      >
        {isLoading ? (
          <div className="text-center py-12 text-accent-yellow animate-pulse">
            Loading users...
          </div>
        ) : error ? (
          <div className="text-center py-12 text-primary-red">
            Error loading users. Please try again.
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-muted-gray">
            No users found matching your filters.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b-muted-gray hover:bg-transparent">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedIds.length === users.length && users.length > 0}
                    onCheckedChange={handleSelectAll}
                    className="border-muted-gray data-[state=checked]:bg-accent-yellow data-[state=checked]:border-accent-yellow"
                  />
                </TableHead>
                <TableHead className="w-[60px]">Avatar</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className={`border-b-muted-gray hover:bg-muted-gray/10 cursor-pointer ${
                    selectedIds.includes(user.id) ? 'bg-accent-yellow/10' : ''
                  }`}
                  onClick={() => handleRowClick(user.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(user.id)}
                      onCheckedChange={() => handleSelectUser(user.id)}
                      className="border-muted-gray data-[state=checked]:bg-accent-yellow data-[state=checked]:border-accent-yellow"
                    />
                  </TableCell>
                  <TableCell>
                    <Avatar className="h-10 w-10 border border-muted-gray">
                      <AvatarImage src={user.profile?.avatar_url} />
                      <AvatarFallback className="bg-muted-gray text-bone-white">
                        {user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-bone-white">
                      {user.full_name || user.profile?.username || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-gray">
                      {user.profile?.username && `@${user.profile.username}`}
                    </div>
                    <div className="text-xs text-muted-gray/70">{user.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {user.profile?.roles?.slice(0, 3).map((role: string) => (
                        <Badge
                          key={role}
                          variant="outline"
                          className="text-xs border-muted-gray text-bone-white"
                        >
                          {role.replace('_', ' ')}
                        </Badge>
                      ))}
                      {user.profile?.roles?.length > 3 && (
                        <Badge variant="outline" className="text-xs border-muted-gray text-muted-gray">
                          +{user.profile.roles.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.profile?.is_banned ? (
                      <Badge variant="destructive" className="bg-primary-red text-bone-white">
                        Banned
                      </Badge>
                    ) : (
                      <Badge className="bg-green-600 text-bone-white">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-gray">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted-gray/30">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-charcoal-black border-muted-gray text-bone-white"
                      >
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          className="cursor-pointer focus:bg-muted-gray/50"
                          onSelect={() => handleRowClick(user.id)}
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer focus:bg-muted-gray/50"
                          onSelect={() => handleOpenRolesDialog(user)}
                        >
                          Edit Roles
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-muted-gray" />
                        <DropdownMenuItem
                          className="cursor-pointer focus:bg-primary-red/20 text-primary-red"
                          onSelect={(e) => {
                            e.preventDefault();
                            banUserMutation.mutate({
                              userId: user.id,
                              ban: !user.profile?.is_banned,
                            });
                          }}
                        >
                          {user.profile?.is_banned ? 'Unban User' : 'Ban User'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer focus:bg-primary-red/20 text-primary-red"
                          onSelect={() => handleOpenDeleteDialog(user)}
                        >
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="bg-charcoal-black border-muted-gray text-bone-white disabled:opacity-50"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bg-charcoal-black border-muted-gray text-bone-white disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1 px-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className={
                    page === pageNum
                      ? 'bg-accent-yellow text-charcoal-black'
                      : 'bg-charcoal-black border-muted-gray text-bone-white'
                  }
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="bg-charcoal-black border-muted-gray text-bone-white disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="bg-charcoal-black border-muted-gray text-bone-white disabled:opacity-50"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <EditRolesDialog
        user={selectedUser}
        isOpen={isRolesDialogOpen}
        onClose={() => setIsRolesDialogOpen(false)}
      />
      <DeleteUserConfirmationDialog
        user={userToDelete}
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteUserMutation.isPending}
      />

      {/* User Detail Drawer */}
      <UserDetailDrawer userId={detailUserId} onClose={() => setDetailUserId(null)} />

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
      />
    </div>
  );
};

export default UserManagement;
