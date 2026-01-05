/**
 * PostForm - Modal form for creating/editing posts
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Globe,
  Users,
  Link as LinkIcon,
  X,
  Loader2,
  UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLinkPreview } from '@/hooks/useFeed';
import LinkPreview from './LinkPreview';
import type { CommunityPost, PostVisibility, PostImage } from '@/types/community';

interface PostFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    content: string;
    images?: PostImage[];
    link_url?: string;
    link_title?: string;
    link_description?: string;
    link_image?: string;
    link_site_name?: string;
    visibility: PostVisibility;
    is_profile_update?: boolean;
  }) => Promise<void>;
  editingPost?: CommunityPost | null;
  isSubmitting?: boolean;
}

const PostForm: React.FC<PostFormProps> = ({
  open,
  onOpenChange,
  onSubmit,
  editingPost,
  isSubmitting = false,
}) => {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [isProfileUpdate, setIsProfileUpdate] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkPreview, setLinkPreview] = useState<{
    title?: string;
    description?: string;
    image?: string;
    site_name?: string;
  } | null>(null);

  const linkPreviewMutation = useLinkPreview();

  // Reset form when dialog opens/closes or editingPost changes
  useEffect(() => {
    if (open) {
      if (editingPost) {
        setContent(editingPost.content);
        setVisibility(editingPost.visibility);
        setIsProfileUpdate(editingPost.is_profile_update || false);
        if (editingPost.link_url) {
          setLinkUrl(editingPost.link_url);
          setShowLinkInput(true);
          setLinkPreview({
            title: editingPost.link_title || undefined,
            description: editingPost.link_description || undefined,
            image: editingPost.link_image || undefined,
            site_name: editingPost.link_site_name || undefined,
          });
        }
      } else {
        setContent('');
        setVisibility('public');
        setIsProfileUpdate(false);
        setLinkUrl('');
        setShowLinkInput(false);
        setLinkPreview(null);
      }
    }
  }, [open, editingPost]);

  const handleFetchLinkPreview = async () => {
    if (!linkUrl.trim()) return;

    try {
      const preview = await linkPreviewMutation.mutateAsync(linkUrl.trim());
      if (preview && !preview.error) {
        setLinkPreview({
          title: preview.title,
          description: preview.description,
          image: preview.image,
          site_name: preview.site_name,
        });
      }
    } catch (error) {
      console.error('Failed to fetch link preview:', error);
    }
  };

  const handleRemoveLink = () => {
    setLinkUrl('');
    setLinkPreview(null);
    setShowLinkInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    await onSubmit({
      content: content.trim(),
      visibility,
      is_profile_update: isProfileUpdate,
      ...(linkUrl && linkPreview
        ? {
            link_url: linkUrl,
            link_title: linkPreview.title,
            link_description: linkPreview.description,
            link_image: linkPreview.image,
            link_site_name: linkPreview.site_name,
          }
        : {}),
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="text-bone-white">
            {editingPost ? 'Edit Post' : 'Create Post'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Content */}
          <div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="min-h-[120px] bg-charcoal-black/50 border-muted-gray/30 resize-none"
              autoFocus
            />
            <div className="text-xs text-muted-gray text-right mt-1">
              {content.length} / 5000
            </div>
          </div>

          {/* Link input */}
          {showLinkInput && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="bg-charcoal-black/50 border-muted-gray/30"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFetchLinkPreview}
                  disabled={!linkUrl.trim() || linkPreviewMutation.isPending}
                >
                  {linkPreviewMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Preview'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLink}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {linkPreview && linkUrl && (
                <LinkPreview
                  url={linkUrl}
                  title={linkPreview.title}
                  description={linkPreview.description}
                  image={linkPreview.image}
                  siteName={linkPreview.site_name}
                />
              )}
            </div>
          )}

          {/* Attachments toolbar */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'text-muted-gray hover:text-bone-white',
                showLinkInput && 'border-accent-yellow text-accent-yellow'
              )}
              onClick={() => setShowLinkInput(!showLinkInput)}
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Link
            </Button>
            {/* Image upload would go here - simplified for now */}
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-gray">Who can see this?</Label>
            <RadioGroup
              value={visibility}
              onValueChange={(v) => setVisibility(v as PostVisibility)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" />
                <Label
                  htmlFor="public"
                  className="flex items-center gap-2 text-bone-white cursor-pointer"
                >
                  <Globe className="w-4 h-4" />
                  Public
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="connections" id="connections" />
                <Label
                  htmlFor="connections"
                  className="flex items-center gap-2 text-bone-white cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  Connections Only
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Share to Profile */}
          <div className="flex items-center space-x-2 py-2 px-3 bg-charcoal-black/30 rounded-md border border-muted-gray/20">
            <Checkbox
              id="profile-update"
              checked={isProfileUpdate}
              onCheckedChange={(checked) => setIsProfileUpdate(checked === true)}
            />
            <Label
              htmlFor="profile-update"
              className="flex items-center gap-2 text-bone-white cursor-pointer text-sm"
            >
              <UserCircle className="w-4 h-4 text-accent-yellow" />
              Share to my profile
            </Label>
            <span className="text-xs text-muted-gray ml-auto">
              Shows on your Updates tab
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!content.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingPost ? 'Saving...' : 'Posting...'}
                </>
              ) : editingPost ? (
                'Save Changes'
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PostForm;
