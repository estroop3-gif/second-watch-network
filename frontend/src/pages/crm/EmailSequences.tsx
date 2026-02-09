import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Workflow, Trash2, Users, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  useAdminSequences, useCreateSequence,
  useUpdateSequence, useDeleteSequence,
} from '@/hooks/crm/useSequences';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';

const EmailSequences = () => {
  const navigate = useNavigate();
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin']);
  const { toast } = useToast();

  const { data, isLoading } = useAdminSequences();
  const createSequence = useCreateSequence();
  const updateSequence = useUpdateSequence();
  const deleteSequence = useDeleteSequence();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const sequences = data?.sequences || [];

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    try {
      const result = await createSequence.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast({ title: 'Sequence created' });
      setShowCreate(false);
      setName('');
      setDescription('');
      if (result?.id) {
        navigate(`/crm/sequences/${result.id}`);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (seq: any) => {
    try {
      await updateSequence.mutateAsync({
        id: seq.id,
        data: { is_active: !seq.is_active },
      });
      toast({ title: seq.is_active ? 'Sequence paused' : 'Sequence activated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (seq: any) => {
    if (!confirm(`Delete sequence "${seq.name}"? This cannot be undone.`)) return;
    try {
      await deleteSequence.mutateAsync(seq.id);
      toast({ title: 'Sequence deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-muted-gray">
        Admin access required to manage email sequences.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading text-accent-yellow flex items-center gap-3">
            <Workflow className="h-7 w-7" />
            Email Sequences
          </h1>
          <p className="text-muted-gray mt-1">
            Automated multi-step email sequences for outreach
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
        >
          <Plus className="h-4 w-4 mr-2" /> Create Sequence
        </Button>
      </div>

      {/* Sequence List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-gray">Loading sequences...</div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-12">
          <Workflow className="h-12 w-12 text-muted-gray/30 mx-auto mb-3" />
          <p className="text-muted-gray">No sequences yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq: any) => (
            <div
              key={seq.id}
              className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 hover:border-muted-gray/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/crm/sequences/${seq.id}`)}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-medium text-bone-white">{seq.name}</h3>
                    <Badge
                      variant="outline"
                      className={
                        seq.is_active
                          ? 'border-emerald-400/50 text-emerald-400 text-xs'
                          : 'border-muted-gray/30 text-muted-gray text-xs'
                      }
                    >
                      {seq.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  {seq.description && (
                    <p className="text-xs text-muted-gray mb-2">{seq.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-gray">
                    <span>{seq.step_count ?? 0} step{(seq.step_count ?? 0) !== 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {seq.active_enrollments ?? 0} enrolled
                    </span>
                    {seq.created_by_name && (
                      <span>by {seq.created_by_name}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-gray">
                      {seq.is_active ? 'On' : 'Off'}
                    </span>
                    <Switch
                      checked={seq.is_active}
                      onCheckedChange={() => handleToggleActive(seq)}
                    />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(seq); }}
                    className="p-1.5 rounded text-muted-gray hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => navigate(`/crm/sequences/${seq.id}`)}
                    className="p-1.5 rounded text-muted-gray hover:text-bone-white hover:bg-muted-gray/20 transition-colors"
                    title="Open"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-charcoal-black border-muted-gray/50 text-bone-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-accent-yellow">Create Sequence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-bone-white/70 text-xs">Sequence Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. New Lead Nurture"
                className="bg-charcoal-black border-muted-gray/50 text-bone-white"
              />
            </div>
            <div>
              <Label className="text-bone-white/70 text-xs">Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose of this sequence..."
                className="bg-charcoal-black border-muted-gray/50 text-bone-white"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || createSequence.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {createSequence.isPending ? 'Creating...' : 'Create Sequence'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailSequences;
