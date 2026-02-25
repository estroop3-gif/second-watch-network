/**
 * Rate Card Editor — Manage rate cards for different production roles.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import {
  useRateCards,
  useCreateRateCard,
  useUpdateRateCard,
  useDeleteRateCard,
} from '@/hooks/useFilmmakerPro';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import ProUpgradePrompt from '@/components/filmmaker-pro/ProUpgradePrompt';
import { useToast } from '@/hooks/use-toast';

const formatCents = (cents: number | null) => cents ? `$${(cents / 100).toFixed(0)}` : '—';

const RateCard = () => {
  const { profile } = useEnrichedProfile();
  const { data, isLoading } = useRateCards();
  const createMutation = useCreateRateCard();
  const updateMutation = useUpdateRateCard();
  const deleteMutation = useDeleteRateCard();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    role_name: '',
    day_rate_cents: '',
    half_day_rate_cents: '',
    weekly_rate_cents: '',
    hourly_rate_cents: '',
    notes: '',
    is_public: true,
  });

  if (!profile?.is_filmmaker_pro) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-heading text-bone-white mb-6">Rate Card</h1>
        <ProUpgradePrompt feature="Rate Card" />
      </div>
    );
  }

  const cards = data?.rate_cards || [];

  const openAdd = () => {
    setEditing(null);
    setForm({ role_name: '', day_rate_cents: '', half_day_rate_cents: '', weekly_rate_cents: '', hourly_rate_cents: '', notes: '', is_public: true });
    setIsOpen(true);
  };

  const openEdit = (card: any) => {
    setEditing(card);
    setForm({
      role_name: card.role_name || '',
      day_rate_cents: card.day_rate_cents ? String(card.day_rate_cents / 100) : '',
      half_day_rate_cents: card.half_day_rate_cents ? String(card.half_day_rate_cents / 100) : '',
      weekly_rate_cents: card.weekly_rate_cents ? String(card.weekly_rate_cents / 100) : '',
      hourly_rate_cents: card.hourly_rate_cents ? String(card.hourly_rate_cents / 100) : '',
      notes: card.notes || '',
      is_public: card.is_public ?? true,
    });
    setIsOpen(true);
  };

  const handleSave = async () => {
    const payload: any = {
      role_name: form.role_name,
      is_public: form.is_public,
      notes: form.notes || null,
      day_rate_cents: form.day_rate_cents ? Math.round(Number(form.day_rate_cents) * 100) : null,
      half_day_rate_cents: form.half_day_rate_cents ? Math.round(Number(form.half_day_rate_cents) * 100) : null,
      weekly_rate_cents: form.weekly_rate_cents ? Math.round(Number(form.weekly_rate_cents) * 100) : null,
      hourly_rate_cents: form.hourly_rate_cents ? Math.round(Number(form.hourly_rate_cents) * 100) : null,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
        toast({ title: 'Rate card updated' });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: 'Rate card created' });
      }
      setIsOpen(false);
    } catch {
      toast({ title: 'Error saving rate card', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Rate card deleted' });
    } catch {
      toast({ title: 'Error deleting rate card', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-bone-white">Rate Card</h1>
        <Button className="bg-amber-500 hover:bg-amber-600 text-charcoal-black" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />Add Rate
        </Button>
      </div>

      <p className="text-muted-gray text-sm">
        Set your rates for different production roles. Public rates will appear on your profile and portfolio.
      </p>

      {isLoading ? (
        <p className="text-muted-gray text-center py-12">Loading...</p>
      ) : cards.length === 0 ? (
        <Card className="bg-charcoal-black border-muted-gray">
          <CardContent className="p-8 text-center">
            <p className="text-muted-gray mb-4">No rate cards yet. Add your first role and rates.</p>
            <Button variant="outline" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />Add Rate Card
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cards.map((card: any) => (
            <Card key={card.id} className="bg-charcoal-black border-muted-gray">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <GripVertical className="h-5 w-5 text-muted-gray mt-1 cursor-grab shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-medium text-bone-white">{card.role_name}</h3>
                      {!card.is_public && <span className="text-xs text-muted-gray bg-muted-gray/20 px-2 py-0.5 rounded">Private</span>}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      {card.day_rate_cents && <span className="text-bone-white">Day: <strong>{formatCents(card.day_rate_cents)}</strong></span>}
                      {card.half_day_rate_cents && <span className="text-bone-white">Half Day: <strong>{formatCents(card.half_day_rate_cents)}</strong></span>}
                      {card.weekly_rate_cents && <span className="text-bone-white">Weekly: <strong>{formatCents(card.weekly_rate_cents)}</strong></span>}
                      {card.hourly_rate_cents && <span className="text-bone-white">Hourly: <strong>{formatCents(card.hourly_rate_cents)}</strong></span>}
                    </div>
                    {card.notes && <p className="text-xs text-muted-gray mt-1">{card.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(card)}>
                      <Pencil className="h-4 w-4 text-muted-gray" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(card.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-charcoal-black border-muted-gray">
          <DialogHeader>
            <DialogTitle className="text-bone-white">{editing ? 'Edit Rate Card' : 'Add Rate Card'}</DialogTitle>
            <DialogDescription className="text-muted-gray">Set your rates for a production role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-bone-white">Role / Position</Label>
              <Input
                value={form.role_name}
                onChange={(e) => setForm({ ...form, role_name: e.target.value })}
                placeholder="e.g. Director of Photography"
                className="bg-muted-gray/20 border-muted-gray text-bone-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-bone-white">Day Rate ($)</Label>
                <Input type="number" value={form.day_rate_cents}
                  onChange={(e) => setForm({ ...form, day_rate_cents: e.target.value })}
                  placeholder="500" className="bg-muted-gray/20 border-muted-gray text-bone-white" />
              </div>
              <div>
                <Label className="text-bone-white">Half Day ($)</Label>
                <Input type="number" value={form.half_day_rate_cents}
                  onChange={(e) => setForm({ ...form, half_day_rate_cents: e.target.value })}
                  placeholder="300" className="bg-muted-gray/20 border-muted-gray text-bone-white" />
              </div>
              <div>
                <Label className="text-bone-white">Weekly ($)</Label>
                <Input type="number" value={form.weekly_rate_cents}
                  onChange={(e) => setForm({ ...form, weekly_rate_cents: e.target.value })}
                  placeholder="2000" className="bg-muted-gray/20 border-muted-gray text-bone-white" />
              </div>
              <div>
                <Label className="text-bone-white">Hourly ($)</Label>
                <Input type="number" value={form.hourly_rate_cents}
                  onChange={(e) => setForm({ ...form, hourly_rate_cents: e.target.value })}
                  placeholder="75" className="bg-muted-gray/20 border-muted-gray text-bone-white" />
              </div>
            </div>
            <div>
              <Label className="text-bone-white">Notes</Label>
              <Textarea value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Minimum 10-hour days, overtime at 1.5x..."
                className="bg-muted-gray/20 border-muted-gray text-bone-white" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_public} onCheckedChange={(v) => setForm({ ...form, is_public: v })} />
              <Label className="text-bone-white">Show on public profile</Label>
            </div>
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-charcoal-black" onClick={handleSave}
              disabled={!form.role_name || createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Update' : 'Create'} Rate Card
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RateCard;
