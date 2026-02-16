import { useMemo, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MEETING_PATTERNS = [
  // Time references
  /tomorrow at \d/i,
  /next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /at \d{1,2}(:\d{2})?\s*(am|pm)/i,
  // Meeting language
  /let'?s meet/i,
  /schedule a call/i,
  /set up a meeting/i,
  /book a time/i,
  /sync up/i,
  /hop on a call/i,
  /jump on a call/i,
  /let'?s connect/i,
  /catch up (on a |over )?call/i,
  /get on a call/i,
  /meeting invite/i,
  /calendar invite/i,
  // Platform links
  /meet\.google\.com\/[a-z\-]+/i,
  /zoom\.(us|com)\//i,
  /teams\.microsoft\.com\//i,
  // Explicit scheduling
  /are you (free|available)/i,
  /does .{0,20} work for you/i,
  /what time works/i,
  /when (are you|can you|should we)/i,
];

function detectMeetingLanguage(text: string): boolean {
  if (!text || text.length < 20) return false;
  return MEETING_PATTERNS.some(pattern => pattern.test(text));
}

function extractSuggestedDate(text: string): string | null {
  // Try "tomorrow"
  if (/tomorrow/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  // Try "next <day>"
  const dayMatch = text.match(/next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (dayMatch) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
    if (targetDay >= 0) {
      const d = new Date();
      const currentDay = d.getDay();
      let daysAhead = targetDay - currentDay;
      if (daysAhead <= 0) daysAhead += 7;
      d.setDate(d.getDate() + daysAhead);
      return d.toISOString().split('T')[0];
    }
  }

  return null;
}

interface MeetingSuggestionBannerProps {
  bodyText: string;
  subject: string;
  contactId?: string;
  onAddToCalendar: (prefilled: any) => void;
}

const MeetingSuggestionBanner = ({ bodyText, subject, contactId, onAddToCalendar }: MeetingSuggestionBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  const hasMeetingLanguage = useMemo(() => detectMeetingLanguage(bodyText), [bodyText]);
  const suggestedDate = useMemo(() => extractSuggestedDate(bodyText), [bodyText]);

  if (!hasMeetingLanguage || dismissed) return null;

  const handleClick = () => {
    onAddToCalendar({
      activity_type: 'meeting',
      subject: subject,
      activity_date: suggestedDate || new Date().toISOString().split('T')[0],
      contact_id: contactId || '',
      description: bodyText.slice(0, 200),
    });
  };

  return (
    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md border border-accent-yellow/20 bg-accent-yellow/5">
      <CalendarPlus className="h-4 w-4 text-accent-yellow flex-shrink-0" />
      <span className="text-xs text-bone-white/80 flex-1">
        This email mentions a meeting.
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleClick}
        className="h-6 text-xs text-accent-yellow hover:text-accent-yellow/80 hover:bg-accent-yellow/10 px-2"
      >
        Add to Calendar
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs text-muted-gray hover:text-bone-white/60 px-1"
        title="Dismiss"
      >
        &times;
      </button>
    </div>
  );
};

export default MeetingSuggestionBanner;
