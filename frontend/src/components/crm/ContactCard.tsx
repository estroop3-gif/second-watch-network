import { Link } from 'react-router-dom';
import { Phone, Mail, Building2, Clock, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import TemperatureBadge from './TemperatureBadge';
import CopyableEmail from './CopyableEmail';

interface ContactCardProps {
  contact: any;
  onEmail?: (contact: any) => void;
}

const ContactCard = ({ contact, onEmail }: ContactCardProps) => {
  const lastActivity = contact.last_activity_date
    ? new Date(contact.last_activity_date).toLocaleDateString()
    : 'No activity';

  return (
    <Link to={`/crm/contacts/${contact.id}`}>
      <Card className="bg-charcoal-black border-muted-gray/30 hover:border-accent-yellow/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-medium text-bone-white">
                {contact.first_name} {contact.last_name}
              </h3>
              {contact.company && (
                <div className="flex items-center gap-1 text-sm text-muted-gray">
                  <Building2 className="h-3 w-3" />
                  <span>{contact.company}</span>
                  {contact.job_title && <span>- {contact.job_title}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onEmail && contact.email && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEmail(contact); }}
                  className="p-1.5 rounded text-muted-gray hover:text-accent-yellow hover:bg-accent-yellow/10 transition-colors"
                  title="Send email"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
              <TemperatureBadge temperature={contact.temperature} />
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

          <div className="mt-3 flex items-center justify-between text-xs text-muted-gray">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {lastActivity}
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
