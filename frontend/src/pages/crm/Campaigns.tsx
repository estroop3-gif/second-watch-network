import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import CampaignCard from '@/components/crm/CampaignCard';
import { useCampaigns, useCreateCampaign } from '@/hooks/crm/useCampaigns';
import { useEmailAccounts } from '@/hooks/crm/useEmail';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sending', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TEMPERATURE_OPTIONS = ['cold', 'warm', 'hot'];

const ROLE_OPTIONS = [
  { value: 'is_filmmaker', label: 'Filmmaker' },
  { value: 'is_partner', label: 'Partner' },
  { value: 'is_order_member', label: 'Order Member' },
  { value: 'is_premium', label: 'Premium' },
  { value: 'is_sales_agent', label: 'Sales Agent' },
  { value: 'is_sales_rep', label: 'Sales Rep' },
  { value: 'is_media_team', label: 'Media Team' },
  { value: 'is_admin', label: 'Admin' },
];

const TIER_OPTIONS = ['Free', 'Indie', 'Pro', 'Business', 'Enterprise'];

const INITIAL_FORM = {
  name: '',
  description: '',
  subject_template: '',
  html_template: '',
  text_template: '',
  send_type: 'manual',
  target_temperature: [] as string[],
  target_tags: [] as string[],
  sender_account_ids: [] as string[],
  sender_mode: 'rotate_all' as 'rotate_all' | 'single' | 'select' | 'rep_match',
  source_crm_contacts: true,
  source_manual_emails: false,
  source_site_users: false,
  manual_recipients: [] as { email: string; first_name: string; last_name: string; company: string }[],
  target_roles: [] as string[],
  target_subscription_tiers: [] as string[],
};

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

  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [tagInput, setTagInput] = useState('');
  const [manualInput, setManualInput] = useState('');

  const toggleSender = (accountId: string) => {
    setForm((prev) => ({
      ...prev,
      sender_account_ids: prev.sender_account_ids.includes(accountId)
        ? prev.sender_account_ids.filter((id) => id !== accountId)
        : [...prev.sender_account_ids, accountId],
    }));
  };

  const toggleTemp = (temp: string) => {
    setForm((prev) => ({
      ...prev,
      target_temperature: prev.target_temperature.includes(temp)
        ? prev.target_temperature.filter((t) => t !== temp)
        : [...prev.target_temperature, temp],
    }));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.target_tags.includes(tag)) {
      setForm((prev) => ({ ...prev, target_tags: [...prev.target_tags, tag] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm((prev) => ({ ...prev, target_tags: prev.target_tags.filter((t) => t !== tag) }));
  };

  const parseManualInput = (text: string) => {
    const lines = text.split('\n').filter((l) => l.trim());
    const parsed: typeof form.manual_recipients = [];
    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim());
      const email = parts[0] || '';
      if (!email || !email.includes('@')) continue;
      parsed.push({
        email,
        first_name: parts[1] || '',
        last_name: parts[2] || '',
        company: parts[3] || '',
      });
    }
    return parsed;
  };

  const parseManualRecipients = () => {
    const parsed = parseManualInput(manualInput);
    setForm((prev) => ({ ...prev, manual_recipients: parsed }));
  };

  const toggleRole = (role: string) => {
    setForm((prev) => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter((r) => r !== role)
        : [...prev.target_roles, role],
    }));
  };

  const toggleTier = (tier: string) => {
    setForm((prev) => ({
      ...prev,
      target_subscription_tiers: prev.target_subscription_tiers.includes(tier)
        ? prev.target_subscription_tiers.filter((t) => t !== tier)
        : [...prev.target_subscription_tiers, tier],
    }));
  };

  const handleCreate = () => {
    // Auto-parse manual input before submit so user doesn't have to click Parse
    const submitForm = { ...form };
    if (form.source_manual_emails && manualInput.trim()) {
      submitForm.manual_recipients = parseManualInput(manualInput);
    }
    createCampaign.mutate(submitForm, {
      onSuccess: (result) => {
        setShowCreate(false);
        setForm({ ...INITIAL_FORM });
        setTagInput('');
        setManualInput('');
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
        <DialogContent className="bg-charcoal-black border-muted-gray/30 text-bone-white max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>New Email Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
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

            {/* ===== Recipient Targeting ===== */}
            <div className="border border-muted-gray/20 rounded-lg p-4 space-y-4">
              <Label className="text-base font-medium block">Recipient Targeting</Label>

              {/* Source toggles */}
              <div className="space-y-2">
                <p className="text-xs text-muted-gray uppercase tracking-wide">Recipient Sources</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={form.source_crm_contacts}
                    onCheckedChange={(v) => setForm({ ...form, source_crm_contacts: !!v })}
                  />
                  <span className="text-sm text-bone-white">CRM Contacts</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={form.source_manual_emails}
                    onCheckedChange={(v) => setForm({ ...form, source_manual_emails: !!v })}
                  />
                  <span className="text-sm text-bone-white">Manual Emails</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={form.source_site_users}
                    onCheckedChange={(v) => setForm({ ...form, source_site_users: !!v })}
                  />
                  <span className="text-sm text-bone-white">Site Users</span>
                </label>
              </div>

              {/* CRM Contact filters */}
              {form.source_crm_contacts && (
                <div className="border-t border-muted-gray/20 pt-3 space-y-3">
                  <p className="text-xs text-muted-gray uppercase tracking-wide">CRM Contact Filters</p>
                  <div>
                    <Label className="text-xs">Temperature</Label>
                    <div className="flex gap-3 mt-1">
                      {TEMPERATURE_OPTIONS.map((temp) => (
                        <label key={temp} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={form.target_temperature.includes(temp)}
                            onCheckedChange={() => toggleTemp(temp)}
                          />
                          <span className="text-sm text-bone-white capitalize">{temp}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-gray mt-1">Leave empty to target all temperatures</p>
                  </div>
                  <div>
                    <Label className="text-xs">Tags</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                        className="bg-charcoal-black border-muted-gray/30 flex-1"
                        placeholder="Type a tag and press Enter"
                      />
                      <Button variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()}>Add</Button>
                    </div>
                    {form.target_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.target_tags.map((tag) => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted-gray/20 text-bone-white text-xs rounded-full">
                            {tag}
                            <button onClick={() => removeTag(tag)} className="hover:text-red-400"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manual email input */}
              {form.source_manual_emails && (
                <div className="border-t border-muted-gray/20 pt-3 space-y-2">
                  <p className="text-xs text-muted-gray uppercase tracking-wide">Manual Email Recipients</p>
                  <Textarea
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="bg-charcoal-black border-muted-gray/30 font-mono text-xs"
                    rows={4}
                    placeholder={"email, first name, last name, company\njohn@example.com, John, Doe, Acme Inc\njane@example.com, Jane, Smith,"}
                  />
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={parseManualRecipients}>
                      Parse ({manualInput.split('\n').filter((l) => l.trim()).length} lines)
                    </Button>
                    {form.manual_recipients.length > 0 && (
                      <span className="text-xs text-green-300">{form.manual_recipients.length} valid recipients parsed</span>
                    )}
                  </div>
                </div>
              )}

              {/* Site user filters */}
              {form.source_site_users && (
                <div className="border-t border-muted-gray/20 pt-3 space-y-3">
                  <p className="text-xs text-muted-gray uppercase tracking-wide">Site User Filters</p>
                  <div>
                    <Label className="text-xs">Roles</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {ROLE_OPTIONS.map((role) => (
                        <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={form.target_roles.includes(role.value)}
                            onCheckedChange={() => toggleRole(role.value)}
                          />
                          <span className="text-sm text-bone-white">{role.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-gray mt-1">Leave empty to target all users</p>
                  </div>
                  <div>
                    <Label className="text-xs">Subscription Tiers</Label>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {TIER_OPTIONS.map((tier) => (
                        <label key={tier} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={form.target_subscription_tiers.includes(tier)}
                            onCheckedChange={() => toggleTier(tier)}
                          />
                          <span className="text-sm text-bone-white">{tier}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sender Mode Selection */}
            {accounts.length > 0 && (
              <div>
                <Label className="mb-2 block">Sender Mode</Label>
                <RadioGroup
                  value={form.sender_mode}
                  onValueChange={(v) => {
                    setForm((prev) => ({
                      ...prev,
                      sender_mode: v as typeof prev.sender_mode,
                      sender_account_ids: (v === 'rotate_all' || v === 'rep_match') ? [] : prev.sender_account_ids,
                    }));
                  }}
                  className="space-y-3"
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <RadioGroupItem value="rotate_all" className="mt-0.5" />
                    <div className="text-sm">
                      <span className="text-bone-white">Rotate All Active Accounts</span>
                      <span className="text-muted-gray ml-1">({accounts.length} accounts)</span>
                      <p className="text-xs text-muted-gray mt-0.5">Distributes evenly across all active email accounts. New accounts added later are included automatically.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <RadioGroupItem value="single" className="mt-0.5" />
                    <div className="text-sm">
                      <span className="text-bone-white">Single Account</span>
                      <p className="text-xs text-muted-gray mt-0.5">Every email sent from one specific address.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <RadioGroupItem value="select" className="mt-0.5" />
                    <div className="text-sm">
                      <span className="text-bone-white">Select Specific Accounts</span>
                      <p className="text-xs text-muted-gray mt-0.5">Manually choose which accounts to rotate across.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <RadioGroupItem value="rep_match" className="mt-0.5" />
                    <div className="text-sm">
                      <span className="text-bone-white">Rep Match</span>
                      <p className="text-xs text-muted-gray mt-0.5">Each contact receives the email from their assigned rep's email account. Contacts without an assigned rep are skipped.</p>
                    </div>
                  </label>
                </RadioGroup>

                {/* Single account dropdown */}
                {form.sender_mode === 'single' && (
                  <div className="mt-3">
                    <Select
                      value={form.sender_account_ids[0] || ''}
                      onValueChange={(v) => setForm((prev) => ({ ...prev, sender_account_ids: [v] }))}
                    >
                      <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                        <SelectValue placeholder="Choose an account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acct: any) => (
                          <SelectItem key={acct.id} value={acct.id}>
                            {acct.display_name} — {acct.email_address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Multi-select checkboxes */}
                {form.sender_mode === 'select' && (
                  <div className="mt-3 space-y-2 max-h-40 overflow-y-auto border border-muted-gray/20 rounded-md p-3">
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
                )}
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
