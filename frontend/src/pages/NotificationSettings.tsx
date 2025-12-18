import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Settings = {
  user_id: string;
  email_digest_enabled: boolean;
  email_on_submission_updates: boolean;
  email_on_connection_accepts: boolean;
  digest_hour_utc: number;
};

export default function NotificationSettings() {
  const { profileId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (!profileId) return;
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await api.getNotificationSettings(profileId);
        setSettings(
          data || {
            user_id: profileId,
            email_digest_enabled: false,
            email_on_submission_updates: true,
            email_on_connection_accepts: true,
            digest_hour_utc: 13,
          }
        );
      } catch (error) {
        // If no row exists, initialize defaults in UI; we upsert on save.
        setSettings({
          user_id: profileId,
          email_digest_enabled: false,
          email_on_submission_updates: true,
          email_on_connection_accepts: true,
          digest_hour_utc: 13,
        });
      }
      if (isMounted) setLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, [profileId]);

  const save = async () => {
    if (!profileId || !settings) return;
    setSaving(true);
    try {
      await api.updateNotificationSettings(profileId, settings);
      toast({ title: "Preferences saved", description: "Your email preferences were updated." });
    } catch (error: any) {
      toast({ title: "Save failed", description: error?.message || "Failed to save preferences" });
    }
    setSaving(false);
  };

  const update = (patch: Partial<Settings>) => {
    setSettings(prev => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <div className="container mx-auto max-w-3xl py-12">
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader>
          <CardTitle className="font-heading text-3xl text-bone-white">Notification Settings</CardTitle>
          <CardDescription>Choose how you'd like to be notified by email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading || !settings ? (
            <>
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-6 w-80" />
              <Skeleton className="h-10 w-28" />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="digest" className="text-bone-white">Daily email digest</Label>
                  <p className="text-sm text-muted-foreground">Receive a once-daily summary of unread notifications older than 24 hours.</p>
                </div>
                <Switch
                  id="digest"
                  checked={settings.email_digest_enabled}
                  onCheckedChange={(v) => update({ email_digest_enabled: Boolean(v) })}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="subs" className="text-bone-white">Submission updates</Label>
                  <p className="text-sm text-muted-foreground">Email me when my submission status changes.</p>
                </div>
                <Switch
                  id="subs"
                  checked={settings.email_on_submission_updates}
                  onCheckedChange={(v) => update({ email_on_submission_updates: Boolean(v) })}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="accepts" className="text-bone-white">Connection accepts</Label>
                  <p className="text-sm text-muted-foreground">Email me when someone accepts my connection request.</p>
                </div>
                <Switch
                  id="accepts"
                  checked={settings.email_on_connection_accepts}
                  onCheckedChange={(v) => update({ email_on_connection_accepts: Boolean(v) })}
                />
              </div>

              <div className="pt-2">
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save preferences"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
