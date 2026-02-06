import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, UserCog, Save, RotateCcw } from 'lucide-react';
import {
  useViewOverrides,
  useRolePresets,
  normalizePermission,
  type ProjectMemberWithRoles,
  type ViewEditConfig,
  type PermissionValue,
} from '@/hooks/backlot/useProjectAccess';
import { TAB_DEFINITIONS, SECTION_DEFINITIONS } from './constants';
import PermissionToggle from './PermissionToggle';
import { toast } from 'sonner';

interface PermissionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: ProjectMemberWithRoles | null;
  projectId: string;
}

const PermissionEditorDialog: React.FC<PermissionEditorDialogProps> = ({
  open,
  onOpenChange,
  member,
  projectId,
}) => {
  const { overrides, updateOverride, deleteOverride } = useViewOverrides(projectId);
  const { data: rolePresets } = useRolePresets(projectId);
  const [editConfig, setEditConfig] = useState<ViewEditConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const baseConfig = useMemo(() => {
    if (!member || !rolePresets) return null;
    const preset = rolePresets.find(p => p.role === member.primary_role);
    return preset?.config || null;
  }, [member, rolePresets]);

  const existingOverride = useMemo(() => {
    if (!member) return null;
    return overrides.find(o => o.user_id === member.user_id);
  }, [member, overrides]);

  React.useEffect(() => {
    if (open && member) {
      if (existingOverride) {
        setEditConfig(existingOverride.config);
      } else if (baseConfig) {
        setEditConfig(JSON.parse(JSON.stringify(baseConfig)));
      } else {
        setEditConfig({
          tabs: TAB_DEFINITIONS.reduce((acc, tab) => {
            acc[tab.key] = { view: false, edit: false };
            return acc;
          }, {} as Record<string, PermissionValue>),
          sections: SECTION_DEFINITIONS.reduce((acc, section) => {
            acc[section.key] = { view: false, edit: false };
            return acc;
          }, {} as Record<string, PermissionValue>),
        });
      }
      setHasChanges(false);
    }
  }, [open, member, existingOverride, baseConfig]);

  const handlePermissionChange = (
    type: 'tabs' | 'sections',
    key: string,
    value: PermissionValue
  ) => {
    if (!editConfig) return;
    setEditConfig({
      ...editConfig,
      [type]: {
        ...editConfig[type],
        [key]: value,
      },
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!member || !editConfig) return;
    setIsSaving(true);
    try {
      await updateOverride.mutateAsync({
        userId: member.user_id,
        config: editConfig,
      });
      toast.success('Permissions saved');
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!member) return;
    setIsSaving(true);
    try {
      await deleteOverride.mutateAsync(member.user_id);
      toast.success('Permissions reset to role defaults');
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to reset permissions');
    } finally {
      setIsSaving(false);
    }
  };

  if (!member || !editConfig) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-accent-yellow" />
            Permissions for {member.user_name || member.user_username}
          </DialogTitle>
          <DialogDescription>
            Customize view and edit permissions for this team member. Changes override their role defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Accordion type="single" collapsible defaultValue="tabs">
            <AccordionItem value="tabs">
              <AccordionTrigger className="text-sm font-medium text-bone-white">
                Tab Permissions
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {TAB_DEFINITIONS.map(tab => (
                    <div
                      key={tab.key}
                      className="flex items-center justify-between py-2 border-b border-muted-gray/20 last:border-0"
                    >
                      <span className="text-sm text-bone-white">{tab.label}</span>
                      <PermissionToggle
                        value={normalizePermission(editConfig.tabs[tab.key])}
                        onChange={(value) => handlePermissionChange('tabs', tab.key, value)}
                      />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sections">
              <AccordionTrigger className="text-sm font-medium text-bone-white">
                Section Permissions
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {SECTION_DEFINITIONS.map(section => (
                    <div
                      key={section.key}
                      className="flex items-center justify-between py-2 border-b border-muted-gray/20 last:border-0"
                    >
                      <span className="text-sm text-bone-white">{section.label}</span>
                      <PermissionToggle
                        value={normalizePermission(editConfig.sections[section.key])}
                        onChange={(value) => handlePermissionChange('sections', section.key, value)}
                      />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-muted-gray/20">
          {existingOverride && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Role Defaults
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PermissionEditorDialog;
