import { Link } from 'react-router-dom';
import { Building2, Globe, UserPlus, Mail, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import TemperatureBadge from './TemperatureBadge';
import CopyableEmail from './CopyableEmail';
import { formatDate } from '@/lib/dateUtils';

interface ContactListViewProps {
  contacts: any[];
  onEmail?: (contact: any) => void;
  showAdminControls?: boolean;
  onAssign?: (contact: any) => void;
}

const formatDomain = (url: string) => {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const ContactListView = ({ contacts, onEmail, showAdminControls, onAssign }: ContactListViewProps) => {
  return (
    <div className="rounded-lg border border-muted-gray/30 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-muted-gray/30 hover:bg-transparent">
            <TableHead className="text-muted-gray">Name</TableHead>
            <TableHead className="text-muted-gray">Company</TableHead>
            <TableHead className="text-muted-gray">Email</TableHead>
            <TableHead className="text-muted-gray">Phone</TableHead>
            <TableHead className="text-muted-gray">Website</TableHead>
            <TableHead className="text-muted-gray">Temp</TableHead>
            <TableHead className="text-muted-gray">Last Activity</TableHead>
            <TableHead className="text-muted-gray">Tags</TableHead>
            {showAdminControls && <TableHead className="text-muted-gray">Rep</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow
              key={contact.id}
              className="border-muted-gray/20 hover:bg-muted-gray/5 cursor-pointer"
            >
              <TableCell className="py-2.5">
                <Link to={`/crm/contacts/${contact.id}`} className="flex items-center gap-1.5">
                  <span className="text-sm text-bone-white font-medium hover:text-accent-yellow transition-colors">
                    {contact.first_name}{contact.last_name ? ` ${contact.last_name}` : ''}
                  </span>
                  {!contact.last_name && (
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] px-1 py-0 h-4">
                      <Building2 className="h-2.5 w-2.5 mr-0.5" /> Co
                    </Badge>
                  )}
                </Link>
              </TableCell>
              <TableCell className="py-2.5 text-sm text-muted-gray">
                {contact.company_id ? (
                  <Link
                    to={`/crm/companies/${contact.company_id}`}
                    className="hover:text-accent-yellow transition-colors"
                  >
                    {contact.company}
                  </Link>
                ) : (
                  contact.company || '—'
                )}
              </TableCell>
              <TableCell className="py-2.5 text-sm" onClick={e => e.stopPropagation()}>
                {contact.email ? (
                  <div className="flex items-center gap-1.5">
                    <CopyableEmail email={contact.email} className="text-muted-gray text-xs" />
                    {onEmail && (
                      <button
                        onClick={() => onEmail(contact)}
                        className="p-0.5 rounded text-muted-gray hover:text-accent-yellow transition-colors"
                        title="Send email"
                      >
                        <Mail className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-gray/50">—</span>
                )}
              </TableCell>
              <TableCell className="py-2.5 text-sm text-muted-gray">
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="hover:text-accent-yellow transition-colors">
                    {contact.phone}
                  </a>
                ) : (
                  <span className="text-muted-gray/50">—</span>
                )}
              </TableCell>
              <TableCell className="py-2.5 text-sm text-muted-gray max-w-[140px]">
                {contact.website ? (
                  <a
                    href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 hover:text-accent-yellow transition-colors truncate"
                  >
                    <Globe className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{formatDomain(contact.website)}</span>
                  </a>
                ) : (
                  <span className="text-muted-gray/50">—</span>
                )}
              </TableCell>
              <TableCell className="py-2.5">
                <TemperatureBadge temperature={contact.temperature} />
              </TableCell>
              <TableCell className="py-2.5 text-xs text-muted-gray">
                {contact.last_activity_date
                  ? formatDate(contact.last_activity_date)
                  : <span className="text-muted-gray/50">None</span>
                }
              </TableCell>
              <TableCell className="py-2.5">
                {contact.tags?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.slice(0, 2).map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-block rounded-full bg-muted-gray/20 px-1.5 py-0 text-[10px] text-bone-white/70"
                      >
                        {tag}
                      </span>
                    ))}
                    {contact.tags.length > 2 && (
                      <span className="text-[10px] text-muted-gray">+{contact.tags.length - 2}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-gray/50 text-xs">—</span>
                )}
              </TableCell>
              {showAdminControls && (
                <TableCell className="py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-gray">
                      {contact.assigned_rep_name ? (
                        <span className="text-bone-white/70">{contact.assigned_rep_name}</span>
                      ) : (
                        <span className="text-orange-400">Unassigned</span>
                      )}
                    </span>
                    {onAssign && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAssign(contact); }}
                        className="p-0.5 rounded text-muted-gray hover:text-accent-yellow hover:bg-accent-yellow/10 transition-colors"
                        title={contact.assigned_rep_id ? 'Reassign' : 'Assign'}
                      >
                        <UserPlus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ContactListView;
