import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { Shield, Crown, Users, Star, Film, Briefcase, Sparkles, Lock } from 'lucide-react';

interface User {
  id: string;
  email: string;
  profile: {
    username: string;
    roles: string[];
    avatar_url: string;
    is_banned: boolean;
  };
}

interface EditRolesDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

// Role definitions with metadata
const ROLE_DEFINITIONS = [
  { id: 'superadmin', label: 'Superadmin', icon: Crown, description: 'Full system access - god mode', requiresSuperadmin: true, color: 'text-red-500' },
  { id: 'admin', label: 'Admin', icon: Shield, description: 'Manage users, content, and moderate', requiresSuperadmin: true, color: 'text-orange-500' },
  { id: 'moderator', label: 'Moderator', icon: Users, description: 'Moderate content and users', requiresSuperadmin: false, color: 'text-yellow-500' },
  { id: 'lodge_officer', label: 'Lodge Officer', icon: Star, description: 'Order lodge leadership', requiresSuperadmin: false, color: 'text-purple-500' },
  { id: 'order_member', label: 'Order Member', icon: Sparkles, description: 'Member of The Second Watch Order', requiresSuperadmin: false, color: 'text-blue-500' },
  { id: 'partner', label: 'Partner', icon: Briefcase, description: 'Business/sponsor partner', requiresSuperadmin: false, color: 'text-green-500' },
  { id: 'filmmaker', label: 'Filmmaker', icon: Film, description: 'Content creator with verified profile', requiresSuperadmin: false, color: 'text-cyan-500' },
  { id: 'premium', label: 'Premium', icon: Star, description: 'Paid subscriber', requiresSuperadmin: false, color: 'text-amber-500' },
];

const ALL_ROLES = ROLE_DEFINITIONS.map(r => r.id);

const EditRolesDialog: React.FC<EditRolesDialogProps> = ({ user, isOpen, onClose }) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();
  const { hasRole } = usePermissions();
  const isSuperadmin = hasRole('superadmin');

  useEffect(() => {
    if (user?.profile?.roles) {
      setSelectedRoles(user.profile.roles);
    } else {
      setSelectedRoles([]);
    }
  }, [user]);

  const handleRoleChange = (role: string, checked: boolean) => {
    setSelectedRoles(prev =>
      checked ? [...prev, role] : prev.filter(r => r !== role)
    );
  };

  const handleSaveChanges = async () => {
    if (!user) return;

    setIsUpdating(true);
    try {
      await api.updateUserRoles(user.id, selectedRoles);

      toast.success(`Roles updated for ${user.profile.username || user.email}`);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['community'] });
      onClose();
    } catch (error: any) {
      toast.error(`Failed to update roles: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Roles for <span className="text-accent-yellow">{user.profile.username || user.email}</span></DialogTitle>
          <DialogDescription>
            Select the roles to assign to this user.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {ROLE_DEFINITIONS.map(role => {
            const IconComponent = role.icon;
            const isLocked = role.requiresSuperadmin && !isSuperadmin;
            const isChecked = selectedRoles.includes(role.id);

            return (
              <div
                key={role.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isChecked
                    ? 'border-accent-yellow/50 bg-accent-yellow/10'
                    : 'border-muted-gray/30 hover:border-muted-gray/50'
                } ${isLocked ? 'opacity-50' : ''}`}
              >
                <Checkbox
                  id={role.id}
                  checked={isChecked}
                  onCheckedChange={(checked) => handleRoleChange(role.id, !!checked)}
                  disabled={isLocked}
                  className="data-[state=checked]:bg-accent-yellow data-[state=checked]:text-charcoal-black border-muted-gray"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <IconComponent className={`w-4 h-4 ${role.color}`} />
                    <Label htmlFor={role.id} className="text-sm font-medium cursor-pointer">
                      {role.label}
                    </Label>
                    {isLocked && <Lock className="w-3 h-3 text-muted-gray" />}
                  </div>
                  <p className="text-xs text-muted-gray mt-0.5">{role.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        {!isSuperadmin && (
          <p className="text-xs text-muted-gray flex items-center gap-1">
            <Lock className="w-3 h-3" /> Superadmin/Admin roles require superadmin privileges to assign
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>Cancel</Button>
          <Button onClick={handleSaveChanges} disabled={isUpdating} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditRolesDialog;
