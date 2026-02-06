import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Search, Loader2, Plus, Check } from 'lucide-react';
import { BACKLOT_ROLES } from '@/hooks/backlot/useProjectRoles';
import { useUserSearch } from '@/hooks/useUserSearch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (params: { userId: string; role: string; backlotRole?: string }) => Promise<void>;
}

const AddMemberDialog: React.FC<AddMemberDialogProps> = ({ open, onOpenChange, onAdd }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('viewer');
  const [selectedBacklotRole, setSelectedBacklotRole] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

  const { data: searchResults, isLoading: searchingUsers } = useUserSearch(searchQuery, { minLength: 2 });

  const resetForm = () => {
    setSearchQuery('');
    setSelectedUserId(null);
    setSelectedRole('viewer');
    setSelectedBacklotRole('');
  };

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setIsAdding(true);
    try {
      await onAdd({
        userId: selectedUserId,
        role: selectedRole,
        backlotRole: selectedBacklotRole || undefined,
      });
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add team member');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Search for a user to add to your project team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Search Users</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchingUsers && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}
            {searchResults && searchResults.length > 0 && (
              <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                {searchResults.map(user => (
                  <button
                    key={user.id}
                    className={cn(
                      'w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-left transition-colors',
                      selectedUserId === user.id && 'bg-primary/10'
                    )}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>
                        {(user.display_name || user.username || 'U')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">{user.display_name || user.full_name || user.username}</div>
                      <div className="text-xs text-muted-foreground">@{user.username}</div>
                    </div>
                    {selectedUserId === user.id && (
                      <Check className="h-4 w-4 ml-auto text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Project Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Backlot Role</label>
              <Select value={selectedBacklotRole} onValueChange={setSelectedBacklotRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {BACKLOT_ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedUserId || isAdding}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Add Member
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddMemberDialog;
