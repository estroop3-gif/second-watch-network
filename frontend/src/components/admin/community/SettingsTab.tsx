/**
 * Community Settings Tab
 * Admin interface for managing community-wide visibility and privacy defaults
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Eye,
  EyeOff,
  Globe,
  Lock,
  Loader2,
  MessageSquare,
  Save,
  Settings,
  Shield,
  Star,
  Users
} from 'lucide-react';

interface PrivacyDefaults {
  profile_visibility: string;
  show_email: boolean;
  show_phone: boolean;
  show_location: boolean;
  show_availability: boolean;
  show_credits: boolean;
  show_equipment: boolean;
  allow_messages: string;
}

const DEFAULT_PRIVACY: PrivacyDefaults = {
  profile_visibility: 'public',
  show_email: false,
  show_phone: false,
  show_location: true,
  show_availability: true,
  show_credits: true,
  show_equipment: true,
  allow_messages: 'everyone',
};

const SettingsTab = () => {
  const queryClient = useQueryClient();
  const [localPrivacy, setLocalPrivacy] = useState<PrivacyDefaults>(DEFAULT_PRIVACY);
  const [maxFeatured, setMaxFeatured] = useState(10);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch privacy defaults
  const { data: privacyDefaults, isLoading: privacyLoading } = useQuery({
    queryKey: ['admin-privacy-defaults'],
    queryFn: () => api.getPrivacyDefaults(),
  });

  // Fetch featured users count
  const { data: featuredUsers } = useQuery({
    queryKey: ['admin-featured-users'],
    queryFn: () => api.listFeaturedUsers(),
  });

  // Initialize local state when data loads
  useEffect(() => {
    if (privacyDefaults) {
      setLocalPrivacy({
        ...DEFAULT_PRIVACY,
        ...privacyDefaults,
      });
    }
  }, [privacyDefaults]);

  // Update privacy mutation
  const updatePrivacyMutation = useMutation({
    mutationFn: (data: Partial<PrivacyDefaults>) => api.updatePrivacyDefaults(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-privacy-defaults'] });
      toast.success('Privacy defaults updated');
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update settings');
    },
  });

  const handleToggle = (key: keyof PrivacyDefaults, value: boolean) => {
    setLocalPrivacy(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSelectChange = (key: keyof PrivacyDefaults, value: string) => {
    setLocalPrivacy(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updatePrivacyMutation.mutate(localPrivacy);
  };

  if (privacyLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save Button (Sticky) */}
      {hasChanges && (
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-cyan-900/30 border border-cyan-600 rounded-lg">
          <div className="flex items-center gap-2 text-cyan-400">
            <Settings className="h-5 w-5" />
            <span>You have unsaved changes</span>
          </div>
          <Button
            onClick={handleSave}
            disabled={updatePrivacyMutation.isPending}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            {updatePrivacyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      )}

      {/* Profile Visibility Level */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-cyan-500" />
            Default Profile Visibility
          </CardTitle>
          <CardDescription>
            Set the default visibility level for new user profiles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card
              className={`cursor-pointer transition-all ${
                localPrivacy.profile_visibility === 'public'
                  ? 'bg-cyan-900/30 border-cyan-600'
                  : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
              }`}
              onClick={() => handleSelectChange('profile_visibility', 'public')}
            >
              <CardContent className="p-4 text-center">
                <Globe className="h-8 w-8 mx-auto mb-2 text-cyan-500" />
                <div className="font-medium">Public</div>
                <div className="text-xs text-zinc-400">Anyone can view</div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${
                localPrivacy.profile_visibility === 'members_only'
                  ? 'bg-cyan-900/30 border-cyan-600'
                  : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
              }`}
              onClick={() => handleSelectChange('profile_visibility', 'members_only')}
            >
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-cyan-500" />
                <div className="font-medium">Members Only</div>
                <div className="text-xs text-zinc-400">Logged-in users only</div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${
                localPrivacy.profile_visibility === 'connections_only'
                  ? 'bg-cyan-900/30 border-cyan-600'
                  : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
              }`}
              onClick={() => handleSelectChange('profile_visibility', 'connections_only')}
            >
              <CardContent className="p-4 text-center">
                <Lock className="h-8 w-8 mx-auto mb-2 text-cyan-500" />
                <div className="font-medium">Connections Only</div>
                <div className="text-xs text-zinc-400">Connected users only</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Profile Field Visibility */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-cyan-500" />
            Default Field Visibility
          </CardTitle>
          <CardDescription>
            Control which fields are visible on public profiles by default
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
              <div className="flex items-center gap-3">
                <EyeOff className="h-5 w-5 text-zinc-400" />
                <div>
                  <Label className="font-medium">Show Email</Label>
                  <div className="text-sm text-zinc-400">Display email address on profiles</div>
                </div>
              </div>
              <Switch
                checked={localPrivacy.show_email}
                onCheckedChange={(v) => handleToggle('show_email', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
              <div className="flex items-center gap-3">
                <EyeOff className="h-5 w-5 text-zinc-400" />
                <div>
                  <Label className="font-medium">Show Phone</Label>
                  <div className="text-sm text-zinc-400">Display phone number on profiles</div>
                </div>
              </div>
              <Switch
                checked={localPrivacy.show_phone}
                onCheckedChange={(v) => handleToggle('show_phone', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-zinc-400" />
                <div>
                  <Label className="font-medium">Show Location</Label>
                  <div className="text-sm text-zinc-400">Display location on profiles</div>
                </div>
              </div>
              <Switch
                checked={localPrivacy.show_location}
                onCheckedChange={(v) => handleToggle('show_location', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-zinc-400" />
                <div>
                  <Label className="font-medium">Show Availability</Label>
                  <div className="text-sm text-zinc-400">Display availability status on profiles</div>
                </div>
              </div>
              <Switch
                checked={localPrivacy.show_availability}
                onCheckedChange={(v) => handleToggle('show_availability', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-zinc-400" />
                <div>
                  <Label className="font-medium">Show Credits</Label>
                  <div className="text-sm text-zinc-400">Display film credits on profiles</div>
                </div>
              </div>
              <Switch
                checked={localPrivacy.show_credits}
                onCheckedChange={(v) => handleToggle('show_credits', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-zinc-400" />
                <div>
                  <Label className="font-medium">Show Equipment</Label>
                  <div className="text-sm text-zinc-400">Display equipment list on profiles</div>
                </div>
              </div>
              <Switch
                checked={localPrivacy.show_equipment}
                onCheckedChange={(v) => handleToggle('show_equipment', v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messaging Permissions */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-cyan-500" />
            Default Messaging Permissions
          </CardTitle>
          <CardDescription>
            Set default settings for who can send messages to new users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={localPrivacy.allow_messages}
            onValueChange={(v) => handleSelectChange('allow_messages', v)}
          >
            <SelectTrigger className="w-full bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Who can send messages" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="everyone">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Everyone - Any member can message
                </div>
              </SelectItem>
              <SelectItem value="connections">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Connections Only - Only connected users
                </div>
              </SelectItem>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  No Messages - Disable messaging by default
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Featured Members Settings */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-cyan-500" />
            Featured Members
          </CardTitle>
          <CardDescription>
            Configure featured member settings for homepage and discovery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
            <div>
              <Label className="font-medium">Current Featured Members</Label>
              <div className="text-sm text-zinc-400">
                Members currently featured on the platform
              </div>
            </div>
            <div className="text-2xl font-bold text-cyan-500">
              {featuredUsers?.length || 0}
            </div>
          </div>
          <div className="text-sm text-zinc-400">
            Manage featured members from the Members tab. Featured members appear on the homepage and discovery pages.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsTab;
