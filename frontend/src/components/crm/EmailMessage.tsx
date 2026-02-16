import { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Forward, Reply, Eye, Download, Paperclip, User, CalendarDays, MapPin, Video, ExternalLink, Check, X } from 'lucide-react';
import { formatDateTime } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import CopyableEmail from './CopyableEmail';
import { useDownloadEmailAttachment } from '@/hooks/crm/useEmail';
import { useAcceptCalendarEvent, useDeclineCalendarEvent } from '@/hooks/crm/useActivities';
import MeetingSuggestionBanner from './MeetingSuggestionBanner';

interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string;
  location?: string;
  meet_link?: string;
  organizer_email?: string;
  status: string;
  all_day?: boolean;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  from_address: string;
  to_addresses: string[];
  cc_addresses?: string[];
  subject?: string;
  body_html?: string;
  body_text?: string;
  status: string;
  created_at: string;
  open_count?: number;
  first_opened_at?: string;
  last_opened_at?: string;
  attachments?: Attachment[];
  sender_avatar_url?: string;
  calendar_event?: CalendarEvent | null;
}

interface EmailMessageProps {
  message: Message;
  defaultExpanded?: boolean;
  onForward?: () => void;
  onReply?: () => void;
  contactId?: string;
  onAddToCalendar?: (prefilled: any) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getPreviewText(message: Message): string {
  if (message.body_text) return message.body_text.slice(0, 80);
  if (message.body_html) {
    const div = document.createElement('div');
    div.innerHTML = message.body_html;
    return (div.textContent || div.innerText || '').slice(0, 80);
  }
  return '(No content)';
}

/**
 * Split HTML content into main body and quoted reply content.
 * Detects Gmail quotes, blockquotes, Outlook appendonsend, "On ... wrote:" patterns,
 * and forwarded message markers.
 */
function splitQuotedContent(html: string): { mainHtml: string; quotedHtml: string | null } {
  if (!html) return { mainHtml: html, quotedHtml: null };

  // Patterns to detect quoted content, ordered by specificity
  const quotePatterns = [
    // Gmail quote div
    /<div\s+class="gmail_quote"/i,
    // Outlook appendonsend
    /<div\s+id="appendonsend"/i,
    // Standard blockquote (but only if it looks like a reply quote — has "wrote:" before it)
    /(<br\s*\/?>[\s\n]*)*<blockquote/i,
    // "On ... wrote:" pattern (commonly followed by a quote block)
    /<div[^>]*>[\s\n]*On\s.+wrote:[\s\n]*<\/div>/i,
    // Plain text "On ... wrote:" at start of a line
    /(<br\s*\/?>[\s\n]*)On\s[^<]{10,80}\swrote:\s*(<br\s*\/?>)/i,
    // Forwarded message marker
    /---------- Forwarded message ----------/,
  ];

  for (const pattern of quotePatterns) {
    const match = html.match(pattern);
    if (match && match.index !== undefined) {
      const splitIdx = match.index;
      const mainHtml = html.slice(0, splitIdx).trim();
      const quotedHtml = html.slice(splitIdx).trim();
      // Only split if we have meaningful main content
      if (mainHtml.length > 0 && quotedHtml.length > 0) {
        return { mainHtml, quotedHtml };
      }
    }
  }

  return { mainHtml: html, quotedHtml: null };
}

const CalendarInviteCard = ({ event }: { event: CalendarEvent }) => {
  const acceptEvent = useAcceptCalendarEvent();
  const declineEvent = useDeclineCalendarEvent();

  const statusColors: Record<string, string> = {
    pending: 'bg-accent-yellow/20 text-accent-yellow',
    accepted: 'bg-green-500/20 text-green-400',
    declined: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/5">
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays className="h-4 w-4 text-accent-yellow" />
        <span className="font-medium text-bone-white text-sm">Calendar Invite</span>
        <Badge className={cn('text-xs px-1.5 py-0 capitalize', statusColors[event.status] || statusColors.pending)}>
          {event.status}
        </Badge>
      </div>
      <p className="text-sm text-bone-white font-medium">{event.title}</p>
      <p className="text-xs text-muted-gray mt-1">
        {event.all_day
          ? formatDateTime(event.starts_at, 'MMM d, yyyy') + ' (All day)'
          : formatDateTime(event.starts_at, 'MMM d, yyyy h:mm a') +
            (event.ends_at ? ` - ${formatDateTime(event.ends_at, 'h:mm a')}` : '')}
      </p>
      {event.location && (
        <p className="text-xs text-muted-gray mt-1 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {event.location}
        </p>
      )}
      {event.meet_link && (
        <a
          href={event.meet_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent-yellow hover:underline mt-1 flex items-center gap-1 w-fit"
        >
          <Video className="h-3 w-3" />
          Join Google Meet
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
      {event.status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            onClick={() => acceptEvent.mutate(event.id)}
            disabled={acceptEvent.isPending || declineEvent.isPending}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 h-7 text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            {acceptEvent.isPending ? 'Accepting...' : 'Accept'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => declineEvent.mutate(event.id)}
            disabled={acceptEvent.isPending || declineEvent.isPending}
            className="text-muted-gray hover:text-bone-white h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Decline
          </Button>
        </div>
      )}
    </div>
  );
};

const EmailMessage = ({ message, defaultExpanded = true, onForward, onReply, contactId, onAddToCalendar }: EmailMessageProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showQuoted, setShowQuoted] = useState(false);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const isOutbound = message.direction === 'outbound';
  const downloadAttachment = useDownloadEmailAttachment();
  const attachments = message.attachments || [];

  // For outbound messages, merge To + CC into a single "all recipients" list
  // so the message card shows everyone it was sent to (like Gmail)
  const allRecipients = (() => {
    const to = (message.to_addresses || []).filter(a => !a.includes('reply+'));
    if (!isOutbound) return to;
    const cc = (message.cc_addresses || []).filter(a => !a.includes('reply+'));
    const seen = new Set(to.map(a => a.toLowerCase()));
    const merged = [...to];
    for (const addr of cc) {
      if (!seen.has(addr.toLowerCase())) {
        seen.add(addr.toLowerCase());
        merged.push(addr);
      }
    }
    return merged;
  })();

  const { mainHtml, quotedHtml } = message.body_html
    ? splitQuotedContent(message.body_html)
    : { mainHtml: null, quotedHtml: null };

  // Collapsed view
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        className={cn(
          'rounded-lg border px-4 py-3 cursor-pointer hover:bg-muted-gray/20 transition-colors flex items-center gap-3',
          isOutbound
            ? 'border-muted-gray/20 bg-muted-gray/5'
            : 'border-accent-yellow/10 bg-accent-yellow/5'
        )}
      >
        {isOutbound ? (
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-gray flex-shrink-0" />
        ) : (
          <ArrowDownLeft className="h-3.5 w-3.5 text-accent-yellow flex-shrink-0" />
        )}
        <span className="text-sm font-medium text-bone-white truncate min-w-0 max-w-[140px]">
          {message.from_address.split('@')[0]}
        </span>
        <span className="text-xs text-muted-gray truncate flex-1 min-w-0">
          {getPreviewText(message)}
        </span>
        {message.calendar_event && (
          <CalendarDays className="h-3 w-3 text-accent-yellow flex-shrink-0" />
        )}
        {attachments.length > 0 && (
          <Paperclip className="h-3 w-3 text-muted-gray flex-shrink-0" />
        )}
        <span className="text-xs text-muted-gray flex-shrink-0 whitespace-nowrap">
          {formatDateTime(message.created_at, 'MMM d, h:mm a')}
        </span>
      </div>
    );
  }

  // Expanded view
  return (
    <div className={cn(
      'rounded-lg border p-4 overflow-hidden',
      isOutbound
        ? 'border-muted-gray/30 bg-muted-gray/10'
        : 'border-accent-yellow/20 bg-accent-yellow/5'
    )}>
      <div className="flex flex-wrap items-center justify-between gap-y-1 mb-3">
        <div
          className="flex items-center gap-2 text-sm min-w-0 cursor-pointer overflow-hidden"
          onClick={() => setExpanded(false)}
          title="Click to collapse"
        >
          {message.sender_avatar_url ? (
            <img src={message.sender_avatar_url} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-muted-gray/20 flex items-center justify-center flex-shrink-0">
              <User className="h-3.5 w-3.5 text-muted-gray" />
            </div>
          )}
          {isOutbound ? (
            <ArrowUpRight className="h-4 w-4 text-muted-gray flex-shrink-0" />
          ) : (
            <ArrowDownLeft className="h-4 w-4 text-accent-yellow flex-shrink-0" />
          )}
          <CopyableEmail email={message.from_address} className="font-medium text-bone-white" />
          <span className="text-muted-gray flex-shrink-0">&rarr;</span>
          <span className="text-muted-gray truncate">
            {allRecipients[0] || ''}
          </span>
          {(() => {
            const rest = allRecipients.length - 1;
            if (rest <= 0) return null;
            return (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAllRecipients(!showAllRecipients); }}
                className="text-xs text-accent-yellow hover:underline flex-shrink-0"
              >
                {showAllRecipients ? `\u25B4` : `+${rest}`}
              </button>
            );
          })()}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Open tracking badge */}
          {isOutbound && message.open_count != null && message.open_count > 0 && (
            <Badge
              className="bg-green-500/20 text-green-400 text-xs px-1.5 py-0"
              title={`First opened: ${message.first_opened_at ? formatDateTime(message.first_opened_at, 'MMM d, h:mm a') : 'N/A'}\nLast opened: ${message.last_opened_at ? formatDateTime(message.last_opened_at, 'MMM d, h:mm a') : 'N/A'}\nTotal opens: ${message.open_count}`}
            >
              <Eye className="h-3 w-3 mr-1" />
              Opened{message.open_count > 1 ? ` (${message.open_count})` : ''}
            </Badge>
          )}
          {onReply && (
            <Button variant="ghost" size="sm" onClick={onReply} className="h-6 text-xs text-muted-gray hover:text-accent-yellow">
              <Reply className="h-3 w-3 mr-1" />Reply
            </Button>
          )}
          {onForward && (
            <Button variant="ghost" size="sm" onClick={onForward} className="h-6 text-xs text-muted-gray hover:text-accent-yellow">
              <Forward className="h-3 w-3 mr-1" />Fwd
            </Button>
          )}
          <span className="text-xs text-muted-gray">
            {formatDateTime(message.created_at)}
          </span>
        </div>
      </div>

      {showAllRecipients && allRecipients.length > 1 && (
        <div className="text-xs text-muted-gray mb-2 break-words overflow-hidden">
          <span>To: </span>
          {allRecipients.map((addr, i) => (
            <span key={addr}>
              {i > 0 && ', '}
              <CopyableEmail email={addr} className="text-muted-gray" />
            </span>
          ))}
          <button
            onClick={() => setShowAllRecipients(false)}
            className="text-accent-yellow hover:underline ml-2 inline"
          >
            hide
          </button>
        </div>
      )}

      {!isOutbound && message.cc_addresses?.length > 0 && (
        <p className="text-xs text-muted-gray mb-2">
          CC: {message.cc_addresses.filter(a => !a.includes('reply+')).map((addr, i) => (
            <span key={addr}>
              {i > 0 && ', '}
              <CopyableEmail email={addr} className="text-muted-gray" />
            </span>
          ))}
        </p>
      )}

      <div className="overflow-x-hidden">
        {mainHtml ? (
          <>
            <div
              dangerouslySetInnerHTML={{ __html: mainHtml }}
              className="prose prose-invert max-w-none text-bone-white/90 [&_a]:text-accent-yellow [&_img]:max-w-full [&_p]:mb-4 [&_p:last-child]:mb-0 overflow-x-hidden break-words [&_*]:max-w-full"
            />
            {quotedHtml && !showQuoted && (
              <button
                onClick={() => setShowQuoted(true)}
                className="mt-2 px-2 py-0.5 text-xs text-muted-gray bg-muted-gray/20 hover:bg-muted-gray/30 rounded transition-colors tracking-widest font-bold"
                title="Show quoted text"
              >
                &middot;&middot;&middot;
              </button>
            )}
            {quotedHtml && showQuoted && (
              <div className="mt-2 border-l-2 border-muted-gray/30 pl-3">
                <div
                  dangerouslySetInnerHTML={{ __html: quotedHtml }}
                  className="prose prose-invert max-w-none text-bone-white/60 [&_a]:text-accent-yellow [&_img]:max-w-full [&_p]:mb-4 [&_p:last-child]:mb-0"
                />
                <button
                  onClick={() => setShowQuoted(false)}
                  className="mt-1 px-2 py-0.5 text-xs text-muted-gray bg-muted-gray/20 hover:bg-muted-gray/30 rounded transition-colors"
                >
                  Hide quoted text
                </button>
              </div>
            )}
          </>
        ) : message.body_html ? (
          <div
            dangerouslySetInnerHTML={{ __html: message.body_html }}
            className="prose prose-invert max-w-none text-bone-white/90 [&_a]:text-accent-yellow [&_img]:max-w-full [&_p]:mb-4 [&_p:last-child]:mb-0 overflow-x-hidden break-words [&_*]:max-w-full"
          />
        ) : (
          <pre className="text-bone-white/90 text-sm whitespace-pre-wrap font-sans">
            {message.body_text || '(No content)'}
          </pre>
        )}
      </div>

      {/* Calendar Invite Card */}
      {message.calendar_event && (
        <CalendarInviteCard event={message.calendar_event} />
      )}

      {/* Meeting Suggestion Banner */}
      {!message.calendar_event && message.direction === 'inbound' && onAddToCalendar && (
        <MeetingSuggestionBanner
          bodyText={message.body_text || (() => {
            if (!message.body_html) return '';
            const div = document.createElement('div');
            div.innerHTML = message.body_html;
            return div.textContent || div.innerText || '';
          })()}
          subject={message.subject || ''}
          contactId={contactId}
          onAddToCalendar={onAddToCalendar}
        />
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-muted-gray/20">
          <div className="flex items-center gap-1.5 text-xs text-muted-gray mb-2">
            <Paperclip className="h-3 w-3" />
            <span>{attachments.length} attachment{attachments.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <button
                key={att.id}
                onClick={() => downloadAttachment.mutate(att.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted-gray/10 border border-muted-gray/30 hover:border-accent-yellow/50 transition-colors text-xs text-bone-white/80 hover:text-bone-white"
              >
                <Download className="h-3 w-3" />
                <span className="truncate max-w-[150px]">{att.filename}</span>
                <span className="text-muted-gray">({formatFileSize(att.size_bytes)})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailMessage;
