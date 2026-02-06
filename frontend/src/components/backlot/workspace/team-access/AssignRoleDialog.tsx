import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { BACKLOT_ROLES } from '@/hooks/backlot/useProjectRoles';
import type { BacklotRoleValue } from '@/hooks/backlot/useProjectRoles';
import type { ProjectMemberWithRoles } from '@/hooks/backlot/useProjectAccess';
import { BACKLOT_ROLE_COLORS } from './constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AssignRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: ProjectMemberWithRoles | null;
  onAssign: (userId: string, role: BacklotRoleValue) => Promise<void>;
}

const AssignRoleDialog: React.FC<AssignRoleDialogProps> = ({
  open,
  onOpenChange,
  member,
  onAssign,
}) => {
  const [selectedRole, setSelectedRole] = useState<BacklotRoleValue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAssign = async () => {
    if (!member || !selectedRole) return;
    setIsSubmitting(true);
    try {
      await onAssign(member.user_id, selectedRole);
      onOpenChange(false);
      setSelectedRole(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign role');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!member) return null;

  const displayName = member.user_name || member.user_username || 'Unknown User';

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelectedRole(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Role to {displayName}</DialogTitle>
          <DialogDescription>
            Select a Backlot role to assign. The role determines default tab visibility.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Current roles */}
          {member.backlot_roles && member.backlot_roles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-gray">Current Roles</Label>
              <div className="flex flex-wrap gap-2">
                {member.backlot_roles.map((roleValue) => (
                  <Badge
                    key={roleValue}
                    variant="outline"
                    className={cn(
                      'text-xs',
                      BACKLOT_ROLE_COLORS[roleValue] || BACKLOT_ROLE_COLORS.crew
                    )}
                  >
                    {BACKLOT_ROLES.find(r => r.value === roleValue)?.label || roleValue}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Backlot Role</Label>
            <Select
              value={selectedRole || ''}
              onValueChange={(v) => setSelectedRole(v as BacklotRoleValue)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role..." />
              </SelectTrigger>
              <SelectContent>
                {BACKLOT_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    <div className="flex flex-col">
                      <span>{role.label}</span>
                      <span className="text-xs text-muted-gray">{role.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={isSubmitting || !selectedRole}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Role'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignRoleDialog;
