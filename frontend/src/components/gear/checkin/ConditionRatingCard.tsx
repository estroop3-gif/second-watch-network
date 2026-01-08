/**
 * Condition Rating Card
 * Per-item condition assessment for check-in
 */
import React from 'react';
import { AlertTriangle, Camera, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { AssetCondition } from '@/types/gear';

const CONDITIONS: { value: AssetCondition; label: string; color: string }[] = [
  { value: 'excellent', label: 'Excellent', color: 'bg-green-500' },
  { value: 'good', label: 'Good', color: 'bg-blue-500' },
  { value: 'fair', label: 'Fair', color: 'bg-yellow-500' },
  { value: 'poor', label: 'Poor', color: 'bg-orange-500' },
  { value: 'non_functional', label: 'Non-functional', color: 'bg-red-500' },
];

interface ConditionRatingCardProps {
  assetId: string;
  assetName: string;
  currentCondition?: AssetCondition;
  hasDamage?: boolean;
  onConditionChange: (condition: AssetCondition, notes?: string) => void;
  onReportDamage: () => void;
}

export function ConditionRatingCard({
  assetId,
  assetName,
  currentCondition,
  hasDamage,
  onConditionChange,
  onReportDamage,
}: ConditionRatingCardProps) {
  const [notes, setNotes] = React.useState('');
  const [showNotes, setShowNotes] = React.useState(false);

  const handleConditionSelect = (value: AssetCondition) => {
    onConditionChange(value, notes || undefined);
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (currentCondition) {
      onConditionChange(currentCondition, value || undefined);
    }
  };

  const selectedCondition = CONDITIONS.find((c) => c.value === currentCondition);

  return (
    <Card className={cn(hasDamage && 'border-destructive')}>
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{assetName}</p>
          </div>
          {currentCondition && (
            <Badge
              variant="secondary"
              className={cn(
                'shrink-0 ml-2',
                selectedCondition?.color.replace('bg-', 'bg-') + '/20'
              )}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              {selectedCondition?.label}
            </Badge>
          )}
          {hasDamage && (
            <Badge variant="destructive" className="shrink-0 ml-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Damaged
            </Badge>
          )}
        </div>

        {/* Condition Selector */}
        <div className="flex items-center gap-2">
          <Select value={currentCondition || ''} onValueChange={handleConditionSelect}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map((cond) => (
                <SelectItem key={cond.value} value={cond.value}>
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', cond.color)} />
                    {cond.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={hasDamage ? 'destructive' : 'outline'}
            size="sm"
            onClick={onReportDamage}
          >
            <Camera className="h-4 w-4 mr-1" />
            {hasDamage ? 'Edit Damage' : 'Report Damage'}
          </Button>
        </div>

        {/* Optional Notes */}
        {(showNotes || notes) && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              placeholder="Add condition notes..."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
        )}

        {!showNotes && !notes && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotes(true)}
            className="text-xs text-muted-foreground"
          >
            + Add notes
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default ConditionRatingCard;
