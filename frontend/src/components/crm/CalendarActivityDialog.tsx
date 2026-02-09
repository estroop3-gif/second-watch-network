import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
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

const schema = z.object({
  contact_id: z.string().min(1, 'Contact is required'),
  activity_type: z.enum(['call', 'email', 'text', 'meeting', 'demo', 'follow_up', 'proposal_sent', 'note', 'other']),
  subject: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  outcome: z.string().optional().or(z.literal('')),
  activity_date: z.string().optional().or(z.literal('')),
  duration_minutes: z.number().min(0).optional().nullable(),
  follow_up_date: z.string().optional().or(z.literal('')),
  follow_up_notes: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface CalendarActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: any[];
  onSubmit: (data: any) => void;
  isSubmitting?: boolean;
  editActivity?: any;
  defaultDate?: string;
}

const CalendarActivityDialog = ({
  open, onOpenChange, contacts, onSubmit, isSubmitting, editActivity, defaultDate,
}: CalendarActivityDialogProps) => {
  const isEdit = !!editActivity;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      contact_id: '',
      activity_type: 'call',
      subject: '',
      description: '',
      outcome: '',
      activity_date: defaultDate || '',
      duration_minutes: null,
      follow_up_date: '',
      follow_up_notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (editActivity) {
        form.reset({
          contact_id: editActivity.contact_id || '',
          activity_type: editActivity.activity_type || 'call',
          subject: editActivity.subject || '',
          description: editActivity.description || '',
          outcome: editActivity.outcome || '',
          activity_date: editActivity.activity_date?.split('T')[0] || defaultDate || '',
          duration_minutes: editActivity.duration_minutes ?? null,
          follow_up_date: editActivity.follow_up_date?.split('T')[0] || '',
          follow_up_notes: editActivity.follow_up_notes || '',
        });
      } else {
        form.reset({
          contact_id: '',
          activity_type: 'call',
          subject: '',
          description: '',
          outcome: '',
          activity_date: defaultDate || '',
          duration_minutes: null,
          follow_up_date: '',
          follow_up_notes: '',
        });
      }
    }
  }, [open, editActivity, defaultDate]);

  const handleSubmit = (values: FormValues) => {
    const cleaned: any = {};
    if (values.contact_id) cleaned.contact_id = values.contact_id;
    if (values.activity_type) cleaned.activity_type = values.activity_type;
    if (values.subject) cleaned.subject = values.subject;
    if (values.description) cleaned.description = values.description;
    if (values.outcome) cleaned.outcome = values.outcome;
    if (values.activity_date) cleaned.activity_date = values.activity_date;
    if (values.duration_minutes) cleaned.duration_minutes = values.duration_minutes;
    if (values.follow_up_date) cleaned.follow_up_date = values.follow_up_date;
    if (values.follow_up_notes) cleaned.follow_up_notes = values.follow_up_notes;
    onSubmit(cleaned);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Activity' : 'Log Activity'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="contact_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-charcoal-black border-muted-gray">
                        <SelectValue placeholder="Select contact..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contacts.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

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

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="activity_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity Date</FormLabel>
                  <FormControl><Input type="date" {...field} className="bg-charcoal-black border-muted-gray" /></FormControl>
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
            </div>

            <FormField control={form.control} name="follow_up_notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Follow-up Notes</FormLabel>
                <FormControl><Input {...field} className="bg-charcoal-black border-muted-gray" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
                {isSubmitting ? 'Saving...' : isEdit ? 'Update Activity' : 'Log Activity'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarActivityDialog;
