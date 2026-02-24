import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Clock, Ban, Trash2, Edit2, Save, Zap, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CampaignStatusBadge from '@/components/crm/CampaignStatusBadge';
import {
  useCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useScheduleCampaign,
  useCancelCampaign,
  useSendCampaignNow,
  usePreviewTargeting,
  useUpdateCampaignSenders,
} from '@/hooks/crm/useCampaigns';
import { useEmailAccounts } from '@/hooks/crm/useEmail';
import { formatDate, formatDateTime } from '@/lib/dateUtils';

const SEND_STATUS_COLORS: Record<string, string> = {
  pending: 'text-muted-gray',
  sent: 'text-blue-300',
  delivered: 'text-green-300',
  opened: 'text-accent-yellow',
  clicked: 'text-accent-yellow',
  bounced: 'text-red-400',
  failed: 'text-red-400',
};

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  crm_contact: { label: 'CRM', cls: 'bg-blue-900/30 text-blue-300' },
  manual: { label: 'Manual', cls: 'bg-green-900/30 text-green-300' },
  site_user: { label: 'Site User', cls: 'bg-purple-900/30 text-purple-300' },
};

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

const ROLE_LABEL_MAP: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

const CampaignDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaign(id!);
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const scheduleCampaign = useScheduleCampaign();
  const cancelCampaign = useCancelCampaign();
  const sendNow = useSendCampaignNow();
  const { data: targeting } = usePreviewTargeting(id!);
  const updateSenders = useUpdateCampaignSenders();
  const { data: accountsData } = useEmailAccounts();
  const allAccounts = accountsData?.accounts?.filter((a: any) => a.is_active) || [];

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [editSenderIds, setEditSenderIds] = useState<string[]>([]);
  const [editSenderMode, setEditSenderMode] = useState<'rotate_all' | 'single' | 'select' | 'rep_match'>('select');
  const [editTagInput, setEditTagInput] = useState('');
  const [editManualInput, setEditManualInput] = useState('');

  if (isLoading) return <div className="text-muted-gray">Loading campaign...</div>;
  if (!campaign) return <div className="text-muted-gray">Campaign not found</div>;

  const canEdit = campaign.status === 'draft' || campaign.status === 'scheduled';
  const canSchedule = campaign.status === 'draft';
  const canSendNow = campaign.status === 'draft' || campaign.status === 'scheduled';
  const canCancel = campaign.status === 'draft' || campaign.status === 'scheduled';
  const canDelete = campaign.status === 'draft';
  const senders = campaign.senders || [];
  const hasSenders = campaign.sender_mode === 'rotate_all' || campaign.sender_mode === 'rep_match' || senders.length > 0;

  const startEdit = () => {
    const manualRecipients = campaign.manual_recipients || [];
    setEditForm({
      name: campaign.name,
      description: campaign.description || '',
      subject_template: campaign.subject_template,
      html_template: campaign.html_template || '',
      text_template: campaign.text_template || '',
      source_crm_contacts: campaign.source_crm_contacts ?? true,
      source_manual_emails: campaign.source_manual_emails ?? false,
      source_site_users: campaign.source_site_users ?? false,
      target_temperature: campaign.target_temperature || [],
      target_tags: campaign.target_tags || [],
      manual_recipients: Array.isArray(manualRecipients) ? manualRecipients : [],
      target_roles: campaign.target_roles || [],
      target_subscription_tiers: campaign.target_subscription_tiers || [],
    });
    setEditSenderIds(senders.map((s: any) => s.account_id));
    setEditSenderMode(campaign.sender_mode || 'select');
    setEditTagInput('');
    // Reconstruct manual input from existing recipients
    const recipients = Array.isArray(manualRecipients) ? manualRecipients : [];
    setEditManualInput(
      recipients.map((r: any) => [r.email, r.first_name, r.last_name, r.company].filter(Boolean).join(', ')).join('\n')
    );
    setEditing(true);
  };

  const saveEdit = () => {
    const { target_temperature, target_tags, manual_recipients, target_roles, target_subscription_tiers, ...rest } = editForm;
    // Auto-parse manual input before save so user doesn't have to click Parse
    const finalManualRecipients = (editForm.source_manual_emails && editManualInput.trim())
      ? parseManualText(editManualInput)
      : manual_recipients;
    updateCampaign.mutate({
      id: id!,
      data: {
        ...rest,
        sender_mode: editSenderMode,
        target_temperature,
        target_tags,
        manual_recipients: finalManualRecipients,
        target_roles,
        target_subscription_tiers,
      },
    }, {
      onSuccess: () => {
        const ids = (editSenderMode === 'rotate_all' || editSenderMode === 'rep_match') ? [] : editSenderIds;
        updateSenders.mutate({ id: id!, accountIds: ids });
        setEditing(false);
      },
    });
  };

  const toggleEditSender = (accountId: string) => {
    setEditSenderIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  };

  const editToggleTemp = (temp: string) => {
    setEditForm((prev: any) => ({
      ...prev,
      target_temperature: prev.target_temperature.includes(temp)
        ? prev.target_temperature.filter((t: string) => t !== temp)
        : [...prev.target_temperature, temp],
    }));
  };

  const editAddTag = () => {
    const tag = editTagInput.trim();
    if (tag && !editForm.target_tags.includes(tag)) {
      setEditForm((prev: any) => ({ ...prev, target_tags: [...prev.target_tags, tag] }));
    }
    setEditTagInput('');
  };

  const editRemoveTag = (tag: string) => {
    setEditForm((prev: any) => ({ ...prev, target_tags: prev.target_tags.filter((t: string) => t !== tag) }));
  };

  const parseManualText = (text: string) => {
    const lines = text.split('\n').filter((l) => l.trim());
    const parsed: any[] = [];
    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim());
      const email = parts[0] || '';
      if (!email || !email.includes('@')) continue;
      parsed.push({ email, first_name: parts[1] || '', last_name: parts[2] || '', company: parts[3] || '' });
    }
    return parsed;
  };

  const editParseManual = () => {
    const parsed = parseManualText(editManualInput);
    setEditForm((prev: any) => ({ ...prev, manual_recipients: parsed }));
  };

  const editToggleRole = (role: string) => {
    setEditForm((prev: any) => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter((r: string) => r !== role)
        : [...prev.target_roles, role],
    }));
  };

  const editToggleTier = (tier: string) => {
    setEditForm((prev: any) => ({
      ...prev,
      target_subscription_tiers: prev.target_subscription_tiers.includes(tier)
        ? prev.target_subscription_tiers.filter((t: string) => t !== tier)
        : [...prev.target_subscription_tiers, tier],
    }));
  };

  const handleSchedule = () => {
    if (confirm('Schedule this campaign for sending?')) {
      scheduleCampaign.mutate(id!);
    }
  };

  const handleSendNow = () => {
    if (!hasSenders) {
      alert('Please assign sender accounts before sending.');
      return;
    }
    if (confirm('Start sending this campaign immediately? Emails will be sent in batches.')) {
      sendNow.mutate(id!);
    }
  };

  const handleCancel = () => {
    if (confirm('Cancel this campaign?')) {
      cancelCampaign.mutate(id!);
    }
  };

  const handleDelete = () => {
    if (confirm('Delete this campaign? This cannot be undone.')) {
      deleteCampaign.mutate(id!, { onSuccess: () => navigate('/crm/admin/campaigns') });
    }
  };

  // Active sources for read-only display
  const activeSources: string[] = [];
  if (campaign.source_crm_contacts ?? true) activeSources.push('CRM Contacts');
  if (campaign.source_manual_emails) activeSources.push('Manual Emails');
  if (campaign.source_site_users) activeSources.push('Site Users');

  return (
    <div>
      <button onClick={() => navigate('/crm/admin/campaigns')} className="flex items-center gap-2 text-muted-gray hover:text-bone-white mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Campaigns
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading text-bone-white">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          {campaign.description && (
            <p className="text-muted-gray mt-1">{campaign.description}</p>
          )}
          <p className="text-xs text-muted-gray mt-2">
            Created {formatDate(campaign.created_at)}
            {campaign.created_by_name && ` by ${campaign.created_by_name}`}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && !editing && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Edit2 className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          {canSendNow && (
            <Button
              size="sm"
              onClick={handleSendNow}
              disabled={sendNow.isPending || !hasSenders}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Zap className="h-4 w-4 mr-1" /> {sendNow.isPending ? 'Starting...' : 'Send Now'}
            </Button>
          )}
          {canSchedule && (
            <Button size="sm" onClick={handleSchedule} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Clock className="h-4 w-4 mr-1" /> Schedule
            </Button>
          )}
          {canCancel && campaign.status === 'scheduled' && (
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <Ban className="h-4 w-4 mr-1" /> Cancel
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-400 border-red-400/30 hover:bg-red-900/20">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
        </div>
      </div>

      {editing && editForm ? (
        <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-6 mb-6 space-y-4">
          <div>
            <Label>Campaign Name</Label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="bg-charcoal-black border-muted-gray/30"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="bg-charcoal-black border-muted-gray/30"
              rows={2}
            />
          </div>
          <div>
            <Label>Subject Template</Label>
            <Input
              value={editForm.subject_template}
              onChange={(e) => setEditForm({ ...editForm, subject_template: e.target.value })}
              className="bg-charcoal-black border-muted-gray/30"
            />
          </div>
          <div>
            <Label>HTML Template</Label>
            <Textarea
              value={editForm.html_template}
              onChange={(e) => setEditForm({ ...editForm, html_template: e.target.value })}
              className="bg-charcoal-black border-muted-gray/30 font-mono text-xs"
              rows={8}
            />
          </div>
          <div>
            <Label>Plain Text</Label>
            <Textarea
              value={editForm.text_template}
              onChange={(e) => setEditForm({ ...editForm, text_template: e.target.value })}
              className="bg-charcoal-black border-muted-gray/30"
              rows={4}
            />
          </div>

          {/* ===== Recipient Targeting (Edit) ===== */}
          <div className="border border-muted-gray/20 rounded-lg p-4 space-y-4">
            <Label className="text-base font-medium block">Recipient Targeting</Label>

            <div className="space-y-2">
              <p className="text-xs text-muted-gray uppercase tracking-wide">Recipient Sources</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={editForm.source_crm_contacts}
                  onCheckedChange={(v) => setEditForm({ ...editForm, source_crm_contacts: !!v })}
                />
                <span className="text-sm text-bone-white">CRM Contacts</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={editForm.source_manual_emails}
                  onCheckedChange={(v) => setEditForm({ ...editForm, source_manual_emails: !!v })}
                />
                <span className="text-sm text-bone-white">Manual Emails</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={editForm.source_site_users}
                  onCheckedChange={(v) => setEditForm({ ...editForm, source_site_users: !!v })}
                />
                <span className="text-sm text-bone-white">Site Users</span>
              </label>
            </div>

            {editForm.source_crm_contacts && (
              <div className="border-t border-muted-gray/20 pt-3 space-y-3">
                <p className="text-xs text-muted-gray uppercase tracking-wide">CRM Contact Filters</p>
                <div>
                  <Label className="text-xs">Temperature</Label>
                  <div className="flex gap-3 mt-1">
                    {TEMPERATURE_OPTIONS.map((temp) => (
                      <label key={temp} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={editForm.target_temperature.includes(temp)}
                          onCheckedChange={() => editToggleTemp(temp)}
                        />
                        <span className="text-sm text-bone-white capitalize">{temp}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Tags</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={editTagInput}
                      onChange={(e) => setEditTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editAddTag(); } }}
                      className="bg-charcoal-black border-muted-gray/30 flex-1"
                      placeholder="Type a tag and press Enter"
                    />
                    <Button variant="outline" size="sm" onClick={editAddTag} disabled={!editTagInput.trim()}>Add</Button>
                  </div>
                  {editForm.target_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {editForm.target_tags.map((tag: string) => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted-gray/20 text-bone-white text-xs rounded-full">
                          {tag}
                          <button onClick={() => editRemoveTag(tag)} className="hover:text-red-400"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {editForm.source_manual_emails && (
              <div className="border-t border-muted-gray/20 pt-3 space-y-2">
                <p className="text-xs text-muted-gray uppercase tracking-wide">Manual Email Recipients</p>
                <Textarea
                  value={editManualInput}
                  onChange={(e) => setEditManualInput(e.target.value)}
                  className="bg-charcoal-black border-muted-gray/30 font-mono text-xs"
                  rows={4}
                  placeholder={"email, first name, last name, company\njohn@example.com, John, Doe, Acme Inc"}
                />
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={editParseManual}>
                    Parse ({editManualInput.split('\n').filter((l) => l.trim()).length} lines)
                  </Button>
                  {editForm.manual_recipients.length > 0 && (
                    <span className="text-xs text-green-300">{editForm.manual_recipients.length} valid recipients parsed</span>
                  )}
                </div>
              </div>
            )}

            {editForm.source_site_users && (
              <div className="border-t border-muted-gray/20 pt-3 space-y-3">
                <p className="text-xs text-muted-gray uppercase tracking-wide">Site User Filters</p>
                <div>
                  <Label className="text-xs">Roles</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {ROLE_OPTIONS.map((role) => (
                      <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={editForm.target_roles.includes(role.value)}
                          onCheckedChange={() => editToggleRole(role.value)}
                        />
                        <span className="text-sm text-bone-white">{role.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Subscription Tiers</Label>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {TIER_OPTIONS.map((tier) => (
                      <label key={tier} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={editForm.target_subscription_tiers.includes(tier)}
                          onCheckedChange={() => editToggleTier(tier)}
                        />
                        <span className="text-sm text-bone-white">{tier}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sender mode selection in edit mode */}
          {allAccounts.length > 0 && (
            <div>
              <Label className="mb-2 block">Sender Mode</Label>
              <RadioGroup
                value={editSenderMode}
                onValueChange={(v) => {
                  const mode = v as typeof editSenderMode;
                  setEditSenderMode(mode);
                  if (mode === 'rotate_all' || mode === 'rep_match') setEditSenderIds([]);
                }}
                className="space-y-3"
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <RadioGroupItem value="rotate_all" className="mt-0.5" />
                  <div className="text-sm">
                    <span className="text-bone-white">Rotate All Active Accounts</span>
                    <span className="text-muted-gray ml-1">({allAccounts.length} accounts)</span>
                    <p className="text-xs text-muted-gray mt-0.5">Distributes evenly across all active email accounts.</p>
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

              {editSenderMode === 'single' && (
                <div className="mt-3">
                  <Select
                    value={editSenderIds[0] || ''}
                    onValueChange={(v) => setEditSenderIds([v])}
                  >
                    <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                      <SelectValue placeholder="Choose an account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allAccounts.map((acct: any) => (
                        <SelectItem key={acct.id} value={acct.id}>
                          {acct.display_name} — {acct.email_address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editSenderMode === 'select' && (
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto border border-muted-gray/20 rounded-md p-3">
                  {allAccounts.map((acct: any) => (
                    <label key={acct.id} className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={editSenderIds.includes(acct.id)}
                        onCheckedChange={() => toggleEditSender(acct.id)}
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

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateCampaign.isPending} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
              <Save className="h-4 w-4 mr-1" /> {updateCampaign.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          {campaign.total_sent > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              {[
                { label: 'Sent', value: campaign.total_sent, color: 'text-bone-white' },
                { label: 'Delivered', value: campaign.total_delivered, color: 'text-green-300' },
                { label: 'Opened', value: campaign.total_opened, color: 'text-blue-300' },
                { label: 'Clicked', value: campaign.total_clicked, color: 'text-accent-yellow' },
                { label: 'Bounced', value: campaign.total_bounced, color: 'text-red-400' },
                { label: 'Unsubscribed', value: campaign.total_unsubscribed, color: 'text-red-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 text-center">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-gray mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Sender Accounts */}
          <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-bone-white mb-3">Sender Accounts</h2>
            <div className="text-sm text-muted-gray mb-3">
              Mode:{' '}
              <span className="text-bone-white">
                {campaign.sender_mode === 'rotate_all'
                  ? 'Rotate All Active Accounts'
                  : campaign.sender_mode === 'single'
                    ? `Single Account${senders[0] ? `: ${senders[0].email_address}` : ''}`
                    : campaign.sender_mode === 'rep_match'
                      ? "Rep Match (each contact's assigned rep)"
                      : `${senders.length} Selected Account${senders.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            {senders.length > 0 && (
              <div className="space-y-2">
                {senders.map((sender: any) => (
                  <div key={sender.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-bone-white">{sender.display_name}</span>
                      <span className="text-muted-gray">{sender.email_address}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        sender.is_active ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                      }`}>
                        {sender.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <span className="text-muted-gray">{sender.send_count} sent</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview Targeting — Multi-source */}
          {canEdit && targeting && (
            <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-accent-yellow" />
                <h2 className="text-lg font-medium text-bone-white">Targeting Preview</h2>
              </div>
              <p className="text-2xl font-bold text-accent-yellow mb-4">{targeting.total} total unique recipients</p>

              {/* Per-source breakdown */}
              {targeting.sources && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {targeting.sources.crm_contacts && (
                    <div className="border border-blue-500/20 rounded-lg p-3">
                      <div className="text-xs text-blue-300 uppercase tracking-wide mb-1">CRM Contacts</div>
                      <div className="text-lg font-bold text-bone-white">{targeting.sources.crm_contacts.count}</div>
                    </div>
                  )}
                  {targeting.sources.manual_emails && (
                    <div className="border border-green-500/20 rounded-lg p-3">
                      <div className="text-xs text-green-300 uppercase tracking-wide mb-1">Manual Emails</div>
                      <div className="text-lg font-bold text-bone-white">{targeting.sources.manual_emails.count}</div>
                    </div>
                  )}
                  {targeting.sources.site_users && (
                    <div className="border border-purple-500/20 rounded-lg p-3">
                      <div className="text-xs text-purple-300 uppercase tracking-wide mb-1">Site Users</div>
                      <div className="text-lg font-bold text-bone-white">{targeting.sources.site_users.count}</div>
                    </div>
                  )}
                </div>
              )}

              {targeting.sample?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-gray mb-2">Sample recipients:</p>
                  <div className="space-y-1">
                    {targeting.sample.map((c: any, i: number) => (
                      <div key={c.id || c.email || i} className="text-sm text-bone-white/70">
                        {c.first_name} {c.last_name} — {c.email}
                        {c.company && <span className="text-muted-gray"> ({c.company})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Email content preview */}
          <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-bone-white mb-4">Email Template</h2>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-muted-gray uppercase">Subject</span>
                <p className="text-bone-white">{campaign.subject_template}</p>
              </div>
              {campaign.html_template && (
                <div>
                  <span className="text-xs text-muted-gray uppercase">HTML Body</span>
                  <pre className="text-bone-white/70 text-sm bg-muted-gray/10 p-3 rounded mt-1 overflow-x-auto max-h-48">
                    {campaign.html_template}
                  </pre>
                </div>
              )}
              {campaign.text_template && (
                <div>
                  <span className="text-xs text-muted-gray uppercase">Plain Text</span>
                  <pre className="text-bone-white/70 text-sm bg-muted-gray/10 p-3 rounded mt-1 overflow-x-auto max-h-32">
                    {campaign.text_template}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Targeting info */}
          <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-bone-white mb-3">Targeting</h2>
            <div className="flex gap-6 text-sm flex-wrap">
              <div>
                <span className="text-muted-gray">Sources:</span>{' '}
                <span className="text-bone-white">{activeSources.join(', ') || 'None'}</span>
              </div>
              <div>
                <span className="text-muted-gray">Send Type:</span>{' '}
                <span className="text-bone-white capitalize">{campaign.send_type}</span>
              </div>
              {campaign.target_temperature?.length > 0 && (
                <div>
                  <span className="text-muted-gray">Temperature:</span>{' '}
                  <span className="text-bone-white capitalize">{campaign.target_temperature.join(', ')}</span>
                </div>
              )}
              {campaign.target_tags?.length > 0 && (
                <div>
                  <span className="text-muted-gray">Tags:</span>{' '}
                  <span className="text-bone-white">{campaign.target_tags.join(', ')}</span>
                </div>
              )}
              {campaign.target_roles?.length > 0 && (
                <div>
                  <span className="text-muted-gray">Roles:</span>{' '}
                  <span className="text-bone-white">{campaign.target_roles.map((r: string) => ROLE_LABEL_MAP[r] || r).join(', ')}</span>
                </div>
              )}
              {campaign.target_subscription_tiers?.length > 0 && (
                <div>
                  <span className="text-muted-gray">Tiers:</span>{' '}
                  <span className="text-bone-white">{campaign.target_subscription_tiers.join(', ')}</span>
                </div>
              )}
              {campaign.source_manual_emails && (
                <div>
                  <span className="text-muted-gray">Manual Recipients:</span>{' '}
                  <span className="text-bone-white">{(campaign.manual_recipients || []).length}</span>
                </div>
              )}
              {campaign.scheduled_at && (
                <div>
                  <span className="text-muted-gray">Scheduled:</span>{' '}
                  <span className="text-bone-white">{formatDateTime(campaign.scheduled_at)}</span>
                </div>
              )}
              {campaign.drip_delay_days && (
                <div>
                  <span className="text-muted-gray">Drip Delay:</span>{' '}
                  <span className="text-bone-white">{campaign.drip_delay_days} days</span>
                </div>
              )}
              <div>
                <span className="text-muted-gray">Batch Size:</span>{' '}
                <span className="text-bone-white">{campaign.batch_size || 10}</span>
              </div>
              <div>
                <span className="text-muted-gray">Send Delay:</span>{' '}
                <span className="text-bone-white">{campaign.send_delay_seconds || 5}s</span>
              </div>
            </div>
          </div>

          {/* Send results */}
          {campaign.sends?.length > 0 && (
            <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-6">
              <h2 className="text-lg font-medium text-bone-white mb-4">Send Results ({campaign.sends.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-muted-gray/30 text-muted-gray text-left">
                      <th className="pb-2 pr-4">Contact</th>
                      <th className="pb-2 pr-4">Email</th>
                      <th className="pb-2 pr-4">Source</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Sent</th>
                      <th className="pb-2">Opened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.sends.map((send: any) => {
                      const src = SOURCE_BADGE[send.recipient_source] || SOURCE_BADGE.crm_contact;
                      return (
                        <tr key={send.id} className="border-b border-muted-gray/10">
                          <td className="py-2 pr-4 text-bone-white">
                            {send.contact_first_name} {send.contact_last_name}
                          </td>
                          <td className="py-2 pr-4 text-muted-gray">{send.contact_email}</td>
                          <td className="py-2 pr-4">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${src.cls}`}>
                              {src.label}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <span className={`capitalize ${SEND_STATUS_COLORS[send.status] || 'text-muted-gray'}`}>
                              {send.status}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-muted-gray">
                            {send.sent_at ? formatDateTime(send.sent_at) : '-'}
                          </td>
                          <td className="py-2 text-muted-gray">
                            {send.opened_at ? formatDateTime(send.opened_at) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CampaignDetail;
