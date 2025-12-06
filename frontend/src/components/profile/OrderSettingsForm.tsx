/**
 * OrderSettingsForm Component
 * Client component for editing Order profile visibility settings
 */
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, CheckCircle, Shield, Eye, Users, Globe, Lock } from 'lucide-react';
import {
  OrderProfileSettings,
  OrderProfileSettingsUpdate,
  OrderProfileVisibility,
} from '@/lib/api/order';
import { updateOrderProfileSettings } from '@/lib/api/orderSettings';

interface OrderSettingsFormProps {
  initialSettings: OrderProfileSettings;
  onSaved?: () => void;
}

interface SettingRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = ({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}) => (
  <div className="flex items-center justify-between py-3 border-b border-muted-gray/30 last:border-0">
    <div className="space-y-0.5 pr-4">
      <Label htmlFor={id} className="text-bone-white font-medium cursor-pointer">
        {label}
      </Label>
      <p className="text-sm text-muted-gray">{description}</p>
    </div>
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="data-[state=checked]:bg-emerald-600"
    />
  </div>
);

export const OrderSettingsForm: React.FC<OrderSettingsFormProps> = ({
  initialSettings,
  onSaved,
}) => {
  const [settings, setSettings] = useState<OrderProfileSettingsUpdate>({
    show_membership_status: initialSettings.show_membership_status,
    show_order_badge: initialSettings.show_order_badge,
    show_joined_date: initialSettings.show_joined_date,
    show_city_region: initialSettings.show_city_region,
    show_lodge_info: initialSettings.show_lodge_info,
    show_order_track: initialSettings.show_order_track,
    show_order_activity: initialSettings.show_order_activity,
    public_visibility: initialSettings.public_visibility,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (key: keyof OrderProfileSettingsUpdate) => (checked: boolean) => {
    setSettings(prev => ({ ...prev, [key]: checked }));
    setSaved(false);
  };

  const handleVisibilityChange = (value: OrderProfileVisibility) => {
    setSettings(prev => ({ ...prev, public_visibility: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await updateOrderProfileSettings(settings);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getVisibilityIcon = () => {
    switch (settings.public_visibility) {
      case 'public':
        return <Globe className="h-4 w-4 text-emerald-400" />;
      case 'members-only':
        return <Users className="h-4 w-4 text-amber-400" />;
      case 'private':
        return <Lock className="h-4 w-4 text-red-400" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Visibility Settings */}
      <Card className="bg-charcoal-black/50 border-muted-gray">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-emerald-400" />
            <CardTitle className="text-lg text-bone-white">Visibility</CardTitle>
          </div>
          <CardDescription className="text-muted-gray">
            Control who can see your Order section on your profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-bone-white">Who can see my Order section?</Label>
              <Select
                value={settings.public_visibility}
                onValueChange={handleVisibilityChange}
              >
                <SelectTrigger className="w-full bg-charcoal-black border-muted-gray text-bone-white">
                  <div className="flex items-center gap-2">
                    {getVisibilityIcon()}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray">
                  <SelectItem value="public" className="text-bone-white hover:bg-muted-gray/50">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-emerald-400" />
                      <div>
                        <p className="font-medium">Everyone</p>
                        <p className="text-xs text-muted-gray">Anyone can see your Order section</p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="members-only" className="text-bone-white hover:bg-muted-gray/50">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-400" />
                      <div>
                        <p className="font-medium">Order members only</p>
                        <p className="text-xs text-muted-gray">Only other Order members can see details</p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="private" className="text-bone-white hover:bg-muted-gray/50">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-red-400" />
                      <div>
                        <p className="font-medium">Only me</p>
                        <p className="text-xs text-muted-gray">Only you can see your Order section</p>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card className="bg-charcoal-black/50 border-muted-gray">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            <CardTitle className="text-lg text-bone-white">Display Settings</CardTitle>
          </div>
          <CardDescription className="text-muted-gray">
            Choose what information to show in your Order section
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-muted-gray/30">
            <SettingRow
              id="show_membership_status"
              label="Show membership status"
              description="Display your status (Probationary, Active, etc.)"
              checked={settings.show_membership_status ?? true}
              onCheckedChange={handleToggle('show_membership_status')}
            />
            <SettingRow
              id="show_order_badge"
              label="Show Order badge"
              description="Display the Order and Lodge Officer badges"
              checked={settings.show_order_badge ?? true}
              onCheckedChange={handleToggle('show_order_badge')}
            />
            <SettingRow
              id="show_joined_date"
              label="Show when I joined"
              description="Display when you became an Order member"
              checked={settings.show_joined_date ?? true}
              onCheckedChange={handleToggle('show_joined_date')}
            />
            <SettingRow
              id="show_city_region"
              label="Show my city and region"
              description="Display your location in The Order section"
              checked={settings.show_city_region ?? true}
              onCheckedChange={handleToggle('show_city_region')}
            />
            <SettingRow
              id="show_lodge_info"
              label="Show my lodge and role"
              description="Display your lodge membership and officer status"
              checked={settings.show_lodge_info ?? true}
              onCheckedChange={handleToggle('show_lodge_info')}
            />
            <SettingRow
              id="show_order_track"
              label="Show my Order track"
              description="Display your primary track (Camera, Post, etc.)"
              checked={settings.show_order_track ?? true}
              onCheckedChange={handleToggle('show_order_track')}
            />
            <SettingRow
              id="show_order_activity"
              label="Show Order activity"
              description="Display job stats and Green Room project count"
              checked={settings.show_order_activity ?? true}
              onCheckedChange={handleToggle('show_order_activity')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {saved && (
        <Alert className="border-emerald-600 bg-emerald-950/30">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <AlertDescription className="text-emerald-200">
            Settings saved successfully.
          </AlertDescription>
        </Alert>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default OrderSettingsForm;
