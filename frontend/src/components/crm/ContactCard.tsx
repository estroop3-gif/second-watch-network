import { Link } from 'react-router-dom';
import { Phone, Mail, Building2, Clock, Send, PhoneOff, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import TemperatureBadge from './TemperatureBadge';
import CopyableEmail from './CopyableEmail';
import { useUpdateContact, useUpdateContactDNC } from '@/hooks/crm';
import { formatDate } from '@/lib/dateUtils';
import { toast } from 'sonner';

const TEMPERATURES = [
  { value: 'cold', label: 'Cold', dot: 'bg-blue-400' },
  { value: 'warm', label: 'Warm', dot: 'bg-yellow-400' },
  { value: 'hot', label: 'Hot', dot: 'bg-red-400' },
  { value: 'missed_opportunity', label: 'Missed Opportunity', dot: 'bg-gray-400' },
];

interface ContactCardProps {
  contact: any;
  onEmail?: (contact: any) => void;
  showAdminControls?: boolean;
  onAssign?: (contact: any) => void;
}

const ContactCard = ({ contact, onEmail, showAdminControls, onAssign }: ContactCardProps) => {
  const lastActivity = contact.last_activity_date
    ? formatDate(contact.last_activity_date)
    : null;

  const updateDNC = useUpdateContactDNC();
  const updateContact = useUpdateContact();
  const isDNC = contact.do_not_call || contact.do_not_email || contact.do_not_text;

  const handleToggleDNC = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (contact.do_not_call) {
      updateDNC.mutate(
        { contactId: contact.id, data: { do_not_call: false } },
        { onSuccess: () => toast.success('Removed from Do Not Call') }
      );
    } else {
      updateDNC.mutate(
        { contactId: contact.id, data: { do_not_call: true } },
        { onSuccess: () => toast.success('Added to Do Not Call list') }
      );
    }
  };

  const handleTemperatureChange = (temp: string) => {
    if (temp === contact.temperature) return;
    updateContact.mutate(
      { id: contact.id, data: { temperature: temp } },
      { onSuccess: () => toast.success(`Temperature set to ${temp.replace('_', ' ')}`) }
    );
  };

  return (
    <Link to={`/crm/contacts/${contact.id}`}>
      <Card className={`bg-charcoal-black border-muted-gray/30 hover:border-accent-yellow/50 transition-colors cursor-pointer ${isDNC ? 'border-red-500/30' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-bone-white truncate">
                  {contact.first_name} {contact.last_name}
                </h3>
                {isDNC && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0 h-5 flex-shrink-0">
                    DNC
                  </Badge>
                )}
              </div>
              {contact.company && (
                <div className="flex items-center gap-1 text-sm text-muted-gray">
                  <Building2 className="h-3 w-3" />
                  <span>{contact.company}</span>
                  {contact.job_title && <span>- {contact.job_title}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleToggleDNC}
                className={`p-1.5 rounded transition-colors ${
                  contact.do_not_call
                    ? 'text-red-400 hover:text-red-300 hover:bg-red-400/10'
                    : 'text-muted-gray hover:text-red-400 hover:bg-red-400/10'
                }`}
                title={contact.do_not_call ? 'Remove from DNC' : 'Add to Do Not Call'}
              >
                <PhoneOff className="h-3.5 w-3.5" />
              </button>
              {onEmail && contact.email && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEmail(contact); }}
                  className="p-1.5 rounded text-muted-gray hover:text-accent-yellow hover:bg-accent-yellow/10 transition-colors"
                  title="Send email"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <button className="focus:outline-none">
                    <TemperatureBadge temperature={contact.temperature} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  {TEMPERATURES.map((t) => (
                    <DropdownMenuItem
                      key={t.value}
                      onClick={() => handleTemperatureChange(t.value)}
                      className={contact.temperature === t.value ? 'bg-muted-gray/20' : ''}
                    >
                      <span className={`h-2 w-2 rounded-full ${t.dot} mr-2`} />
                      {t.label}
                      {contact.temperature === t.value && <span className="ml-auto text-accent-yellow text-xs">current</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-gray">
            {contact.email && (
              <span className="flex items-center gap-1" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
                <Mail className="h-3 w-3" />
                <CopyableEmail email={contact.email} className="text-muted-gray" />
              </span>
            )}
            {contact.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {contact.phone}
              </span>
            )}
          </div>

          {/* Admin: Assigned rep + assign button */}
          {showAdminControls && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-gray">
                {contact.assigned_rep_name
                  ? <>Rep: <span className="text-bone-white/70">{contact.assigned_rep_name}</span></>
                  : <span className="text-orange-400">Unassigned</span>
                }
              </span>
              {onAssign && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAssign(contact); }}
                  className="p-1 rounded text-muted-gray hover:text-accent-yellow hover:bg-accent-yellow/10 transition-colors"
                  title={contact.assigned_rep_id ? 'Reassign' : 'Assign'}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-muted-gray">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {lastActivity ? `Last contacted: ${lastActivity}` : 'No activity'}
            </span>
            <div className="flex items-center gap-3">
              {contact.email_thread_count > 0 && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-accent-yellow/70" /> {contact.email_thread_count}
                </span>
              )}
              {contact.activity_count > 0 && (
                <span>{contact.activity_count} activities</span>
              )}
            </div>
          </div>

          {contact.tags?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {contact.tags.slice(0, 3).map((tag: string) => (
                <span
                  key={tag}
                  className="inline-block rounded-full bg-muted-gray/20 px-2 py-0.5 text-xs text-bone-white/70"
                >
                  {tag}
                </span>
              ))}
              {contact.tags.length > 3 && (
                <span className="text-xs text-muted-gray">+{contact.tags.length - 3}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};

export default ContactCard;
