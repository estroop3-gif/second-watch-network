import { useState } from 'react';
import {
  Plus, Trash2, Save, Clock, Mail, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  useAdminSequence, useUpdateSequence,
  useCreateSequenceStep, useUpdateSequenceStep, useDeleteSequenceStep,
} from '@/hooks/crm/useSequences';
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from '@/components/crm/RichTextEditor';

interface SequenceBuilderProps {
  sequenceId: string;
}

const SequenceBuilder = ({ sequenceId }: SequenceBuilderProps) => {
  const { toast } = useToast();

  const { data, isLoading } = useAdminSequence(sequenceId);
  const updateSequence = useUpdateSequence();
  const createStep = useCreateSequenceStep();
  const updateStep = useUpdateSequenceStep();
  const deleteStep = useDeleteSequenceStep();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [descValue, setDescValue] = useState('');

  const [showAddStep, setShowAddStep] = useState(false);
  const [newStepNumber, setNewStepNumber] = useState(1);
  const [newDelayDays, setNewDelayDays] = useState(1);
  const [newSubject, setNewSubject] = useState('');
  const [newBodyHtml, setNewBodyHtml] = useState('');

  const sequence = data?.sequence || data;
  const steps = sequence?.steps || [];

  const startEditMeta = () => {
    setNameValue(sequence?.name || '');
    setDescValue(sequence?.description || '');
    setEditingName(true);
  };

  const saveMeta = async () => {
    if (!nameValue.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    try {
      await updateSequence.mutateAsync({
        id: sequenceId,
        data: { name: nameValue.trim(), description: descValue.trim() },
      });
      setEditingName(false);
      toast({ title: 'Sequence updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openAddStep = () => {
    const nextNum = steps.length > 0
      ? Math.max(...steps.map((s: any) => s.step_number)) + 1
      : 1;
    setNewStepNumber(nextNum);
    setNewDelayDays(steps.length === 0 ? 0 : 2);
    setNewSubject('');
    setNewBodyHtml('');
    setShowAddStep(true);
  };

  const handleAddStep = async () => {
    if (!newSubject.trim() || !newBodyHtml.trim()) {
      toast({ title: 'Subject and body are required', variant: 'destructive' });
      return;
    }
    try {
      await createStep.mutateAsync({
        sequenceId,
        data: {
          step_number: newStepNumber,
          delay_days: newDelayDays,
          subject: newSubject.trim(),
          body_html: newBodyHtml,
        },
      });
      setShowAddStep(false);
      toast({ title: 'Step added' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteStep = async (step: any) => {
    if (!confirm(`Delete step ${step.step_number}?`)) return;
    try {
      await deleteStep.mutateAsync({ sequenceId, stepId: step.id });
      toast({ title: 'Step deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-gray">Loading sequence...</div>;
  }

  if (!sequence) {
    return <div className="text-center py-12 text-muted-gray">Sequence not found.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Sequence Header / Meta */}
      <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-5">
        {editingName ? (
          <div className="space-y-3">
            <div>
              <Label className="text-bone-white/70 text-xs">Sequence Name</Label>
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="bg-charcoal-black border-muted-gray/50 text-bone-white mt-1"
              />
            </div>
            <div>
              <Label className="text-bone-white/70 text-xs">Description</Label>
              <Input
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                placeholder="Optional description..."
                className="bg-charcoal-black border-muted-gray/50 text-bone-white mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={saveMeta}
                disabled={updateSequence.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {updateSequence.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingName(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="cursor-pointer group"
            onClick={startEditMeta}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-heading text-bone-white group-hover:text-accent-yellow transition-colors">
                {sequence.name}
              </h2>
              <Badge
                variant="outline"
                className={
                  sequence.is_active
                    ? 'border-emerald-400/50 text-emerald-400 text-xs'
                    : 'border-muted-gray/30 text-muted-gray text-xs'
                }
              >
                {sequence.is_active ? 'Active' : 'Paused'}
              </Badge>
            </div>
            {sequence.description && (
              <p className="text-sm text-muted-gray mt-1">{sequence.description}</p>
            )}
            <p className="text-xs text-muted-gray/60 mt-2">Click to edit</p>
          </div>
        )}
      </div>

      {/* Steps Timeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-bone-white">
            Steps ({steps.length})
          </h3>
          <Button
            size="sm"
            onClick={openAddStep}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Step
          </Button>
        </div>

        {steps.length === 0 && !showAddStep ? (
          <div className="text-center py-10 border border-dashed border-muted-gray/30 rounded-lg">
            <Mail className="h-10 w-10 text-muted-gray/30 mx-auto mb-2" />
            <p className="text-muted-gray text-sm">No steps yet. Add your first step to build the sequence.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            {steps.length > 0 && (
              <div className="absolute left-5 top-4 bottom-4 w-px bg-muted-gray/20" />
            )}

            <div className="space-y-3">
              {[...steps]
                .sort((a: any, b: any) => a.step_number - b.step_number)
                .map((step: any, idx: number) => (
                  <div key={step.id} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-charcoal-black border-2 border-accent-yellow/50 flex items-center justify-center">
                      <span className="text-xs font-bold text-accent-yellow">{step.step_number}</span>
                    </div>

                    {/* Step card */}
                    <div className="flex-1 bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 hover:border-muted-gray/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="h-3.5 w-3.5 text-accent-yellow/70" />
                            <span className="text-sm font-medium text-bone-white truncate">
                              {step.subject}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-gray">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {step.delay_days === 0
                                ? 'Send immediately'
                                : `Wait ${step.delay_days} day${step.delay_days !== 1 ? 's' : ''}`}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteStep(step)}
                          className="p-1.5 rounded text-muted-gray hover:text-red-400 hover:bg-red-400/10 transition-colors ml-2"
                          title="Delete step"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Add Step Inline Form */}
        {showAddStep && (
          <div className="mt-4 bg-charcoal-black border border-accent-yellow/30 rounded-lg p-5 space-y-4">
            <h4 className="text-sm font-semibold text-accent-yellow">New Step</h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-bone-white/70 text-xs">Step Number</Label>
                <Input
                  type="number"
                  min={1}
                  value={newStepNumber}
                  onChange={(e) => setNewStepNumber(Number(e.target.value))}
                  className="bg-charcoal-black border-muted-gray/50 text-bone-white mt-1"
                />
              </div>
              <div>
                <Label className="text-bone-white/70 text-xs">Delay (days)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newDelayDays}
                  onChange={(e) => setNewDelayDays(Number(e.target.value))}
                  className="bg-charcoal-black border-muted-gray/50 text-bone-white mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-bone-white/70 text-xs">Subject Line</Label>
              <Input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g. Following up on our conversation"
                className="bg-charcoal-black border-muted-gray/50 text-bone-white mt-1"
              />
            </div>

            <div>
              <Label className="text-bone-white/70 text-xs mb-1 block">Email Body</Label>
              <RichTextEditor
                content={newBodyHtml}
                onChange={setNewBodyHtml}
                placeholder="Write the email content for this step..."
                minHeight="180px"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddStep(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddStep}
                disabled={!newSubject.trim() || !newBodyHtml.trim() || createStep.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {createStep.isPending ? 'Adding...' : 'Add Step'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SequenceBuilder;
