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
  Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Topic {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  thread_count?: number;
}

const TopicsTab = () => {
  const queryClient = useQueryClient();
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: '',
    is_active: true,
  });

  const { data: topics, isLoading } = useQuery({
    queryKey: ['admin-community-topics'],
    queryFn: () => api.listCommunityTopicsAdmin(),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.createCommunityTopicAdmin(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-topics'] });
      toast.success('Topic created');
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create topic');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Topic> }) =>
      api.updateCommunityTopicAdmin(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-topics'] });
      toast.success('Topic updated');
      setEditingTopic(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update topic');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCommunityTopicAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-topics'] });
      toast.success('Topic deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete topic');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderCommunityTopicsAdmin(orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-topics'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: '',
      is_active: true,
    });
  };

  const handleEdit = (topic: Topic) => {
    setEditingTopic(topic);
    setFormData({
      name: topic.name,
      slug: topic.slug,
      description: topic.description || '',
      icon: topic.icon || '',
      is_active: topic.is_active,
    });
  };

  const handleSave = () => {
    if (editingTopic) {
      updateMutation.mutate({ id: editingTopic.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0 || !topics) return;
    const newOrder = [...topics];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMutation.mutate(newOrder.map(t => t.id));
  };

  const moveDown = (index: number) => {
    if (!topics || index === topics.length - 1) return;
    const newOrder = [...topics];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate(newOrder.map(t => t.id));
  };

  const toggleActive = (topic: Topic) => {
    updateMutation.mutate({ id: topic.id, data: { is_active: !topic.is_active } });
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
        <h2 className="text-xl font-semibold text-white">Community Topics</h2>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Topic
        </Button>
      </div>

      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400 w-12">Order</TableHead>
              <TableHead className="text-zinc-400">Name</TableHead>
              <TableHead className="text-zinc-400">Slug</TableHead>
              <TableHead className="text-zinc-400 text-center">Threads</TableHead>
              <TableHead className="text-zinc-400 text-center">Active</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics?.map((topic, index) => (
              <TableRow key={topic.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => moveDown(index)}
                      disabled={index === topics.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-white">
                  {topic.icon && <span className="mr-2">{topic.icon}</span>}
                  {topic.name}
                </TableCell>
                <TableCell className="text-zinc-400">{topic.slug}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{topic.thread_count || 0}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={topic.is_active}
                    onCheckedChange={() => toggleActive(topic)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(topic)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this topic?')) {
                          deleteMutation.mutate(topic.id);
                        }
                      }}
                      disabled={topic.thread_count && topic.thread_count > 0}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingTopic} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingTopic(null);
          resetForm();
        }
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingTopic ? 'Edit Topic' : 'Create Topic'}
            </DialogTitle>
            <DialogDescription>
              {editingTopic ? 'Update the topic details' : 'Add a new community topic'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                placeholder="topic-slug"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="icon">Icon (emoji)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                placeholder="e.g. 🎬"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setEditingTopic(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTopic ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TopicsTab;
