import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { toast } from 'sonner';
import { Clapperboard, Loader2, CheckCircle2, ChevronsUpDown, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  referred_by_rep_id: z.string().optional(),
  consent_contact: z.literal(true, {
    errorMap: () => ({ message: 'You must consent to being contacted' }),
  }),
});

type FormData = z.infer<typeof formSchema>;

const BacklotFreeTrial = () => {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reps, setReps] = useState<{ id: string; full_name: string }[]>([]);
  const [repPopoverOpen, setRepPopoverOpen] = useState(false);

  useEffect(() => {
    api.getSalesRepsPublic().then((res) => setReps(res.reps || [])).catch(() => {});
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      referred_by_rep_id: undefined,
      consent_contact: false as any,
    },
    mode: 'onBlur',
  });

  const selectedRepId = form.watch('referred_by_rep_id');
  const selectedRep = reps.find((r) => r.id === selectedRepId);

  const onSubmit = async (values: FormData) => {
    setSubmitting(true);
    try {
      await api.submitBacklotTrial(values);
      setSubmitted(true);
    } catch (err: any) {
      const msg = err?.message || 'Something went wrong. Please try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h1 className="text-3xl font-heading font-bold text-bone-white">
            Thank You!
          </h1>
          <p className="text-bone-white/70 text-lg">
            A member of our team will be in touch shortly to get you started with your Backlot free trial.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Clapperboard className="h-8 w-8 text-accent-yellow" />
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-bone-white">
              Backlot <span className="text-accent-yellow">Free Trial</span>
            </h1>
          </div>
          <p className="text-bone-white/70 max-w-md mx-auto">
            Professional production management tools — call sheets, budgets, casting, clearances, and more. Try it free.
          </p>
        </div>

        {/* Form */}
        <div className="bg-gray-900/50 border border-muted-gray/30 rounded-lg p-6 md:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-bone-white/80">First Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="First name"
                          className="bg-charcoal-black border-muted-gray/40 text-bone-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-bone-white/80">Last Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Last name"
                          className="bg-charcoal-black border-muted-gray/40 text-bone-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white/80">Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="you@example.com"
                        className="bg-charcoal-black border-muted-gray/40 text-bone-white"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white/80">Phone</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="(555) 123-4567"
                        className="bg-charcoal-black border-muted-gray/40 text-bone-white"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sales Rep Referral Dropdown */}
              {reps.length > 0 && (
                <FormField
                  control={form.control}
                  name="referred_by_rep_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-bone-white/80">Who referred you?</FormLabel>
                      <div className="flex items-center gap-2">
                        <Popover open={repPopoverOpen} onOpenChange={setRepPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={repPopoverOpen}
                                className={cn(
                                  'w-full justify-between bg-charcoal-black border-muted-gray/40 text-bone-white hover:bg-charcoal-black hover:text-bone-white',
                                  !field.value && 'text-bone-white/50'
                                )}
                              >
                                {selectedRep ? selectedRep.full_name : 'Select a sales rep...'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-charcoal-black border-muted-gray/40" align="start">
                            <Command className="bg-charcoal-black">
                              <CommandInput placeholder="Search reps..." className="text-bone-white" />
                              <CommandList>
                                <CommandEmpty className="text-bone-white/50 py-3 text-center text-sm">No reps found.</CommandEmpty>
                                <CommandGroup>
                                  {reps.map((rep) => (
                                    <CommandItem
                                      key={rep.id}
                                      value={rep.full_name}
                                      onSelect={() => {
                                        field.onChange(rep.id);
                                        setRepPopoverOpen(false);
                                      }}
                                      className="text-bone-white/80 cursor-pointer"
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          field.value === rep.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      {rep.full_name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {field.value && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-bone-white/50 hover:text-bone-white"
                            onClick={() => field.onChange(undefined)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="consent_contact"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-bone-white/70 text-sm font-normal cursor-pointer">
                        I consent to being contacted by email or phone by Second Watch Network regarding the Backlot.
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white font-bold rounded-[4px] uppercase py-5 text-base"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Request Free Trial'
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default BacklotFreeTrial;
