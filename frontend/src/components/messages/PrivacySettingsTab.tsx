/**
 * PrivacySettingsTab
 * Privacy settings for messaging: who can message, read receipts, online status
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Save, Globe, Users, Ban, Eye, EyeOff, Wifi } from 'lucide-react';
import {
  useMessagePreferences,
  useUpdateMessagePreferences,
  MessagePreferences,
} from '@/hooks/useMessageSettings';
import { useToast } from '@/hooks/use-toast';

export function PrivacySettingsTab() {
  const { data: preferences, isLoading } = useMessagePreferences();
  const updatePreferences = useUpdateMessagePreferences();
  const { toast } = useToast();

  const [localPrefs, setLocalPrefs] = useState<MessagePreferences>({
    who_can_message: 'everyone',
    show_read_receipts: true,
    show_online_status: true,
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state with fetched preferences
  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
      setHasChanges(false);
    }
  }, [preferences]);

  const handleChange = (field: keyof MessagePreferences, value: any) => {
    setLocalPrefs((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updatePreferences.mutateAsync(localPrefs);
      setHasChanges(false);
      toast({
        title: 'Settings saved',
        description: 'Your privacy settings have been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to save settings',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Who can message me */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Who can message me</Label>
        <RadioGroup
          value={localPrefs.who_can_message}
          onValueChange={(v) => handleChange('who_can_message', v)}
        >
          <div
            className="flex items-start space-x-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30 hover:bg-muted-gray/20 transition-colors cursor-pointer"
            onClick={() => handleChange('who_can_message', 'everyone')}
          >
            <RadioGroupItem value="everyone" id="everyone" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-green-500" />
                <Label htmlFor="everyone" className="cursor-pointer font-medium">
                  Everyone
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Anyone on the platform can send you messages
              </p>
            </div>
          </div>

          <div
            className="flex items-start space-x-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30 hover:bg-muted-gray/20 transition-colors cursor-pointer"
            onClick={() => handleChange('who_can_message', 'connections')}
          >
            <RadioGroupItem value="connections" id="connections" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <Label htmlFor="connections" className="cursor-pointer font-medium">
                  Connections Only
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only mutual followers, project collaborators, or Order members can message you
              </p>
            </div>
          </div>

          <div
            className="flex items-start space-x-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30 hover:bg-muted-gray/20 transition-colors cursor-pointer"
            onClick={() => handleChange('who_can_message', 'nobody')}
          >
            <RadioGroupItem value="nobody" id="nobody" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-500" />
                <Label htmlFor="nobody" className="cursor-pointer font-medium">
                  Nobody
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                No one can send you new messages (existing conversations still work)
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Read receipts */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
        <div className="flex items-start gap-3">
          {localPrefs.show_read_receipts ? (
            <Eye className="h-5 w-5 text-muted-foreground mt-0.5" />
          ) : (
            <EyeOff className="h-5 w-5 text-muted-foreground mt-0.5" />
          )}
          <div>
            <Label className="font-medium">Read Receipts</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {localPrefs.show_read_receipts
                ? 'Others can see when you\'ve read their messages'
                : 'Others won\'t know when you\'ve read their messages'}
            </p>
          </div>
        </div>
        <Switch
          checked={localPrefs.show_read_receipts}
          onCheckedChange={(checked) => handleChange('show_read_receipts', checked)}
        />
      </div>

      {/* Online status */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
        <div className="flex items-start gap-3">
          <Wifi className={`h-5 w-5 mt-0.5 ${localPrefs.show_online_status ? 'text-green-500' : 'text-muted-foreground'}`} />
          <div>
            <Label className="font-medium">Online Status</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {localPrefs.show_online_status
                ? 'Others can see when you\'re online'
                : 'Your online status is hidden from others'}
            </p>
          </div>
        </div>
        <Switch
          checked={localPrefs.show_online_status}
          onCheckedChange={(checked) => handleChange('show_online_status', checked)}
        />
      </div>

      {/* Save button */}
      {hasChanges && (
        <Button
          onClick={handleSave}
          disabled={updatePreferences.isPending}
          className="w-full"
        >
          {updatePreferences.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      )}
    </div>
  );
}
