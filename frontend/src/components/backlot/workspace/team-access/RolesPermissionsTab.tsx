import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Trash2, Users } from 'lucide-react';
import { BACKLOT_ROLES } from '@/hooks/backlot/useProjectRoles';
import type { BacklotProjectRole } from '@/hooks/backlot/useProjectRoles';
import type { ProjectMemberWithRoles } from '@/hooks/backlot/useProjectAccess';
import { BACKLOT_ROLE_COLORS } from './constants';
import RoleLegend from './RoleLegend';
import RolePresetEditor from './RolePresetEditor';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UserRoleGroup {
  userId: string;
  profile: BacklotProjectRole['profile'];
  roles: BacklotProjectRole[];
  primaryRoleId?: string;
}

interface RolesPermissionsTabProps {
  projectId: string;
  roles: BacklotProjectRole[];
  members: ProjectMemberWithRoles[];
  onSetPrimary: (roleId: string, userId: string) => Promise<void>;
  onRemoveRole: (roleId: string) => void;
}

const RolesPermissionsTab: React.FC<RolesPermissionsTabProps> = ({
  projectId,
  roles,
  members,
  onSetPrimary,
  onRemoveRole,
}) => {
  const [selectedPresetRole, setSelectedPresetRole] = useState<string | null>(null);

  // Group roles by user
  const userRoleGroups = useMemo<UserRoleGroup[]>(() => {
    const groups = new Map<string, UserRoleGroup>();
    roles.forEach(role => {
      const existing = groups.get(role.user_id);
      if (existing) {
        existing.roles.push(role);
        if (role.is_primary) {
          existing.primaryRoleId = role.id;
        }
      } else {
        groups.set(role.user_id, {
          userId: role.user_id,
          profile: role.profile,
          roles: [role],
          primaryRoleId: role.is_primary ? role.id : undefined,
        });
      }
    });
    return Array.from(groups.values());
  }, [roles]);

  return (
    <div className="space-y-6">
      {/* Role Legend */}
      <RoleLegend onRoleClick={(role) => setSelectedPresetRole(role)} />

      {/* Role Preset Editor */}
      <div>
        <h3 className="text-lg font-medium text-bone-white mb-3">Role Presets</h3>
        <RolePresetEditor projectId={projectId} initialRole={selectedPresetRole} />
      </div>

      {/* Role Assignments */}
      {userRoleGroups.length > 0 && (
        <div className="border-t border-muted-gray/20 pt-6">
          <h3 className="text-lg font-medium text-bone-white mb-2 flex items-center gap-2">
            <Star className="w-5 h-5 text-accent-yellow" />
            Role Assignments
          </h3>
          <p className="text-sm text-muted-gray mb-4">
            Manage which roles are assigned to each team member. Click a role to make it primary.
          </p>
          <div className="space-y-3">
            {userRoleGroups.map((group) => {
              const memberInfo = members.find(m => m.user_id === group.userId);
              const displayName = memberInfo?.user_name || group.profile?.display_name || group.profile?.full_name || 'Unknown';
              const avatarUrl = memberInfo?.user_avatar || group.profile?.avatar_url || '';

              return (
                <div
                  key={group.userId}
                  className="bg-charcoal-black/30 border border-muted-gray/20 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback>
                          {displayName.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-bone-white text-sm">
                        {displayName}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      {group.roles.map((role) => {
                        const roleInfo = BACKLOT_ROLES.find(r => r.value === role.backlot_role);
                        const isPrimary = role.id === group.primaryRoleId;

                        return (
                          <div key={role.id} className="flex items-center gap-1">
                            <Badge
                              variant={isPrimary ? 'default' : 'outline'}
                              className={cn(
                                'cursor-pointer transition-colors text-xs',
                                isPrimary
                                  ? 'bg-accent-yellow text-charcoal-black'
                                  : cn('hover:bg-muted-gray/20', BACKLOT_ROLE_COLORS[role.backlot_role] || BACKLOT_ROLE_COLORS.crew)
                              )}
                              onClick={() => {
                                if (!isPrimary) {
                                  onSetPrimary(role.id, group.userId).catch((err: any) => {
                                    toast.error(err?.message || 'Failed to set primary role');
                                  });
                                }
                              }}
                              title={isPrimary ? 'Primary role' : 'Click to set as primary'}
                            >
                              {isPrimary && <Star className="w-3 h-3 mr-1" />}
                              {roleInfo?.label || role.backlot_role}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-gray hover:text-red-400"
                              onClick={() => onRemoveRole(role.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {userRoleGroups.length === 0 && (
        <div className="text-center py-8 text-muted-gray border-t border-muted-gray/20 mt-6 pt-6">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No role assignments yet. Assign roles from the Team Members tab.</p>
        </div>
      )}
    </div>
  );
};

export default RolesPermissionsTab;
