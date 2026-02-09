import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepEmailMessages } from '@/hooks/crm/useEmail';
import { normalizeSubject } from '@/lib/emailUtils';
import { X, Send, Inbox, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface RepEmailDetailProps {
  repId: string;
  repName: string;
  days: number;
  onClose: () => void;
}

const RepEmailDetail = ({ repId, repName, days, onClose }: RepEmailDetailProps) => {
  const navigate = useNavigate();
  const [direction, setDirection] = useState<string | undefined>(undefined);

  const { data, isLoading } = useRepEmailMessages(repId, { direction, days, limit: 50 });
  const messages = data?.messages || [];

  return (
    <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-muted-gray/30">
        <div>
          <h3 className="text-lg font-medium text-bone-white">{repName}'s Emails</h3>
          <p className="text-xs text-muted-gray">{data?.total || 0} messages in last {days} days</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 p-3 border-b border-muted-gray/20">
        {[
          { label: 'All', value: undefined, icon: Mail },
          { label: 'Sent', value: 'outbound', icon: Send },
          { label: 'Received', value: 'inbound', icon: Inbox },
        ].map((tab) => (
          <Button
            key={tab.label}
            size="sm"
            variant={direction === tab.value ? 'secondary' : 'ghost'}
            onClick={() => setDirection(tab.value)}
            className="text-xs"
          >
            <tab.icon className="h-3 w-3 mr-1" />
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="max-h-[400px] overflow-y-auto divide-y divide-muted-gray/10">
        {isLoading ? (
          <div className="p-8 text-center text-muted-gray text-sm">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-muted-gray text-sm">No emails found.</div>
        ) : (
          messages.map((msg: any) => {
            const contactName = [msg.contact_first_name, msg.contact_last_name].filter(Boolean).join(' ');
            return (
              <button
                key={msg.id}
                onClick={() => navigate(`/crm/email?thread=${msg.thread_id}`)}
                className="w-full text-left px-4 py-3 hover:bg-muted-gray/10 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {msg.direction === 'outbound' ? (
                      <Send className="h-3 w-3 text-accent-yellow flex-shrink-0" />
                    ) : (
                      <Inbox className="h-3 w-3 text-muted-gray flex-shrink-0" />
                    )}
                    <span className="text-sm text-bone-white truncate">
                      {normalizeSubject(msg.subject || '(no subject)')}
                    </span>
                  </div>
                  <span className="text-xs text-muted-gray whitespace-nowrap">
                    {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-gray pl-5">
                  {contactName && <span>{contactName}</span>}
                  {msg.contact_email && <span className="truncate">{msg.contact_email}</span>}
                  {msg.source_type && (
                    <span className="bg-muted-gray/20 px-1.5 py-0.5 rounded text-[10px]">
                      {msg.source_type}
                    </span>
                  )}
                </div>
                {msg.body_text && (
                  <p className="text-xs text-muted-gray/70 mt-1 truncate pl-5">
                    {msg.body_text.slice(0, 100)}
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RepEmailDetail;
