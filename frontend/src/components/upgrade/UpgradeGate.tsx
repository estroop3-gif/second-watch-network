import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermissions } from '@/hooks/usePermissions';
import { PermKey } from '@/lib/permissions';
import { Shield, Star, CheckCircle2, MessageSquarePlus, Paperclip, Film } from 'lucide-react';
import { track } from '@/utils/telemetry';
import { api } from '@/lib/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type UpgradeGateButtonProps = {
  requiredPerm: PermKey;
  onClickAllowed: () => void;
  children: React.ReactElement; // a single interactive child (e.g., Button)
  disabledHint?: string;
};

const COPY: Record<PermKey, { title: string; lead: string }> = {
  view_free: { title: 'Go Premium', lead: 'Enjoy more features with Premium.' },
  forum_read: { title: 'Go Premium', lead: 'Enjoy more features with Premium.' },
  forum_post: { title: 'Go Premium to post', lead: 'Premium members can start conversations in the forum.' },
  forum_reply: { title: 'Go Premium to reply', lead: 'Premium members can reply and join conversations.' },
  forum_react: { title: 'Go Premium to react', lead: 'Premium members can react to posts and replies.' },
  submit_content: { title: 'Upgrade required', lead: 'Creators and partners can submit content.' },
  access_partner_tools: { title: 'Partner tools', lead: 'Partner plan required to access partner tools.' },
  start_group_chat: { title: 'Go Premium for group chats', lead: 'Create group conversations and add multiple participants.' },
  dm_attachments: { title: 'Go Premium for file sharing', lead: 'Share files and images in your messages.' },
  view_creator_partner_directory: { title: 'Upgrade for more', lead: 'Unlock more community features with Premium.' },
  connection_request: { title: 'Upgrade for more', lead: 'Unlock more community features with Premium.' },
  profile_edit: { title: 'Upgrade for more', lead: 'Unlock more profile features with Premium.' },
  watch_now_free: { title: 'Upgrade for more', lead: 'Unlock more content with Premium.' },
  watch_now_premium: { title: 'Go Premium to watch', lead: 'Unlock Premium content.' },
};

const BENEFITS = [
  { icon: <CheckCircle2 className="h-4 w-4 text-accent-yellow" />, text: 'Post, reply, and react in the forum' },
  { icon: <MessageSquarePlus className="h-4 w-4 text-accent-yellow" />, text: 'Start group chats' },
  { icon: <Paperclip className="h-4 w-4 text-accent-yellow" />, text: 'Share files and images in DMs' },
  { icon: <Film className="h-4 w-4 text-accent-yellow" />, text: 'Unlock Premium content areas' },
  { icon: <Shield className="h-4 w-4 text-accent-yellow" />, text: 'Priority support (coming soon)' },
];

function UpgradePrompt({
  open,
  onOpenChange,
  requiredPerm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requiredPerm: PermKey;
}) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  const { title, lead } = COPY[requiredPerm] || COPY.view_free;

  const onUpgrade = async () => {
    try {
      track('gate_checkout_click', { perm: requiredPerm });
    } catch {}
    const returnTo = location.pathname + location.search;
    try {
      const result = await api.createCheckoutSession('premium', requiredPerm, returnTo);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Checkout session error", error);
    }
  };

  const Content = (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-accent-yellow" />
          {title}
        </DialogTitle>
        <DialogDescription className="text-bone-white/80">{lead}</DialogDescription>
      </DialogHeader>
      <ul className="space-y-2">
        {BENEFITS.map((b, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-bone-white/90">
            {b.icon}
            {b.text}
          </li>
        ))}
      </ul>
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button onClick={onUpgrade} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
          Upgrade to Premium
        </Button>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Maybe later
        </Button>
      </div>
      <p className="text-xs text-muted-gray pt-2">Secure payments • Powered by Stripe</p>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-charcoal-black border-muted-gray">
          {Content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-charcoal-black border-muted-gray">
        {Content}
      </DialogContent>
    </Dialog>
  );
}

export function UpgradeGateButton({ requiredPerm, onClickAllowed, children }: UpgradeGateButtonProps) {
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);

  const allowed = hasPermission(requiredPerm);

  const onClick = (e: React.MouseEvent) => {
    if (allowed) {
      onClickAllowed();
    } else {
      e.preventDefault();
      e.stopPropagation();
      try {
        track('gate_shown', { perm: requiredPerm });
      } catch {}
      setOpen(true);
    }
  };

  // Merge the onClick into the child element
  const interactive = React.cloneElement(children, { onClick, 'aria-disabled': allowed ? undefined : true });
  const child = allowed ? (
    interactive
  ) : (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{interactive}</TooltipTrigger>
      <TooltipContent className="bg-charcoal-black border-muted-gray text-bone-white">
        Premium required
      </TooltipContent>
    </Tooltip>
  );

  return (
    <>
      {child}
      <UpgradePrompt open={open} onOpenChange={setOpen} requiredPerm={requiredPerm} />
    </>
  );
}