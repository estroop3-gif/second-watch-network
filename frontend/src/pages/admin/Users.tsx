import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { MoreHorizontal } from 'lucide-react';
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

interface User {
  id: string;
  email: string;
  created_at: string;
  profile: {
    username: string;
    roles: string[];
    avatar_url: string;
    is_banned: boolean;
  };
}

const fetchUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.functions.invoke('get-all-users');
  if (error) {
    throw new Error(error.message);
  }
  return data;
};

const UserManagement = () => {
  const queryClient = useQueryClient();
  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
  });
  const [isRolesDialogOpen, setIsRolesDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const handleOpenRolesDialog = (user: User) => {
    setSelectedUser(user);
    setIsRolesDialogOpen(true);
  };

  const handleOpenDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      const { error } = await supabase.functions.invoke('ban-user', {
        body: { userId, ban },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, { ban }) => {
      toast.success(`User has been successfully ${ban ? 'banned' : 'unbanned'}.`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update ban status: ${error.message}`);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('User has been permanently deleted.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
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

  if (isLoading) {
    return <div className="text-center font-spray text-2xl text-accent-yellow animate-pulse">Loading Users...</div>;
  }

  if (error) {
    toast.error(`Failed to fetch users: ${error.message}`);
    return <div className="text-center text-primary-red">Error loading users.</div>;
  }

  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-12 -rotate-1">
        User <span className="font-spray text-accent-yellow">Management</span>
      </h1>
      <div className="border-2 border-muted-gray p-2 bg-charcoal-black/50">
        <Table>
          <TableHeader>
            <TableRow className="border-b-muted-gray hover:bg-charcoal-black/20">
              <TableHead className="w-[80px]">Avatar</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id} className="border-b-muted-gray hover:bg-charcoal-black/20">
                <TableCell>
                  <Avatar>
                    <AvatarImage src={user.profile?.avatar_url} />
                    <AvatarFallback>{user.email.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{user.profile?.username || 'N/A'}</div>
                  <div className="text-sm text-muted-gray">{user.email}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.profile?.roles?.map((role: string) => (
                      <Badge key={role} variant="secondary" className="bg-muted-gray text-bone-white uppercase">{role}</Badge>
                    )) || <Badge variant="outline">User</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  {user.profile?.is_banned ? (
                    <Badge variant="destructive" className="bg-primary-red text-bone-white">Banned</Badge>
                  ) : (
                    <Badge variant="default" className="bg-green-500 text-bone-white">Active</Badge>
                  )}
                </TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray text-bone-white">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem 
                        className="cursor-pointer focus:bg-muted-gray/50"
                        onSelect={() => handleOpenRolesDialog(user)}
                      >
                        Edit Roles
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer focus:bg-muted-gray/50">Reset Password</DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-muted-gray" />
                      <DropdownMenuItem 
                        className="cursor-pointer focus:bg-primary-red/20 text-primary-red focus:text-primary-red focus:bg-primary-red/30"
                        onSelect={(e) => {
                          e.preventDefault();
                          banUserMutation.mutate({ userId: user.id, ban: !user.profile?.is_banned });
                        }}
                      >
                        {user.profile?.is_banned ? 'Unban User' : 'Ban User'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer focus:bg-primary-red/20 text-primary-red focus:text-primary-red focus:bg-primary-red/30"
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
      </div>
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
    </div>
  );
};

export default UserManagement;