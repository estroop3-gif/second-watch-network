import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'demo', label: 'Demo' },
  { value: 'note', label: 'Note' },
  { value: 'other', label: 'Other' },
];

const OUTCOMES = [
  { value: 'completed', label: 'Completed' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'left_voicemail', label: 'Left Voicemail' },
  { value: 'callback_requested', label: 'Callback Requested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'interested', label: 'Interested' },
];

const schema = z.object({
  activity_type: z.enum(['call', 'email', 'text', 'meeting', 'demo', 'note', 'other']),
  subject: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  outcome: z.string().optional().or(z.literal('')),
  duration_minutes: z.number().min(0).optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

interface FollowUpCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUp: any;
  onSubmit: (newActivityData: any, originalActivityId: string) => void;
  isSubmitting?: boolean;
}

const FollowUpCompleteDialog = ({
  open, onOpenChange, followUp, onSubmit, isSubmitting,
}: FollowUpCompleteDialogProps) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      activity_type: 'call',
      subject: '',
      description: '',
      outcome: 'completed',
      duration_minutes: null,
    },
  });

  useEffect(() => {
    if (open && followUp) {
      form.reset({
        activity_type: 'call',
        subject: followUp.follow_up_notes ? `Follow-up: ${followUp.follow_up_notes}` : `Follow-up re: ${followUp.subject || 'previous activity'}`,
        description: '',
        outcome: 'completed',
        duration_minutes: null,
      });
    }
  }, [open, followUp]);

  const handleSubmit = (values: FormValues) => {
    if (!followUp) return;
    const cleaned: any = {
      contact_id: followUp.contact_id,
      activity_type: values.activity_type,
    };
    if (values.subject) cleaned.subject = values.subject;
    if (values.description) cleaned.description = values.description;
    if (values.outcome) cleaned.outcome = values.outcome;
    if (values.duration_minutes) cleaned.duration_minutes = values.duration_minutes;
    onSubmit(cleaned, followUp.id);
  };

  if (!followUp) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle>Complete Follow-up</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Log an activity for {followUp.contact_first_name} {followUp.contact_last_name} and clear this follow-up.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="activity_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-charcoal-black border-muted-gray">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACTIVITY_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="outcome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Outcome</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className="bg-charcoal-black border-muted-gray">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OUTCOMES.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="subject" render={({ field }) => (
              <FormItem>
                <FormLabel>Subject</FormLabel>
                <FormControl><Input {...field} className="bg-charcoal-black border-muted-gray" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={3} placeholder="What happened during this follow-up?" className="bg-charcoal-black border-muted-gray" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="duration_minutes" render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (min)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    className="bg-charcoal-black border-muted-gray"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white hover:bg-blue-500">
                {isSubmitting ? 'Completing...' : 'Complete Follow-up'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default FollowUpCompleteDialog;
