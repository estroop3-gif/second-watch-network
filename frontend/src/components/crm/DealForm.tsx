import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const dealSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  contact_id: z.string().min(1, 'Contact is required'),
  description: z.string().optional(),
  product_type: z.string().default('backlot_membership'),
  stage: z.string().default('lead'),
  amount: z.coerce.number().min(0).default(0),
  expected_close_date: z.string().optional(),
  competitor: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;

const PRODUCT_TYPES = [
  { value: 'backlot_membership', label: 'Backlot Membership' },
  { value: 'premium_membership', label: 'Premium Membership' },
  { value: 'production_service', label: 'Production Service' },
  { value: 'gear_rental', label: 'Gear Rental' },
  { value: 'ad_deal', label: 'Ad Deal' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'other', label: 'Other' },
];

const STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

interface DealFormProps {
  initialData?: any;
  contacts?: any[];
  onSubmit: (data: DealFormValues) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

const DealForm = ({ initialData, contacts, onSubmit: onSubmitProp, isLoading, onCancel }: DealFormProps) => {
  const onSubmit = (data: DealFormValues) => {
    const { amount, ...rest } = data;
    onSubmitProp({ ...rest, amount_cents: Math.round(amount * 100) } as any);
  };

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: initialData?.title || '',
      contact_id: initialData?.contact_id || '',
      description: initialData?.description || '',
      product_type: initialData?.product_type || 'backlot_membership',
      stage: initialData?.stage || 'lead',
      amount: initialData?.amount_cents ? initialData.amount_cents / 100 : 0,
      expected_close_date: initialData?.expected_close_date || '',
      competitor: initialData?.competitor || '',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-bone-white">Title</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Deal title" className="bg-charcoal-black border-muted-gray text-bone-white" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {contacts && (
          <FormField
            control={form.control}
            name="contact_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-bone-white">Contact</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-charcoal-black border-muted-gray text-bone-white">
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {contacts.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} {c.company ? `(${c.company})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-bone-white">Description</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Deal description" className="bg-charcoal-black border-muted-gray text-bone-white" rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="product_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-bone-white">Product</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-charcoal-black border-muted-gray text-bone-white">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PRODUCT_TYPES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-bone-white">Stage</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-charcoal-black border-muted-gray text-bone-white">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-bone-white">Amount ($)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" placeholder="0.00" className="bg-charcoal-black border-muted-gray text-bone-white" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expected_close_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-bone-white">Expected Close</FormLabel>
                <FormControl>
                  <Input {...field} type="date" className="bg-charcoal-black border-muted-gray text-bone-white" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="competitor"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-bone-white">Competitor</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Competitor name (optional)" className="bg-charcoal-black border-muted-gray text-bone-white" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          )}
          <Button type="submit" disabled={isLoading} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
            {isLoading ? 'Saving...' : initialData ? 'Update Deal' : 'Create Deal'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default DealForm;
