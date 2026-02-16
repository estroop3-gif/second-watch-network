import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  phone_secondary: z.string().optional().or(z.literal('')),
  company: z.string().optional().or(z.literal('')),
  job_title: z.string().optional().or(z.literal('')),
  address_line1: z.string().optional().or(z.literal('')),
  address_line2: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  zip: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  temperature: z.enum(['cold', 'warm', 'hot', 'missed_opportunity']),
  source: z.enum(['inbound', 'outbound', 'referral', 'event', 'website', 'social', 'other']),
  source_detail: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  visibility: z.enum(['private', 'team']).default('team'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactFormProps {
  defaultValues?: Partial<ContactFormValues>;
  onSubmit: (values: ContactFormValues) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const ContactForm = ({ defaultValues, onSubmit, isSubmitting, submitLabel = 'Save Contact' }: ContactFormProps) => {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      phone_secondary: '',
      company: '',
      job_title: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      zip: '',
      country: 'US',
      temperature: 'cold',
      source: 'outbound',
      source_detail: '',
      notes: '',
      visibility: 'team',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="first_name" render={({ field }) => (
            <FormItem>
              <FormLabel>First Name *</FormLabel>
              <FormControl><Input {...field} className="bg-charcoal-black border-muted-gray" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="last_name" render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name *</FormLabel>
              <FormControl><Input {...field} className="bg-charcoal-black border-muted-gray" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" {...field} className="bg-charcoal-black border-muted-gray" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl><Input {...field} className="bg-charcoal-black border-muted-gray" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Company */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="company" render={({ field }) => (
            <FormItem>
              <FormLabel>Company</FormLabel>
              <FormControl><Input {...field} className="bg-charcoal-black border-muted-gray" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="job_title" render={({ field }) => (
            <FormItem>
              <FormLabel>Job Title</FormLabel>
              <FormControl><Input {...field} className="bg-charcoal-black border-muted-gray" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* CRM Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="temperature" render={({ field }) => (
            <FormItem>
              <FormLabel>Temperature</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="cold">Cold</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="missed_opportunity">Missed Opportunity</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="source" render={({ field }) => (
            <FormItem>
              <FormLabel>Source</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Address */}
        <div className="space-y-4">
          <FormField control={form.control} name="address_line1" render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl><Input {...field} placeholder="Street address" className="bg-charcoal-black border-muted-gray" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField control={form.control} name="city" render={({ field }) => (
              <FormItem>
                <FormControl><Input {...field} placeholder="City" className="bg-charcoal-black border-muted-gray" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="state" render={({ field }) => (
              <FormItem>
                <FormControl><Input {...field} placeholder="State" className="bg-charcoal-black border-muted-gray" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="zip" render={({ field }) => (
              <FormItem>
                <FormControl><Input {...field} placeholder="ZIP" className="bg-charcoal-black border-muted-gray" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="country" render={({ field }) => (
              <FormItem>
                <FormControl><Input {...field} placeholder="Country" className="bg-charcoal-black border-muted-gray" /></FormControl>
              </FormItem>
            )} />
          </div>
        </div>

        {/* Visibility */}
        <FormField control={form.control} name="visibility" render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between rounded-lg border border-muted-gray/30 p-3">
              <div>
                <FormLabel className="text-sm font-medium">Private (Admin Only)</FormLabel>
                <p className="text-xs text-muted-gray mt-0.5">
                  When enabled, only you and admins can see this contact
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value === 'private'}
                  onCheckedChange={(checked) => field.onChange(checked ? 'private' : 'team')}
                />
              </FormControl>
            </div>
          </FormItem>
        )} />

        {/* Notes */}
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea {...field} rows={3} className="bg-charcoal-black border-muted-gray" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" disabled={isSubmitting} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </form>
    </Form>
  );
};

export default ContactForm;
