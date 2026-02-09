import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const ACTIVITY_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'demo', label: 'Demo' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'note', label: 'Note' },
  { value: 'other', label: 'Other' },
];

interface CalendarFiltersProps {
  activityType: string;
  onActivityTypeChange: (value: string) => void;
  contactId: string;
  onContactIdChange: (value: string) => void;
  showFollowUps: boolean;
  onShowFollowUpsChange: (value: boolean) => void;
  contacts: any[];
}

const CalendarFilters = ({
  activityType, onActivityTypeChange,
  contactId, onContactIdChange,
  showFollowUps, onShowFollowUpsChange,
  contacts,
}: CalendarFiltersProps) => {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
      <Select value={activityType} onValueChange={onActivityTypeChange}>
        <SelectTrigger className="w-[160px] bg-charcoal-black border-muted-gray">
          <SelectValue placeholder="Activity Type" />
        </SelectTrigger>
        <SelectContent>
          {ACTIVITY_TYPES.map(t => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={contactId} onValueChange={onContactIdChange}>
        <SelectTrigger className="w-[200px] bg-charcoal-black border-muted-gray">
          <SelectValue placeholder="All Contacts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Contacts</SelectItem>
          {contacts.map((c: any) => (
            <SelectItem key={c.id} value={c.id}>
              {c.first_name} {c.last_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Switch
          id="show-follow-ups"
          checked={showFollowUps}
          onCheckedChange={onShowFollowUpsChange}
        />
        <Label htmlFor="show-follow-ups" className="text-sm text-bone-white/70 cursor-pointer">
          Follow-ups
        </Label>
      </div>
    </div>
  );
};

export default CalendarFilters;
