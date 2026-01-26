/**
 * BookApplicantModal - Modal for booking an applicant
 * Comprehensive booking flow with rate, dates, documents, and notifications
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useBookApplicant } from '@/hooks/backlot';
import { CollabApplication } from '@/types/applications';
import { Calendar as CalendarIcon, Loader2, CheckCircle, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { POSITIONS } from '@/components/shared/PositionSelector';
import SearchableCombobox, { SearchableItem } from '@/components/shared/SearchableCombobox';

interface BookApplicantModalProps {
  application: CollabApplication;
  collabId: string;
  collabTitle: string;
  isCastRole: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Document types available for request
const DOCUMENT_TYPES = [
  { value: 'deal_memo', label: 'Deal Memo' },
  { value: 'w9', label: 'W-9 Tax Form' },
  { value: 'nda', label: 'NDA' },
  { value: 'emergency_contact', label: 'Emergency Contact' },
  { value: 'i9', label: 'I-9 Employment Verification' },
];

// Extract unique departments from POSITIONS
const DEPARTMENTS = Array.from(new Set(POSITIONS.map(p => p.department)))
  .sort()
  .map((dept, idx) => ({
    id: dept.toLowerCase().replace(/\s+/g, '-'),
    name: dept,
  }));

// Form schema with validation
const bookingSchema = z.object({
  rate_amount: z.string().optional(),
  rate_period: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'flat']).optional(),
  booking_start_date: z.date().optional().nullable(),
  booking_end_date: z.date().optional().nullable(),
  booking_notes: z.string().optional(),
  booking_schedule_notes: z.string().optional(),
  // Contract type (cast or crew)
  contract_type: z.enum([
    // Cast types (actors)
    'series_regular', 'recurring', 'guest_star', 'day_player',
    // Cast types (hosts/presenters)
    'host', 'co_host', 'guest_host',
    // Crew types
    'freelance', 'staff', 'contractor', 'intern', 'temporary'
  ]).optional(),
  billing_position: z.number().min(1).optional().nullable(),
  character_id: z.string().optional(),
  // Crew-specific fields
  role_title: z.string().optional(),
  department: z.string().optional(),
  // Document requests
  document_types: z.array(z.string()).optional(),
  // Notification
  send_notification: z.boolean().default(true),
  notification_message: z.string().optional(),
}).refine((data) => {
  // End date must be after start date if both are provided
  if (data.booking_start_date && data.booking_end_date) {
    return data.booking_end_date >= data.booking_start_date;
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['booking_end_date'],
});

type BookingFormData = z.infer<typeof bookingSchema>;

export function BookApplicantModal({
  application,
  collabId,
  collabTitle,
  isCastRole,
  isOpen,
  onClose,
  onSuccess,
}: BookApplicantModalProps) {
  const { toast } = useToast();
  const bookApplicant = useBookApplicant(collabId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customDepartments, setCustomDepartments] = useState<SearchableItem[]>([]);
  const [customRoles, setCustomRoles] = useState<SearchableItem[]>([]);

  // Default notification message
  const defaultMessage = `Congratulations! You've been booked for ${collabTitle}. We're excited to have you on board. Details about your booking are below.`;

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      rate_amount: '',
      rate_period: undefined,
      booking_start_date: null,
      booking_end_date: null,
      booking_notes: '',
      booking_schedule_notes: '',
      contract_type: undefined,
      billing_position: null,
      character_id: '',
      role_title: '',
      department: '',
      document_types: [],
      send_notification: true,
      notification_message: defaultMessage,
    },
  });

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);
    try {
      // Combine rate amount and period into a single string
      let booking_rate = undefined;
      if (data.rate_amount && data.rate_period) {
        booking_rate = `$${data.rate_amount}/${data.rate_period}`;
      } else if (data.rate_amount) {
        booking_rate = `$${data.rate_amount}`;
      }

      // Format dates as YYYY-MM-DD
      const bookingData = {
        booking_rate,
        booking_start_date: data.booking_start_date ? format(data.booking_start_date, 'yyyy-MM-dd') : undefined,
        booking_end_date: data.booking_end_date ? format(data.booking_end_date, 'yyyy-MM-dd') : undefined,
        booking_notes: data.booking_notes || undefined,
        booking_schedule_notes: data.booking_schedule_notes || undefined,
        contract_type: data.contract_type || undefined,
        billing_position: data.billing_position || undefined,
        character_id: data.character_id || undefined,
        role_title: data.role_title || undefined,
        department: data.department || undefined,
        request_documents: data.document_types && data.document_types.length > 0,
        document_types: data.document_types || undefined,
        send_notification: data.send_notification,
        notification_message: data.notification_message || undefined,
      };

      await bookApplicant.mutateAsync({
        applicationId: application.id,
        booking: bookingData,
      });

      toast({
        title: 'Applicant booked',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>
              {application.current_profile?.full_name || application.current_profile?.username} has been booked successfully.
            </span>
          </div>
        ),
      });

      onSuccess?.();
      onClose();
      form.reset();
    } catch (error: any) {
      toast({
        title: 'Booking failed',
        description: error.message || 'Failed to book applicant',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      form.reset();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book Applicant</DialogTitle>
          <DialogDescription>
            Book {application.current_profile?.full_name || application.current_profile?.username} for {collabTitle}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-bone-white">Basic Information</h3>

              {/* Rate */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="rate_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Amount</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                          <Input
                            {...field}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="500"
                            className="bg-charcoal-black border-muted-gray/30 pl-7"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rate_period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Period</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hourly">Per Hour</SelectItem>
                          <SelectItem value="daily">Per Day</SelectItem>
                          <SelectItem value="weekly">Per Week</SelectItem>
                          <SelectItem value="monthly">Per Month</SelectItem>
                          <SelectItem value="flat">Flat Rate</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Start Date */}
              <FormField
                control={form.control}
                name="booking_start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal bg-charcoal-black border-muted-gray/30',
                              !field.value && 'text-muted-gray'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date */}
              <FormField
                control={form.control}
                name="booking_end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal bg-charcoal-black border-muted-gray/30',
                              !field.value && 'text-muted-gray'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cast-Specific Fields */}
            {isCastRole && (
              <div className="space-y-4 pt-4 border-t border-muted-gray/30">
                <h3 className="text-sm font-medium text-bone-white">Cast Details</h3>

                {/* Contract Type */}
                <FormField
                  control={form.control}
                  name="contract_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                            <SelectValue placeholder="Select contract type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="series_regular">Series Regular</SelectItem>
                          <SelectItem value="recurring">Recurring</SelectItem>
                          <SelectItem value="guest_star">Guest Star</SelectItem>
                          <SelectItem value="day_player">Day Player</SelectItem>
                          <SelectItem value="host">Host</SelectItem>
                          <SelectItem value="co_host">Co-Host</SelectItem>
                          <SelectItem value="guest_host">Guest Host</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Billing Position */}
                <FormField
                  control={form.control}
                  name="billing_position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Position</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="1"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="1 = lead, 2 = supporting, etc."
                          className="bg-charcoal-black border-muted-gray/30"
                        />
                      </FormControl>
                      <FormDescription>
                        Credits billing order (1 for lead, 2 for supporting, etc.)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Character Assignment */}
                <FormField
                  control={form.control}
                  name="character_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Character Name (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Character name"
                          className="bg-charcoal-black border-muted-gray/30"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Crew-Specific Fields */}
            {!isCastRole && (
              <div className="space-y-4 pt-4 border-t border-muted-gray/30">
                <h3 className="text-sm font-medium text-bone-white">Crew Details</h3>

                {/* Contract Type */}
                <FormField
                  control={form.control}
                  name="contract_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                            <SelectValue placeholder="Select contract type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="freelance">Freelance</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="contractor">Contractor</SelectItem>
                          <SelectItem value="temporary">Temporary</SelectItem>
                          <SelectItem value="intern">Intern</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Role Title */}
                <FormField
                  control={form.control}
                  name="role_title"
                  render={({ field }) => {
                    const baseRoles = POSITIONS.map(p => ({ id: p.id, name: p.name, department: p.department }));
                    const allRoles = [...baseRoles, ...customRoles];
                    const selectedRole = allRoles.find(r => r.name === field.value);

                    const searchRoles = async (query: string) => {
                      if (!query || query.length < 1) {
                        return allRoles.sort((a, b) => a.name.localeCompare(b.name));
                      }
                      const lowerQuery = query.toLowerCase();
                      return allRoles.filter(r =>
                        r.name.toLowerCase().includes(lowerQuery) ||
                        ('department' in r && (r as any).department?.toLowerCase().includes(lowerQuery))
                      ).sort((a, b) => {
                        // Exact match first
                        const aName = a.name.toLowerCase();
                        const bName = b.name.toLowerCase();
                        if (aName === lowerQuery && bName !== lowerQuery) return -1;
                        if (bName === lowerQuery && aName !== lowerQuery) return 1;
                        if (aName.startsWith(lowerQuery) && !bName.startsWith(lowerQuery)) return -1;
                        if (bName.startsWith(lowerQuery) && !aName.startsWith(lowerQuery)) return 1;
                        return aName.localeCompare(bName);
                      });
                    };

                    const handleAddRole = async (name: string) => {
                      const newRole = {
                        id: name.toLowerCase().replace(/\s+/g, '-'),
                        name: name,
                      };
                      setCustomRoles(prev => [...prev, newRole]);
                      field.onChange(name);
                      return newRole;
                    };

                    return (
                      <FormItem>
                        <FormLabel>Role Title</FormLabel>
                        <FormControl>
                          <SearchableCombobox
                            value={selectedRole?.id || null}
                            onChange={(id, role) => field.onChange(role?.name || '')}
                            searchFn={searchRoles}
                            onAddNew={handleAddRole}
                            placeholder="Select or add role title..."
                            searchPlaceholder="Search roles..."
                            emptyMessage="No roles found."
                            addNewLabel="Add custom role"
                            renderItem={(role) => (
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-gray" />
                                <div className="flex flex-col">
                                  <span className="text-bone-white">{role.name}</span>
                                  {'department' in role && (role as any).department && (
                                    <span className="text-[10px] text-muted-gray">{(role as any).department}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            renderSelected={(role) => (
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-gray" />
                                <span>{role.name}</span>
                              </div>
                            )}
                            initialSelectedItem={selectedRole}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {/* Department */}
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => {
                    const allDepartments = [...DEPARTMENTS, ...customDepartments];
                    const selectedDept = allDepartments.find(d => d.name === field.value);

                    const searchDepartments = async (query: string) => {
                      if (!query || query.length < 1) {
                        return allDepartments.sort((a, b) => a.name.localeCompare(b.name));
                      }
                      const lowerQuery = query.toLowerCase();
                      return allDepartments.filter(d =>
                        d.name.toLowerCase().includes(lowerQuery)
                      ).sort((a, b) => a.name.localeCompare(b.name));
                    };

                    const handleAddDepartment = async (name: string) => {
                      const newDept = {
                        id: name.toLowerCase().replace(/\s+/g, '-'),
                        name: name,
                      };
                      setCustomDepartments(prev => [...prev, newDept]);
                      field.onChange(name);
                      return newDept;
                    };

                    return (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <SearchableCombobox
                            value={selectedDept?.id || null}
                            onChange={(id, dept) => field.onChange(dept?.name || '')}
                            searchFn={searchDepartments}
                            onAddNew={handleAddDepartment}
                            placeholder="Select department..."
                            searchPlaceholder="Search departments..."
                            emptyMessage="No departments found."
                            addNewLabel="Add department"
                            renderItem={(dept) => (
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-gray" />
                                <span className="text-bone-white">{dept.name}</span>
                              </div>
                            )}
                            renderSelected={(dept) => (
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-gray" />
                                <span>{dept.name}</span>
                              </div>
                            )}
                            initialSelectedItem={selectedDept}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
            )}

            {/* Additional Details */}
            <div className="space-y-4 pt-4 border-t border-muted-gray/30">
              <h3 className="text-sm font-medium text-bone-white">Additional Details</h3>

              {/* Schedule Notes */}
              <FormField
                control={form.control}
                name="booking_schedule_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Work days, hours, special scheduling requirements..."
                        className="bg-charcoal-black border-muted-gray/30"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Booking Notes */}
              <FormField
                control={form.control}
                name="booking_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Internal notes about this booking..."
                        className="bg-charcoal-black border-muted-gray/30"
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      These notes are internal and won't be shared with the applicant
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Document Requests */}
            <div className="space-y-4 pt-4 border-t border-muted-gray/30">
              <h3 className="text-sm font-medium text-bone-white">Document Requests</h3>
              <FormField
                control={form.control}
                name="document_types"
                render={() => (
                  <FormItem>
                    <div className="space-y-2">
                      {DOCUMENT_TYPES.map((doc) => (
                        <FormField
                          key={doc.value}
                          control={form.control}
                          name="document_types"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={doc.value}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(doc.value)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), doc.value])
                                        : field.onChange(
                                            field.value?.filter((value) => value !== doc.value)
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {doc.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormDescription>
                      Select documents to request from the applicant
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notification */}
            <div className="space-y-4 pt-4 border-t border-muted-gray/30">
              <h3 className="text-sm font-medium text-bone-white">Notification</h3>

              {/* Send Notification Checkbox */}
              <FormField
                control={form.control}
                name="send_notification"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">
                        Send notification to applicant
                      </FormLabel>
                      <FormDescription>
                        Notify the applicant about their booking
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {/* Custom Message */}
              {form.watch('send_notification') && (
                <FormField
                  control={form.control}
                  name="notification_message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Message</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={defaultMessage}
                          className="bg-charcoal-black border-muted-gray/30"
                          rows={4}
                        />
                      </FormControl>
                      <FormDescription>
                        Customize the notification message sent to the applicant
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Footer */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Booking...
                  </>
                ) : (
                  'Book Applicant'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
