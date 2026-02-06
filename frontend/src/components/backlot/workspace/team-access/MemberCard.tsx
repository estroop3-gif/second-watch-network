import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Crown, Star, UserCog, Trash2, Shield } from 'lucide-react';
import { BACKLOT_ROLES } from '@/hooks/backlot/useProjectRoles';
import type { ProjectMemberWithRoles } from '@/hooks/backlot/useProjectAccess';
import { ROLE_COLORS, BACKLOT_ROLE_COLORS } from './constants';
import { cn } from '@/lib/utils';

interface MemberCardProps {
  member: ProjectMemberWithRoles;
  onEditPermissions: (member: ProjectMemberWithRoles) => void;
  onRemove: (member: ProjectMemberWithRoles) => void;
  onChangeRole: (member: ProjectMemberWithRoles, role: string) => void;
  onAssignRole: (member: ProjectMemberWithRoles) => void;
  onSetPrimaryRole?: (member: ProjectMemberWithRoles, roleValue: string) => void;
  isLoading?: boolean;
}

const MemberCard: React.FC<MemberCardProps> = ({
  member,
  onEditPermissions,
  onRemove,
  onChangeRole,
  onAssignRole,
  onSetPrimaryRole,
  isLoading,
}) => {
  const isOwner = member.role === 'owner';
  const displayName = member.user_name || member.user_username || 'Unknown User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 hover:border-muted-gray/40 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={member.user_avatar || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 font-medium text-bone-white">
              {displayName}
              {isOwner && <Crown className="h-4 w-4 text-yellow-500" />}
            </div>
            <div className="text-xs text-muted-gray">
              @{member.user_username || 'unknown'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Project role badge */}
          <Badge variant="outline" className={cn('text-xs', ROLE_COLORS[member.role])}>
            {member.role}
          </Badge>

          {/* Backlot Roles */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {member.primary_role && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs cursor-default',
                  BACKLOT_ROLE_COLORS[member.primary_role] || BACKLOT_ROLE_COLORS.crew
                )}
              >
                <Star className="w-3 h-3 mr-1" />
                {BACKLOT_ROLES.find(r => r.value === member.primary_role)?.label || member.primary_role}
              </Badge>
            )}
            {member.backlot_roles?.filter(r => r !== member.primary_role).map((roleValue) => (
              <Badge
                key={roleValue}
                variant="outline"
                className={cn(
                  'text-xs cursor-pointer hover:opacity-80',
                  BACKLOT_ROLE_COLORS[roleValue] || BACKLOT_ROLE_COLORS.crew
                )}
                onClick={() => onSetPrimaryRole?.(member, roleValue)}
                title="Click to set as primary"
              >
                {BACKLOT_ROLES.find(r => r.value === roleValue)?.label || roleValue}
              </Badge>
            ))}
            {member.has_overrides && (
              <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                Custom
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {!isOwner && (
              <Select
                value={member.role}
                onValueChange={(value) => onChangeRole(member, value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-[100px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-gray hover:text-bone-white"
              onClick={() => onAssignRole(member)}
              disabled={isLoading}
              title="Assign role"
            >
              <Shield className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-gray hover:text-bone-white"
              onClick={() => onEditPermissions(member)}
              disabled={isLoading}
              title="Edit permissions"
            >
              <UserCog className="h-4 w-4" />
            </Button>
            {!isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onRemove(member)}
                disabled={isLoading}
                title="Remove member"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberCard;
