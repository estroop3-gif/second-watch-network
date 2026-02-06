import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, RotateCcw, Settings } from 'lucide-react';
import {
  useRolePresets,
  useViewProfiles,
  normalizePermission,
  type ViewEditConfig,
  type PermissionValue,
} from '@/hooks/backlot/useProjectAccess';
import { BACKLOT_ROLES } from '@/hooks/backlot/useProjectRoles';
import { TAB_DEFINITIONS, SECTION_DEFINITIONS, BACKLOT_ROLE_COLORS } from './constants';
import PermissionToggle from './PermissionToggle';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RolePresetEditorProps {
  projectId: string;
  initialRole?: string | null;
}

const RolePresetEditor: React.FC<RolePresetEditorProps> = ({ projectId, initialRole }) => {
  const { data: rolePresets, isLoading } = useRolePresets(projectId);
  const { viewProfiles, updateProfile, deleteProfile } = useViewProfiles(projectId);
  const [selectedRole, setSelectedRole] = useState<string | null>(initialRole || null);
  const [editConfig, setEditConfig] = useState<ViewEditConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Set the initial role if passed via props (e.g. from role legend click)
  React.useEffect(() => {
    if (initialRole) {
      setSelectedRole(initialRole);
    }
  }, [initialRole]);

  const activeConfig = useMemo(() => {
    if (!selectedRole || !rolePresets) return null;
    const customProfile = viewProfiles.find(p => p.backlot_role === selectedRole);
    if (customProfile) return customProfile.config;
    const preset = rolePresets.find(p => p.role === selectedRole);
    return preset?.config || null;
  }, [selectedRole, rolePresets, viewProfiles]);

  const hasCustomProfile = useMemo(() => {
    if (!selectedRole) return false;
    return viewProfiles.some(p => p.backlot_role === selectedRole);
  }, [selectedRole, viewProfiles]);

  React.useEffect(() => {
    if (activeConfig) {
      setEditConfig(JSON.parse(JSON.stringify(activeConfig)));
      setHasChanges(false);
    }
  }, [activeConfig]);

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
    if (!selectedRole || !editConfig) return;
    setIsSaving(true);
    try {
      await updateProfile.mutateAsync({
        role: selectedRole,
        config: editConfig,
      });
      toast.success('Role preset saved');
      setHasChanges(false);
    } catch (err) {
      toast.error('Failed to save role preset');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      await deleteProfile.mutateAsync(selectedRole);
      toast.success('Role preset reset to defaults');
      setHasChanges(false);
    } catch (err) {
      toast.error('Failed to reset role preset');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={selectedRole || ''} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a role..." />
          </SelectTrigger>
          <SelectContent>
            {BACKLOT_ROLES.map(role => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRole && hasCustomProfile && (
          <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            Custom
          </Badge>
        )}
        {selectedRole && (
          <Badge
            variant="outline"
            className={cn('text-xs', BACKLOT_ROLE_COLORS[selectedRole] || BACKLOT_ROLE_COLORS.crew)}
          >
            {BACKLOT_ROLES.find(r => r.value === selectedRole)?.label}
          </Badge>
        )}
      </div>

      {selectedRole && editConfig && (
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-bone-white">
              {BACKLOT_ROLES.find(r => r.value === selectedRole)?.label} Permissions
            </CardTitle>
            <CardDescription>
              {BACKLOT_ROLES.find(r => r.value === selectedRole)?.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue="tabs">
              <AccordionItem value="tabs">
                <AccordionTrigger className="text-sm font-medium text-bone-white">
                  Tab Permissions ({TAB_DEFINITIONS.length} tabs)
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

            <div className="flex items-center justify-between pt-4 border-t mt-4 border-muted-gray/20">
              {hasCustomProfile && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to System Defaults
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="ml-auto bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Preset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedRole && (
        <div className="text-center py-8 text-muted-gray">
          <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a role to customize its default permissions</p>
        </div>
      )}
    </div>
  );
};

export default RolePresetEditor;
