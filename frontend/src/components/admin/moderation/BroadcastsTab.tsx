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
import { Switch } from '@/components/ui/switch';
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
  Plus, Pencil, Trash2, Loader2, Radio
} from 'lucide-react';
import { format } from 'date-fns';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  broadcast_type: string;
  target_audience: string;
  is_active: boolean;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

const BroadcastsTab = () => {
  const queryClient = useQueryClient();
  const [editingBroadcast, setEditingBroadcast] = useState<Broadcast | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    broadcast_type: 'info',
    target_audience: 'all',
    expires_at: '',
  });

  const { data: broadcasts, isLoading } = useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: () => api.listBroadcastsAdmin(),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.createBroadcastAdmin({
      ...data,
      expires_at: data.expires_at || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-broadcasts'] });
      toast.success('Broadcast created');
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create broadcast');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Broadcast> }) =>
      api.updateBroadcastAdmin(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-broadcasts'] });
      toast.success('Broadcast updated');
      setEditingBroadcast(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update broadcast');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBroadcastAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-broadcasts'] });
      toast.success('Broadcast deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete broadcast');
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      broadcast_type: 'info',
      target_audience: 'all',
      expires_at: '',
    });
  };

  const handleEdit = (broadcast: Broadcast) => {
    setEditingBroadcast(broadcast);
    setFormData({
      title: broadcast.title,
      message: broadcast.message,
      broadcast_type: broadcast.broadcast_type,
      target_audience: broadcast.target_audience,
      expires_at: broadcast.expires_at ? broadcast.expires_at.split('T')[0] : '',
    });
  };

  const handleSave = () => {
    if (editingBroadcast) {
      updateMutation.mutate({
        id: editingBroadcast.id,
        data: {
          ...formData,
          expires_at: formData.expires_at || undefined,
        }
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleActive = (broadcast: Broadcast) => {
    updateMutation.mutate({
      id: broadcast.id,
      data: { is_active: !broadcast.is_active }
    });
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'info': 'bg-blue-500/20 text-blue-400',
      'warning': 'bg-yellow-500/20 text-yellow-400',
      'urgent': 'bg-red-500/20 text-red-400',
      'maintenance': 'bg-purple-500/20 text-purple-400',
    };
    return colors[type] || 'bg-zinc-500/20 text-zinc-400';
  };

  const getAudienceBadge = (audience: string) => {
    const labels: Record<string, string> = {
      'all': 'Everyone',
      'filmmakers': 'Filmmakers',
      'partners': 'Partners',
      'order_members': 'Order Members',
      'premium': 'Premium',
    };
    return labels[audience] || audience;
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
        <h2 className="text-xl font-semibold text-white">Platform Broadcasts</h2>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Broadcast
        </Button>
      </div>

      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400">Title</TableHead>
              <TableHead className="text-zinc-400">Type</TableHead>
              <TableHead className="text-zinc-400">Audience</TableHead>
              <TableHead className="text-zinc-400">Expires</TableHead>
              <TableHead className="text-zinc-400 text-center">Active</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!broadcasts || broadcasts.length === 0) ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-zinc-400">
                  <Radio className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No broadcasts yet</p>
                </TableCell>
              </TableRow>
            ) : (
              broadcasts.map((broadcast: Broadcast) => (
                <TableRow key={broadcast.id} className="border-zinc-800 hover:bg-zinc-900/50">
                  <TableCell className="font-medium text-white max-w-xs">
                    <p className="truncate">{broadcast.title}</p>
                    <p className="text-sm text-zinc-400 truncate">{broadcast.message}</p>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTypeBadge(broadcast.broadcast_type)}>
                      {broadcast.broadcast_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {getAudienceBadge(broadcast.target_audience)}
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {broadcast.expires_at
                      ? format(new Date(broadcast.expires_at), 'MMM d, yyyy')
                      : 'Never'
                    }
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={broadcast.is_active}
                      onCheckedChange={() => toggleActive(broadcast)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(broadcast)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this broadcast?')) {
                            deleteMutation.mutate(broadcast.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingBroadcast} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingBroadcast(null);
          resetForm();
        }
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingBroadcast ? 'Edit Broadcast' : 'Create Broadcast'}
            </DialogTitle>
            <DialogDescription>
              {editingBroadcast ? 'Update the broadcast details' : 'Create a new platform-wide announcement'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                placeholder="Announcement title"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                placeholder="Announcement message..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.broadcast_type}
                  onValueChange={(v) => setFormData({ ...formData, broadcast_type: v })}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="audience">Target Audience</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(v) => setFormData({ ...formData, target_audience: v })}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="filmmakers">Filmmakers</SelectItem>
                    <SelectItem value="partners">Partners</SelectItem>
                    <SelectItem value="order_members">Order Members</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="expires">Expires (optional)</Label>
              <Input
                id="expires"
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setEditingBroadcast(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending || !formData.title || !formData.message}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingBroadcast ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BroadcastsTab;
