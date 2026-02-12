import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, User, Mail, Phone, Building2, Briefcase } from 'lucide-react';
import { useTeamDirectory } from '@/hooks/crm/useEmail';
import { useEmailCompose } from '@/context/EmailComposeContext';

interface TeamDirectoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getRoleBadge(member: any): { label: string; color: string } | null {
  if (member.is_superadmin) return { label: 'Super Admin', color: 'bg-primary-red/20 text-primary-red' };
  if (member.is_admin) return { label: 'Admin', color: 'bg-primary-red/20 text-primary-red' };
  if (member.is_moderator) return { label: 'Moderator', color: 'bg-blue-500/20 text-blue-400' };
  if (member.is_sales_admin) return { label: 'Sales Admin', color: 'bg-accent-yellow/20 text-accent-yellow' };
  if (member.is_sales_agent) return { label: 'Sales Agent', color: 'bg-green-500/20 text-green-400' };
  if (member.is_sales_rep) return { label: 'Sales Rep', color: 'bg-purple-500/20 text-purple-400' };
  return null;
}

const TeamDirectoryModal = ({ open, onOpenChange }: TeamDirectoryModalProps) => {
  const [search, setSearch] = useState('');
  const { data: members, isLoading } = useTeamDirectory();
  const { openCompose } = useEmailCompose();

  const filtered = useMemo(() => {
    const list = Array.isArray(members) ? members : [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((m: any) =>
      (m.full_name || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.theswn_email || '').toLowerCase().includes(q) ||
      (m.department || '').toLowerCase().includes(q) ||
      (m.job_title || '').toLowerCase().includes(q)
    );
  }, [members, search]);

  const handleSendEmail = (member: any) => {
    openCompose({ defaultTo: member.theswn_email });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Team Directory</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Find team members and send them an email.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <Input
            placeholder="Search by name, email, department, title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-charcoal-black border-muted-gray pl-10"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-gray" />
            </div>
          )}

          {filtered.map((m: any) => {
            const role = getRoleBadge(m);
            return (
              <div
                key={m.id}
                className="flex items-start justify-between p-3 rounded-lg border border-muted-gray/20 hover:border-accent-yellow/30 transition-colors gap-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted-gray/20 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-muted-gray" />
                    </div>
                  )}
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-bone-white truncate">{m.full_name || 'Unnamed'}</span>
                      {role && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border-0 ${role.color}`}>
                          {role.label}
                        </Badge>
                      )}
                    </div>
                    {m.theswn_email && (
                      <div className="flex items-center gap-1 text-xs text-accent-yellow">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{m.theswn_email}</span>
                      </div>
                    )}
                    {(m.job_title || m.department) && (
                      <div className="flex items-center gap-2 text-xs text-muted-gray">
                        {m.job_title && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {m.job_title}
                          </span>
                        )}
                        {m.department && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {m.department}
                          </span>
                        )}
                      </div>
                    )}
                    {m.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-gray">
                        <Phone className="h-3 w-3" />
                        {m.phone}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!m.theswn_email}
                  onClick={() => handleSendEmail(m)}
                  className="text-accent-yellow hover:text-accent-yellow flex-shrink-0 mt-0.5"
                  title={m.theswn_email ? `Email ${m.full_name}` : 'No email account'}
                >
                  <Mail className="h-4 w-4 mr-1" /> Email
                </Button>
              </div>
            );
          })}

          {!isLoading && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-gray py-8">
              {search ? 'No team members match your search' : 'No team members found'}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeamDirectoryModal;
