/**
 * Team & Access - Unified component merging TeamAccessView and RolesManagementView
 *
 * Sub-tabs:
 *  1. Team Members — member list, search, role assignment, permission overrides
 *  2. Roles & Permissions — role legend, preset editor, role assignments
 *  3. External Access — freelancers + clients (with tab permissions editor)
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Plus, UserPlus, Shield, Loader2 } from 'lucide-react';
import {
  useProjectMembers,
  useRoleAssignments,
  useEffectiveConfig,
  canEditTab,
  type ProjectMemberWithRoles,
} from '@/hooks/backlot/useProjectAccess';
import {
  useBacklotRoles,
  useCanManageRoles,
} from '@/hooks/backlot';
import type { BacklotRoleValue } from '@/hooks/backlot/useProjectRoles';
import AddFromNetworkModal from '../AddFromNetworkModal';
import TeamMembersTab from './TeamMembersTab';
import RolesPermissionsTab from './RolesPermissionsTab';
import ExternalAccessTab from './ExternalAccessTab';
import PermissionEditorDialog from './PermissionEditorDialog';
import AssignRoleDialog from './AssignRoleDialog';
import AddMemberDialog from './AddMemberDialog';
import { toast } from 'sonner';

interface TeamAccessViewProps {
  projectId: string;
}

const TeamAccessView: React.FC<TeamAccessViewProps> = ({ projectId }) => {
  const { members, isLoading, addMember, updateMember, removeMember } = useProjectMembers(projectId);
  const { assignRole, removeRole } = useRoleAssignments(projectId);
  const { data: myConfig } = useEffectiveConfig(projectId);
  const { roles, isLoading: loadingRoles, assignRole: backlotAssignRole, removeRole: backlotRemoveRole, setPrimaryRole } = useBacklotRoles(projectId);
  const { data: canManageRolesData } = useCanManageRoles(projectId);

  const [activeTab, setActiveTab] = useState('team');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [editingMember, setEditingMember] = useState<ProjectMemberWithRoles | null>(null);
  const [assigningRoleMember, setAssigningRoleMember] = useState<ProjectMemberWithRoles | null>(null);
  const [removingMember, setRemovingMember] = useState<ProjectMemberWithRoles | null>(null);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = myConfig?.is_owner || myConfig?.role === 'showrunner' || canEditTab(myConfig, 'access');

  const handleAddMember = async (params: { userId: string; role: string; backlotRole?: string }) => {
    await addMember.mutateAsync({
      userId: params.userId,
      role: params.role,
      backlotRole: params.backlotRole,
    });
    toast.success('Team member added');
  };

  const handleAddFromNetwork = async (params: {
    userId: string;
    role: string;
    backlotRole?: string;
  }) => {
    try {
      await addMember.mutateAsync({
        userId: params.userId,
        role: params.role,
        backlotRole: params.backlotRole,
      });
      toast.success('Team member added from network');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add team member');
    }
  };

  const handleChangeRole = async (member: ProjectMemberWithRoles, role: string) => {
    try {
      await updateMember.mutateAsync({
        memberId: member.id,
        role,
      });
      toast.success('Role updated');
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    try {
      await removeMember.mutateAsync(removingMember.id);
      toast.success('Team member removed');
      setRemovingMember(null);
    } catch (err) {
      toast.error('Failed to remove team member');
    }
  };

  const handleAssignBacklotRole = async (userId: string, role: BacklotRoleValue) => {
    try {
      await backlotAssignRole.mutateAsync({
        projectId,
        userId,
        backlotRole: role,
        isPrimary: !members.find(m => m.user_id === userId)?.primary_role,
      });
      toast.success('Role assigned');
    } catch (err) {
      toast.error('Failed to assign role');
    }
  };

  const handleSetPrimaryRole = async (member: ProjectMemberWithRoles, roleValue: string) => {
    // Find the role ID for this role value + user
    const role = roles.find(r => r.user_id === member.user_id && r.backlot_role === roleValue);
    if (!role) return;
    try {
      await setPrimaryRole.mutateAsync({
        projectId,
        userId: member.user_id,
        roleId: role.id,
      });
      toast.success('Primary role updated');
    } catch (err) {
      toast.error('Failed to set primary role');
    }
  };

  const handleSetPrimaryRoleById = async (roleId: string, userId: string) => {
    try {
      await setPrimaryRole.mutateAsync({
        projectId,
        userId,
        roleId,
      });
      toast.success('Primary role updated');
    } catch (err) {
      toast.error('Failed to set primary role');
    }
  };

  const handleRemoveBacklotRole = async () => {
    if (!deleteRoleId) return;
    setIsSubmitting(true);
    try {
      await backlotRemoveRole.mutateAsync(deleteRoleId);
      setDeleteRoleId(null);
    } catch (err) {
      toast.error('Failed to remove role');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || loadingRoles) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-muted-gray/20 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-bone-white">
            <Users className="h-5 w-5 text-accent-yellow" />
            Team & Access
          </h2>
          <p className="text-sm text-muted-gray">
            {members.length} team member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowNetworkModal(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add from Network
            </Button>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-muted-gray/20 px-4">
          <TabsList className="bg-transparent h-auto p-0">
            <TabsTrigger
              value="team"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent-yellow data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow"
            >
              Team Members
            </TabsTrigger>
            {canManage && (
              <TabsTrigger
                value="roles"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent-yellow data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow"
              >
                Roles & Permissions
              </TabsTrigger>
            )}
            {canManage && (
              <TabsTrigger
                value="external"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent-yellow data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow"
              >
                External Access
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="team" className="flex-1 p-4 space-y-4 m-0">
          <TeamMembersTab
            members={members}
            onEditPermissions={setEditingMember}
            onRemove={setRemovingMember}
            onChangeRole={handleChangeRole}
            onAssignRole={setAssigningRoleMember}
            onSetPrimaryRole={handleSetPrimaryRole}
            isLoading={updateMember.isPending || removeMember.isPending}
          />
        </TabsContent>

        <TabsContent value="roles" className="flex-1 p-4 m-0">
          <RolesPermissionsTab
            projectId={projectId}
            roles={roles}
            members={members}
            onSetPrimary={handleSetPrimaryRoleById}
            onRemoveRole={(id) => setDeleteRoleId(id)}
          />
        </TabsContent>

        <TabsContent value="external" className="flex-1 p-4 m-0">
          <ExternalAccessTab projectId={projectId} />
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAddMember}
      />

      {/* Permission Editor Dialog */}
      <PermissionEditorDialog
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
        member={editingMember}
        projectId={projectId}
      />

      {/* Assign Role Dialog */}
      <AssignRoleDialog
        open={!!assigningRoleMember}
        onOpenChange={(open) => !open && setAssigningRoleMember(null)}
        member={assigningRoleMember}
        onAssign={handleAssignBacklotRole}
      />

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removingMember} onOpenChange={(open) => !open && setRemovingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removingMember?.user_name || removingMember?.user_username} from this project?
              This will also remove their role assignments and any custom permission overrides.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemoveMember}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Role Confirmation */}
      <AlertDialog open={!!deleteRoleId} onOpenChange={(open) => !open && setDeleteRoleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this role assignment. The user will lose access associated with this role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveBacklotRole}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Role'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add from Network Modal */}
      <AddFromNetworkModal
        open={showNetworkModal}
        onOpenChange={setShowNetworkModal}
        projectId={projectId}
        onAddMember={handleAddFromNetwork}
      />
    </div>
  );
};

export default TeamAccessView;
