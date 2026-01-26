/**
 * RuleConditionBuilder
 * Visual builder for creating folder rule conditions
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  RuleCondition,
  CONDITION_TYPE_LABELS,
  OPERATOR_LABELS,
  CONTEXT_TYPE_LABELS,
} from '@/hooks/useFolderRules';
import { Plus, X, User, Search, MessageSquare } from 'lucide-react';

interface RuleConditionBuilderProps {
  conditions: RuleCondition[];
  conditionLogic: 'AND' | 'OR';
  onChange: (conditions: RuleCondition[], logic: 'AND' | 'OR') => void;
}

export function RuleConditionBuilder({
  conditions,
  conditionLogic,
  onChange,
}: RuleConditionBuilderProps) {
  const addCondition = (type: RuleCondition['type']) => {
    const newCondition: RuleCondition = {
      type,
      operator: type === 'sender' ? 'in' : type === 'keyword' ? 'contains' : 'equals',
      value: type === 'context' ? 'personal' : [],
    };
    onChange([...conditions, newCondition], conditionLogic);
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated, conditionLogic);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index), conditionLogic);
  };

  const toggleLogic = () => {
    onChange(conditions, conditionLogic === 'AND' ? 'OR' : 'AND');
  };

  return (
    <div className="space-y-4">
      {/* Condition logic toggle */}
      {conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Match</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleLogic}
            className={cn(
              'min-w-[60px]',
              conditionLogic === 'AND' && 'bg-accent-yellow/20 border-accent-yellow'
            )}
          >
            {conditionLogic === 'AND' ? 'All' : 'Any'}
          </Button>
          <span className="text-sm text-muted-foreground">of the following conditions</span>
        </div>
      )}

      {/* Conditions list */}
      <div className="space-y-3">
        {conditions.map((condition, index) => (
          <ConditionRow
            key={index}
            condition={condition}
            onUpdate={(updates) => updateCondition(index, updates)}
            onRemove={() => removeCondition(index)}
            showLogic={index > 0}
            logic={conditionLogic}
          />
        ))}
      </div>

      {/* Add condition buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addCondition('sender')}
          className="text-muted-foreground hover:text-bone-white"
        >
          <User className="h-4 w-4 mr-2" />
          Add Sender Condition
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addCondition('keyword')}
          className="text-muted-foreground hover:text-bone-white"
        >
          <Search className="h-4 w-4 mr-2" />
          Add Keyword Condition
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addCondition('context')}
          className="text-muted-foreground hover:text-bone-white"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Add Context Condition
        </Button>
      </div>
    </div>
  );
}

interface ConditionRowProps {
  condition: RuleCondition;
  onUpdate: (updates: Partial<RuleCondition>) => void;
  onRemove: () => void;
  showLogic: boolean;
  logic: 'AND' | 'OR';
}

function ConditionRow({ condition, onUpdate, onRemove, showLogic, logic }: ConditionRowProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddValue = () => {
    if (!inputValue.trim()) return;

    const currentValue = Array.isArray(condition.value) ? condition.value : [];
    onUpdate({ value: [...currentValue, inputValue.trim()] });
    setInputValue('');
  };

  const handleRemoveValue = (index: number) => {
    const currentValue = Array.isArray(condition.value) ? condition.value : [];
    onUpdate({ value: currentValue.filter((_, i) => i !== index) });
  };

  const getOperatorOptions = (): { value: string; label: string }[] => {
    switch (condition.type) {
      case 'sender':
        return [
          { value: 'in', label: 'is any of' },
          { value: 'not_in', label: 'is not any of' },
        ];
      case 'keyword':
        return [
          { value: 'contains', label: 'contains any of' },
          { value: 'not_contains', label: 'does not contain' },
        ];
      case 'context':
        return [
          { value: 'equals', label: 'equals' },
          { value: 'not_equals', label: 'does not equal' },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="flex items-start gap-2 p-3 rounded-md bg-muted-gray/20 border border-muted-gray/30">
      {/* Logic indicator */}
      {showLogic && (
        <div className="flex-shrink-0 pt-2">
          <Badge variant="outline" className="text-xs bg-muted-gray/30">
            {logic}
          </Badge>
        </div>
      )}

      <div className="flex-1 space-y-3">
        {/* Type and operator row */}
        <div className="flex items-center gap-2">
          <Badge className="flex-shrink-0">
            {CONDITION_TYPE_LABELS[condition.type] || condition.type}
          </Badge>

          <Select
            value={condition.operator}
            onValueChange={(value) => onUpdate({ operator: value as RuleCondition['operator'] })}
          >
            <SelectTrigger className="w-[180px] bg-charcoal-black border-muted-gray">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-charcoal-black border-muted-gray text-bone-white">
              {getOperatorOptions().map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Value input */}
        {condition.type === 'context' ? (
          <Select
            value={typeof condition.value === 'string' ? condition.value : ''}
            onValueChange={(value) => onUpdate({ value })}
          >
            <SelectTrigger className="w-full bg-charcoal-black border-muted-gray">
              <SelectValue placeholder="Select context type..." />
            </SelectTrigger>
            <SelectContent className="bg-charcoal-black border-muted-gray text-bone-white">
              {Object.entries(CONTEXT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="space-y-2">
            {/* Value tags */}
            {Array.isArray(condition.value) && condition.value.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {condition.value.map((val, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="bg-muted-gray/30 gap-1"
                  >
                    {condition.type === 'sender' ? `User ${index + 1}` : val}
                    <button
                      type="button"
                      onClick={() => handleRemoveValue(index)}
                      className="hover:text-primary-red"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add value input */}
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  condition.type === 'sender'
                    ? 'Enter user ID...'
                    : 'Enter keyword...'
                }
                className="flex-1 bg-charcoal-black border-muted-gray"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddValue();
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                onClick={handleAddValue}
                disabled={!inputValue.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Remove button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="text-muted-foreground hover:text-primary-red"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default RuleConditionBuilder;
