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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  VolumeX, Volume2, Loader2, Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MutedUser {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  is_muted: boolean;
  muted_until: string | null;
  mute_reason: string;
}

const UserModerationTab = () => {
  const queryClient = useQueryClient();
  const [muteDialogOpen, setMuteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [muteReason, setMuteReason] = useState('');
  const [muteDuration, setMuteDuration] = useState('24');

  const { data: mutedUsers, isLoading } = useQuery({
    queryKey: ['admin-active-mutes'],
    queryFn: () => api.listActiveMutes(),
  });

  const unmuteMutation = useMutation({
    mutationFn: (userId: string) => api.unmuteUserAdmin(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-active-mutes'] });
      toast.success('User unmuted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unmute user');
    },
  });

  const muteMutation = useMutation({
    mutationFn: ({ userId, reason, duration }: { userId: string; reason: string; duration: number }) =>
      api.muteUserAdmin(userId, { reason, duration_hours: duration }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-active-mutes'] });
      toast.success('User muted');
      setMuteDialogOpen(false);
      setMuteReason('');
      setSelectedUserId('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to mute user');
    },
  });

  const handleMute = () => {
    if (!selectedUserId || !muteReason) {
      toast.error('Please provide user ID and reason');
      return;
    }
    muteMutation.mutate({
      userId: selectedUserId,
      reason: muteReason,
      duration: parseInt(muteDuration),
    });
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
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">User Moderation</h2>
        <Button onClick={() => setMuteDialogOpen(true)}>
          <VolumeX className="h-4 w-4 mr-2" />
          Mute User
        </Button>
      </div>

      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400">User</TableHead>
              <TableHead className="text-zinc-400">Reason</TableHead>
              <TableHead className="text-zinc-400">Expires</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!mutedUsers || mutedUsers.length === 0) ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-zinc-400">
                  No muted users
                </TableCell>
              </TableRow>
            ) : (
              mutedUsers.map((user: MutedUser) => (
                <TableRow key={user.id} className="border-zinc-800 hover:bg-zinc-900/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback>
                          {(user.full_name || user.username || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-white">{user.full_name || user.username}</p>
                        <p className="text-sm text-zinc-400">@{user.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-300 max-w-xs truncate">
                    {user.mute_reason || 'No reason provided'}
                  </TableCell>
                  <TableCell>
                    {user.muted_until ? (
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Clock className="h-4 w-4" />
                        {formatDistanceToNow(new Date(user.muted_until), { addSuffix: true })}
                      </div>
                    ) : (
                      <Badge variant="outline" className="border-red-500 text-red-500">
                        Permanent
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unmuteMutation.mutate(user.id)}
                      disabled={unmuteMutation.isPending}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Unmute
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mute User Dialog */}
      <Dialog open={muteDialogOpen} onOpenChange={setMuteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Mute User</DialogTitle>
            <DialogDescription>
              Prevent a user from posting in the community
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                placeholder="Enter user UUID"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={muteReason}
                onChange={(e) => setMuteReason(e.target.value)}
                placeholder="Reason for muting this user..."
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select value={muteDuration} onValueChange={setMuteDuration}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                  <SelectItem value="720">30 days</SelectItem>
                  <SelectItem value="0">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMuteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMute}
              disabled={muteMutation.isPending || !selectedUserId || !muteReason}
              variant="destructive"
            >
              {muteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mute User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserModerationTab;
