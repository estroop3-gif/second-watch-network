import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Save, Eye } from 'lucide-react';
import { useUpdateExternalSeat } from '@/hooks/backlot/useExternalSeats';
import type { ExternalSeat } from '@/hooks/backlot/useExternalSeats';
import { TAB_DEFINITIONS, STANDARD_CLIENT_TABS } from './constants';
import { toast } from 'sonner';

interface ClientTabPermissionsEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seat: ExternalSeat | null;
  projectId: string;
}

const ClientTabPermissionsEditor: React.FC<ClientTabPermissionsEditorProps> = ({
  open,
  onOpenChange,
  seat,
  projectId,
}) => {
  const updateSeat = useUpdateExternalSeat(projectId);
  const [tabPermissions, setTabPermissions] = useState<Record<string, { view: boolean; edit: boolean }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize from seat data when dialog opens
  useEffect(() => {
    if (open && seat) {
      const initial: Record<string, { view: boolean; edit: boolean }> = {};
      TAB_DEFINITIONS.forEach(tab => {
        const existing = seat.tab_permissions?.[tab.key];
        initial[tab.key] = {
          view: existing?.view ?? false,
          edit: false, // clients are view-only
        };
      });
      setTabPermissions(initial);
    }
  }, [open, seat]);

  const visibleCount = useMemo(
    () => Object.values(tabPermissions).filter(p => p.view).length,
    [tabPermissions]
  );

  const toggleTab = (key: string, checked: boolean) => {
    setTabPermissions(prev => ({
      ...prev,
      [key]: { view: checked, edit: false },
    }));
  };

  const grantAll = () => {
    const next: Record<string, { view: boolean; edit: boolean }> = {};
    TAB_DEFINITIONS.forEach(tab => {
      next[tab.key] = { view: true, edit: false };
    });
    setTabPermissions(next);
  };

  const revokeAll = () => {
    const next: Record<string, { view: boolean; edit: boolean }> = {};
    TAB_DEFINITIONS.forEach(tab => {
      next[tab.key] = { view: false, edit: false };
    });
    setTabPermissions(next);
  };

  const applyStandardPreset = () => {
    const next: Record<string, { view: boolean; edit: boolean }> = {};
    TAB_DEFINITIONS.forEach(tab => {
      next[tab.key] = {
        view: STANDARD_CLIENT_TABS.includes(tab.key),
        edit: false,
      };
    });
    setTabPermissions(next);
  };

  const handleSave = async () => {
    if (!seat) return;
    setIsSaving(true);
    try {
      await updateSeat.mutateAsync({
        seatId: seat.id,
        tabPermissions,
      });
      toast.success('Client tab permissions saved');
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to save tab permissions');
    } finally {
      setIsSaving(false);
    }
  };

  if (!seat) return null;

  const displayName = seat.user_name || seat.user_email || 'Unknown User';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-400" />
            Tab Permissions for {displayName}
          </DialogTitle>
          <DialogDescription>
            Configure which tabs this client can view. Clients have view-only access.
          </DialogDescription>
        </DialogHeader>

        {/* Quick actions */}
        <div className="flex items-center gap-2 pb-2 border-b border-muted-gray/20">
          <Button variant="outline" size="sm" onClick={grantAll}>
            Grant All
          </Button>
          <Button variant="outline" size="sm" onClick={revokeAll}>
            Revoke All
          </Button>
          <Button variant="outline" size="sm" onClick={applyStandardPreset}>
            Standard Client View
          </Button>
          <span className="text-xs text-muted-gray ml-auto">
            {visibleCount} of {TAB_DEFINITIONS.length} visible
          </span>
        </div>

        {/* Tab list */}
        <div className="space-y-1">
          {TAB_DEFINITIONS.map(tab => (
            <label
              key={tab.key}
              className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted-gray/10 cursor-pointer"
            >
              <span className="text-sm text-bone-white">{tab.label}</span>
              <Checkbox
                checked={tabPermissions[tab.key]?.view ?? false}
                onCheckedChange={(checked) => toggleTab(tab.key, !!checked)}
              />
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t border-muted-gray/20">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientTabPermissionsEditor;
