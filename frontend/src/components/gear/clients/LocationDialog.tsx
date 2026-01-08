/**
 * Location Dialog
 * Create and edit gear locations with full details
 */
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MapPin,
  Building2,
  Mail,
  Phone,
  User,
  Check,
  Loader2,
  Warehouse,
  Truck,
  Video,
  Home,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

import { useGearLocations } from '@/hooks/gear';
import type { GearLocation, LocationType } from '@/types/gear';

const LOCATION_TYPES: { value: LocationType; label: string; icon: React.ReactNode }[] = [
  { value: 'warehouse', label: 'Warehouse', icon: <Warehouse className="w-4 h-4" /> },
  { value: 'stage', label: 'Stage/Studio', icon: <Video className="w-4 h-4" /> },
  { value: 'vehicle', label: 'Vehicle', icon: <Truck className="w-4 h-4" /> },
  { value: 'client_site', label: 'Client Site', icon: <Building2 className="w-4 h-4" /> },
  { value: 'other', label: 'Other', icon: <MapPin className="w-4 h-4" /> },
];

const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  location_type: z.string().default('warehouse'),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().default('US'),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  is_default_home: z.boolean().default(false),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface LocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  location?: GearLocation | null;
  onCreated?: (locationId: string) => void;
}

export function LocationDialog({
  isOpen,
  onClose,
  orgId,
  location,
  onCreated,
}: LocationDialogProps) {
  const { createLocation, refetch } = useGearLocations(orgId);
  const isEditing = !!location;

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: '',
      location_type: 'warehouse',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      is_default_home: false,
    },
  });

  // Reset form when dialog opens/closes or location changes
  useEffect(() => {
    if (isOpen) {
      if (location) {
        form.reset({
          name: location.name,
          location_type: location.location_type || 'warehouse',
          address_line1: location.address_line1 || '',
          address_line2: location.address_line2 || '',
          city: location.city || '',
          state: location.state || '',
          postal_code: location.postal_code || '',
          country: location.country || 'US',
          contact_name: location.contact_name || '',
          contact_phone: location.contact_phone || '',
          contact_email: location.contact_email || '',
          is_default_home: location.is_default_home || false,
        });
      } else {
        form.reset({
          name: '',
          location_type: 'warehouse',
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'US',
          contact_name: '',
          contact_phone: '',
          contact_email: '',
          is_default_home: false,
        });
      }
    }
  }, [isOpen, location, form]);

  const onSubmit = async (data: LocationFormData) => {
    try {
      const result = await createLocation.mutateAsync({
        ...data,
        contact_email: data.contact_email || undefined,
      });

      refetch();

      if (onCreated && result?.location?.id) {
        onCreated(result.location.id);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error saving location:', error);
    }
  };

  const isSubmitting = form.formState.isSubmitting || createLocation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {isEditing ? 'Edit Location' : 'Add Location'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
                  Basic Information
                </h3>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Main Warehouse" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LOCATION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                {type.icon}
                                <span>{type.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_default_home"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="flex items-center gap-2 cursor-pointer">
                          <Home className="w-4 h-4" />
                          Default Home Location
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Assets will return here by default after checkout
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
                  Address
                </h3>

                <FormField
                  control={form.control}
                  name="address_line1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                          <Input className="pl-9" placeholder="123 Main Street" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_line2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Suite 100, Building A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Los Angeles" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="CA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="90001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="US" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
                  Contact (Optional)
                </h3>

                <FormField
                  control={form.control}
                  name="contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                          <Input className="pl-9" placeholder="John Smith" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contact_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                            <Input className="pl-9" placeholder="(555) 123-4567" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                            <Input className="pl-9" placeholder="john@example.com" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-shrink-0 pt-4 border-t border-muted-gray/30 mt-4">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {isEditing ? 'Save Changes' : 'Create Location'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
