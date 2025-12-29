/**
 * PackageCreateEditDialog - Create or edit a document package
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Loader2,
  GripVertical,
  FileText,
} from 'lucide-react';
import { useDocumentPackages, useClearanceTemplates } from '@/hooks/backlot';
import {
  DocumentPackage,
  DocumentPackageInput,
  DocumentPackageItemInput,
  DocumentPackageTargetType,
  BacklotClearanceType,
  CLEARANCE_TYPE_LABELS,
  CLEARANCE_TYPE_GROUPS,
  CLEARANCE_TYPE_GROUP_LABELS,
} from '@/types/backlot';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PackageCreateEditDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  package?: DocumentPackage | null;
}

const TARGET_TYPE_OPTIONS: { value: DocumentPackageTargetType; label: string }[] = [
  { value: 'all', label: 'All (Cast & Crew)' },
  { value: 'cast', label: 'Cast Only' },
  { value: 'crew', label: 'Crew Only' },
];

export function PackageCreateEditDialog({
  projectId,
  open,
  onClose,
  package: existingPackage,
}: PackageCreateEditDialogProps) {
  const isEditing = !!existingPackage;
  const { createPackage, updatePackage } = useDocumentPackages(projectId);
  const { data: templates } = useClearanceTemplates(projectId);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<DocumentPackageTargetType>('all');
  const [items, setItems] = useState<DocumentPackageItemInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when opening/closing or package changes
  useEffect(() => {
    if (open) {
      if (existingPackage) {
        setName(existingPackage.name);
        setDescription(existingPackage.description || '');
        setTargetType(existingPackage.target_type);
        setItems(
          existingPackage.items?.map((item) => ({
            clearance_type: item.clearance_type,
            template_id: item.template_id || undefined,
            is_required: item.is_required,
            sort_order: item.sort_order,
            custom_title: item.custom_title || undefined,
            custom_description: item.custom_description || undefined,
          })) || []
        );
      } else {
        setName('');
        setDescription('');
        setTargetType('all');
        setItems([]);
      }
    }
  }, [open, existingPackage]);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        clearance_type: 'nda' as BacklotClearanceType,
        is_required: true,
        sort_order: items.length,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, updates: Partial<DocumentPackageItemInput>) => {
    setItems(items.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Package name is required');
      return;
    }

    if (items.length === 0) {
      toast.error('Add at least one document to the package');
      return;
    }

    setIsSubmitting(true);

    try {
      const input: DocumentPackageInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        target_type: targetType,
        items,
      };

      if (isEditing && existingPackage) {
        await updatePackage.mutateAsync({
          packageId: existingPackage.id,
          ...input,
        });
        toast.success('Package updated');
      } else {
        await createPackage.mutateAsync({
          projectId,
          ...input,
        });
        toast.success('Package created');
      }

      onClose();
    } catch (err) {
      toast.error(isEditing ? 'Failed to update package' : 'Failed to create package', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Package' : 'Create Document Package'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Package Name *</Label>
              <Input
                id="name"
                placeholder="e.g., New Crew Onboarding"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this package is for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Target Recipients</Label>
              <Select
                value={targetType}
                onValueChange={(v) => setTargetType(v as DocumentPackageTargetType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Document Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Documents in Package</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Document
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="border border-dashed border-muted-gray/50 rounded-lg p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No documents added yet. Click &quot;Add Document&quot; to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <PackageItemRow
                    key={index}
                    item={item}
                    index={index}
                    templates={templates || []}
                    onUpdate={(updates) => handleUpdateItem(index, updates)}
                    onRemove={() => handleRemoveItem(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-primary-red hover:bg-primary-red/90"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Package'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Package Item Row Component
function PackageItemRow({
  item,
  index,
  templates,
  onUpdate,
  onRemove,
}: {
  item: DocumentPackageItemInput;
  index: number;
  templates: Array<{ id: string; name: string; clearance_type: string }>;
  onUpdate: (updates: Partial<DocumentPackageItemInput>) => void;
  onRemove: () => void;
}) {
  // Get templates that match the selected clearance type
  const matchingTemplates = templates.filter(
    (t) => t.clearance_type === item.clearance_type
  );

  return (
    <div className="flex items-start gap-3 p-3 bg-muted-gray/10 rounded-lg">
      <div className="flex items-center text-muted-foreground cursor-move">
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Document Type */}
          <div className="space-y-1">
            <Label className="text-xs">Document Type</Label>
            <Select
              value={item.clearance_type}
              onValueChange={(v) =>
                onUpdate({
                  clearance_type: v as BacklotClearanceType,
                  template_id: undefined, // Reset template when type changes
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLEARANCE_TYPE_GROUPS).map(([group, types]) => (
                  <React.Fragment key={group}>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {CLEARANCE_TYPE_GROUP_LABELS[group as keyof typeof CLEARANCE_TYPE_GROUP_LABELS]}
                    </div>
                    {types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CLEARANCE_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template (optional) */}
          <div className="space-y-1">
            <Label className="text-xs">Template (optional)</Label>
            <Select
              value={item.template_id || '_none'}
              onValueChange={(v) => onUpdate({ template_id: v === '_none' ? undefined : v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="No template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No template</SelectItem>
                {matchingTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom Title (optional) */}
        <div className="space-y-1">
          <Label className="text-xs">Custom Title (optional)</Label>
          <Input
            placeholder={CLEARANCE_TYPE_LABELS[item.clearance_type]}
            value={item.custom_title || ''}
            onChange={(e) => onUpdate({ custom_title: e.target.value || undefined })}
            className="h-9"
          />
        </div>

        {/* Required Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            checked={item.is_required}
            onCheckedChange={(checked) => onUpdate({ is_required: checked })}
          />
          <Label className="text-xs font-normal">Required document</Label>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-red-400"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
