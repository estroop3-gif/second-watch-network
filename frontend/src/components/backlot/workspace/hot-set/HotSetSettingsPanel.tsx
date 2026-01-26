/**
 * HotSetSettingsPanel - Configuration panel for Hot Set preferences
 *
 * Settings:
 * - Auto-start configuration (enable/disable, minutes before call)
 * - Notification configuration (enable/disable, timing, recipients)
 * - Catch-up suggestion triggers (thresholds)
 * - Default view preferences
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Bell,
  Clock,
  Lightbulb,
  Eye,
  Save,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HotSetSettings } from '@/types/backlot';

interface HotSetSettingsPanelProps {
  settings: HotSetSettings | null;
  onSave: (settings: Partial<HotSetSettings>) => void;
  isSaving?: boolean;
  className?: string;
}

export const HotSetSettingsPanel: React.FC<HotSetSettingsPanelProps> = ({
  settings,
  onSave,
  isSaving = false,
  className,
}) => {
  // Local state for form
  const [formData, setFormData] = useState<Partial<HotSetSettings>>({
    auto_start_enabled: settings?.auto_start_enabled ?? true,
    auto_start_minutes_before_call: settings?.auto_start_minutes_before_call ?? 30,
    notifications_enabled: settings?.notifications_enabled ?? true,
    notify_minutes_before_call: settings?.notify_minutes_before_call ?? 30,
    notify_crew_on_auto_start: settings?.notify_crew_on_auto_start ?? true,
    suggestion_trigger_minutes_behind: settings?.suggestion_trigger_minutes_behind ?? 15,
    suggestion_trigger_meal_penalty_minutes: settings?.suggestion_trigger_meal_penalty_minutes ?? 30,
    suggestion_trigger_wrap_extension_minutes: settings?.suggestion_trigger_wrap_extension_minutes ?? 30,
    default_schedule_view: settings?.default_schedule_view ?? 'current',
  });

  const [hasChanges, setHasChanges] = useState(false);

  const updateField = <K extends keyof HotSetSettings>(
    field: K,
    value: HotSetSettings[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(formData);
    setHasChanges(false);
  };

  const handleReset = () => {
    setFormData({
      auto_start_enabled: settings?.auto_start_enabled ?? true,
      auto_start_minutes_before_call: settings?.auto_start_minutes_before_call ?? 30,
      notifications_enabled: settings?.notifications_enabled ?? true,
      notify_minutes_before_call: settings?.notify_minutes_before_call ?? 30,
      notify_crew_on_auto_start: settings?.notify_crew_on_auto_start ?? true,
      suggestion_trigger_minutes_behind: settings?.suggestion_trigger_minutes_behind ?? 15,
      suggestion_trigger_meal_penalty_minutes: settings?.suggestion_trigger_meal_penalty_minutes ?? 30,
      suggestion_trigger_wrap_extension_minutes: settings?.suggestion_trigger_wrap_extension_minutes ?? 30,
      default_schedule_view: settings?.default_schedule_view ?? 'current',
    });
    setHasChanges(false);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Save/Reset buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-accent-yellow" />
          <h2 className="text-xl font-semibold text-bone-white">Hot Set Settings</h2>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isSaving}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="bg-primary-red hover:bg-primary-red/90"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Auto-Start Settings */}
      <Card className="bg-soft-black border-muted-gray/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-accent-yellow" />
            Auto-Start Configuration
          </CardTitle>
          <CardDescription>
            Automatically start Hot Set sessions at crew call time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-start-enabled" className="text-bone-white">
                Enable Auto-Start
              </Label>
              <p className="text-sm text-muted-gray">
                Session will automatically activate at crew call time
              </p>
            </div>
            <Switch
              id="auto-start-enabled"
              checked={formData.auto_start_enabled}
              onCheckedChange={(checked) => updateField('auto_start_enabled', checked)}
            />
          </div>

          {formData.auto_start_enabled && (
            <div className="space-y-2 pl-4 border-l-2 border-accent-yellow/30">
              <Label htmlFor="auto-start-minutes" className="text-bone-white">
                Start Session (minutes before crew call)
              </Label>
              <Input
                id="auto-start-minutes"
                type="number"
                min="0"
                max="120"
                value={formData.auto_start_minutes_before_call}
                onChange={(e) => updateField('auto_start_minutes_before_call', parseInt(e.target.value))}
                className="w-32"
              />
              <p className="text-xs text-muted-gray">
                Session activates {formData.auto_start_minutes_before_call} minutes before crew call
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="bg-soft-black border-muted-gray/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4 text-accent-yellow" />
            Notification Configuration
          </CardTitle>
          <CardDescription>
            Send notifications to crew about shoot day events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications-enabled" className="text-bone-white">
                Enable Notifications
              </Label>
              <p className="text-sm text-muted-gray">
                Send notifications to crew working the shoot day
              </p>
            </div>
            <Switch
              id="notifications-enabled"
              checked={formData.notifications_enabled}
              onCheckedChange={(checked) => updateField('notifications_enabled', checked)}
            />
          </div>

          {formData.notifications_enabled && (
            <div className="space-y-4 pl-4 border-l-2 border-accent-yellow/30">
              <div className="space-y-2">
                <Label htmlFor="notify-minutes" className="text-bone-white">
                  Pre-Crew Call Reminder (minutes before)
                </Label>
                <Input
                  id="notify-minutes"
                  type="number"
                  min="0"
                  max="240"
                  value={formData.notify_minutes_before_call}
                  onChange={(e) => updateField('notify_minutes_before_call', parseInt(e.target.value))}
                  className="w-32"
                />
                <p className="text-xs text-muted-gray">
                  Notify crew {formData.notify_minutes_before_call} minutes before call time
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-auto-start" className="text-sm text-bone-white">
                    Notify on Auto-Start
                  </Label>
                  <p className="text-xs text-muted-gray">
                    Send notification when session auto-starts
                  </p>
                </div>
                <Switch
                  id="notify-auto-start"
                  checked={formData.notify_crew_on_auto_start}
                  onCheckedChange={(checked) => updateField('notify_crew_on_auto_start', checked)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Catch-Up Suggestion Triggers */}
      <Card className="bg-soft-black border-muted-gray/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="w-4 h-4 text-accent-yellow" />
            Catch-Up Suggestion Triggers
          </CardTitle>
          <CardDescription>
            Configure when to show catch-up suggestions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="behind-trigger" className="text-bone-white">
              Minutes Behind Schedule
            </Label>
            <Input
              id="behind-trigger"
              type="number"
              min="5"
              max="60"
              value={formData.suggestion_trigger_minutes_behind}
              onChange={(e) => updateField('suggestion_trigger_minutes_behind', parseInt(e.target.value))}
              className="w-32"
            />
            <p className="text-xs text-muted-gray">
              Show suggestions when {formData.suggestion_trigger_minutes_behind}+ minutes behind
            </p>
          </div>

          <Separator className="bg-muted-gray/20" />

          <div className="space-y-2">
            <Label htmlFor="meal-penalty-trigger" className="text-bone-white">
              Meal Penalty Warning (minutes before)
            </Label>
            <Input
              id="meal-penalty-trigger"
              type="number"
              min="10"
              max="120"
              value={formData.suggestion_trigger_meal_penalty_minutes}
              onChange={(e) => updateField('suggestion_trigger_meal_penalty_minutes', parseInt(e.target.value))}
              className="w-32"
            />
            <p className="text-xs text-muted-gray">
              Warn when approaching meal penalty
            </p>
          </div>

          <Separator className="bg-muted-gray/20" />

          <div className="space-y-2">
            <Label htmlFor="wrap-extension-trigger" className="text-bone-white">
              Wrap Extension Warning (minutes over)
            </Label>
            <Input
              id="wrap-extension-trigger"
              type="number"
              min="10"
              max="120"
              value={formData.suggestion_trigger_wrap_extension_minutes}
              onChange={(e) => updateField('suggestion_trigger_wrap_extension_minutes', parseInt(e.target.value))}
              className="w-32"
            />
            <p className="text-xs text-muted-gray">
              Warn when projected wrap extends {formData.suggestion_trigger_wrap_extension_minutes}+ minutes
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Default View Preferences */}
      <Card className="bg-soft-black border-muted-gray/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="w-4 h-4 text-accent-yellow" />
            Default View Preferences
          </CardTitle>
          <CardDescription>
            Choose which tab to show by default
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="default-view" className="text-bone-white">
              Default Schedule View
            </Label>
            <Select
              value={formData.default_schedule_view}
              onValueChange={(value) => updateField('default_schedule_view', value as 'current' | 'full' | 'completed')}
            >
              <SelectTrigger id="default-view" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current & Upcoming</SelectItem>
                <SelectItem value="full">Full Day Schedule</SelectItem>
                <SelectItem value="completed">Completed Items</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-gray">
              This tab will be shown first when opening Hot Set
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
