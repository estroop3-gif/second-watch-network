/**
 * TaskListShareModal - Modal for managing task list sharing and members
 * For selective sharing mode, allows adding/removing specific project members
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Users,
  Globe,
  Lock,
  Search,
  UserPlus,
  Trash2,
  Check,
  Loader2,
  Edit,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { useTaskList, useTaskListMembers, useProjectMembers } from '@/hooks/backlot';
import {
  BacklotTaskList,
  BacklotTaskListMember,
  BacklotProjectMember,
  TaskListSharingMode,
  TASK_SHARING_MODE_LABELS,
} from '@/types/backlot';
import { cn } from '@/lib/utils';

interface TaskListShareModalProps {
  taskListId: string;
  projectId: string;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =====================================================
// MemberRow Component
// =====================================================
interface MemberRowProps {
  member: BacklotTaskListMember;
  canManage: boolean;
  onToggleEdit: (canEdit: boolean) => void;
  onRemove: () => void;
  isRemoving: boolean;
}

const MemberRow: React.FC<MemberRowProps> = ({
  member,
  canManage,
  onToggleEdit,
  onRemove,
  isRemoving,
}) => {
  const profile = member.profile;

  return (
    <div className="flex items-center justify-between py-2 group">
      <div className="flex items-center gap-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={profile?.avatar_url || ''} />
          <AvatarFallback className="text-xs">
            {(profile?.display_name || profile?.full_name || 'U').slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm font-medium text-bone-white">
            {profile?.display_name || profile?.full_name || 'Unknown User'}
          </div>
          <div className="text-xs text-muted-gray">
            {profile?.username ? `@${profile.username}` : profile?.role || 'Member'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Permission Badge */}
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            member.can_edit
              ? 'text-green-400 border-green-400/30'
              : 'text-blue-400 border-blue-400/30'
          )}
        >
          {member.can_edit ? (
            <>
              <Edit className="w-3 h-3 mr-1" />
              Can Edit
            </>
          ) : (
            <>
              <Eye className="w-3 h-3 mr-1" />
              View Only
            </>
          )}
        </Badge>

        {canManage && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Toggle Edit Permission */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleEdit(!member.can_edit)}
            >
              {member.can_edit ? 'Remove Edit' : 'Allow Edit'}
            </Button>

            {/* Remove Member */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-400 hover:text-red-500"
              onClick={onRemove}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================
// AddMemberRow Component
// =====================================================
interface AddMemberRowProps {
  projectMember: BacklotProjectMember;
  onAdd: (canEdit: boolean) => void;
  isAdding: boolean;
}

const AddMemberRow: React.FC<AddMemberRowProps> = ({
  projectMember,
  onAdd,
  isAdding,
}) => {
  const profile = projectMember.profile;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={profile?.avatar_url || ''} />
          <AvatarFallback className="text-xs">
            {(profile?.display_name || profile?.full_name || 'U').slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm font-medium text-bone-white">
            {profile?.display_name || profile?.full_name || 'Unknown User'}
          </div>
          <div className="text-xs text-muted-gray">
            {projectMember.production_role || projectMember.role}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAdd(false)}
          disabled={isAdding}
        >
          {isAdding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Eye className="w-3 h-3 mr-1" />
              Add as Viewer
            </>
          )}
        </Button>
        <Button
          size="sm"
          onClick={() => onAdd(true)}
          disabled={isAdding}
          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
        >
          {isAdding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Edit className="w-3 h-3 mr-1" />
              Add as Editor
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

// =====================================================
// Main TaskListShareModal Component
// =====================================================
const TaskListShareModal: React.FC<TaskListShareModalProps> = ({
  taskListId,
  projectId,
  canManage,
  open,
  onOpenChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const { taskList, updateTaskList } = useTaskList(taskListId);
  const { members, addMember, updateMember, removeMember } = useTaskListMembers({ taskListId });
  const { members: projectMembers, isLoading: loadingProjectMembers } = useProjectMembers(projectId);

  // Get members who are not yet added to the task list
  const availableMembers = useMemo(() => {
    const memberUserIds = new Set(members.map(m => m.user_id));
    return (projectMembers || []).filter(pm => !memberUserIds.has(pm.user_id));
  }, [members, projectMembers]);

  // Filter available members by search
  const filteredAvailableMembers = useMemo(() => {
    if (!searchQuery.trim()) return availableMembers;
    const query = searchQuery.toLowerCase();
    return availableMembers.filter(pm => {
      const profile = pm.profile;
      return (
        profile?.display_name?.toLowerCase().includes(query) ||
        profile?.full_name?.toLowerCase().includes(query) ||
        profile?.username?.toLowerCase().includes(query) ||
        pm.production_role?.toLowerCase().includes(query)
      );
    });
  }, [availableMembers, searchQuery]);

  const handleSharingModeChange = async (mode: TaskListSharingMode) => {
    try {
      await updateTaskList.mutateAsync({ sharing_mode: mode });
    } catch (error) {
      console.error('Error updating sharing mode:', error);
    }
  };

  const handleAddMember = async (userId: string, canEdit: boolean) => {
    setAddingUserId(userId);
    try {
      await addMember.mutateAsync({ user_id: userId, can_edit: canEdit });
    } catch (error) {
      console.error('Error adding member:', error);
    } finally {
      setAddingUserId(null);
    }
  };

  const handleUpdateMember = async (userId: string, canEdit: boolean) => {
    try {
      await updateMember.mutateAsync({ userId, canEdit });
    } catch (error) {
      console.error('Error updating member:', error);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the task list?')) return;
    setRemovingUserId(userId);
    try {
      await removeMember.mutateAsync(userId);
    } catch (error) {
      console.error('Error removing member:', error);
    } finally {
      setRemovingUserId(null);
    }
  };

  if (!taskList) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Share Task List
          </DialogTitle>
          <DialogDescription>
            Control who can access "{taskList.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sharing Mode */}
          <div className="space-y-3">
            <Label className="text-muted-gray">Sharing Mode</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(
                  'flex items-start gap-3 p-4 rounded-lg border text-left transition-colors',
                  taskList.sharing_mode === 'project_wide'
                    ? 'border-accent-yellow bg-accent-yellow/5'
                    : 'border-muted-gray/20 hover:border-muted-gray/40'
                )}
                onClick={() => canManage && handleSharingModeChange('project_wide')}
                disabled={!canManage}
              >
                <Globe className={cn(
                  'w-5 h-5 mt-0.5',
                  taskList.sharing_mode === 'project_wide' ? 'text-accent-yellow' : 'text-muted-gray'
                )} />
                <div>
                  <div className="font-medium text-bone-white">All Project Members</div>
                  <div className="text-xs text-muted-gray mt-0.5">
                    Everyone on this project can view and edit tasks
                  </div>
                </div>
                {taskList.sharing_mode === 'project_wide' && (
                  <Check className="w-4 h-4 text-accent-yellow ml-auto" />
                )}
              </button>

              <button
                type="button"
                className={cn(
                  'flex items-start gap-3 p-4 rounded-lg border text-left transition-colors',
                  taskList.sharing_mode === 'selective'
                    ? 'border-accent-yellow bg-accent-yellow/5'
                    : 'border-muted-gray/20 hover:border-muted-gray/40'
                )}
                onClick={() => canManage && handleSharingModeChange('selective')}
                disabled={!canManage}
              >
                <Lock className={cn(
                  'w-5 h-5 mt-0.5',
                  taskList.sharing_mode === 'selective' ? 'text-accent-yellow' : 'text-muted-gray'
                )} />
                <div>
                  <div className="font-medium text-bone-white">Selected Members Only</div>
                  <div className="text-xs text-muted-gray mt-0.5">
                    Only specific people you add can access
                  </div>
                </div>
                {taskList.sharing_mode === 'selective' && (
                  <Check className="w-4 h-4 text-accent-yellow ml-auto" />
                )}
              </button>
            </div>
          </div>

          {/* Members (for selective mode) */}
          {taskList.sharing_mode === 'selective' && (
            <>
              <Separator />

              {/* Current Members */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-gray">
                    Members ({members.length})
                  </Label>
                </div>

                {members.length > 0 ? (
                  <div className="space-y-1">
                    {members.map(member => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        canManage={canManage}
                        onToggleEdit={(canEdit) => handleUpdateMember(member.user_id, canEdit)}
                        onRemove={() => handleRemoveMember(member.user_id)}
                        isRemoving={removingUserId === member.user_id}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-gray">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No members yet</p>
                    <p className="text-xs mt-1">Add project members below</p>
                  </div>
                )}
              </div>

              {/* Add Members */}
              {canManage && availableMembers.length > 0 && (
                <>
                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-muted-gray">Add Members</Label>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                      <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search project members..."
                        className="pl-10"
                      />
                    </div>

                    {/* Available Members */}
                    {loadingProjectMembers ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <Skeleton key={i} className="h-12" />
                        ))}
                      </div>
                    ) : filteredAvailableMembers.length > 0 ? (
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {filteredAvailableMembers.map(pm => (
                          <AddMemberRow
                            key={pm.id}
                            projectMember={pm}
                            onAdd={(canEdit) => handleAddMember(pm.user_id, canEdit)}
                            isAdding={addingUserId === pm.user_id}
                          />
                        ))}
                      </div>
                    ) : searchQuery ? (
                      <div className="text-center py-4 text-muted-gray text-sm">
                        No members match "{searchQuery}"
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-gray text-sm">
                        All project members have been added
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Info for project-wide mode */}
          {taskList.sharing_mode === 'project_wide' && (
            <>
              <Separator />
              <div className="bg-muted-gray/10 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-accent-yellow mt-0.5" />
                  <div>
                    <div className="font-medium text-bone-white">
                      Shared with all project members
                    </div>
                    <div className="text-sm text-muted-gray mt-1">
                      {projectMembers?.length || 0} members can view and edit this task list.
                      Switch to "Selected Members Only" to control access.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskListShareModal;
