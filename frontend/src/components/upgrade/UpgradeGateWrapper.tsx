import React, { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/hooks/usePermissions";
import { PermKey } from "@/lib/permissions";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Star, CheckCircle2, MessageSquarePlus, Paperclip, Film, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/utils/telemetry";

type UpgradeGateProps = {
  requiredPerm: PermKey;
  children: React.ReactNode;
  disabledHint?: string;
  autoOpen?: boolean; // auto-open on mount (useful for deep-linked gated routes)
};

const COPY: Record<PermKey, { title: string; lead: string }> = {
  view_free: { title: "Go Premium", lead: "Enjoy more features with Premium." },
  forum_read: { title: "Go Premium", lead: "Enjoy more features with Premium." },
  forum_post: { title: "Go Premium to post", lead: "Premium members can start conversations in the forum." },
  forum_reply: { title: "Go Premium to reply", lead: "Premium members can reply and join conversations." },
  forum_react: { title: "Go Premium to react", lead: "Premium members can react to posts and replies." },
  submit_content: { title: "Upgrade required", lead: "Creators and partners can submit content." },
  access_partner_tools: { title: "Partner tools", lead: "Partner plan required to access partner tools." },
  start_group_chat: { title: "Go Premium for group chats", lead: "Create group conversations and add multiple participants." },
  dm_attachments: { title: "Go Premium for file sharing", lead: "Share files and images in your messages." },
  view_creator_partner_directory: { title: "Upgrade for more", lead: "Unlock more community features with Premium." },
  connection_request: { title: "Upgrade for more", lead: "Unlock more community features with Premium." },
  profile_edit: { title: "Upgrade for more", lead: "Unlock more profile features with Premium." },
  watch_now_free: { title: "Upgrade for more", lead: "Unlock more content with Premium." },
  watch_now_premium: { title: "Go Premium to watch", lead: "Unlock Premium content." },
};

const BENEFITS = [
  { icon: <CheckCircle2 className="h-4 w-4 text-accent-yellow" />, text: "Post, reply, and react in the forum" },
  { icon: <MessageSquarePlus className="h-4 w-4 text-accent-yellow" />, text: "Start group chats" },
  { icon: <Paperclip className="h-4 w-4 text-accent-yellow" />, text: "Share files and images in DMs" },
  { icon: <Film className="h-4 w-4 text-accent-yellow" />, text: "Unlock Premium content areas" },
  { icon: <Shield className="h-4 w-4 text-accent-yellow" />, text: "Priority support (coming soon)" },
];

export function UpgradeGate({ requiredPerm, children, disabledHint = "Premium required", autoOpen = false }: UpgradeGateProps) {
  const { hasPermission } = usePermissions();
  const allowed = hasPermission(requiredPerm);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!allowed && autoOpen) {
      try {
        track("gate_shown", { perm: requiredPerm, autoOpen: true });
      } catch {}
      setOpen(true);
    }
  }, [allowed, autoOpen, requiredPerm]);

  const onUpgrade = async () => {
    try {
      track("gate_checkout_click", { perm: requiredPerm });
    } catch {}
    const returnTo = location.pathname + location.search;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const resp = await fetch(
      "https://twjlkyaocvgfkbwbefja.supabase.co/functions/v1/billing-create-checkout-session",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ context: requiredPerm, returnTo }),
      }
    );
    if (!resp.ok) {
      const err = await resp.text();
      console.error("Checkout session error", err);
      return;
    }
    const { url } = await resp.json();
    if (url) {
      window.location.href = url as string;
    }
  };

  const PromptContent = useMemo(() => {
    const { title, lead } = COPY[requiredPerm] || COPY.view_free;
    const inner = (
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
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Maybe later
          </Button>
        </div>
        <p className="text-xs text-muted-gray pt-2">Secure payments • Powered by Stripe</p>
      </div>
    );
    if (isMobile) {
      return (
        <SheetContent side="bottom" className="bg-charcoal-black border-muted-gray">
          {inner}
        </SheetContent>
      );
    }
    return (
      <DialogContent className="sm:max-w-[520px] bg-charcoal-black border-muted-gray">
        {inner}
      </DialogContent>
    );
  }, [requiredPerm, isMobile]);

  if (allowed) {
    return <>{children}</>;
  }

  const gatedChild = (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          track("gate_shown", { perm: requiredPerm });
        } catch {}
        setOpen(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          try {
            track("gate_shown", { perm: requiredPerm, viaKeyboard: true });
          } catch {}
          setOpen(true);
        }
      }}
      aria-disabled
      className="cursor-pointer"
    >
      {children}
    </div>
  );

  return (
    <>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="opacity-90">{gatedChild}</div>
        </TooltipTrigger>
        <TooltipContent className="bg-charcoal-black border-muted-gray text-bone-white">
          {disabledHint}
        </TooltipContent>
      </Tooltip>
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          {PromptContent}
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          {PromptContent}
        </Dialog>
      )}
    </>
  );
}