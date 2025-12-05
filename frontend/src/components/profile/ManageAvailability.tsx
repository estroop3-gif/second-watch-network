import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Availability } from '@/types';
import { AccountSection } from '@/components/account/AccountSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Trash2, PlusCircle, CalendarIcon, Eye, EyeOff } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import AvailabilityCalendar from './AvailabilityCalendar';

const availabilitySchema = z.object({
  start_date: z.date({ required_error: "A start date is required." }),
  end_date: z.date({ required_error: "An end date is required." }),
  notes: z.string().max(200, "Notes must be 200 characters or less.").optional(),
}).refine(data => data.end_date >= data.start_date, {
  message: "End date cannot be before start date.",
  path: ["end_date"],
});

type AvailabilityFormValues = z.infer<typeof availabilitySchema>;

const ManageAvailability = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCalendar, setShowCalendar] = useState(true);

  const fetchAvailability = async () => {
    if (!user) return [];
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: true });
    if (error) throw new Error(error.message);
    return data as Availability[];
  };

  const { data: availabilities, isLoading } = useQuery({
    queryKey: ['availability', user?.id],
    queryFn: fetchAvailability,
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (newAvailability: AvailabilityFormValues) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from('availability').insert({
        user_id: user.id,
        ...newAvailability,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['public_availability', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardStats'] });
      toast.success("Availability added!");
      form.reset();
    },
    onError: (error) => {
      toast.error(`Failed to add availability: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('availability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['public_availability', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardStats'] });
      toast.success("Availability removed.");
    },
    onError: (error) => {
      toast.error(`Failed to remove availability: ${error.message}`);
    },
  });

  const form = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilitySchema),
  });

  const onSubmit = (data: AvailabilityFormValues) => {
    addMutation.mutate(data);
  };

  return (
    <AccountSection title="Manage Availability" description="Add date ranges when you are available for work. This will be displayed on your public profile.">
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="space-y-8">
          <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardContent className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="start_date" render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel>Start Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="end_date" render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel>End Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Available for local shoots only" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={addMutation.isPending}>
                      {addMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                      Add Availability
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div>
            <h4 className="text-lg font-semibold mb-4">Your Upcoming Availability</h4>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : availabilities && availabilities.length > 0 ? (
              <ul className="space-y-3">
                {availabilities.map(item => (
                  <li key={item.id} className="flex items-center justify-between p-3 bg-charcoal-black rounded-md border border-muted-gray/20">
                    <div>
                      <p className="font-semibold">{format(new Date(item.start_date), 'MMM d, yyyy')} - {format(new Date(item.end_date), 'MMM d, yyyy')}</p>
                      {item.notes && <p className="text-sm text-muted-gray">{item.notes}</p>}
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending && deleteMutation.variables === item.id}>
                      {deleteMutation.isPending && deleteMutation.variables === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-muted-gray py-8">You haven't added any availability yet.</p>
            )}
          </div>
        </div>
        <div className="sticky top-24">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold">Calendar View</h4>
              <Button variant="ghost" size="icon" onClick={() => setShowCalendar(!showCalendar)}>
                {showCalendar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showCalendar ? 'Hide Calendar' : 'Show Calendar'}</span>
              </Button>
            </div>
             {showCalendar && (
                isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                  <AvailabilityCalendar availabilities={availabilities || []} />
              )
            )}
        </div>
      </div>
    </AccountSection>
  );
};

export default ManageAvailability;