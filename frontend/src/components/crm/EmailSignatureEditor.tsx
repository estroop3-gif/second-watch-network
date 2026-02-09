import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Eye, Pencil, User } from 'lucide-react';
import { useEmailAccount, useUpdateEmailSignature, useUpdateEmailAvatar } from '@/hooks/crm/useEmail';
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from './RichTextEditor';

interface EmailSignatureEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EmailSignatureEditor = ({ open, onOpenChange }: EmailSignatureEditorProps) => {
  const { data: account } = useEmailAccount();
  const updateSignature = useUpdateEmailSignature();
  const updateAvatar = useUpdateEmailAvatar();
  const { toast } = useToast();
  const [signatureHtml, setSignatureHtml] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (account?.signature_html) {
      setSignatureHtml(account.signature_html);
    }
    if (account?.avatar_url) {
      setAvatarUrl(account.avatar_url);
    }
  }, [account?.signature_html, account?.avatar_url]);

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

  const handleAvatarSave = () => {
    updateAvatar.mutate(avatarUrl, {
      onSuccess: () => {
        toast({ title: 'Avatar updated' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to update avatar.', variant: 'destructive' });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Email Settings</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Customize your email signature and profile picture.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Avatar Section */}
          <div className="flex items-center gap-4 p-3 rounded-lg border border-muted-gray/20">
            <div className="w-12 h-12 rounded-full bg-muted-gray/20 flex items-center justify-center overflow-hidden flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="h-6 w-6 text-muted-gray" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-xs text-muted-gray block mb-1">Profile Picture URL</label>
              <div className="flex gap-2">
                <Input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="bg-charcoal-black border-muted-gray/30 text-bone-white text-sm h-8"
                />
                <Button
                  size="sm"
                  onClick={handleAvatarSave}
                  disabled={updateAvatar.isPending}
                  className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 h-8 px-3 text-xs"
                >
                  {updateAvatar.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          </div>

          {/* Signature Section */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showPreview ? 'ghost' : 'secondary'}
              onClick={() => setShowPreview(false)}
              className="text-xs"
            >
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button
              size="sm"
              variant={showPreview ? 'secondary' : 'ghost'}
              onClick={() => setShowPreview(true)}
              className="text-xs"
            >
              <Eye className="h-3 w-3 mr-1" /> Preview
            </Button>
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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-gray">
              Cancel
            </Button>
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
      </DialogContent>
    </Dialog>
  );
};

export default EmailSignatureEditor;
