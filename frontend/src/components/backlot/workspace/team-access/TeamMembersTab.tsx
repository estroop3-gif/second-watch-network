import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Users } from 'lucide-react';
import type { ProjectMemberWithRoles } from '@/hooks/backlot/useProjectAccess';
import MemberCard from './MemberCard';

interface TeamMembersTabProps {
  members: ProjectMemberWithRoles[];
  onEditPermissions: (member: ProjectMemberWithRoles) => void;
  onRemove: (member: ProjectMemberWithRoles) => void;
  onChangeRole: (member: ProjectMemberWithRoles, role: string) => void;
  onAssignRole: (member: ProjectMemberWithRoles) => void;
  onSetPrimaryRole: (member: ProjectMemberWithRoles, roleValue: string) => void;
  isLoading?: boolean;
}

const TeamMembersTab: React.FC<TeamMembersTabProps> = ({
  members,
  onEditPermissions,
  onRemove,
  onChangeRole,
  onAssignRole,
  onSetPrimaryRole,
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(m => {
      const name = (m.user_name || m.user_username || '').toLowerCase();
      return name.includes(query);
    });
  }, [members, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search team members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Member List */}
      <div className="space-y-2">
        {filteredMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-gray">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No team members found</p>
          </div>
        ) : (
          filteredMembers.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              onEditPermissions={onEditPermissions}
              onRemove={onRemove}
              onChangeRole={onChangeRole}
              onAssignRole={onAssignRole}
              onSetPrimaryRole={onSetPrimaryRole}
              isLoading={isLoading}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TeamMembersTab;
