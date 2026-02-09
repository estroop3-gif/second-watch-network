import { useState } from 'react';
import { Workflow, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useSequences, useContactSequences,
  useEnrollSequence, useUnenrollSequence,
} from '@/hooks/crm/useSequences';
import { useToast } from '@/hooks/use-toast';

interface SequenceEnrollButtonProps {
  contactId: string;
}

const SequenceEnrollButton = ({ contactId }: SequenceEnrollButtonProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: seqData } = useSequences();
  const { data: enrollData } = useContactSequences(contactId);
  const enrollSequence = useEnrollSequence();
  const unenrollSequence = useUnenrollSequence();

  const sequences = seqData?.sequences || [];
  const enrollments = enrollData?.enrollments || [];
  const enrolledIds = enrollments.map((e: any) => e.sequence_id);

  const handleEnroll = async (sequenceId: string) => {
    try {
      await enrollSequence.mutateAsync({ sequenceId, contactId });
      toast({ title: 'Contact enrolled in sequence' });
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleUnenroll = async (sequenceId: string) => {
    try {
      await unenrollSequence.mutateAsync({ sequenceId, contactId });
      toast({ title: 'Contact removed from sequence' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const availableSequences = sequences.filter(
    (s: any) => s.is_active && !enrolledIds.includes(s.id)
  );

  return (
    <div className="space-y-2">
      {/* Enroll Button with Dropdown */}
      <div className="relative">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(!open)}
          className="border-muted-gray/30 text-bone-white hover:border-accent-yellow/50 hover:text-accent-yellow"
        >
          <Workflow className="h-3.5 w-3.5 mr-1.5" />
          Enroll in Sequence
          <ChevronDown className={`h-3.5 w-3.5 ml-1.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>

        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            {/* Dropdown */}
            <div className="absolute z-20 mt-1 left-0 w-64 bg-charcoal-black border border-muted-gray/50 rounded-lg shadow-xl overflow-hidden">
              {availableSequences.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-gray text-center">
                  {sequences.length === 0
                    ? 'No sequences available'
                    : 'Already enrolled in all active sequences'}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {availableSequences.map((seq: any) => (
                    <button
                      key={seq.id}
                      onClick={() => handleEnroll(seq.id)}
                      disabled={enrollSequence.isPending}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted-gray/20 transition-colors border-b border-muted-gray/10 last:border-0"
                    >
                      <p className="text-sm text-bone-white">{seq.name}</p>
                      {seq.description && (
                        <p className="text-xs text-muted-gray mt-0.5 line-clamp-1">{seq.description}</p>
                      )}
                      <span className="text-xs text-muted-gray/70">
                        {seq.step_count ?? 0} step{(seq.step_count ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Current Enrollments */}
      {enrollments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {enrollments.map((enrollment: any) => (
            <Badge
              key={enrollment.id || enrollment.sequence_id}
              variant="outline"
              className="border-accent-yellow/30 text-accent-yellow/80 text-xs flex items-center gap-1 pr-1"
            >
              <Workflow className="h-3 w-3" />
              <span>{enrollment.sequence_name || 'Sequence'}</span>
              {enrollment.status && (
                <span className="text-muted-gray ml-0.5">
                  ({enrollment.status})
                </span>
              )}
              <button
                onClick={() => handleUnenroll(enrollment.sequence_id)}
                className="ml-0.5 p-0.5 rounded hover:bg-red-400/20 hover:text-red-400 transition-colors"
                title="Unenroll"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default SequenceEnrollButton;
