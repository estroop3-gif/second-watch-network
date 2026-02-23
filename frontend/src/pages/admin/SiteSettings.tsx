import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useFormDraftRHF } from '@/hooks/useFormDraftRHF';
import { buildDraftKey } from '@/lib/formDraftStorage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

const settingsSchema = z.object({
  site_title: z.string().min(1, "Site title is required."),
  site_description: z.string().min(1, "Site description is required."),
  platform_status: z.enum(['live', 'maintenance', 'coming_soon']),
  maintenance_message: z.string().optional(),
  landing_page_redirect: z.string().optional(),
  default_user_role: z.enum(['user', 'filmmaker']),
  required_signup_fields: z.array(z.string()).optional(),
  filmmaker_onboarding_enabled: z.boolean().optional(),
  global_admin_email: z.string().email("Please enter a valid email address."),
  primary_theme_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Please enter a valid HEX color code.").or(z.string().length(0)),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface Setting {
  key: string;
  value: { value: any };
}

const SiteSettings = () => {
  const queryClient = useQueryClient();
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['siteSettings'],
    queryFn: () => api.getSiteSettings(),
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    if (settings) {
      const settingsObject = settings.reduce((acc: any, setting: Setting) => {
        acc[setting.key] = setting.value.value;
        return acc;
      }, {} as any);
      form.reset(settingsObject);
    }
  }, [settings, form]);

  const { clearDraft } = useFormDraftRHF(form, {
    key: buildDraftKey('admin', 'settings', 'global'),
    enabled: !isLoading && !!settings,
  });

  const mutation = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      await api.updateSiteSettings(values);
    },
    onSuccess: () => {
      clearDraft();
      toast.success('Site settings updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['siteSettings'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  const onSubmit = (data: SettingsFormValues) => {
    mutation.mutate(data);
  };

  const platformStatus = form.watch('platform_status');
  const signupFields = [{ id: 'fullName', label: 'Full Name' }];

  if (isLoading) {
    return (
      <div>
        <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-8 -rotate-1">
          Site <span className="font-spray text-accent-yellow">Settings</span>
        </h1>
        <div className="space-y-8">
          <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (error) {
    toast.error(`Error loading settings: ${(error as Error).message}`);
    return <div>Error loading settings. Please try again later.</div>;
  }

  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-8 -rotate-1">
        Site <span className="font-spray text-accent-yellow">Settings</span>
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Set global SEO-friendly metadata and platform title.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="site_title" render={({ field }) => (
                <FormItem><FormLabel>Site Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="site_description" render={({ field }) => (
                <FormItem><FormLabel>Site Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="landing_page_redirect" render={({ field }) => (
                <FormItem>
                  <FormLabel>Landing Page Redirect</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a page" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="/">Default Landing Page</SelectItem>
                      <SelectItem value="/originals">Originals</SelectItem>
                      <SelectItem value="/submit">Submit Content</SelectItem>
                      <SelectItem value="/partners">Partners</SelectItem>
                      <SelectItem value="/watch-now">Watch Now</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose the page users see when they visit your site's main URL.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Platform Status</CardTitle>
              <CardDescription>Control the global status of the site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="platform_status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="coming_soon">Coming Soon</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {platformStatus === 'maintenance' && (
                <FormField control={form.control} name="maintenance_message" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maintenance Message</FormLabel>
                    <FormControl><Textarea placeholder="e.g., We'll be back in a few hours." {...field} /></FormControl>
                    <FormDescription>This message will be shown to users when the site is in maintenance mode.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Defaults</CardTitle>
              <CardDescription>Configure default settings for new user accounts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="default_user_role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Role for New Users</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="filmmaker">Filmmaker</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>This role will be assigned to all new users upon signup.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField
                control={form.control}
                name="required_signup_fields"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel>Required Fields on Signup</FormLabel>
                      <FormDescription>
                        Select which fields are mandatory. Email and password are always required.
                      </FormDescription>
                    </div>
                    <div className="space-y-2">
                      {signupFields.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="required_signup_fields"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={item.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), item.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== item.id
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {item.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="filmmaker_onboarding_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Enable Filmmaker Onboarding</FormLabel>
                      <FormDescription>
                        If enabled, new filmmakers must complete the onboarding process.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel of the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="primary_theme_color" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Theme Color</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-4">
                      <Input placeholder="#FBBF24" {...field} />
                      <div className="h-10 w-16 rounded-md border border-input" style={{ backgroundColor: field.value }} />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Enter a HEX code to change the primary accent color. To use this, ensure your Tailwind config uses the CSS variable: <code className="bg-muted p-1 rounded-sm text-xs">var(--primary-theme-color)</code>.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email & Notifications</CardTitle>
              <CardDescription>Manage system email configurations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="global_admin_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Global Admin Email</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormDescription>The address where system-level notifications (e.g., new user signups, errors) will be sent.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default SiteSettings;
