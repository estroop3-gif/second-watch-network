/**
 * CallSheetShareModal - Modal for creating and managing external share links
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Link2,
  Copy,
  Check,
  Loader2,
  Trash2,
  Eye,
  Download,
  Lock,
  Clock,
  ExternalLink,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useCallSheetShares, CallSheetShare } from '@/hooks/backlot';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns';

interface CallSheetShareModalProps {
  callSheetId: string;
  callSheetTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =====================================================
// ShareLinkRow Component
// =====================================================
interface ShareLinkRowProps {
  share: CallSheetShare;
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
  isRevoking: boolean;
}

const ShareLinkRow: React.FC<ShareLinkRowProps> = ({
  share,
  onRevoke,
  onDelete,
  isRevoking,
}) => {
  const [copied, setCopied] = useState(false);
  const isExpired = isPast(parseISO(share.expires_at));
  const isActive = share.is_active && !isExpired;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(share.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={cn(
      'p-4 rounded-lg border transition-colors',
      isActive
        ? 'border-muted-gray/20 bg-charcoal-black/30'
        : 'border-red-400/20 bg-red-400/5'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-bone-white truncate">
              {share.name || 'Share Link'}
            </span>
            {share.has_password && (
              <Badge variant="outline" className="text-xs border-amber-400/30 text-amber-400">
                <Lock className="w-3 h-3 mr-1" />
                Password
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                isActive
                  ? 'border-green-400/30 text-green-400'
                  : 'border-red-400/30 text-red-400'
              )}
            >
              {!share.is_active ? 'Revoked' : isExpired ? 'Expired' : 'Active'}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-gray">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {share.view_count} views
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {isExpired
                ? `Expired ${formatDistanceToNow(parseISO(share.expires_at))} ago`
                : `Expires ${formatDistanceToNow(parseISO(share.expires_at), { addSuffix: true })}`
              }
            </span>
          </div>

          {isActive && (
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-xs bg-muted-gray/10 px-2 py-1 rounded truncate">
                {share.share_url}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => window.open(share.share_url, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRevoke(share.id)}
              disabled={isRevoking}
              className="text-amber-400 hover:text-amber-500"
            >
              {isRevoking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Revoke'
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-400 hover:text-red-500"
            onClick={() => onDelete(share.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// Main CallSheetShareModal Component
// =====================================================
const CallSheetShareModal: React.FC<CallSheetShareModalProps> = ({
  callSheetId,
  callSheetTitle,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { shares, isLoading, createShare, revokeShare, deleteShare } = useCallSheetShares(callSheetId);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Create form state
  const [linkName, setLinkName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);

  const handleCreate = async () => {
    try {
      const result = await createShare.mutateAsync({
        name: linkName || undefined,
        expires_in_days: parseInt(expiresInDays),
        password: usePassword && password ? password : undefined,
        allowed_actions: allowDownload ? ['view', 'download'] : ['view'],
      });

      // Copy to clipboard
      await navigator.clipboard.writeText(result.share_url);

      toast({
        title: 'Share Link Created',
        description: 'Link copied to clipboard',
      });

      // Reset form
      setShowCreateForm(false);
      setLinkName('');
      setExpiresInDays('7');
      setUsePassword(false);
      setPassword('');
      setAllowDownload(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create share link',
        variant: 'destructive',
      });
    }
  };

  const handleRevoke = async (shareId: string) => {
    setRevokingId(shareId);
    try {
      await revokeShare.mutateAsync(shareId);
      toast({
        title: 'Share Link Revoked',
        description: 'The link will no longer work',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke share link',
        variant: 'destructive',
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleDelete = async (shareId: string) => {
    if (!confirm('Permanently delete this share link? This cannot be undone.')) return;

    try {
      await deleteShare.mutateAsync(shareId);
      toast({
        title: 'Share Link Deleted',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete share link',
        variant: 'destructive',
      });
    }
  };

  const activeShares = shares.filter(s => s.is_active && !isPast(parseISO(s.expires_at)));
  const inactiveShares = shares.filter(s => !s.is_active || isPast(parseISO(s.expires_at)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Share Call Sheet
          </DialogTitle>
          <DialogDescription>
            Create shareable links for "{callSheetTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Create New Link */}
          {showCreateForm ? (
            <div className="space-y-4 p-4 rounded-lg border border-accent-yellow/30 bg-accent-yellow/5">
              <div className="flex items-center justify-between">
                <Label className="text-bone-white font-medium">New Share Link</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-muted-gray text-sm">Link Name (optional)</Label>
                  <Input
                    value={linkName}
                    onChange={e => setLinkName(e.target.value)}
                    placeholder="e.g., For talent agency"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-muted-gray text-sm">Expires In</Label>
                  <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">2 weeks</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-charcoal-black/30">
                  <Checkbox
                    id="allowDownload"
                    checked={allowDownload}
                    onCheckedChange={(checked) => setAllowDownload(checked === true)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <Label htmlFor="allowDownload" className="text-bone-white cursor-pointer">
                      Allow PDF Download
                    </Label>
                    <p className="text-xs text-muted-gray mt-0.5">Recipients can download the call sheet as PDF</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-charcoal-black/30">
                  <Checkbox
                    id="usePassword"
                    checked={usePassword}
                    onCheckedChange={(checked) => setUsePassword(checked === true)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <Label htmlFor="usePassword" className="text-bone-white cursor-pointer">
                      Password Protection
                    </Label>
                    <p className="text-xs text-muted-gray mt-0.5">Require a password to view</p>
                  </div>
                </div>

                {usePassword && (
                  <div>
                    <Label className="text-muted-gray text-sm">Password</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreate}
                disabled={createShare.isPending || (usePassword && !password)}
                className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {createShare.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Create Share Link
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Share Link
            </Button>
          )}

          <Separator />

          {/* Active Share Links */}
          <div className="space-y-3">
            <Label className="text-muted-gray">
              Active Links ({activeShares.length})
            </Label>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
              </div>
            ) : activeShares.length > 0 ? (
              <div className="space-y-2">
                {activeShares.map(share => (
                  <ShareLinkRow
                    key={share.id}
                    share={share}
                    onRevoke={handleRevoke}
                    onDelete={handleDelete}
                    isRevoking={revokingId === share.id}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-gray">
                <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active share links</p>
                <p className="text-xs mt-1">Create a link to share this call sheet externally</p>
              </div>
            )}
          </div>

          {/* Inactive Share Links */}
          {inactiveShares.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-muted-gray">
                  Expired/Revoked ({inactiveShares.length})
                </Label>
                <div className="space-y-2">
                  {inactiveShares.map(share => (
                    <ShareLinkRow
                      key={share.id}
                      share={share}
                      onRevoke={handleRevoke}
                      onDelete={handleDelete}
                      isRevoking={revokingId === share.id}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CallSheetShareModal;
