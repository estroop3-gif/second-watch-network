/**
 * CatchUpSuggestionsPanel - Actionable suggestions when behind schedule
 *
 * Shows:
 * - List of suggestions with time savings
 * - Impact level indicators
 * - Apply/Dismiss buttons
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { HotSetCatchUpSuggestion } from '@/types/backlot';
import {
  Lightbulb,
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
  Coffee,
  SkipForward,
  Layers,
  Scissors,
  Timer,
  ChevronDown,
  ChevronUp,
  Shuffle,
  Calendar,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface CatchUpSuggestionsPanelProps {
  suggestions: HotSetCatchUpSuggestion[];
  deviationMinutes: number;
  onApplySuggestion?: (suggestion: HotSetCatchUpSuggestion) => void;
  onDismissSuggestion?: (suggestionId: string) => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

// Get icon for suggestion type
function getSuggestionIcon(type: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    shorten_meal: <Coffee className="w-4 h-4" />,
    skip_activity: <SkipForward className="w-4 h-4" />,
    combine_setups: <Layers className="w-4 h-4" />,
    cut_scene: <Scissors className="w-4 h-4" />,
    extend_day: <Timer className="w-4 h-4" />,
    scene_consolidation: <Layers className="w-4 h-4" />,
    schedule_reordering: <Shuffle className="w-4 h-4" />,
    break_shortening: <Coffee className="w-4 h-4" />,
    walking_lunch: <Coffee className="w-4 h-4" />,
    scene_cut: <Scissors className="w-4 h-4" />,
    scene_move: <Calendar className="w-4 h-4" />,
    meal_penalty_warning: <AlertTriangle className="w-4 h-4" />,
    wrap_extension_warning: <AlertTriangle className="w-4 h-4" />,
  };
  return icons[type] || <Lightbulb className="w-4 h-4" />;
}

// Check if suggestion is a warning (not an actionable suggestion)
function isWarningType(type: string): boolean {
  return ['meal_penalty_warning', 'wrap_extension_warning'].includes(type);
}

// Check if suggestion has compliance warnings (affects union rules)
function hasComplianceWarning(type: string): boolean {
  return ['break_shortening', 'walking_lunch', 'extend_day', 'shorten_meal'].includes(type);
}

// Get compliance warning message
function getComplianceWarning(type: string): string | null {
  const warnings: Record<string, string> = {
    break_shortening: 'May require crew consent. Check union agreements.',
    walking_lunch: 'Walking lunch must be agreed upon. Ensure proper meal penalty calculation.',
    extend_day: 'Extended day may trigger meal penalties and additional OT costs.',
    shorten_meal: 'Ensure meal break meets minimum union requirements (typically 30 min).',
  };
  return warnings[type] || null;
}

// Get impact color
function getImpactColor(impact: string): string {
  switch (impact) {
    case 'low':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'high':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  }
}

// Get impact label
function getImpactLabel(impact: string): string {
  switch (impact) {
    case 'low':
      return 'Low Impact';
    case 'medium':
      return 'Medium Impact';
    case 'high':
      return 'High Impact';
    default:
      return impact;
  }
}

export const CatchUpSuggestionsPanel: React.FC<CatchUpSuggestionsPanelProps> = ({
  suggestions,
  deviationMinutes,
  onApplySuggestion,
  onDismissSuggestion,
  isExpanded = true,
  onToggleExpanded,
}) => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Filter out dismissed suggestions
  const visibleSuggestions = suggestions.filter((s) => !dismissedIds.has(s.id));

  // Handle dismiss
  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    onDismissSuggestion?.(id);
  };

  // Calculate total potential time savings
  const totalSavings = visibleSuggestions.reduce((sum, s) => sum + s.time_saved_minutes, 0);

  if (visibleSuggestions.length === 0) {
    return null;
  }

  return (
    <Card className="bg-soft-black border-yellow-500/30">
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={onToggleExpanded}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-yellow-400">
            <Lightbulb className="w-5 h-5" />
            Catch-Up Suggestions
          </CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
              Save up to {totalSavings}m
            </Badge>
            {onToggleExpanded && (
              isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-gray" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-gray" />
              )
            )}
          </div>
        </div>
        {!isExpanded && (
          <p className="text-sm text-muted-gray">
            {visibleSuggestions.length} suggestion{visibleSuggestions.length !== 1 ? 's' : ''} to help get back on track
          </p>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-2 space-y-3">
          {/* Context */}
          <div className="text-sm text-muted-gray flex items-center gap-2 pb-2 border-b border-muted-gray/20">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            You're {deviationMinutes} minutes behind. Here are some ways to catch up:
          </div>

          {/* Suggestions List */}
          <div className="space-y-2">
            {visibleSuggestions.map((suggestion) => {
              const isWarning = isWarningType(suggestion.type);
              return (
                <div
                  key={suggestion.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                    isWarning
                      ? "bg-red-500/10 border-red-500/30 hover:border-red-500/50"
                      : "bg-charcoal-black/50 border-muted-gray/20 hover:border-muted-gray/40"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    isWarning
                      ? "bg-red-500/20 text-red-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  )}>
                    {getSuggestionIcon(suggestion.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn(
                        "font-medium",
                        isWarning ? "text-red-400" : "text-bone-white"
                      )}>
                        {suggestion.description}
                      </span>
                      {!isWarning && (
                        <Badge
                          variant="outline"
                          className={cn('text-xs', getImpactColor(suggestion.impact))}
                        >
                          {getImpactLabel(suggestion.impact)}
                        </Badge>
                      )}
                      {isWarning && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-red-500/20 text-red-400 border-red-500/30"
                        >
                          Warning
                        </Badge>
                      )}
                      {hasComplianceWarning(suggestion.type) && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30"
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Compliance
                        </Badge>
                      )}
                    </div>
                    {!isWarning && suggestion.time_saved_minutes > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-gray mb-1">
                        <Clock className="w-3 h-3" />
                        <span>Save {suggestion.time_saved_minutes} minutes</span>
                      </div>
                    )}

                    {/* Compliance Warning */}
                    {hasComplianceWarning(suggestion.type) && (
                      <div className="mt-2 text-xs text-orange-400 flex items-start gap-1.5 bg-orange-500/10 px-2 py-1.5 rounded border border-orange-500/20">
                        <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{getComplianceWarning(suggestion.type)}</span>
                      </div>
                    )}

                    {/* Additional Action Data */}
                    {suggestion.action_data && Object.keys(suggestion.action_data).length > 0 && (
                      <div className="mt-2 text-xs text-muted-gray">
                        {suggestion.action_data.block_id && (
                          <div>Block ID: {suggestion.action_data.block_id}</div>
                        )}
                        {suggestion.action_data.new_duration !== undefined && (
                          <div>New duration: {suggestion.action_data.new_duration} min</div>
                        )}
                        {suggestion.action_data.scenes && Array.isArray(suggestion.action_data.scenes) && (
                          <div>Affects {suggestion.action_data.scenes.length} scene(s)</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {onApplySuggestion && !isWarning && (
                      <Button
                        size="sm"
                        onClick={() => onApplySuggestion(suggestion)}
                        className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Apply
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDismiss(suggestion.id)}
                      className="text-muted-gray hover:text-bone-white"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          {totalSavings >= deviationMinutes && (
            <div className="text-sm text-green-400 flex items-center gap-2 pt-2 border-t border-muted-gray/20">
              <CheckCircle2 className="w-4 h-4" />
              Applying these suggestions could put you back on schedule!
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default CatchUpSuggestionsPanel;
