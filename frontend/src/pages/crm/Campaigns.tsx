import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import CampaignCard from '@/components/crm/CampaignCard';
import { useCampaigns, useCreateCampaign } from '@/hooks/crm/useCampaigns';
import { useEmailAccounts } from '@/hooks/crm/useEmail';
import { useFormDraft } from '@/hooks/useFormDraft';
import { buildDraftKey } from '@/lib/formDraftStorage';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sending', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
  { value: 'cancelled', label: 'Cancelled' },
];

const Campaigns = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useCampaigns({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const createCampaign = useCreateCampaign();
  const { data: accountsData } = useEmailAccounts();
  const accounts = accountsData?.accounts?.filter((a: any) => a.is_active) || [];

  const campaignInitial = {
    name: '',
    description: '',
    subject_template: '',
    html_template: '',
    text_template: '',
    send_type: 'manual',
    target_temperature: [] as string[],
    target_tags: [] as string[],
    sender_account_ids: [] as string[],
  };

  const { formData: form, setFormData: setForm, clearDraft } = useFormDraft({
    key: buildDraftKey('crm', 'campaign', 'new'),
    initialData: campaignInitial,
  });

  const toggleSender = (accountId: string) => {
    setForm((prev) => ({
      ...prev,
      sender_account_ids: prev.sender_account_ids.includes(accountId)
        ? prev.sender_account_ids.filter((id) => id !== accountId)
        : [...prev.sender_account_ids, accountId],
    }));
  };

  const handleCreate = () => {
    createCampaign.mutate(form, {
      onSuccess: (result) => {
        clearDraft();
        setShowCreate(false);
        setForm({
          name: '', description: '', subject_template: '', html_template: '',
          text_template: '', send_type: 'manual', target_temperature: [], target_tags: [],
          sender_account_ids: [],
        });
        if (result?.id) navigate(`/crm/admin/campaigns/${result.id}`);
      },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading text-bone-white">Email Campaigns</h1>
        <Button onClick={() => setShowCreate(true)} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
          <Plus className="h-4 w-4 mr-2" /> New Campaign
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Filter className="h-4 w-4 text-muted-gray" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-charcoal-black border-muted-gray/30 text-bone-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-muted-gray">Loading campaigns...</div>
      ) : !data?.campaigns?.length ? (
        <div className="text-center py-12 text-muted-gray">
          <p className="text-lg mb-2">No campaigns yet</p>
          <p className="text-sm">Create your first email campaign to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.campaigns.map((c: any) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onClick={() => navigate(`/crm/admin/campaigns/${c.id}`)}
            />
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-charcoal-black border-muted-gray/30 text-bone-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Email Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-charcoal-black border-muted-gray/30"
                placeholder="Q1 Outreach"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-charcoal-black border-muted-gray/30"
                rows={2}
              />
            </div>
            <div>
              <Label>Subject Line Template</Label>
              <Input
                value={form.subject_template}
                onChange={(e) => setForm({ ...form, subject_template: e.target.value })}
                className="bg-charcoal-black border-muted-gray/30"
                placeholder="Hi {{first_name}}, check out..."
              />
            </div>
            <div>
              <Label>Email Body (HTML)</Label>
              <Textarea
                value={form.html_template}
                onChange={(e) => setForm({ ...form, html_template: e.target.value })}
                className="bg-charcoal-black border-muted-gray/30 font-mono text-xs"
                rows={6}
                placeholder="<h1>Hello {{first_name}}</h1>..."
              />
            </div>
            <div>
              <Label>Plain Text Version</Label>
              <Textarea
                value={form.text_template}
                onChange={(e) => setForm({ ...form, text_template: e.target.value })}
                className="bg-charcoal-black border-muted-gray/30"
                rows={3}
              />
            </div>
            <div>
              <Label>Send Type</Label>
              <Select value={form.send_type} onValueChange={(v) => setForm({ ...form, send_type: v })}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="drip">Drip</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sender Account Selection */}
            {accounts.length > 0 && (
              <div>
                <Label className="mb-2 block">Sender Accounts (for rotation)</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-muted-gray/20 rounded-md p-3">
                  {accounts.map((acct: any) => (
                    <label key={acct.id} className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={form.sender_account_ids.includes(acct.id)}
                        onCheckedChange={() => toggleSender(acct.id)}
                      />
                      <div className="text-sm">
                        <span className="text-bone-white">{acct.display_name}</span>
                        <span className="text-muted-gray ml-2">{acct.email_address}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-gray mt-1">
                  Select multiple accounts to distribute sends across senders.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!form.name || !form.subject_template || createCampaign.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Campaigns;
