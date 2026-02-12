import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, UserPlus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import ContactCard from '@/components/crm/ContactCard';
import ContactForm from '@/components/crm/ContactForm';
import ContactFilters from '@/components/crm/ContactFilters';
import CalendarActivityDialog from '@/components/crm/CalendarActivityDialog';
import ContactAssignmentDialog from '@/components/crm/ContactAssignmentDialog';
import { useContacts, useCreateContact, useCreateActivity, useNewLeads, useMarkNewLeadsViewed } from '@/hooks/crm';
import { useSidebarBadges } from '@/hooks/crm/useSidebarBadges';
import { useEmailCompose } from '@/context/EmailComposeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

type Tab = 'my_contacts' | 'new_leads' | 'all_contacts';

const Contacts = () => {
  const navigate = useNavigate();
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin', 'sales_admin']);

  const [activeTab, setActiveTab] = useState<Tab>('my_contacts');
  const [search, setSearch] = useState('');
  const [temperature, setTemperature] = useState('all');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [showCreate, setShowCreate] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [offset, setOffset] = useState(0);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const limit = 50;

  const { data: badges } = useSidebarBadges();
  const newLeadsCount = badges?.new_leads || 0;

  // My Contacts / All Contacts data
  const { data, isLoading } = useContacts({
    search: search || undefined,
    temperature: temperature !== 'all' ? temperature : undefined,
    status: status !== 'all' ? status : undefined,
    sort_by: sortBy,
    sort_order: sortBy === 'created_at' ? 'desc' : 'asc',
    limit,
    offset,
  });

  // New Leads data
  const { data: newLeadsData, isLoading: newLeadsLoading } = useNewLeads();
  const markViewed = useMarkNewLeadsViewed();

  // Mark new leads as viewed when user visits the tab
  useEffect(() => {
    if (activeTab === 'new_leads' && newLeadsCount > 0) {
      markViewed.mutate();
    }
  }, [activeTab]);

  const createContact = useCreateContact();
  const createActivity = useCreateActivity();
  const { openCompose } = useEmailCompose();

  const handleEmail = (contact: any) => {
    openCompose({
      defaultTo: contact.email,
      contactId: contact.id,
      contactData: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        company: contact.company,
        email: contact.email,
      },
    });
  };

  const contacts = data?.contacts || [];
  const total = data?.total || 0;
  const newLeads = newLeadsData?.contacts || [];

  const handleCreate = async (values: any) => {
    try {
      const result = await createContact.mutateAsync(values);
      setShowCreate(false);
      toast.success('Contact created');
      navigate(`/crm/contacts/${result.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create contact');
    }
  };

  const handleLogActivity = async (data: any) => {
    try {
      await createActivity.mutateAsync(data);
      setShowLogActivity(false);
      toast.success('Activity logged');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleNewLeadClick = (contact: any) => {
    // Navigate to the contact detail — it will show in "My Contacts"
    navigate(`/crm/contacts/${contact.id}`);
  };

  // Reset pagination on tab change
  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setOffset(0);
  };

  // Determine which tabs to show
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'my_contacts', label: 'My Contacts', badge: badges?.my_contacts || 0 },
  ];

  // Always show New Leads tab — show badge when there are unviewed
  tabs.push({ id: 'new_leads', label: 'New Leads', badge: newLeadsCount });

  if (isAdmin) {
    tabs.push({ id: 'all_contacts', label: 'All Contacts' });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-bone-white">Contacts</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowLogActivity(true)}
            className="border-green-500/50 text-green-400 hover:bg-green-500/10"
          >
            <ClipboardList className="h-4 w-4 mr-2" /> Log Activity
          </Button>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Plus className="h-4 w-4 mr-2" /> New Contact
          </Button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-muted-gray/30">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-accent-yellow text-accent-yellow'
                : 'border-transparent text-muted-gray hover:text-bone-white hover:border-muted-gray/50'
            }`}
          >
            {tab.id === 'new_leads' && <Sparkles className="h-3.5 w-3.5" />}
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className={`text-xs px-1.5 py-0 rounded-full ${
                tab.id === 'new_leads'
                  ? 'bg-primary-red/20 text-primary-red'
                  : activeTab === tab.id
                    ? 'bg-accent-yellow/20 text-accent-yellow'
                    : 'bg-muted-gray/20 text-muted-gray'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* New Leads Tab */}
      {activeTab === 'new_leads' && (
        <>
          {newLeadsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-40 rounded-lg" />
              ))}
            </div>
          ) : newLeads.length === 0 ? (
            <div className="text-center py-12 text-muted-gray">
              <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p className="text-lg mb-2">No new leads</p>
              <p className="text-sm">When contacts are assigned to you, they'll appear here first.</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-gray">{newLeads.length} new lead{newLeads.length !== 1 ? 's' : ''} assigned to you</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {newLeads.map((contact: any) => (
                  <div key={contact.id} className="relative">
                    {contact.assigned_by_name && (
                      <div className="text-xs text-muted-gray mb-1 px-1">
                        Assigned by {contact.assigned_by_name}
                        {contact.assignment_notes && <> &mdash; {contact.assignment_notes}</>}
                      </div>
                    )}
                    <div onClick={() => handleNewLeadClick(contact)} className="cursor-pointer">
                      <ContactCard contact={contact} onEmail={handleEmail} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* My Contacts / All Contacts Tab */}
      {(activeTab === 'my_contacts' || activeTab === 'all_contacts') && (
        <>
          <ContactFilters
            search={search}
            onSearchChange={v => { setSearch(v); setOffset(0); }}
            temperature={temperature}
            onTemperatureChange={v => { setTemperature(v); setOffset(0); }}
            status={status}
            onStatusChange={v => { setStatus(v); setOffset(0); }}
            sortBy={sortBy}
            onSortByChange={v => { setSortBy(v); setOffset(0); }}
          />

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-40 rounded-lg" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-gray">
              <p className="text-lg mb-2">No contacts found</p>
              <p className="text-sm">Create your first contact to get started.</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-gray">{total} contacts</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map((contact: any) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    onEmail={handleEmail}
                    showAdminControls={isAdmin}
                    onAssign={isAdmin ? (c) => setAssignTarget(c) : undefined}
                  />
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
        </>
      )}

      {/* Create Contact Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-charcoal-black border-muted-gray max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-bone-white">New Contact</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 p-6 pt-4">
            <ContactForm
              onSubmit={handleCreate}
              isSubmitting={createContact.isPending}
              submitLabel="Create Contact"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Activity Dialog */}
      <CalendarActivityDialog
        open={showLogActivity}
        onOpenChange={setShowLogActivity}
        contacts={contacts}
        onSubmit={handleLogActivity}
        isSubmitting={createActivity.isPending}
        defaultDate={new Date().toISOString().split('T')[0]}
      />

      {/* Assign Contact Dialog (admin) */}
      <ContactAssignmentDialog
        open={!!assignTarget}
        onOpenChange={(open) => { if (!open) setAssignTarget(null); }}
        contact={assignTarget}
      />
    </div>
  );
};

export default Contacts;
