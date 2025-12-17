/**
 * UpdatesView - Post and manage project updates/announcements
 * Enhanced with visible_to_roles and read/unread tracking
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Megaphone,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Globe,
  Lock,
  Loader2,
  Flag,
  Calendar,
  Bell,
  Eye,
  EyeOff,
  Users,
  Circle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUpdates, BACKLOT_ROLES } from '@/hooks/backlot';
import { BacklotProjectUpdate, ProjectUpdateInput, BacklotUpdateType } from '@/types/backlot';
import { BacklotProjectUpdateWithRead } from '@/hooks/backlot/useUpdates';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface UpdatesViewProps {
  projectId: string;
  canEdit: boolean;
}

const TYPE_CONFIG: Record<BacklotUpdateType, { label: string; icon: React.ElementType; color: string }> = {
  announcement: { label: 'Announcement', icon: Megaphone, color: 'text-accent-yellow' },
  milestone: { label: 'Milestone', icon: Flag, color: 'text-green-400' },
  schedule_change: { label: 'Schedule Change', icon: Calendar, color: 'text-orange-400' },
  general: { label: 'General', icon: Bell, color: 'text-blue-400' },
};

const UpdateCard: React.FC<{
  update: BacklotProjectUpdateWithRead;
  canEdit: boolean;
  onEdit: (update: BacklotProjectUpdateWithRead) => void;
  onDelete: (id: string) => void;
  onTogglePublic: (id: string, isPublic: boolean) => void;
  onMarkRead: (id: string) => void;
}> = ({ update, canEdit, onEdit, onDelete, onTogglePublic, onMarkRead }) => {
  const typeConfig = TYPE_CONFIG[update.type];
  const TypeIcon = typeConfig.icon;
  const visibleRoles = update.visible_to_roles || [];

  // Auto-mark as read when rendered (if not already read)
  React.useEffect(() => {
    if (!update.has_read) {
      onMarkRead(update.id);
    }
  }, [update.id, update.has_read, onMarkRead]);

  return (
    <div className={cn(
      "bg-charcoal-black/50 border rounded-lg p-4 hover:border-muted-gray/40 transition-colors",
      update.has_read ? "border-muted-gray/20" : "border-accent-yellow/30 bg-accent-yellow/5"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          {/* Unread indicator */}
          {!update.has_read && (
            <div className="mt-1">
              <Circle className="w-2 h-2 fill-accent-yellow text-accent-yellow" />
            </div>
          )}
          <Avatar className="w-10 h-10">
            <AvatarImage src={update.author?.avatar_url || ''} />
            <AvatarFallback>
              {(update.author?.display_name || 'U').slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-bone-white">
                {update.author?.display_name || update.author?.full_name || 'Team Member'}
              </span>
              <Badge variant="outline" className={cn('text-xs border-muted-gray/30', typeConfig.color)}>
                <TypeIcon className="w-3 h-3 mr-1" />
                {typeConfig.label}
              </Badge>
              {update.is_public ? (
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                  <Globe className="w-3 h-3 mr-1" />
                  Public
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-muted-gray/30 text-muted-gray">
                  <Lock className="w-3 h-3 mr-1" />
                  Team Only
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-gray">
                {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
              </span>
              {visibleRoles.length > 0 && (
                <span className="text-xs text-muted-gray flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {visibleRoles.map(r => BACKLOT_ROLES.find(br => br.value === r)?.label || r).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(update)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTogglePublic(update.id, !update.is_public)}>
                {update.is_public ? (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Make Private
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 mr-2" />
                    Make Public
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-400" onClick={() => onDelete(update.id)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <div className="pl-13">
        <h4 className="font-medium text-bone-white mb-2">{update.title}</h4>
        <p className="text-sm text-muted-gray whitespace-pre-wrap">{update.content}</p>

        {/* Attachments */}
        {update.attachments && update.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {update.attachments.map((attachment, i) => (
              <a
                key={i}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-yellow hover:underline bg-accent-yellow/10 px-2 py-1 rounded"
              >
                {attachment.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface FormDataWithRoles extends ProjectUpdateInput {
  visible_to_roles: string[];
}

const UpdatesView: React.FC<UpdatesViewProps> = ({ projectId, canEdit }) => {
  const [typeFilter, setTypeFilter] = useState<BacklotUpdateType | 'all'>('all');
  const { updates, isLoading, createUpdate, updateUpdate, deleteUpdate, togglePublic, markAsRead } = useUpdates({
    projectId,
    type: typeFilter,
  });

  const [showForm, setShowForm] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<BacklotProjectUpdateWithRead | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state with visible_to_roles
  const [formData, setFormData] = useState<FormDataWithRoles>({
    title: '',
    content: '',
    type: 'general',
    is_public: false,
    visible_to_roles: [],
  });

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      type: 'general',
      is_public: false,
      visible_to_roles: [],
    });
  };

  const handleOpenForm = (update?: BacklotProjectUpdateWithRead) => {
    if (update) {
      setEditingUpdate(update);
      setFormData({
        title: update.title,
        content: update.content,
        type: update.type,
        is_public: update.is_public,
        visible_to_roles: update.visible_to_roles || [],
      });
    } else {
      setEditingUpdate(null);
      resetForm();
    }
    setShowForm(true);
  };

  const handleMarkRead = React.useCallback((updateId: string) => {
    markAsRead.mutate(updateId);
  }, [markAsRead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingUpdate) {
        await updateUpdate.mutateAsync({
          id: editingUpdate.id,
          ...formData,
        });
      } else {
        await createUpdate.mutateAsync({
          projectId,
          ...formData,
        });
      }
      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error('Failed to save update:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this update?')) {
      await deleteUpdate.mutateAsync(id);
    }
  };

  const handleTogglePublic = async (id: string, isPublic: boolean) => {
    await togglePublic.mutateAsync({ id, isPublic });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Updates</h2>
          <p className="text-sm text-muted-gray">Post announcements and updates for your team</p>
        </div>
        <div className="flex gap-3">
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as BacklotUpdateType | 'all')}
          >
            <SelectTrigger className="w-40 bg-charcoal-black/50 border-muted-gray/30">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TYPE_CONFIG).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit && (
            <Button
              onClick={() => handleOpenForm()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Post Update
            </Button>
          )}
        </div>
      </div>

      {/* Updates List */}
      {updates.length > 0 ? (
        <div className="space-y-4">
          {updates.map((update) => (
            <UpdateCard
              key={update.id}
              update={update}
              canEdit={canEdit}
              onEdit={handleOpenForm}
              onDelete={handleDelete}
              onTogglePublic={handleTogglePublic}
              onMarkRead={handleMarkRead}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <Megaphone className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No updates yet</h3>
          <p className="text-muted-gray mb-4">Post updates to keep your team informed.</p>
          {canEdit && (
            <Button
              onClick={() => handleOpenForm()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Post Update
            </Button>
          )}
        </div>
      )}

      {/* Update Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUpdate ? 'Edit Update' : 'Post Update'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Update title..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as BacklotUpdateType })}
                disabled={isSubmitting}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                placeholder="Write your update..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                disabled={isSubmitting}
                rows={6}
              />
            </div>

            {/* Visible to Roles */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Visible to Roles
              </Label>
              <p className="text-xs text-muted-gray mb-2">
                Select which roles can see this update. Leave empty for all team members.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {BACKLOT_ROLES.map((role) => (
                  <div key={role.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`role-${role.value}`}
                      checked={formData.visible_to_roles.includes(role.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            visible_to_roles: [...formData.visible_to_roles, role.value],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            visible_to_roles: formData.visible_to_roles.filter(r => r !== role.value),
                          });
                        }
                      }}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor={`role-${role.value}`} className="text-sm cursor-pointer">
                      {role.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border border-muted-gray/20 rounded-lg px-4">
              <div>
                <Label htmlFor="is_public" className="text-bone-white">
                  Make Public
                </Label>
                <p className="text-xs text-muted-gray">
                  Public updates appear on your project's public page
                </p>
              </div>
              <Switch
                id="is_public"
                checked={formData.is_public}
                onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.title.trim() || !formData.content.trim()}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {editingUpdate ? 'Saving...' : 'Posting...'}
                  </>
                ) : editingUpdate ? (
                  'Save Changes'
                ) : (
                  'Post Update'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UpdatesView;
