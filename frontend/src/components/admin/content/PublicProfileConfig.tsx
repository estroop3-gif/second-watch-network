import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Layout, Eye, Lock, Save, Check, X } from 'lucide-react';

interface ProfileConfig {
  default_layout: string;
  available_layouts: string[];
  required_fields: string[];
  default_privacy: {
    profile_visibility: string;
    show_email: boolean;
    show_phone: boolean;
    show_location: boolean;
    show_credits: boolean;
    allow_messages: string;
  };
  visible_fields: string[];
}

const AVAILABLE_FIELDS = [
  { key: 'tagline', label: 'Tagline' },
  { key: 'about_me', label: 'About Me' },
  { key: 'location', label: 'Location' },
  { key: 'skills', label: 'Skills' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'union_affiliations', label: 'Union Affiliations' },
  { key: 'credits', label: 'Credits' },
  { key: 'productions', label: 'Productions' },
  { key: 'availability', label: 'Availability Status' },
  { key: 'demo_reel', label: 'Demo Reel' },
  { key: 'social_links', label: 'Social Links' },
];

const LAYOUT_DESCRIPTIONS: Record<string, string> = {
  standard: 'Classic layout with avatar, bio, and credits list',
  portfolio: 'Visual layout with featured work carousel and grid',
  minimal: 'Compact view with essential info and key credits',
};

const PublicProfileConfig = () => {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-profile-config'],
    queryFn: () => api.getProfileConfig(),
  });

  const { data: privacyDefaults } = useQuery({
    queryKey: ['admin-privacy-defaults'],
    queryFn: () => api.getPrivacyDefaults(),
  });

  const { data: visibleFields } = useQuery({
    queryKey: ['admin-visible-fields'],
    queryFn: () => api.getVisibleFields(),
  });

  const { data: layouts } = useQuery({
    queryKey: ['admin-available-layouts'],
    queryFn: () => api.getAvailableLayouts(),
  });

  const [localPrivacy, setLocalPrivacy] = useState<typeof privacyDefaults>(null);
  const [localFields, setLocalFields] = useState<string[]>([]);
  const [localDefaultLayout, setLocalDefaultLayout] = useState<string>('');

  // Initialize local state when data loads
  React.useEffect(() => {
    if (privacyDefaults && !localPrivacy) {
      setLocalPrivacy(privacyDefaults);
    }
  }, [privacyDefaults]);

  React.useEffect(() => {
    if (visibleFields && localFields.length === 0) {
      setLocalFields(visibleFields);
    }
  }, [visibleFields]);

  React.useEffect(() => {
    if (config?.default_layout && !localDefaultLayout) {
      setLocalDefaultLayout(config.default_layout);
    }
  }, [config]);

  const updatePrivacyMutation = useMutation({
    mutationFn: (data: any) => api.updatePrivacyDefaults(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-privacy-defaults'] });
      toast.success('Privacy defaults updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update'),
  });

  const updateFieldsMutation = useMutation({
    mutationFn: (fields: string[]) => api.updateVisibleFields(fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-visible-fields'] });
      toast.success('Visible fields updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update'),
  });

  const updateLayoutMutation = useMutation({
    mutationFn: (layout: string) => api.updateProfileConfig({ config_key: 'default_layout', config_value: layout }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profile-config'] });
      toast.success('Default layout updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update'),
  });

  const toggleField = (field: string) => {
    setLocalFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Layout Configuration */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Profile Layouts
          </CardTitle>
          <CardDescription>
            Configure the default layout for new user profiles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Default Layout for New Users</label>
            <div className="flex items-center gap-4">
              <Select
                value={localDefaultLayout}
                onValueChange={setLocalDefaultLayout}
              >
                <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(layouts || ['standard', 'portfolio', 'minimal']).map((layout: string) => (
                    <SelectItem key={layout} value={layout} className="capitalize">
                      {layout}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => updateLayoutMutation.mutate(localDefaultLayout)}
                disabled={updateLayoutMutation.isPending || localDefaultLayout === config?.default_layout}
              >
                {updateLayoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {(layouts || ['standard', 'portfolio', 'minimal']).map((layout: string) => (
              <div
                key={layout}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  localDefaultLayout === layout
                    ? 'border-accent-yellow bg-accent-yellow/10'
                    : 'border-zinc-700 bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{layout}</span>
                  {localDefaultLayout === layout && (
                    <Badge className="bg-accent-yellow text-black">Default</Badge>
                  )}
                </div>
                <p className="text-sm text-zinc-400">
                  {LAYOUT_DESCRIPTIONS[layout] || 'Custom layout'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Visible Fields Configuration */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visible Profile Fields
          </CardTitle>
          <CardDescription>
            Choose which fields appear on public profiles by default
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {AVAILABLE_FIELDS.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-800"
              >
                <span className="text-sm">{field.label}</span>
                <Switch
                  checked={localFields.includes(field.key)}
                  onCheckedChange={() => toggleField(field.key)}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={() => updateFieldsMutation.mutate(localFields)}
              disabled={updateFieldsMutation.isPending}
            >
              {updateFieldsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Field Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Defaults Configuration */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Default Privacy Settings
          </CardTitle>
          <CardDescription>
            Set the default privacy options for new user accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {localPrivacy && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Visibility */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Profile Visibility</label>
                  <Select
                    value={localPrivacy.profile_visibility}
                    onValueChange={(v) => setLocalPrivacy({ ...localPrivacy, profile_visibility: v })}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public - Anyone can view</SelectItem>
                      <SelectItem value="members_only">Members Only - Logged in users</SelectItem>
                      <SelectItem value="connections_only">Connections Only - Approved contacts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Message Settings */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Who Can Send Messages</label>
                  <Select
                    value={localPrivacy.allow_messages}
                    onValueChange={(v) => setLocalPrivacy({ ...localPrivacy, allow_messages: v })}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="connections">Connections Only</SelectItem>
                      <SelectItem value="none">No One</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium block">Information Visibility</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
                    <span className="text-sm">Email</span>
                    <Switch
                      checked={localPrivacy.show_email}
                      onCheckedChange={(v) => setLocalPrivacy({ ...localPrivacy, show_email: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
                    <span className="text-sm">Phone</span>
                    <Switch
                      checked={localPrivacy.show_phone}
                      onCheckedChange={(v) => setLocalPrivacy({ ...localPrivacy, show_phone: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
                    <span className="text-sm">Location</span>
                    <Switch
                      checked={localPrivacy.show_location}
                      onCheckedChange={(v) => setLocalPrivacy({ ...localPrivacy, show_location: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
                    <span className="text-sm">Credits</span>
                    <Switch
                      checked={localPrivacy.show_credits}
                      onCheckedChange={(v) => setLocalPrivacy({ ...localPrivacy, show_credits: v })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => updatePrivacyMutation.mutate(localPrivacy)}
                  disabled={updatePrivacyMutation.isPending}
                >
                  {updatePrivacyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Privacy Defaults
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Current Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-zinc-400 mb-2">Default Layout</p>
              <Badge variant="outline" className="capitalize text-base px-3 py-1">
                {localDefaultLayout || 'standard'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-zinc-400 mb-2">Visible Fields</p>
              <p className="text-lg font-medium">{localFields.length} fields enabled</p>
            </div>
            <div>
              <p className="text-sm text-zinc-400 mb-2">Default Visibility</p>
              <Badge variant="outline" className="capitalize text-base px-3 py-1">
                {localPrivacy?.profile_visibility || 'public'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicProfileConfig;
