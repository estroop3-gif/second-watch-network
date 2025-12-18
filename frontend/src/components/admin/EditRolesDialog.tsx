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

const ALL_ROLES = ['admin', 'filmmaker', 'partner', 'premium'];

const EditRolesDialog: React.FC<EditRolesDialogProps> = ({ user, isOpen, onClose }) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

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
      <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white">
        <DialogHeader>
          <DialogTitle>Edit Roles for <span className="text-accent-yellow">{user.profile.username || user.email}</span></DialogTitle>
          <DialogDescription>
            Select the roles to assign to this user.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {ALL_ROLES.map(role => (
            <div key={role} className="flex items-center space-x-2">
              <Checkbox
                id={role}
                checked={selectedRoles.includes(role)}
                onCheckedChange={(checked) => handleRoleChange(role, !!checked)}
                className="data-[state=checked]:bg-accent-yellow data-[state=checked]:text-charcoal-black border-muted-gray"
              />
              <Label htmlFor={role} className="capitalize text-lg">
                {role}
              </Label>
            </div>
          ))}
        </div>
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
