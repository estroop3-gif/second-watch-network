import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Clock, Ban, Trash2, Edit2, Save, Zap, Users } from 'lucide-react';
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
    setEditForm({
      name: campaign.name,
      description: campaign.description || '',
      subject_template: campaign.subject_template,
      html_template: campaign.html_template || '',
      text_template: campaign.text_template || '',
    });
    setEditSenderIds(senders.map((s: any) => s.account_id));
    setEditSenderMode(campaign.sender_mode || 'select');
    setEditing(true);
  };

  const saveEdit = () => {
    updateCampaign.mutate({ id: id!, data: { ...editForm, sender_mode: editSenderMode } }, {
      onSuccess: () => {
        // Also update senders (for single/select modes; rotate_all/rep_match clears them)
        const ids = (editSenderMode === 'rotate_all' || editSenderMode === 'rep_match') ? [] : editSenderIds;
        updateSenders.mutate({ id: id!, accountIds: ids });
        setEditing(false);
      },
    });
  };

  const toggleEditSender = (accountId: string) => {
    setEditSenderIds((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
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

              {/* Single account dropdown */}
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

              {/* Multi-select checkboxes */}
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

          {/* Preview Targeting */}
          {canEdit && targeting && (
            <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-accent-yellow" />
                <h2 className="text-lg font-medium text-bone-white">Targeting Preview</h2>
              </div>
              <p className="text-2xl font-bold text-accent-yellow mb-2">{targeting.total} contacts match</p>
              {targeting.sample?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-gray mb-2">Sample contacts:</p>
                  <div className="space-y-1">
                    {targeting.sample.map((c: any) => (
                      <div key={c.id} className="text-sm text-bone-white/70">
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
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Sent</th>
                      <th className="pb-2">Opened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.sends.map((send: any) => (
                      <tr key={send.id} className="border-b border-muted-gray/10">
                        <td className="py-2 pr-4 text-bone-white">
                          {send.contact_first_name} {send.contact_last_name}
                        </td>
                        <td className="py-2 pr-4 text-muted-gray">{send.contact_email}</td>
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
                    ))}
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
