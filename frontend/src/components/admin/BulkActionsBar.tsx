import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import { X, Ban, UserCheck, Plus, Minus, Loader2, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';

interface BulkActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

const ROLES = [
  { id: 'filmmaker', label: 'Filmmaker' },
  { id: 'premium', label: 'Premium' },
  { id: 'order_member', label: 'Order Member' },
  { id: 'partner', label: 'Partner' },
  { id: 'moderator', label: 'Moderator' },
  { id: 'admin', label: 'Admin' },
];

export const BulkActionsBar = ({ selectedIds, onClearSelection }: BulkActionsBarProps) => {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{
    action: string;
    role?: string;
    title: string;
    description: string;
  } | null>(null);

  const bulkMutation = useMutation({
    mutationFn: ({ action, role }: { action: string; role?: string }) =>
      api.bulkUserAction(selectedIds, action, role),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-stats'] });
      toast.success(result.message);
      onClearSelection();
      setConfirmAction(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Bulk action failed');
    },
  });

  const handleAction = (action: string, role?: string) => {
    const count = selectedIds.length;

    switch (action) {
      case 'ban':
        setConfirmAction({
          action: 'ban',
          title: `Ban ${count} users?`,
          description: `This will prevent ${count} users from accessing the platform.`,
        });
        break;
      case 'unban':
        setConfirmAction({
          action: 'unban',
          title: `Unban ${count} users?`,
          description: `This will restore access for ${count} users.`,
        });
        break;
      case 'add_role':
        setConfirmAction({
          action: 'add_role',
          role,
          title: `Add "${role}" role to ${count} users?`,
          description: `This will grant the ${role} role to ${count} selected users.`,
        });
        break;
      case 'remove_role':
        setConfirmAction({
          action: 'remove_role',
          role,
          title: `Remove "${role}" role from ${count} users?`,
          description: `This will revoke the ${role} role from ${count} selected users.`,
        });
        break;
    }
  };

  const executeAction = () => {
    if (confirmAction) {
      bulkMutation.mutate({
        action: confirmAction.action,
        role: confirmAction.role,
      });
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-charcoal-black border-2 border-accent-yellow rounded-lg shadow-lg">
            <span className="text-bone-white font-medium">
              {selectedIds.length} user{selectedIds.length > 1 ? 's' : ''} selected
            </span>

            <div className="h-6 w-px bg-muted-gray" />

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('ban')}
              className="bg-charcoal-black border-primary-red text-primary-red hover:bg-primary-red hover:text-bone-white"
            >
              <Ban className="h-4 w-4 mr-1" />
              Ban
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('unban')}
              className="bg-charcoal-black border-green-500 text-green-500 hover:bg-green-500 hover:text-bone-white"
            >
              <UserCheck className="h-4 w-4 mr-1" />
              Unban
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-charcoal-black border-accent-yellow text-accent-yellow"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Role
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-charcoal-black border-muted-gray">
                {ROLES.map((role) => (
                  <DropdownMenuItem
                    key={role.id}
                    onClick={() => handleAction('add_role', role.id)}
                    className="text-bone-white cursor-pointer"
                  >
                    {role.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-charcoal-black border-muted-gray text-muted-gray"
                >
                  <Minus className="h-4 w-4 mr-1" />
                  Remove Role
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-charcoal-black border-muted-gray">
                {ROLES.map((role) => (
                  <DropdownMenuItem
                    key={role.id}
                    onClick={() => handleAction('remove_role', role.id)}
                    className="text-bone-white cursor-pointer"
                  >
                    {role.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-6 w-px bg-muted-gray" />

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-muted-gray hover:text-bone-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">
              {confirmAction?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              {confirmAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-charcoal-black border-muted-gray text-bone-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              disabled={bulkMutation.isPending}
              className={
                confirmAction?.action === 'ban'
                  ? 'bg-primary-red hover:bg-red-700'
                  : 'bg-accent-yellow text-charcoal-black hover:bg-yellow-500'
              }
            >
              {bulkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkActionsBar;
