import { useState } from 'react';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  useMediaPlatforms, useCreateMediaPlatform,
  useUpdateMediaPlatform, useDeleteMediaPlatform,
} from '@/hooks/media';

const emptyForm = { name: '', slug: '', icon: '', color: '#6366f1', url_pattern: '', is_active: true, sort_order: 0 };

const Platforms = () => {
  const { toast } = useToast();
  const { data, isLoading } = useMediaPlatforms(true);
  const createPlatform = useCreateMediaPlatform();
  const updatePlatform = useUpdateMediaPlatform();
  const deletePlatform = useDeleteMediaPlatform();

  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const platforms = data?.platforms || [];

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name || '',
      slug: p.slug || '',
      icon: p.icon || '',
      color: p.color || '#6366f1',
      url_pattern: p.url_pattern || '',
      is_active: p.is_active ?? true,
      sort_order: p.sort_order || 0,
    });
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) return;
    try {
      if (editId) {
        await updatePlatform.mutateAsync({ id: editId, data: form });
        toast({ title: 'Platform updated' });
      } else {
        await createPlatform.mutateAsync(form);
        toast({ title: 'Platform created' });
      }
      setShowDialog(false);
    } catch {
      toast({ title: 'Failed to save platform', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlatform.mutateAsync(id);
      toast({ title: 'Platform deactivated' });
    } catch {
      toast({ title: 'Failed to delete platform', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (p: any) => {
    try {
      await updatePlatform.mutateAsync({ id: p.id, data: { is_active: !p.is_active } });
    } catch {
      toast({ title: 'Failed to update platform', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading text-accent-yellow">Platforms</h1>
        <Button onClick={openCreate} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80">
          <Plus className="h-4 w-4 mr-2" /> Add Platform
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-accent-yellow border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {platforms.map((p: any) => (
            <div key={p.id} className={`rounded-lg border p-4 space-y-3 ${p.is_active ? 'border-muted-gray/50 bg-charcoal-black' : 'border-muted-gray/20 bg-charcoal-black/50 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || '#6366f1' }} />
                  <div>
                    <h3 className="text-sm font-medium text-bone-white">{p.name}</h3>
                    <p className="text-xs text-muted-gray">{p.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={p.is_active} onCheckedChange={() => handleToggleActive(p)} />
                </div>
              </div>
              {p.icon && <p className="text-xs text-muted-gray">Icon: {p.icon}</p>}
              {p.url_pattern && <p className="text-xs text-muted-gray truncate">{p.url_pattern}</p>}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="text-muted-gray hover:text-bone-white">
                  <Edit2 className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-primary-red hover:text-primary-red/80">
                  <Trash2 className="h-3 w-3 mr-1" /> Deactivate
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-charcoal-black border-muted-gray/50 text-bone-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Platform' : 'New Platform'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-muted-gray">Name *</label>
              <input
                type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm" required
              />
            </div>
            <div>
              <label className="text-sm text-muted-gray">Slug *</label>
              <input
                type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm" required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-gray">Icon (Lucide name)</label>
                <input
                  type="text" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                  placeholder="Instagram" className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-muted-gray">Color (hex)</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-10 h-9 rounded border border-muted-gray/50 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-gray">URL Pattern</label>
              <input
                type="text" value={form.url_pattern} onChange={e => setForm(f => ({ ...f, url_pattern: e.target.value }))}
                placeholder="https://instagram.com/{handle}" className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <label className="text-sm text-muted-gray">Active</label>
            </div>
            <Button type="submit" className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80"
              disabled={createPlatform.isPending || updatePlatform.isPending}>
              {editId ? 'Save Changes' : 'Create Platform'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Platforms;
