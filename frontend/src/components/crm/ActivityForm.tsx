import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const activitySchema = z.object({
  activity_type: z.enum(['call', 'email', 'text', 'meeting', 'demo', 'follow_up', 'proposal_sent', 'note', 'other']),
  subject: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  outcome: z.string().optional().or(z.literal('')),
  duration_minutes: z.number().min(0).optional().nullable(),
  follow_up_date: z.string().optional().or(z.literal('')),
  follow_up_notes: z.string().optional().or(z.literal('')),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

interface ActivityFormProps {
  contactId: string;
  onSubmit: (values: any) => void;
  isSubmitting?: boolean;
  defaultValues?: Partial<ActivityFormValues>;
}

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'demo', label: 'Demo' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
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

const ActivityForm = ({ contactId, onSubmit, isSubmitting, defaultValues }: ActivityFormProps) => {
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      activity_type: 'call',
      subject: '',
      description: '',
      outcome: '',
      duration_minutes: null,
      follow_up_date: '',
      follow_up_notes: '',
      ...defaultValues,
    },
  });

  const handleSubmit = (values: ActivityFormValues) => {
    const cleaned: any = { contact_id: contactId };
    if (values.activity_type) cleaned.activity_type = values.activity_type;
    if (values.subject) cleaned.subject = values.subject;
    if (values.description) cleaned.description = values.description;
    if (values.outcome) cleaned.outcome = values.outcome;
    if (values.duration_minutes) cleaned.duration_minutes = values.duration_minutes;
    if (values.follow_up_date) cleaned.follow_up_date = values.follow_up_date;
    if (values.follow_up_notes) cleaned.follow_up_notes = values.follow_up_notes;
    onSubmit(cleaned);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="activity_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Type *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <SelectValue placeholder="Select outcome..." />
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
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea {...field} rows={3} className="bg-charcoal-black border-muted-gray" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="duration_minutes" render={({ field }) => (
            <FormItem>
              <FormLabel>Duration (min)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  value={field.value ?? ''}
                  onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                  className="bg-charcoal-black border-muted-gray"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="follow_up_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Follow-up Date</FormLabel>
              <FormControl><Input type="date" {...field} className="bg-charcoal-black border-muted-gray" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="follow_up_notes" render={({ field }) => (
            <FormItem>
              <FormLabel>Follow-up Notes</FormLabel>
              <FormControl><Input {...field} className="bg-charcoal-black border-muted-gray" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <Button type="submit" disabled={isSubmitting} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
          {isSubmitting ? 'Saving...' : 'Log Activity'}
        </Button>
      </form>
    </Form>
  );
};

export default ActivityForm;
