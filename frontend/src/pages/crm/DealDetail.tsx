import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDeal, useUpdateDeal, useChangeDealStage, useDeleteDeal } from '@/hooks/crm/useDeals';
import { useCreateActivity } from '@/hooks/crm';
import { useDealEmailThreads } from '@/hooks/crm/useEmail';
import { usePermissions } from '@/hooks/usePermissions';
import StageHistory from '@/components/crm/StageHistory';
import ActivityTimeline from '@/components/crm/ActivityTimeline';
import ActivityForm from '@/components/crm/ActivityForm';
import DealForm from '@/components/crm/DealForm';
import { normalizeSubject } from '@/lib/emailUtils';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useEmailCompose } from '@/context/EmailComposeContext';
import {
  ArrowLeft, Edit, Trash2, DollarSign, Calendar,
  User, Building, Phone, Mail, Target, Send, AtSign,
} from 'lucide-react';
import { format } from 'date-fns';

const STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

const STAGE_COLORS: Record<string, string> = {
  lead: 'bg-slate-600',
  contacted: 'bg-blue-600',
  qualified: 'bg-indigo-600',
  proposal: 'bg-purple-600',
  negotiation: 'bg-amber-600',
  closed_won: 'bg-emerald-600',
  closed_lost: 'bg-red-600',
};

const PRODUCT_LABELS: Record<string, string> = {
  backlot_membership: 'Backlot Membership',
  premium_membership: 'Premium Membership',
  production_service: 'Production Service',
  gear_rental: 'Gear Rental',
  ad_deal: 'Ad Deal',
  sponsorship: 'Sponsorship',
  other: 'Other',
};

const DealDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin', 'sales_admin']);

  const { data: deal, isLoading } = useDeal(id);
  const updateDeal = useUpdateDeal();
  const changeStage = useChangeDealStage();
  const deleteDeal = useDeleteDeal();
  const createActivity = useCreateActivity();

  const { openCompose } = useEmailCompose();
  const { data: emailData } = useDealEmailThreads(id || '');
  const emailThreads = emailData?.threads || [];
  const [showEditDeal, setShowEditDeal] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showStageChange, setShowStageChange] = useState(false);
  const [newStage, setNewStage] = useState('');
  const [stageNotes, setStageNotes] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [activeTab, setActiveTab] = useState<'activities' | 'history' | 'emails'>('activities');

  if (isLoading) {
    return <div className="text-center py-12 text-muted-gray">Loading deal...</div>;
  }

  if (!deal) {
    return <div className="text-center py-12 text-muted-gray">Deal not found.</div>;
  }

  const amount = deal.amount_cents ? `$${(deal.amount_cents / 100).toLocaleString()}` : '$0';
  const contactName = [deal.contact_first_name, deal.contact_last_name].filter(Boolean).join(' ');

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    try {
      await deleteDeal.mutateAsync(deal.id);
      toast({ title: 'Deal deleted' });
      navigate('/crm/pipeline');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleStageChange = async () => {
    if (!newStage || newStage === deal.stage) return;
    try {
      await changeStage.mutateAsync({
        id: deal.id,
        data: {
          stage: newStage,
          notes: stageNotes || undefined,
          close_reason: closeReason || undefined,
        },
      });
      toast({ title: 'Stage updated' });
      setShowStageChange(false);
      setNewStage('');
      setStageNotes('');
      setCloseReason('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdateDeal = async (formData: any) => {
    try {
      await updateDeal.mutateAsync({ id: deal.id, data: formData });
      toast({ title: 'Deal updated' });
      setShowEditDeal(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleLogActivity = async (formData: any) => {
    try {
      await createActivity.mutateAsync({ ...formData, contact_id: deal.contact_id, deal_id: deal.id });
      toast({ title: 'Activity logged' });
      setShowLogActivity(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/crm/pipeline')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading text-bone-white">{deal.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full text-white ${STAGE_COLORS[deal.stage]}`}>
                {deal.stage?.replace('_', ' ')}
              </span>
              <span className="text-sm text-muted-gray">
                {PRODUCT_LABELS[deal.product_type] || deal.product_type}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowStageChange(true)} className="border-muted-gray text-bone-white">
            Move Stage
          </Button>
          {deal.contact_email && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCompose({
                defaultTo: deal.contact_email,
                contactId: deal.contact_id,
                defaultSubject: deal.title,
                contactData: {
                  first_name: deal.contact_first_name,
                  last_name: deal.contact_last_name,
                  company: deal.contact_company,
                  email: deal.contact_email,
                  deal_name: deal.title,
                },
              })}
              className="border-accent-yellow text-accent-yellow hover:bg-accent-yellow/10"
            >
              <Send className="h-4 w-4 mr-1" /> Email
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowLogActivity(true)} className="border-muted-gray text-bone-white">
            Log Activity
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditDeal(true)} className="border-muted-gray text-bone-white">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-400 hover:text-red-300">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Deal Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          {deal.description && (
            <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-bone-white mb-2">Description</h3>
              <p className="text-sm text-muted-gray">{deal.description}</p>
            </div>
          )}

          {/* Tabs */}
          <div>
            <div className="flex gap-4 border-b border-muted-gray/30 mb-4">
              <button
                onClick={() => setActiveTab('activities')}
                className={`pb-2 text-sm font-medium ${activeTab === 'activities' ? 'text-accent-yellow border-b-2 border-accent-yellow' : 'text-muted-gray'}`}
              >
                Activities ({deal.activities?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`pb-2 text-sm font-medium ${activeTab === 'history' ? 'text-accent-yellow border-b-2 border-accent-yellow' : 'text-muted-gray'}`}
              >
                Stage History ({deal.stage_history?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('emails')}
                className={`pb-2 text-sm font-medium ${activeTab === 'emails' ? 'text-accent-yellow border-b-2 border-accent-yellow' : 'text-muted-gray'}`}
              >
                Emails ({emailThreads.length})
              </button>
            </div>

            {activeTab === 'activities' ? (
              <ActivityTimeline activities={deal.activities || []} />
            ) : activeTab === 'history' ? (
              <StageHistory history={deal.stage_history || []} />
            ) : (
              <div className="space-y-2">
                {emailThreads.length === 0 ? (
                  <div className="text-center py-8 text-muted-gray text-sm">
                    No email threads linked to this deal.
                  </div>
                ) : (
                  emailThreads.map((thread: any) => (
                    <button
                      key={thread.id}
                      onClick={() => navigate(`/crm/email?thread=${thread.id}`)}
                      className="w-full text-left p-3 rounded-lg bg-charcoal-black/50 border border-muted-gray/20 hover:border-muted-gray/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <AtSign className="h-4 w-4 text-accent-yellow flex-shrink-0" />
                          <span className="text-sm text-bone-white truncate">
                            {normalizeSubject(thread.subject || '(no subject)')}
                          </span>
                        </div>
                        <span className="text-xs text-muted-gray whitespace-nowrap ml-2">
                          {thread.message_count} msgs
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-gray ml-6">
                        {thread.contact_email && <span>{thread.contact_email}</span>}
                        {thread.last_message_at && (
                          <span>{format(new Date(thread.last_message_at), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-bone-white">Deal Details</h3>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-accent-yellow" />
              <span className="text-bone-white">{amount}</span>
              <span className="text-muted-gray">({deal.probability}% prob.)</span>
            </div>
            {deal.expected_close_date && (
              <div className="flex items-center gap-2 text-sm text-muted-gray">
                <Calendar className="h-4 w-4" />
                <span>Expected: {new Date(deal.expected_close_date).toLocaleDateString()}</span>
              </div>
            )}
            {deal.actual_close_date && (
              <div className="flex items-center gap-2 text-sm text-muted-gray">
                <Calendar className="h-4 w-4" />
                <span>Closed: {new Date(deal.actual_close_date).toLocaleDateString()}</span>
              </div>
            )}
            {deal.competitor && (
              <div className="flex items-center gap-2 text-sm text-muted-gray">
                <Target className="h-4 w-4" />
                <span>Competitor: {deal.competitor}</span>
              </div>
            )}
            {deal.close_reason && (
              <p className="text-xs text-muted-gray">Reason: {deal.close_reason}</p>
            )}
            {deal.assigned_rep_name && (
              <div className="flex items-center gap-2 text-sm text-muted-gray">
                <User className="h-4 w-4" />
                <span>Rep: {deal.assigned_rep_name}</span>
              </div>
            )}
          </div>

          <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-bone-white">Contact</h3>
            {contactName && (
              <div className="flex items-center gap-2 text-sm text-bone-white">
                <User className="h-4 w-4 text-muted-gray" />
                <button
                  onClick={() => navigate(`/crm/contacts/${deal.contact_id}`)}
                  className="hover:text-accent-yellow transition-colors"
                >
                  {contactName}
                </button>
              </div>
            )}
            {deal.contact_company && (
              <div className="flex items-center gap-2 text-sm text-muted-gray">
                <Building className="h-4 w-4" />
                <span>{deal.contact_company}</span>
              </div>
            )}
            {deal.contact_email && (
              <div className="flex items-center gap-2 text-sm text-muted-gray">
                <Mail className="h-4 w-4" />
                <button
                  onClick={() => openCompose({
                    defaultTo: deal.contact_email,
                    contactId: deal.contact_id,
                    defaultSubject: deal.title,
                    contactData: {
                      first_name: deal.contact_first_name,
                      last_name: deal.contact_last_name,
                      company: deal.contact_company,
                      email: deal.contact_email,
                      deal_name: deal.title,
                    },
                  })}
                  className="hover:text-accent-yellow transition-colors"
                >
                  {deal.contact_email}
                </button>
              </div>
            )}
            {deal.contact_phone && (
              <div className="flex items-center gap-2 text-sm text-muted-gray">
                <Phone className="h-4 w-4" />
                <span>{deal.contact_phone}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stage Change Dialog */}
      <Dialog open={showStageChange} onOpenChange={setShowStageChange}>
        <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-md">
          <DialogHeader>
            <DialogTitle>Move Deal Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-gray block mb-2">New Stage</label>
              <Select value={newStage} onValueChange={setNewStage}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray text-bone-white">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.filter((s) => s.value !== deal.stage).map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-gray block mb-2">Notes (optional)</label>
              <Textarea
                value={stageNotes}
                onChange={(e) => setStageNotes(e.target.value)}
                placeholder="Why is this deal moving?"
                className="bg-charcoal-black border-muted-gray text-bone-white"
                rows={2}
              />
            </div>
            {(newStage === 'closed_won' || newStage === 'closed_lost') && (
              <div>
                <label className="text-sm text-muted-gray block mb-2">Close Reason</label>
                <Input
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="Reason for closing"
                  className="bg-charcoal-black border-muted-gray text-bone-white"
                />
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowStageChange(false)}>Cancel</Button>
              <Button
                onClick={handleStageChange}
                disabled={!newStage || changeStage.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {changeStage.isPending ? 'Updating...' : 'Move Stage'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Deal Dialog */}
      <Dialog open={showEditDeal} onOpenChange={setShowEditDeal}>
        <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Deal</DialogTitle>
          </DialogHeader>
          <DealForm
            initialData={deal}
            onSubmit={handleUpdateDeal}
            isLoading={updateDeal.isPending}
            onCancel={() => setShowEditDeal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Log Activity Dialog */}
      <Dialog open={showLogActivity} onOpenChange={setShowLogActivity}>
        <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
          </DialogHeader>
          <ActivityForm
            onSubmit={handleLogActivity}
            isLoading={createActivity.isPending}
            onCancel={() => setShowLogActivity(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DealDetail;
