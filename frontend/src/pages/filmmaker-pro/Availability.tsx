/**
 * Advanced Availability Calendar — Rich calendar UI with
 * color-coded entries, rate info, and share link.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Share2, Copy, Link } from 'lucide-react';
import {
  useProAvailability,
  useCreateProAvailability,
  useUpdateProAvailability,
  useDeleteProAvailability,
  useCalendarShare,
  useRegenerateCalendarShare,
} from '@/hooks/useFilmmakerPro';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import ProUpgradePrompt from '@/components/filmmaker-pro/ProUpgradePrompt';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-600',
  booked: 'bg-red-600',
  tentative: 'bg-yellow-600',
  unavailable: 'bg-muted-gray',
};

const Availability = () => {
  const { profile } = useEnrichedProfile();
  const { data, isLoading } = useProAvailability();
  const createMutation = useCreateProAvailability();
  const updateMutation = useUpdateProAvailability();
  const deleteMutation = useDeleteProAvailability();
  const { data: shareData } = useCalendarShare();
  const regenerateMutation = useRegenerateCalendarShare();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showShare, setShowShare] = useState(false);
  const [form, setForm] = useState({
    start_date: '',
    end_date: '',
    status: 'available',
    title: '',
    color: '',
    rate_cents: '',
    rate_type: '',
    is_public: true,
    notes: '',
  });

  if (!profile?.is_filmmaker_pro) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-heading text-bone-white mb-6">Availability</h1>
        <ProUpgradePrompt feature="Advanced Availability Calendar" />
      </div>
    );
  }

  const entries = data?.entries || [];

  const openAdd = () => {
    setEditing(null);
    setForm({ start_date: '', end_date: '', status: 'available', title: '', color: '', rate_cents: '', rate_type: '', is_public: true, notes: '' });
    setIsOpen(true);
  };

  const openEdit = (entry: any) => {
    setEditing(entry);
    setForm({
      start_date: entry.start_date?.split('T')[0] || '',
      end_date: entry.end_date?.split('T')[0] || '',
      status: entry.status || 'available',
      title: entry.title || '',
      color: entry.color || '',
      rate_cents: entry.rate_cents ? String(entry.rate_cents / 100) : '',
      rate_type: entry.rate_type || '',
      is_public: entry.is_public ?? true,
      notes: entry.notes || '',
    });
    setIsOpen(true);
  };

  const handleSave = async () => {
    const payload: any = {
      ...form,
      rate_cents: form.rate_cents ? Math.round(Number(form.rate_cents) * 100) : null,
      rate_type: form.rate_type || null,
      color: form.color || null,
      title: form.title || null,
      notes: form.notes || null,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
        toast({ title: 'Entry updated' });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: 'Entry created' });
      }
      setIsOpen(false);
    } catch {
      toast({ title: 'Error saving', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Entry deleted' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const copyShareLink = () => {
    if (shareData?.share_url) {
      navigator.clipboard.writeText(shareData.share_url);
      toast({ title: 'Share link copied' });
    }
  };

  // Group entries by month for display
  const grouped = entries.reduce((acc: Record<string, any[]>, entry: any) => {
    const month = new Date(entry.start_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[month]) acc[month] = [];
    acc[month].push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-bone-white">Availability</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="text-bone-white" onClick={() => setShowShare(true)}>
            <Share2 className="h-4 w-4 mr-2" />Share
          </Button>
          <Button className="bg-amber-500 hover:bg-amber-600 text-charcoal-black" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />Add Entry
          </Button>
        </div>
      </div>

      {/* Calendar Entries */}
      {isLoading ? (
        <p className="text-muted-gray text-center py-12">Loading...</p>
      ) : entries.length === 0 ? (
        <Card className="bg-charcoal-black border-muted-gray">
          <CardContent className="p-8 text-center">
            <p className="text-muted-gray mb-4">No availability entries yet.</p>
            <Button variant="outline" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Entry</Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([month, monthEntries]) => (
          <div key={month}>
            <h3 className="text-lg font-medium text-bone-white mb-3">{month}</h3>
            <div className="space-y-2">
              {(monthEntries as any[]).map((entry: any) => (
                <Card key={entry.id} className="bg-charcoal-black border-muted-gray">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${STATUS_COLORS[entry.status] || 'bg-muted-gray'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-bone-white">
                          {entry.title || entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                        </p>
                        <Badge variant="outline" className="text-xs">{entry.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-gray">
                        {new Date(entry.start_date).toLocaleDateString()} — {new Date(entry.end_date).toLocaleDateString()}
                        {entry.rate_cents && <span> &middot; ${(entry.rate_cents / 100).toFixed(0)}/{entry.rate_type || 'day'}</span>}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}><Pencil className="h-4 w-4 text-muted-gray" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-charcoal-black border-muted-gray">
          <DialogHeader>
            <DialogTitle className="text-bone-white">{editing ? 'Edit Entry' : 'Add Availability'}</DialogTitle>
            <DialogDescription className="text-muted-gray">Set your availability for a date range.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-bone-white">Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Available for 2nd AC work"
                className="bg-muted-gray/20 border-muted-gray text-bone-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-bone-white">Start Date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="bg-muted-gray/20 border-muted-gray text-bone-white" />
              </div>
              <div>
                <Label className="text-bone-white">End Date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="bg-muted-gray/20 border-muted-gray text-bone-white" />
              </div>
            </div>
            <div>
              <Label className="text-bone-white">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-muted-gray/20 border-muted-gray text-bone-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="tentative">Tentative</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-bone-white">Rate ($)</Label>
                <Input type="number" value={form.rate_cents} onChange={(e) => setForm({ ...form, rate_cents: e.target.value })}
                  placeholder="500" className="bg-muted-gray/20 border-muted-gray text-bone-white" />
              </div>
              <div>
                <Label className="text-bone-white">Rate Type</Label>
                <Select value={form.rate_type} onValueChange={(v) => setForm({ ...form, rate_type: v })}>
                  <SelectTrigger className="bg-muted-gray/20 border-muted-gray text-bone-white"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Per Day</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-bone-white">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="bg-muted-gray/20 border-muted-gray text-bone-white" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_public} onCheckedChange={(v) => setForm({ ...form, is_public: v })} />
              <Label className="text-bone-white">Visible on shared calendar</Label>
            </div>
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-charcoal-black" onClick={handleSave}
              disabled={!form.start_date || !form.end_date}>
              {editing ? 'Update' : 'Add'} Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="bg-charcoal-black border-muted-gray">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Share Calendar</DialogTitle>
            <DialogDescription className="text-muted-gray">Share your availability calendar with clients and collaborators.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {shareData?.share_url ? (
              <>
                <div className="flex gap-2">
                  <Input value={shareData.share_url} readOnly className="bg-muted-gray/20 border-muted-gray text-bone-white" />
                  <Button variant="outline" onClick={copyShareLink}><Copy className="h-4 w-4" /></Button>
                </div>
                <Button variant="outline" className="w-full text-muted-gray" onClick={() => regenerateMutation.mutate()}>
                  <Link className="h-4 w-4 mr-2" />Regenerate Link
                </Button>
              </>
            ) : (
              <p className="text-muted-gray">Loading share link...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Availability;
