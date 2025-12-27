/**
 * ExternalLinkModal - Create and manage external share links for review content
 */
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Copy,
  Link,
  Trash2,
  Lock,
  Eye,
  MessageSquare,
  Download,
  ThumbsUp,
  Calendar,
  Users,
  ExternalLink,
  Loader2,
  Check,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { ReviewExternalLink, ReviewAsset, ReviewFolder } from '@/types/backlot';
import { useExternalLinks } from '@/hooks/backlot/useReview';
import { formatDistanceToNow, format } from 'date-fns';

interface ExternalLinkModalProps {
  projectId: string;
  asset?: ReviewAsset | null;
  folder?: ReviewFolder | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExternalLinkModal: React.FC<ExternalLinkModalProps> = ({
  projectId,
  asset,
  folder,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [canComment, setCanComment] = useState(true);
  const [canDownload, setCanDownload] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [maxViews, setMaxViews] = useState<string>('');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    links,
    isLoading,
    createLink,
    updateLink,
    deleteLink,
    isCreating,
    isDeleting,
  } = useExternalLinks({ projectId });

  // Filter links for current asset/folder
  const relevantLinks = links.filter((link) => {
    if (asset) return link.asset_id === asset.id;
    if (folder) return link.folder_id === folder.id;
    return !link.asset_id && !link.folder_id;
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const defaultName = asset?.name || folder?.name || 'Review Link';
      setName(`${defaultName} - ${format(new Date(), 'MMM d, yyyy')}`);
      setPassword('');
      setUsePassword(false);
      setCanComment(true);
      setCanDownload(false);
      setCanApprove(false);
      setExpiresIn('never');
      setMaxViews('');
      setCreatedUrl(null);
      setError(null);
      setCopied(false);
    }
  }, [isOpen, asset, folder]);

  const handleCreate = async () => {
    setError(null);

    try {
      // Calculate expiration date
      let expires_at: string | null = null;
      if (expiresIn !== 'never') {
        const now = new Date();
        switch (expiresIn) {
          case '24h':
            now.setHours(now.getHours() + 24);
            break;
          case '7d':
            now.setDate(now.getDate() + 7);
            break;
          case '30d':
            now.setDate(now.getDate() + 30);
            break;
        }
        expires_at = now.toISOString();
      }

      const result = await createLink({
        name,
        asset_id: asset?.id || null,
        folder_id: folder?.id || null,
        password: usePassword && password ? password : undefined,
        can_comment: canComment,
        can_download: canDownload,
        can_approve: canApprove,
        expires_at,
        max_views: maxViews ? parseInt(maxViews, 10) : null,
      });

      setCreatedUrl(result.share_url);
      setActiveTab('manage');
    } catch (err: any) {
      setError(err.message || 'Failed to create link');
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleActive = async (link: ReviewExternalLink) => {
    await updateLink(link.id, { is_active: !link.is_active });
  };

  const handleDeleteLink = async (linkId: string) => {
    if (window.confirm('Are you sure you want to delete this link? External reviewers will no longer be able to access the content.')) {
      await deleteLink(linkId);
    }
  };

  const getShareUrl = (link: ReviewExternalLink) => {
    return `${window.location.origin}/review/${link.token}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-surface-800 border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Link className="w-5 h-5" />
            Share for Review
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'create' | 'manage')}>
          <TabsList className="grid w-full grid-cols-2 bg-surface-700">
            <TabsTrigger value="create">Create Link</TabsTrigger>
            <TabsTrigger value="manage">
              Manage Links
              {relevantLinks.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-accent-yellow/20 text-accent-yellow">
                  {relevantLinks.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4">
            {createdUrl ? (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                  <Check className="w-6 h-6 text-green-400" />
                  <div>
                    <p className="text-green-400 font-medium">Link created successfully!</p>
                    <p className="text-sm text-white/60">Copy the link below to share with reviewers</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={createdUrl}
                    readOnly
                    className="bg-surface-700 border-white/10 font-mono text-sm"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => handleCopyUrl(createdUrl)}
                    className={cn(copied && 'bg-green-500/20')}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setCreatedUrl(null)}
                  className="w-full"
                >
                  Create Another Link
                </Button>
              </div>
            ) : (
              <>
                {/* Sharing scope indicator */}
                <div className="bg-surface-700 rounded-lg p-3 flex items-center gap-3">
                  {asset ? (
                    <>
                      <div className="w-10 h-10 rounded bg-accent-yellow/20 flex items-center justify-center">
                        <ExternalLink className="w-5 h-5 text-accent-yellow" />
                      </div>
                      <div>
                        <p className="text-sm text-white/60">Sharing asset</p>
                        <p className="font-medium text-white">{asset.name}</p>
                      </div>
                    </>
                  ) : folder ? (
                    <>
                      <div className="w-10 h-10 rounded bg-blue-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white/60">Sharing folder</p>
                        <p className="font-medium text-white">{folder.name}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded bg-purple-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white/60">Sharing</p>
                        <p className="font-medium text-white">All Review Assets</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Link name */}
                <div className="space-y-2">
                  <Label htmlFor="link-name">Link Name</Label>
                  <Input
                    id="link-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Client Review - Episode 1"
                    className="bg-surface-700 border-white/10"
                  />
                </div>

                {/* Password protection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use-password"
                      checked={usePassword}
                      onCheckedChange={(checked) => setUsePassword(checked as boolean)}
                    />
                    <Label htmlFor="use-password" className="flex items-center gap-2 cursor-pointer">
                      <Lock className="w-4 h-4 text-white/60" />
                      Require password
                    </Label>
                  </div>

                  {usePassword && (
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="bg-surface-700 border-white/10"
                    />
                  )}
                </div>

                {/* Permissions */}
                <div className="space-y-3">
                  <Label>Permissions</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="can-comment"
                        checked={canComment}
                        onCheckedChange={(checked) => setCanComment(checked as boolean)}
                      />
                      <Label htmlFor="can-comment" className="flex items-center gap-2 cursor-pointer">
                        <MessageSquare className="w-4 h-4 text-white/60" />
                        Can add comments and notes
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="can-download"
                        checked={canDownload}
                        onCheckedChange={(checked) => setCanDownload(checked as boolean)}
                      />
                      <Label htmlFor="can-download" className="flex items-center gap-2 cursor-pointer">
                        <Download className="w-4 h-4 text-white/60" />
                        Can download files
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="can-approve"
                        checked={canApprove}
                        onCheckedChange={(checked) => setCanApprove(checked as boolean)}
                      />
                      <Label htmlFor="can-approve" className="flex items-center gap-2 cursor-pointer">
                        <ThumbsUp className="w-4 h-4 text-white/60" />
                        Can mark as approved
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Expiration */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Expires</Label>
                    <select
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-surface-700 border border-white/10 text-white"
                    >
                      <option value="never">Never</option>
                      <option value="24h">24 hours</option>
                      <option value="7d">7 days</option>
                      <option value="30d">30 days</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Views (optional)</Label>
                    <Input
                      type="number"
                      value={maxViews}
                      onChange={(e) => setMaxViews(e.target.value)}
                      placeholder="Unlimited"
                      min="1"
                      className="bg-surface-700 border-white/10"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="manage" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-white/60" />
              </div>
            ) : relevantLinks.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                <Link className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No share links yet</p>
                <p className="text-sm">Create your first link in the "Create Link" tab</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {relevantLinks.map((link) => (
                  <div
                    key={link.id}
                    className={cn(
                      'bg-surface-700 rounded-lg p-4 space-y-3',
                      !link.is_active && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white">{link.name}</h4>
                          {!link.is_active && (
                            <Badge variant="outline" className="text-red-400 border-red-400/30">
                              Disabled
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-white/60">
                          Created {formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyUrl(getShareUrl(link))}
                          className="text-white/60 hover:text-white"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(link)}
                          className="text-white/60 hover:text-white"
                        >
                          {link.is_active ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4 text-red-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLink(link.id)}
                          className="text-white/60 hover:text-red-400"
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Link stats and permissions */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-surface-600">
                        <Users className="w-3 h-3 mr-1" />
                        {link.view_count} views
                      </Badge>

                      {link.expires_at && (
                        <Badge variant="secondary" className="bg-surface-600">
                          <Clock className="w-3 h-3 mr-1" />
                          Expires {format(new Date(link.expires_at), 'MMM d, yyyy')}
                        </Badge>
                      )}

                      {link.can_comment && (
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          Comments
                        </Badge>
                      )}

                      {link.can_download && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Badge>
                      )}

                      {link.can_approve && (
                        <Badge variant="secondary" className="bg-accent-yellow/20 text-accent-yellow">
                          <ThumbsUp className="w-3 h-3 mr-1" />
                          Approve
                        </Badge>
                      )}
                    </div>

                    {/* Quick copy link */}
                    <div className="flex gap-2">
                      <Input
                        value={getShareUrl(link)}
                        readOnly
                        className="bg-surface-600 border-white/10 font-mono text-xs text-white/60"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          {activeTab === 'create' && !createdUrl && (
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || isCreating}
              className="bg-accent-yellow text-black hover:bg-accent-yellow/90"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4 mr-2" />
                  Create Share Link
                </>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExternalLinkModal;
