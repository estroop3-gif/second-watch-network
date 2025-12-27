import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PartnerApplication } from '@/types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ViewApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: PartnerApplication;
  onUpdated?: () => void;
}

const ViewPartnerApplicationModal = ({ isOpen, onClose, application, onUpdated }: ViewApplicationModalProps) => {
  const [status, setStatus] = useState<PartnerApplication['status']>(application.status);
  const [adminNotes, setAdminNotes] = useState<string>(application.admin_notes || '');
  const [saving, setSaving] = useState(false);

  if (!application) return null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.updatePartnerApplicationStatus(application.id, status, adminNotes);
      toast.success('Application updated.');
      onUpdated?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update application.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-charcoal-black text-bone-white border-muted-gray">
        <DialogHeader>
          <DialogTitle className="text-2xl text-accent-yellow">Partner Application</DialogTitle>
          <DialogDescription>
            Full details for {application.company_name || application.brand_name || '—'}.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name" value={application.full_name || application.contact_name || '—'} />
            <Field label="Email" value={application.contact_email || '—'} />
            <Field label="Company" value={application.company_name || application.brand_name || '—'} />
            <Field label="Phone" value={application.phone || '—'} />
            <Field label="Website" value={application.website_url || application.website || '—'} isLink />
            <Field label="Location" value={application.location || '—'} />
            <Field label="Audience Size" value={application.audience_size || '—'} />
            <Field label="Content Focus" value={application.content_focus || '—'} />
          </div>
          <Field label="Primary Platforms" value={(application.primary_platforms || []).join(', ') || '—'} />
          <div>
            <Label className="text-sm text-muted-foreground">Sample Links</Label>
            <pre className="mt-1 p-3 bg-gray-800/40 rounded-md whitespace-pre-wrap break-words text-sm">
{application.sample_links || '—'}
            </pre>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Message</Label>
            <p className="mt-1 p-3 bg-gray-800/40 rounded-md whitespace-pre-wrap break-words text-sm">{application.message || '—'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <Label className="text-sm">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PartnerApplication['status'])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Admin Notes</Label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="mt-1 h-24" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={save} disabled={saving} className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, value, isLink = false }: { label: string; value: string; isLink?: boolean }) => (
  <div>
    <Label className="text-sm text-muted-foreground">{label}</Label>
    {isLink && value && value !== '—' ? (
      <a href={value} target="_blank" rel="noreferrer" className="block mt-1 text-accent-yellow hover:underline break-all">{value}</a>
    ) : (
      <p className="mt-1">{value || '—'}</p>
    )}
  </div>
);

export default ViewPartnerApplicationModal;