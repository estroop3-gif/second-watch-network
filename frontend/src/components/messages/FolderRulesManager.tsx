/**
 * FolderRulesManager
 * Full management UI for folder auto-sorting rules
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  useFolderRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useToggleRule,
  useApplyRule,
  FolderRule,
  RuleCondition,
} from '@/hooks/useFolderRules';
import { useCustomFolders, CustomFolder } from '@/hooks/useCustomFolders';
import { RuleConditionBuilder } from './RuleConditionBuilder';
import {
  Plus,
  Trash2,
  Edit2,
  Play,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
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

interface FolderRulesManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FolderRulesManager({ isOpen, onClose }: FolderRulesManagerProps) {
  const [editingRule, setEditingRule] = useState<FolderRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  const { data: rules, isLoading: rulesLoading } = useFolderRules();
  const { data: folders } = useCustomFolders();
  const deleteRule = useDeleteRule();
  const toggleRule = useToggleRule();
  const applyRule = useApplyRule();

  const handleEditRule = (rule: FolderRule) => {
    setEditingRule(rule);
    setIsCreating(false);
  };

  const handleCreateNew = () => {
    setEditingRule(null);
    setIsCreating(true);
  };

  const handleCloseEditor = () => {
    setEditingRule(null);
    setIsCreating(false);
  };

  const handleDeleteRule = async () => {
    if (!deleteRuleId) return;
    try {
      await deleteRule.mutateAsync(deleteRuleId);
      setDeleteRuleId(null);
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      await toggleRule.mutateAsync({ ruleId, isActive });
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const handleApplyRule = async (ruleId: string) => {
    try {
      const result = await applyRule.mutateAsync(ruleId);
      alert(`Rule applied to ${result.conversations_assigned} conversations.`);
    } catch (error) {
      console.error('Failed to apply rule:', error);
    }
  };

  if (isCreating || editingRule) {
    return (
      <RuleEditor
        isOpen={isOpen}
        onClose={handleCloseEditor}
        rule={editingRule}
        folders={folders || []}
      />
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] bg-charcoal-black border-muted-gray text-bone-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent-yellow" />
              Folder Rules
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Description */}
            <p className="text-sm text-muted-foreground">
              Create rules to automatically sort incoming messages into folders based on sender, keywords, or message context.
            </p>

            {/* Rules list */}
            <ScrollArea className="max-h-[400px]">
              {rulesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !rules || rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <p>No rules created yet</p>
                  <p className="text-sm">Create a rule to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onEdit={() => handleEditRule(rule)}
                      onDelete={() => setDeleteRuleId(rule.id)}
                      onToggle={(isActive) => handleToggleRule(rule.id, isActive)}
                      onApply={() => handleApplyRule(rule.id)}
                      isApplying={applyRule.isPending}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Create button */}
            <Button onClick={handleCreateNew} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create New Rule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray text-bone-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this rule? Existing folder assignments will not be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted-gray/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRule}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteRule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface RuleCardProps {
  rule: FolderRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (isActive: boolean) => void;
  onApply: () => void;
  isApplying: boolean;
}

function RuleCard({ rule, onEdit, onDelete, onToggle, onApply, isApplying }: RuleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        rule.is_active
          ? 'border-muted-gray/50 bg-muted-gray/10'
          : 'border-muted-gray/30 bg-muted-gray/5 opacity-60'
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <Switch
          checked={rule.is_active}
          onCheckedChange={onToggle}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{rule.name}</p>
          <p className="text-xs text-muted-foreground">
            → {rule.folder_name} • {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="h-8 w-8"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-muted-foreground hover:text-primary-red"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-muted-gray/30 space-y-3">
          {/* Conditions summary */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Conditions ({rule.condition_logic})
            </p>
            {rule.conditions.map((condition, index) => (
              <div key={index} className="text-sm pl-2 border-l-2 border-muted-gray/30">
                {condition.type}: {condition.operator}{' '}
                {Array.isArray(condition.value)
                  ? condition.value.join(', ')
                  : condition.value}
              </div>
            ))}
          </div>

          {/* Apply to existing button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onApply}
            disabled={isApplying}
            className="w-full"
          >
            {isApplying ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Apply to existing conversations
          </Button>
        </div>
      )}
    </div>
  );
}

interface RuleEditorProps {
  isOpen: boolean;
  onClose: () => void;
  rule: FolderRule | null;
  folders: CustomFolder[];
}

function RuleEditor({ isOpen, onClose, rule, folders }: RuleEditorProps) {
  const [name, setName] = useState(rule?.name || '');
  const [folderId, setFolderId] = useState(rule?.folder_id || '');
  const [conditions, setConditions] = useState<RuleCondition[]>(rule?.conditions || []);
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>(rule?.condition_logic || 'AND');
  const [priority, setPriority] = useState(rule?.priority || 0);
  const [applyToExisting, setApplyToExisting] = useState(false);

  const createRule = useCreateRule();
  const updateRule = useUpdateRule();

  const isEditing = !!rule;
  const isLoading = createRule.isPending || updateRule.isPending;
  const canSave = name.trim() && folderId && conditions.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSave) return;

    try {
      if (isEditing) {
        await updateRule.mutateAsync({
          ruleId: rule.id,
          name: name.trim(),
          folder_id: folderId,
          conditions,
          condition_logic: conditionLogic,
          priority,
        });
      } else {
        await createRule.mutateAsync({
          name: name.trim(),
          folder_id: folderId,
          conditions,
          condition_logic: conditionLogic,
          priority,
          apply_to_existing: applyToExisting,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto bg-charcoal-black border-muted-gray text-bone-white">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Rule' : 'Create Rule'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Rule name */}
          <div className="space-y-2">
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Work Messages"
              className="bg-muted-gray/20 border-muted-gray"
            />
          </div>

          {/* Target folder */}
          <div className="space-y-2">
            <Label>Move to Folder</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger className="bg-muted-gray/20 border-muted-gray">
                <SelectValue placeholder="Select a folder..." />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray text-bone-white">
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <Label>Conditions</Label>
            <RuleConditionBuilder
              conditions={conditions}
              conditionLogic={conditionLogic}
              onChange={(newConditions, newLogic) => {
                setConditions(newConditions);
                setConditionLogic(newLogic);
              }}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="rule-priority">Priority (higher = evaluated first)</Label>
            <Input
              id="rule-priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              className="bg-muted-gray/20 border-muted-gray w-24"
            />
          </div>

          {/* Apply to existing (only for new rules) */}
          {!isEditing && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="apply-existing"
                checked={applyToExisting}
                onCheckedChange={(checked) => setApplyToExisting(checked === true)}
              />
              <Label htmlFor="apply-existing" className="text-sm cursor-pointer">
                Apply to existing conversations
              </Label>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !canSave}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
