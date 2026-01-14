/**
 * Cart Submit Form Component
 * Form for submitting cart items as work order requests.
 * Allows setting rental dates and notes per vendor.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, addDays } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Building2, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useGearCartContext } from '@/context/GearCartContext';
import { useToast } from '@/hooks/use-toast';
import type { GearCartGrouped, CartSubmitRequestInput } from '@/types/gear';
import { cn } from '@/lib/utils';

// Schema for a single vendor's request
const vendorRequestSchema = z.object({
  rental_start_date: z.date({
    required_error: 'Start date is required',
  }),
  rental_end_date: z.date({
    required_error: 'End date is required',
  }),
  notes: z.string().optional(),
}).refine(data => data.rental_end_date >= data.rental_start_date, {
  message: 'End date must be after start date',
  path: ['rental_end_date'],
});

type VendorRequestFormData = z.infer<typeof vendorRequestSchema>;

interface CartSubmitFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  backlotProjectId?: string;
}

export function CartSubmitForm({
  onSuccess,
  onCancel,
  backlotProjectId,
}: CartSubmitFormProps) {
  const { groups, submitCart, isSubmitting, closeCart } = useGearCartContext();
  const { toast } = useToast();

  // Track form data for each vendor
  const [vendorForms, setVendorForms] = useState<Record<string, VendorRequestFormData>>(() => {
    const initial: Record<string, VendorRequestFormData> = {};
    const tomorrow = addDays(new Date(), 1);
    const weekFromNow = addDays(new Date(), 7);
    groups.forEach(g => {
      initial[g.organization.id] = {
        rental_start_date: tomorrow,
        rental_end_date: weekFromNow,
        notes: '',
      };
    });
    return initial;
  });

  const updateVendorForm = (orgId: string, updates: Partial<VendorRequestFormData>) => {
    setVendorForms(prev => ({
      ...prev,
      [orgId]: { ...prev[orgId], ...updates },
    }));
  };

  const handleSubmit = async () => {
    // Validate all forms
    const requests: CartSubmitRequestInput[] = [];

    for (const group of groups) {
      const formData = vendorForms[group.organization.id];
      if (!formData) continue;

      // Validate dates
      if (!formData.rental_start_date || !formData.rental_end_date) {
        toast({
          title: 'Missing Dates',
          description: `Please select rental dates for ${group.organization.marketplace_name || group.organization.name}`,
          variant: 'destructive',
        });
        return;
      }

      if (formData.rental_end_date < formData.rental_start_date) {
        toast({
          title: 'Invalid Dates',
          description: `End date must be after start date for ${group.organization.marketplace_name || group.organization.name}`,
          variant: 'destructive',
        });
        return;
      }

      // Auto-generate title from item count
      const itemCount = group.items.reduce((sum, item) => sum + item.quantity, 0);
      const generatedTitle = `${itemCount} item${itemCount !== 1 ? 's' : ''} requested`;

      requests.push({
        gear_house_org_id: group.organization.id,
        backlot_project_id: backlotProjectId,
        title: generatedTitle,
        rental_start_date: format(formData.rental_start_date, 'yyyy-MM-dd'),
        rental_end_date: format(formData.rental_end_date, 'yyyy-MM-dd'),
        notes: formData.notes || undefined,
        item_ids: group.items.map(item => item.id),
      });
    }

    try {
      const result = await submitCart({ requests });
      toast({
        title: 'Requests Submitted',
        description: `Created ${result.requests.length} work order request(s). You'll be notified when they're reviewed.`,
      });
      closeCart();
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Submission Failed',
        description: error instanceof Error ? error.message : 'Failed to submit requests',
        variant: 'destructive',
      });
    }
  };

  if (groups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Your cart is empty
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <VendorRequestSection
          key={group.organization.id}
          group={group}
          formData={vendorForms[group.organization.id]}
          onUpdate={(updates) => updateVendorForm(group.organization.id, updates)}
        />
      ))}

      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit {groups.length} Request{groups.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}

// Single vendor request section
interface VendorRequestSectionProps {
  group: GearCartGrouped;
  formData: VendorRequestFormData;
  onUpdate: (updates: Partial<VendorRequestFormData>) => void;
}

function VendorRequestSection({ group, formData, onUpdate }: VendorRequestSectionProps) {
  const org = group.organization;
  const totalQuantity = group.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{org.marketplace_name || org.name}</span>
          {org.is_verified && <BadgeCheck className="h-4 w-4 text-blue-500" />}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{totalQuantity} item{totalQuantity !== 1 ? 's' : ''}</Badge>
          <span className="font-medium">${group.total_daily_rate.toFixed(2)}/day</span>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !formData.rental_start_date && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.rental_start_date ? (
                  format(formData.rental_start_date, 'PPP')
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.rental_start_date}
                onSelect={(date) => date && onUpdate({ rental_start_date: date })}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !formData.rental_end_date && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.rental_end_date ? (
                  format(formData.rental_end_date, 'PPP')
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.rental_end_date}
                onSelect={(date) => date && onUpdate({ rental_end_date: date })}
                disabled={(date) => date < (formData.rental_start_date || new Date())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Textarea
          placeholder="Any special requirements or pickup instructions..."
          value={formData.notes || ''}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}
