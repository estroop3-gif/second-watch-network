import { useState } from 'react';
import { UserPlus, RefreshCw, Mail, Phone, Globe, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ContactCard from '@/components/crm/ContactCard';
import ContactFilters from '@/components/crm/ContactFilters';
import ContactAssignmentDialog from '@/components/crm/ContactAssignmentDialog';
import { useUnassignedContacts } from '@/hooks/crm';
import { useQueryClient } from '@tanstack/react-query';

const LeadQueue = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [temperature, setTemperature] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [offset, setOffset] = useState(0);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [hasEmail, setHasEmail] = useState<string>('any');
  const [hasPhone, setHasPhone] = useState<string>('any');
  const [hasWebsite, setHasWebsite] = useState<string>('any');
  const limit = 50;

  const hasAll3 = hasEmail === 'yes' && hasPhone === 'yes' && hasWebsite === 'yes';

  const toggleAll3 = () => {
    if (hasAll3) {
      setHasEmail('any');
      setHasPhone('any');
      setHasWebsite('any');
    } else {
      setHasEmail('yes');
      setHasPhone('yes');
      setHasWebsite('yes');
    }
    setOffset(0);
  };

  const toBool = (v: string): boolean | undefined =>
    v === 'yes' ? true : v === 'no' ? false : undefined;

  const { data, isLoading } = useUnassignedContacts({
    search: search || undefined,
    temperature: temperature !== 'all' ? temperature : undefined,
    has_email: toBool(hasEmail),
    has_phone: toBool(hasPhone),
    has_website: toBool(hasWebsite),
    sort_by: sortBy,
    sort_order: sortBy === 'created_at' ? 'desc' : 'asc',
    limit,
    offset,
  });

  const contacts = data?.contacts || [];
  const total = data?.total || 0;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-gray">
          {total} unassigned contact{total !== 1 ? 's' : ''} in queue
        </p>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button
              size="sm"
              onClick={() => setBulkAssignOpen(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Assign {selectedIds.length} Selected
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ['crm-unassigned-contacts'] })}
            className="border-muted-gray text-bone-white"
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <ContactFilters
        search={search}
        onSearchChange={v => { setSearch(v); setOffset(0); }}
        temperature={temperature}
        onTemperatureChange={v => { setTemperature(v); setOffset(0); }}
        sortBy={sortBy}
        onSortByChange={v => { setSortBy(v); setOffset(0); }}
      />

      {/* Contact Info Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-gray" />
        <Select value={hasEmail} onValueChange={v => { setHasEmail(v); setOffset(0); }}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-charcoal-black border-muted-gray">
            <Mail className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Email</SelectItem>
            <SelectItem value="yes">Has Email</SelectItem>
            <SelectItem value="no">No Email</SelectItem>
          </SelectContent>
        </Select>

        <Select value={hasPhone} onValueChange={v => { setHasPhone(v); setOffset(0); }}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-charcoal-black border-muted-gray">
            <Phone className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Phone</SelectItem>
            <SelectItem value="yes">Has Phone</SelectItem>
            <SelectItem value="no">No Phone</SelectItem>
          </SelectContent>
        </Select>

        <Select value={hasWebsite} onValueChange={v => { setHasWebsite(v); setOffset(0); }}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-charcoal-black border-muted-gray">
            <Globe className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Website</SelectItem>
            <SelectItem value="yes">Has Website</SelectItem>
            <SelectItem value="no">No Website</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={hasAll3 ? 'default' : 'outline'}
          size="sm"
          onClick={toggleAll3}
          className={`h-8 text-xs ${hasAll3 ? 'bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90' : 'border-muted-gray text-bone-white'}`}
        >
          Has All 3
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 text-muted-gray">
          <p className="text-lg mb-2">No unassigned contacts</p>
          <p className="text-sm">All contacts have been assigned to reps.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact: any) => (
              <div key={contact.id} className="relative group">
                <div
                  className={`absolute top-2 left-2 z-10 h-5 w-5 rounded border cursor-pointer flex items-center justify-center transition-colors ${
                    selectedIds.includes(contact.id)
                      ? 'bg-accent-yellow border-accent-yellow'
                      : 'border-muted-gray/50 hover:border-accent-yellow/50'
                  }`}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(contact.id); }}
                >
                  {selectedIds.includes(contact.id) && (
                    <svg className="h-3 w-3 text-charcoal-black" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 01.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
                    </svg>
                  )}
                </div>
                <ContactCard
                  contact={contact}
                  showAdminControls
                  onAssign={(c) => setAssignTarget(c)}
                />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-gray">
                {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Single Assign Dialog */}
      <ContactAssignmentDialog
        open={!!assignTarget}
        onOpenChange={(open) => { if (!open) setAssignTarget(null); }}
        contact={assignTarget}
      />

      {/* Bulk Assign Dialog */}
      <ContactAssignmentDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        contactIds={selectedIds}
        onSuccess={() => setSelectedIds([])}
      />
    </div>
  );
};

export default LeadQueue;
