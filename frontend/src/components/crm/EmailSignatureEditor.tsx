import { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Eye, Pencil, User, Upload, Bell, BellOff, Info } from 'lucide-react';
import {
  useEmailAccount, useUpdateEmailSignature, useUpdateEmailAvatar,
  useUploadEmailAvatar, useEmailNotificationSettings, useUpdateEmailNotificationSettings,
} from '@/hooks/crm/useEmail';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from './RichTextEditor';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

interface EmailSignatureEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EmailSignatureEditor = ({ open, onOpenChange }: EmailSignatureEditorProps) => {
  const { data: account } = useEmailAccount();
  const updateSignature = useUpdateEmailSignature();
  const updateAvatar = useUpdateEmailAvatar();
  const uploadAvatar = useUploadEmailAvatar();
  const { data: notifData } = useEmailNotificationSettings();
  const updateNotifSettings = useUpdateEmailNotificationSettings();
  const { hasAnyRole } = usePermissions();
  const isNotifAdmin = hasAnyRole(['sales_admin', 'admin', 'superadmin']);
  const { toast } = useToast();

  const [signatureHtml, setSignatureHtml] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Notification settings state
  const [notifEmail, setNotifEmail] = useState('');
  const [notifMode, setNotifMode] = useState('off');
  const [notifInterval, setNotifInterval] = useState('hourly');

  useEffect(() => {
    if (account?.signature_html) setSignatureHtml(account.signature_html);
    if (account?.avatar_url) setAvatarUrl(account.avatar_url);
  }, [account?.signature_html, account?.avatar_url]);

  useEffect(() => {
    if (notifData?.settings) {
      setNotifEmail(notifData.settings.notification_email || '');
      setNotifMode(notifData.settings.notification_mode || 'off');
      setNotifInterval(notifData.settings.notification_digest_interval || 'hourly');
    }
  }, [notifData?.settings]);

  const handleSave = () => {
    updateSignature.mutate(signatureHtml, {
      onSuccess: () => {
        toast({ title: 'Signature saved', description: 'Your email signature has been updated.' });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to save signature.', variant: 'destructive' });
      },
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }
    setIsUploading(true);
    uploadAvatar.mutate(file, {
      onSuccess: (data) => {
        setAvatarUrl(data.avatar_url);
        toast({ title: 'Avatar uploaded', description: 'Your email profile photo has been updated.' });
        setIsUploading(false);
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to upload avatar.', variant: 'destructive' });
        setIsUploading(false);
      },
    });
    // Reset input
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleNotifSave = () => {
    if (!notifData?.settings?.id) return;
    updateNotifSettings.mutate({
      account_id: notifData.settings.id,
      notification_email: notifEmail,
      notification_mode: notifMode,
      notification_digest_interval: notifInterval,
    }, {
      onSuccess: () => {
        toast({ title: 'Notification settings saved' });
      },
      onError: (err: any) => {
        toast({
          title: 'Error',
          description: err?.message || 'Failed to save notification settings.',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Email Settings</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Customize your email profile photo, signature, and notification preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar Section - File Upload */}
          <div className="p-4 rounded-lg border border-muted-gray/20">
            <Label className="text-sm text-muted-gray mb-3 block">Profile Photo</Label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploading}
                className="relative w-16 h-16 rounded-full bg-muted-gray/20 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-accent-yellow/50 transition-all group"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-muted-gray" />
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5 text-white" />
                  )}
                </div>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <div className="text-sm text-muted-gray">
                <p>Click the circle to upload a photo.</p>
                <p className="text-xs mt-1">This photo appears in email clients that support sender avatars.</p>
              </div>
            </div>
          </div>

          {/* Signature Section */}
          <div className="p-4 rounded-lg border border-muted-gray/20">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm text-muted-gray">Email Signature</Label>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={showPreview ? 'ghost' : 'secondary'}
                  onClick={() => setShowPreview(false)}
                  className="text-xs h-7"
                >
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant={showPreview ? 'secondary' : 'ghost'}
                  onClick={() => setShowPreview(true)}
                  className="text-xs h-7"
                >
                  <Eye className="h-3 w-3 mr-1" /> Preview
                </Button>
              </div>
            </div>

            {showPreview ? (
              <div className="border border-muted-gray/50 rounded-lg p-4 bg-white min-h-[200px]">
                <div
                  className="prose prose-sm max-w-none text-black"
                  dangerouslySetInnerHTML={{ __html: signatureHtml || '<p class="text-gray-400">No signature set</p>' }}
                />
              </div>
            ) : (
              <RichTextEditor
                content={signatureHtml}
                onChange={setSignatureHtml}
                placeholder="Enter your email signature..."
                minHeight="200px"
              />
            )}

            <div className="flex justify-end mt-3">
              <Button
                onClick={handleSave}
                disabled={updateSignature.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {updateSignature.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Signature
              </Button>
            </div>
          </div>

          {/* Notification Settings (admin/sales_admin only) */}
          {isNotifAdmin && notifData?.settings && (
            <div className="p-4 rounded-lg border border-muted-gray/20">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-4 w-4 text-accent-yellow" />
                <Label className="text-sm text-bone-white">Email Notifications</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-gray" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-charcoal-black border-muted-gray/30 text-bone-white max-w-xs">
                      Get notified on your personal email when your work inbox receives messages.
                      Cannot use a CRM work email as the notification address.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-gray">Your Personal Email</Label>
                  <Input
                    value={notifEmail}
                    onChange={(e) => setNotifEmail(e.target.value)}
                    placeholder="your.personal@email.com"
                    className="bg-charcoal-black border-muted-gray/30 text-bone-white text-sm mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-gray">Notification Mode</Label>
                    <Select value={notifMode} onValueChange={setNotifMode}>
                      <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-charcoal-black border-muted-gray/30">
                        <SelectItem value="off" className="text-bone-white">
                          <span className="flex items-center gap-2">
                            <BellOff className="h-3 w-3" /> Off
                          </span>
                        </SelectItem>
                        <SelectItem value="instant" className="text-bone-white">Instant</SelectItem>
                        <SelectItem value="digest" className="text-bone-white">Digest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {notifMode === 'digest' && (
                    <div>
                      <Label className="text-xs text-muted-gray">Digest Interval</Label>
                      <Select value={notifInterval} onValueChange={setNotifInterval}>
                        <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-charcoal-black border-muted-gray/30">
                          <SelectItem value="hourly" className="text-bone-white">Hourly</SelectItem>
                          <SelectItem value="daily" className="text-bone-white">Daily</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleNotifSave}
                    disabled={updateNotifSettings.isPending}
                    className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                  >
                    {updateNotifSettings.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                    Save Notifications
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Close */}
          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-gray">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailSignatureEditor;
