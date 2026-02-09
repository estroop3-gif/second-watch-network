import { useState, useMemo } from 'react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Settings, Loader2 } from 'lucide-react';
import { useQuickReplies, useSendEmail } from '@/hooks/crm/useEmail';
import { useToast } from '@/hooks/use-toast';

interface QuickReplyDropdownProps {
  threadId: string;
  toEmail: string;
  contactId?: string;
  onManage?: () => void;
}

const QuickReplyDropdown = ({ threadId, toEmail, contactId, onManage }: QuickReplyDropdownProps) => {
  const [open, setOpen] = useState(false);
  const { data: repliesData } = useQuickReplies();
  const sendEmail = useSendEmail();
  const { toast } = useToast();

  const { systemReplies, userReplies } = useMemo(() => {
    const all = repliesData?.quick_replies || repliesData || [];
    const list = Array.isArray(all) ? all : [];
    return {
      systemReplies: list.filter((r: any) => r.is_system),
      userReplies: list.filter((r: any) => !r.is_system),
    };
  }, [repliesData]);

  const handleSend = (reply: any) => {
    sendEmail.mutate(
      {
        thread_id: threadId,
        to_email: toEmail,
        contact_id: contactId,
        subject: 'Re:',
        body_html: reply.body_html || `<p>${reply.body_text}</p>`,
        body_text: reply.body_text,
      },
      {
        onSuccess: () => {
          toast({ title: 'Sent', description: `Quick reply "${reply.title}" sent.` });
          setOpen(false);
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to send quick reply.', variant: 'destructive' });
        },
      },
    );
  };

  const ReplyItem = ({ reply }: { reply: any }) => (
    <button
      onClick={() => handleSend(reply)}
      disabled={sendEmail.isPending}
      className="w-full text-left px-3 py-2 rounded-md hover:bg-muted-gray/20 transition-colors group"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-bone-white group-hover:text-accent-yellow transition-colors">
          {reply.title}
        </span>
        {reply.is_system && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-gray/40 text-muted-gray">
            System
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-gray mt-0.5 line-clamp-1">{reply.body_text}</p>
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-gray hover:text-accent-yellow" title="Quick replies">
          <Zap className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2 bg-charcoal-black border-muted-gray"
        align="end"
      >
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <span className="text-xs font-medium text-muted-gray uppercase tracking-wider">Quick Replies</span>
          {sendEmail.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-gray" />}
        </div>

        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {systemReplies.map((r: any) => <ReplyItem key={r.id} reply={r} />)}

          {systemReplies.length > 0 && userReplies.length > 0 && (
            <div className="border-t border-muted-gray/20 my-1" />
          )}

          {userReplies.map((r: any) => <ReplyItem key={r.id} reply={r} />)}

          {systemReplies.length === 0 && userReplies.length === 0 && (
            <p className="text-center text-xs text-muted-gray py-4">No quick replies yet</p>
          )}
        </div>

        {onManage && (
          <>
            <div className="border-t border-muted-gray/20 mt-1 pt-1">
              <button
                onClick={() => { setOpen(false); onManage(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-gray hover:text-bone-white rounded-md hover:bg-muted-gray/20 transition-colors"
              >
                <Settings className="h-3.5 w-3.5" /> Manage Quick Replies...
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default QuickReplyDropdown;
