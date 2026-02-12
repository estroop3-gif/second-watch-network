import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Users, Briefcase, Activity, Phone, Mail,
  MessageSquare, Monitor, Target, Star, DollarSign, ChevronDown,
  Calendar, Clock, FileText, ArrowRightLeft,
} from 'lucide-react';
import { useRepSummary, useCRMAdminInteractions } from '@/hooks/crm/useInteractions';
import { useContacts, useActivities, useDeals } from '@/hooks/crm';
import ContactAssignmentDialog from '@/components/crm/ContactAssignmentDialog';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatDateTime } from '@/lib/dateUtils';
import { subDays } from 'date-fns';
import { format } from 'date-fns';

type Tab = 'contacts' | 'deals' | 'activities' | 'interactions' | 'email' | 'goals' | 'reviews';

function getRoleBadge(profile: any) {
  if (profile.is_superadmin) return { label: 'Superadmin', variant: 'destructive' as const };
  if (profile.is_admin) return { label: 'Admin', variant: 'destructive' as const };
  if (profile.is_sales_admin) return { label: 'Sales Admin', variant: 'default' as const };
  if (profile.is_sales_agent) return { label: 'Sales Agent', variant: 'secondary' as const };
  if (profile.is_sales_rep) return { label: 'Sales Rep', variant: 'outline' as const };
  return null;
}

const PAGE_SIZE = 200;

const RepDetail = () => {
  const { repId } = useParams<{ repId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('contacts');

  // Pagination offsets per tab
  const [contactsOffset, setContactsOffset] = useState(0);
  const [dealsOffset, setDealsOffset] = useState(0);
  const [activitiesOffset, setActivitiesOffset] = useState(0);
  const [emailOffset, setEmailOffset] = useState(0);

  const { data: summary, isLoading } = useRepSummary(repId || '');

  // Tab data queries — limit: 200 (backend max)
  const { data: contactsData, isLoading: contactsLoading } = useContacts(
    { assigned_rep_id: repId, limit: PAGE_SIZE, offset: contactsOffset }
  );
  const { data: dealsData, isLoading: dealsLoading } = useDeals(
    { assigned_rep_id: repId, limit: PAGE_SIZE, offset: dealsOffset }
  );
  const { data: activitiesData, isLoading: activitiesLoading } = useActivities(
    { rep_id: repId, limit: PAGE_SIZE, offset: activitiesOffset }
  );
  const { data: emailData, isLoading: emailLoading } = useQuery({
    queryKey: ['crm-rep-emails', repId, emailOffset],
    queryFn: () => api.getCRMRepEmailMessages(repId!, { days: 365, limit: PAGE_SIZE, offset: emailOffset }),
    enabled: activeTab === 'email' && !!repId,
  });
  const { data: goalsData, isLoading: goalsLoading } = useQuery({
    queryKey: ['crm-rep-goals', repId],
    queryFn: () => api.getCRMAdminGoals({ rep_id: repId }),
    enabled: activeTab === 'goals' && !!repId,
  });
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['crm-rep-reviews', repId],
    queryFn: () => api.getCRMAdminReviews({ rep_id: repId }),
    enabled: activeTab === 'reviews' && !!repId,
  });

  // 30-day interaction history for this rep
  const { data: interactionsHistory, isLoading: interactionsLoading } = useCRMAdminInteractions({
    rep_id: repId,
    date_from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    date_to: format(new Date(), 'yyyy-MM-dd'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/crm/admin/team')} className="text-muted-gray">
          <ArrowLeft className="h-4 w-4 mr-1" />Back to Team
        </Button>
        <p className="text-muted-gray text-center py-12">Rep not found.</p>
      </div>
    );
  }

  const profile = summary.profile;
  const roleBadge = getRoleBadge(profile);
  const contacts = summary.contacts;
  const deals = summary.deals;
  const activities = summary.activities;
  const interactions = summary.interactions;
  const email = summary.email;
  const goals = summary.goals;
  const reviews = summary.reviews;

  // Tab count badges from summary data
  const tabCounts: Record<Tab, number | null> = {
    contacts: contacts.total_contacts,
    deals: deals.open_deals + (deals.won_deals || 0) + (deals.lost_deals || 0),
    activities: activities.last_30d,
    interactions: null,
    email: (email.sent_30d || 0) + (email.received_30d || 0),
    goals: goals.active_goals,
    reviews: reviews.recent_reviews,
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'deals', label: 'Deals', icon: Briefcase },
    { id: 'activities', label: 'Activities', icon: Activity },
    { id: 'interactions', label: 'Interactions', icon: Phone },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'reviews', label: 'Reviews', icon: Star },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/crm/admin/team')} className="text-muted-gray">
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <div className="flex items-center gap-3">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-full" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-accent-yellow/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-accent-yellow" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-heading text-bone-white">{profile.full_name}</h2>
              {roleBadge && <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>}
            </div>
            <p className="text-sm text-muted-gray">{profile.email}</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 text-accent-yellow mx-auto mb-1" />
            <div className="text-2xl font-semibold text-bone-white">{contacts.total_contacts}</div>
            <div className="text-xs text-muted-gray">Contacts ({contacts.active_contacts} active)</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="p-4 text-center">
            <Briefcase className="h-5 w-5 text-accent-yellow mx-auto mb-1" />
            <div className="text-2xl font-semibold text-bone-white">{deals.open_deals}</div>
            <div className="text-xs text-muted-gray">Open Deals</div>
            <div className="text-xs text-green-400">${Number(deals.pipeline_value).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="p-4 text-center">
            <Activity className="h-5 w-5 text-accent-yellow mx-auto mb-1" />
            <div className="text-2xl font-semibold text-bone-white">{activities.today}</div>
            <div className="text-xs text-muted-gray">Activities Today</div>
            <div className="text-xs text-muted-gray">{activities.last_30d} (30d)</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="p-4 text-center">
            <Mail className="h-5 w-5 text-accent-yellow mx-auto mb-1" />
            <div className="text-2xl font-semibold text-bone-white">{email.sent_30d}</div>
            <div className="text-xs text-muted-gray">Sent (30d)</div>
            <div className="text-xs text-muted-gray">{email.received_30d} received</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 text-accent-yellow mx-auto mb-1" />
            <div className="text-2xl font-semibold text-bone-white">{goals.active_goals}</div>
            <div className="text-xs text-muted-gray">Active Goals</div>
            <div className="text-xs text-muted-gray">{reviews.recent_reviews} reviews (90d)</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs with count badges */}
      <div className="flex gap-1 overflow-x-auto border-b border-muted-gray/30 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-accent-yellow text-accent-yellow'
                : 'border-transparent text-muted-gray hover:text-bone-white hover:border-muted-gray/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tabCounts[tab.id] != null && tabCounts[tab.id]! > 0 && (
              <span className={`text-xs px-1.5 py-0 rounded-full ${
                activeTab === tab.id
                  ? 'bg-accent-yellow/20 text-accent-yellow'
                  : 'bg-muted-gray/20 text-muted-gray'
              }`}>
                {tabCounts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[300px]">
        {activeTab === 'contacts' && (
          <ContactsTab
            data={contactsData}
            loading={contactsLoading}
            offset={contactsOffset}
            onLoadMore={() => setContactsOffset(prev => prev + PAGE_SIZE)}
            onLoadPrev={() => setContactsOffset(prev => Math.max(0, prev - PAGE_SIZE))}
          />
        )}
        {activeTab === 'deals' && (
          <DealsTab
            data={dealsData}
            loading={dealsLoading}
            offset={dealsOffset}
            onLoadMore={() => setDealsOffset(prev => prev + PAGE_SIZE)}
            onLoadPrev={() => setDealsOffset(prev => Math.max(0, prev - PAGE_SIZE))}
          />
        )}
        {activeTab === 'activities' && (
          <ActivitiesTab
            data={activitiesData}
            loading={activitiesLoading}
            offset={activitiesOffset}
            onLoadMore={() => setActivitiesOffset(prev => prev + PAGE_SIZE)}
            onLoadPrev={() => setActivitiesOffset(prev => Math.max(0, prev - PAGE_SIZE))}
          />
        )}
        {activeTab === 'interactions' && (
          <InteractionsTab
            interactions={interactions}
            history={interactionsHistory}
            loading={interactionsLoading}
          />
        )}
        {activeTab === 'email' && (
          <EmailTab
            data={emailData}
            loading={emailLoading}
            offset={emailOffset}
            onLoadMore={() => setEmailOffset(prev => prev + PAGE_SIZE)}
            onLoadPrev={() => setEmailOffset(prev => Math.max(0, prev - PAGE_SIZE))}
          />
        )}
        {activeTab === 'goals' && (
          <GoalsTab data={goalsData} loading={goalsLoading} />
        )}
        {activeTab === 'reviews' && (
          <ReviewsTab data={reviewsData} loading={reviewsLoading} />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Pagination Controls
// ============================================================================

function PaginationControls({ offset, count, pageSize, onLoadMore, onLoadPrev }: {
  offset: number; count: number; pageSize: number;
  onLoadMore: () => void; onLoadPrev: () => void;
}) {
  const hasMore = count >= pageSize;
  const hasPrev = offset > 0;
  if (!hasMore && !hasPrev) return null;
  return (
    <div className="flex items-center justify-between pt-3">
      <span className="text-xs text-muted-gray">
        Showing {offset + 1}–{offset + count}{hasMore ? '+' : ''}
      </span>
      <div className="flex gap-2">
        {hasPrev && (
          <Button variant="outline" size="sm" onClick={onLoadPrev} className="text-xs">
            Previous {pageSize}
          </Button>
        )}
        {hasMore && (
          <Button variant="outline" size="sm" onClick={onLoadMore} className="text-xs">
            <ChevronDown className="h-3 w-3 mr-1" />Load More
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Tab Components
// ============================================================================

function ContactsTab({ data, loading, offset, onLoadMore, onLoadPrev }: {
  data: any; loading: boolean; offset: number; onLoadMore: () => void; onLoadPrev: () => void;
}) {
  const [transferTarget, setTransferTarget] = useState<any>(null);

  if (loading) return <TabSkeleton />;
  const contacts = data?.contacts || [];
  if (contacts.length === 0 && offset === 0) return <EmptyTab message="No contacts assigned" />;
  return (
    <div className="space-y-2">
      <div className="rounded border border-muted-gray/30 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted-gray/10 text-muted-gray text-left">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Temperature</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Tags</th>
              <th className="px-4 py-2">Last Activity</th>
              <th className="px-4 py-2 text-right">Activities</th>
              <th className="px-4 py-2 text-right">Threads</th>
              <th className="px-4 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted-gray/20">
            {contacts.map((c: any) => (
              <tr key={c.id} className="hover:bg-muted-gray/10">
                <td className="px-4 py-2 whitespace-nowrap">
                  <Link to={`/crm/contacts/${c.id}`} className="text-bone-white hover:text-accent-yellow transition-colors">
                    {c.first_name} {c.last_name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-gray">{c.email || '—'}</td>
                <td className="px-4 py-2 text-muted-gray whitespace-nowrap">{c.phone || '—'}</td>
                <td className="px-4 py-2 text-muted-gray">{c.company || '—'}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className="text-xs capitalize">{c.temperature}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">{c.status}</Badge>
                </td>
                <td className="px-4 py-2">
                  {c.tags && c.tags.length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                      {c.tags.slice(0, 3).map((tag: string, i: number) => (
                        <span key={i} className="text-[10px] bg-muted-gray/20 text-muted-gray px-1.5 py-0 rounded">{tag}</span>
                      ))}
                      {c.tags.length > 3 && <span className="text-[10px] text-muted-gray">+{c.tags.length - 3}</span>}
                    </div>
                  ) : '—'}
                </td>
                <td className="px-4 py-2 text-muted-gray text-xs whitespace-nowrap">
                  {c.last_activity_date ? formatDate(c.last_activity_date, 'MMM d') : '—'}
                </td>
                <td className="px-4 py-2 text-muted-gray text-right">{c.activity_count ?? '—'}</td>
                <td className="px-4 py-2 text-muted-gray text-right">{c.email_thread_count ?? '—'}</td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => setTransferTarget(c)}
                    className="p-1 rounded text-muted-gray hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                    title="Transfer"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls offset={offset} count={contacts.length} pageSize={PAGE_SIZE} onLoadMore={onLoadMore} onLoadPrev={onLoadPrev} />

      <ContactAssignmentDialog
        open={!!transferTarget}
        onOpenChange={(open) => { if (!open) setTransferTarget(null); }}
        contact={transferTarget}
      />
    </div>
  );
}

function DealsTab({ data, loading, offset, onLoadMore, onLoadPrev }: {
  data: any; loading: boolean; offset: number; onLoadMore: () => void; onLoadPrev: () => void;
}) {
  if (loading) return <TabSkeleton />;
  const deals = data?.deals || [];
  if (deals.length === 0 && offset === 0) return <EmptyTab message="No deals" />;
  return (
    <div className="space-y-2">
      <div className="rounded border border-muted-gray/30 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted-gray/10 text-muted-gray text-left">
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Stage</th>
              <th className="px-4 py-2">Value</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Product Type</th>
              <th className="px-4 py-2">Expected Close</th>
              <th className="px-4 py-2 max-w-[200px]">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted-gray/20">
            {deals.map((d: any) => (
              <tr key={d.id} className="hover:bg-muted-gray/10">
                <td className="px-4 py-2 text-bone-white">{d.title}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className="text-xs capitalize">{d.stage?.replace(/_/g, ' ')}</Badge>
                </td>
                <td className="px-4 py-2 text-green-400">${Number(d.value || 0).toLocaleString()}</td>
                <td className="px-4 py-2 text-muted-gray">{d.contact_name || '—'}</td>
                <td className="px-4 py-2 text-muted-gray capitalize">{d.product_type?.replace(/_/g, ' ') || '—'}</td>
                <td className="px-4 py-2 text-muted-gray whitespace-nowrap">
                  {d.expected_close_date ? formatDate(d.expected_close_date) : '—'}
                </td>
                <td className="px-4 py-2 text-muted-gray truncate max-w-[200px]" title={d.description || ''}>
                  {d.description ? d.description.substring(0, 60) + (d.description.length > 60 ? '...' : '') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls offset={offset} count={deals.length} pageSize={PAGE_SIZE} onLoadMore={onLoadMore} onLoadPrev={onLoadPrev} />
    </div>
  );
}

function ActivitiesTab({ data, loading, offset, onLoadMore, onLoadPrev }: {
  data: any; loading: boolean; offset: number; onLoadMore: () => void; onLoadPrev: () => void;
}) {
  if (loading) return <TabSkeleton />;
  const activities = data?.activities || [];
  if (activities.length === 0 && offset === 0) return <EmptyTab message="No recent activities" />;
  return (
    <div className="space-y-2">
      <div className="rounded border border-muted-gray/30 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted-gray/10 text-muted-gray text-left">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Subject</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Outcome</th>
              <th className="px-4 py-2 max-w-[200px]">Description</th>
              <th className="px-4 py-2">Duration</th>
              <th className="px-4 py-2">Follow-up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted-gray/20">
            {activities.map((a: any) => (
              <tr key={a.id} className="hover:bg-muted-gray/10">
                <td className="px-4 py-2 text-muted-gray whitespace-nowrap">
                  {a.activity_date ? formatDate(a.activity_date, 'MMM d') : '—'}
                </td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className="text-xs capitalize">{a.activity_type}</Badge>
                </td>
                <td className="px-4 py-2 text-bone-white truncate max-w-[200px]">{a.subject || '—'}</td>
                <td className="px-4 py-2 text-muted-gray">{a.contact_name || '—'}</td>
                <td className="px-4 py-2 text-muted-gray">{a.outcome || '—'}</td>
                <td className="px-4 py-2 text-muted-gray truncate max-w-[200px]" title={a.description || ''}>
                  {a.description ? a.description.substring(0, 50) + (a.description.length > 50 ? '...' : '') : '—'}
                </td>
                <td className="px-4 py-2 text-muted-gray whitespace-nowrap">
                  {a.duration_minutes ? `${a.duration_minutes}m` : '—'}
                </td>
                <td className="px-4 py-2 text-muted-gray whitespace-nowrap">
                  {a.follow_up_date ? formatDate(a.follow_up_date, 'MMM d') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls offset={offset} count={activities.length} pageSize={PAGE_SIZE} onLoadMore={onLoadMore} onLoadPrev={onLoadPrev} />
    </div>
  );
}

function InteractionsTab({ interactions, history, loading }: {
  interactions: any; history: any; loading: boolean;
}) {
  const items = [
    { label: 'Calls', value: interactions.calls, icon: Phone },
    { label: 'Emails', value: interactions.emails, icon: Mail },
    { label: 'Texts', value: interactions.texts, icon: MessageSquare },
    { label: 'Meetings', value: interactions.meetings, icon: Users },
    { label: 'Demos', value: interactions.demos, icon: Monitor },
    { label: 'Other', value: interactions.other, icon: Activity },
  ];
  const total = items.reduce((s, i) => s + (i.value || 0), 0);

  // Extract daily breakdown from history
  const repHistory = history?.by_rep || [];
  const dailyRows = repHistory.length > 0 ? repHistory : [];

  return (
    <div className="space-y-6">
      {/* Today's counts */}
      <div>
        <p className="text-sm text-muted-gray mb-3">Today's interaction counts</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map(item => (
            <Card key={item.label} className="bg-charcoal-black border-muted-gray/30">
              <CardContent className="p-4 flex items-center gap-3">
                <item.icon className="h-5 w-5 text-accent-yellow" />
                <div>
                  <div className="text-xl font-semibold text-bone-white">{item.value || 0}</div>
                  <div className="text-xs text-muted-gray">{item.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-gray mt-2">Total today: <span className="text-bone-white font-medium">{total}</span></p>
      </div>

      {/* 30-day history table */}
      <div>
        <p className="text-sm text-muted-gray mb-3">30-Day History</p>
        {loading ? <TabSkeleton /> : dailyRows.length === 0 ? (
          <p className="text-xs text-muted-gray">No interaction history available.</p>
        ) : (
          <div className="rounded border border-muted-gray/30 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted-gray/10 text-muted-gray text-left">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2 text-right">Calls</th>
                  <th className="px-4 py-2 text-right">Emails</th>
                  <th className="px-4 py-2 text-right">Texts</th>
                  <th className="px-4 py-2 text-right">Meetings</th>
                  <th className="px-4 py-2 text-right">Demos</th>
                  <th className="px-4 py-2 text-right">Other</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-gray/20">
                {dailyRows.map((row: any, idx: number) => {
                  const rowTotal = (row.calls || 0) + (row.emails || 0) + (row.texts || 0) +
                    (row.meetings || 0) + (row.demos || 0) + (row.other || 0);
                  return (
                    <tr key={row.date || idx} className="hover:bg-muted-gray/10">
                      <td className="px-4 py-2 text-bone-white whitespace-nowrap">
                        {row.date ? formatDate(row.date, 'MMM d') : row.rep_name || '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-gray text-right">{row.calls || 0}</td>
                      <td className="px-4 py-2 text-muted-gray text-right">{row.emails || 0}</td>
                      <td className="px-4 py-2 text-muted-gray text-right">{row.texts || 0}</td>
                      <td className="px-4 py-2 text-muted-gray text-right">{row.meetings || 0}</td>
                      <td className="px-4 py-2 text-muted-gray text-right">{row.demos || 0}</td>
                      <td className="px-4 py-2 text-muted-gray text-right">{row.other || 0}</td>
                      <td className="px-4 py-2 text-bone-white font-medium text-right">{rowTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EmailTab({ data, loading, offset, onLoadMore, onLoadPrev }: {
  data: any; loading: boolean; offset: number; onLoadMore: () => void; onLoadPrev: () => void;
}) {
  if (loading) return <TabSkeleton />;
  const messages = data?.messages || [];
  if (messages.length === 0 && offset === 0) return <EmptyTab message="No emails in the last year" />;
  return (
    <div className="space-y-2">
      <div className="rounded border border-muted-gray/30 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted-gray/10 text-muted-gray text-left">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Direction</th>
              <th className="px-4 py-2">Subject</th>
              <th className="px-4 py-2">To/From</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 max-w-[200px]">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted-gray/20">
            {messages.map((m: any) => (
              <tr key={m.id} className="hover:bg-muted-gray/10">
                <td className="px-4 py-2 text-muted-gray whitespace-nowrap">
                  {formatDateTime(m.created_at, 'MMM d, h:mm a')}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={m.direction === 'outbound' ? 'default' : 'secondary'} className="text-xs">
                    {m.direction === 'outbound' ? 'Sent' : 'Received'}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-bone-white truncate max-w-[250px]">{m.subject || '(no subject)'}</td>
                <td className="px-4 py-2 text-muted-gray truncate max-w-[200px]">
                  {m.direction === 'outbound' ? m.to_address : m.from_address}
                </td>
                <td className="px-4 py-2 text-muted-gray whitespace-nowrap">
                  {m.contact_name || '—'}
                </td>
                <td className="px-4 py-2">
                  {m.status ? (
                    <Badge variant="outline" className="text-xs capitalize">{m.status}</Badge>
                  ) : '—'}
                </td>
                <td className="px-4 py-2 text-muted-gray/70 truncate max-w-[200px] text-xs" title={m.body_text || ''}>
                  {m.body_text ? m.body_text.substring(0, 80) + (m.body_text.length > 80 ? '...' : '') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls offset={offset} count={messages.length} pageSize={PAGE_SIZE} onLoadMore={onLoadMore} onLoadPrev={onLoadPrev} />
    </div>
  );
}

function GoalsTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <TabSkeleton />;
  const goals = data?.goals || [];
  if (goals.length === 0) return <EmptyTab message="No goals" />;
  return (
    <div className="rounded border border-muted-gray/30 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted-gray/10 text-muted-gray text-left">
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Period</th>
            <th className="px-4 py-2">Target</th>
            <th className="px-4 py-2">Actual</th>
            <th className="px-4 py-2">Progress</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-muted-gray/20">
          {goals.map((g: any) => {
            const pct = g.target_value > 0 ? Math.round(((g.manual_override ?? g.actual_value ?? 0) / g.target_value) * 100) : 0;
            return (
              <tr key={g.id} className="hover:bg-muted-gray/10">
                <td className="px-4 py-2 text-bone-white capitalize">{g.goal_type?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2 text-muted-gray">{g.period_start} — {g.period_end}</td>
                <td className="px-4 py-2 text-muted-gray">{g.target_value}</td>
                <td className="px-4 py-2 text-bone-white">{g.manual_override ?? g.actual_value ?? 0}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted-gray/20 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-accent-yellow' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-gray w-10 text-right">{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReviewsTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <TabSkeleton />;
  const reviews = data?.reviews || [];
  if (reviews.length === 0) return <EmptyTab message="No reviews" />;
  return (
    <div className="space-y-3">
      {reviews.map((r: any) => (
        <Card key={r.id} className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="text-xs capitalize">{r.review_type?.replace(/_/g, ' ')}</Badge>
              <span className="text-xs text-muted-gray">{r.review_date ? formatDate(r.review_date) : ''}</span>
            </div>
            {r.rating != null && (
              <div className="flex gap-0.5 mb-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className={`h-4 w-4 ${s <= r.rating ? 'text-accent-yellow fill-accent-yellow' : 'text-muted-gray/30'}`} />
                ))}
              </div>
            )}
            {r.notes && <p className="text-sm text-bone-white">{r.notes}</p>}
            {r.reviewer_name && <p className="text-xs text-muted-gray mt-2">By {r.reviewer_name}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return <p className="text-center py-12 text-muted-gray">{message}</p>;
}

export default RepDetail;
