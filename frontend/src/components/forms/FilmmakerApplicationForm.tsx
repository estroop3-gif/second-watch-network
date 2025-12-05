"use client";

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { experienceLevels, filmmakerSkills } from '@/data/filmmaker-options';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const projectSchema = z.object({
  title: z.string().min(1, 'Project title is required.'),
  role: z.string().min(1, 'Your role is required.'),
  link: z.string().url('Must be a valid URL.').optional().or(z.literal('')),
  description: z.string().min(1, 'Description is required.'),
});

const applicationSchema = z.object({
  fullName: z.string().min(1, 'Full name is required.'),
  displayName: z.string().min(1, 'Display name is required.'),
  email: z.string().email(),
  location: z.string().min(1, 'City & State is required.'),
  portfolioLink: z.string().url('Must be a valid URL.'),
  professionalProfileLink: z.string().url('Must be a valid URL.').optional().or(z.literal('')),
  yearsOfExperience: z.string().min(1, 'Years of experience is required.'),
  primaryRoles: z.array(z.string()).min(1, 'At least one primary role is required.'),
  topProjects: z.array(projectSchema).max(3, 'You can add up to 3 projects.'),
  joinReason: z.string().min(20, 'Please provide a brief reason.'),
});

interface FilmmakerApplicationFormProps {
  onSuccess: () => void;
}

const FilmmakerApplicationForm = ({ onSuccess }: FilmmakerApplicationFormProps) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof applicationSchema>>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      fullName: '',
      displayName: '',
      email: '',
      location: '',
      portfolioLink: '',
      professionalProfileLink: '',
      yearsOfExperience: '',
      primaryRoles: [],
      topProjects: [{ title: '', role: '', link: '', description: '' }],
      joinReason: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'topProjects',
  });

  useEffect(() => {
    if (user) {
      form.setValue('email', user.email || '');
    }
    if (profile) {
      form.setValue('fullName', profile.full_name || '');
      form.setValue('displayName', profile.display_name || profile.username || '');
    }
  }, [user, profile, form]);

  const onSubmit = async (values: z.infer<typeof applicationSchema>) => {
    if (!user) {
      toast.error('You must be logged in to apply.');
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.from('filmmaker_applications').insert({
      user_id: user.id,
      full_name: values.fullName,
      display_name: values.displayName,
      email: values.email,
      location: values.location,
      portfolio_link: values.portfolioLink,
      professional_profile_link: values.professionalProfileLink,
      years_of_experience: values.yearsOfExperience,
      primary_roles: values.primaryRoles,
      top_projects: values.topProjects,
      join_reason: values.joinReason,
    });

    setIsLoading(false);
    if (error) {
      toast.error('Failed to submit application: ' + error.message);
    } else {
      toast.success('Application submitted! We will review it shortly.');
      onSuccess();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FormField control={form.control} name="fullName" render={({ field }) => (
            <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="displayName" render={({ field }) => (
            <FormItem><FormLabel>Display Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} readOnly className="bg-gray-800" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="location" render={({ field }) => (
          <FormItem><FormLabel>City & State</FormLabel><FormControl><Input {...field} placeholder="e.g., Los Angeles, CA" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="portfolioLink" render={({ field }) => (
          <FormItem><FormLabel>Link to Reel or Portfolio</FormLabel><FormControl><Input {...field} placeholder="https://vimeo.com/your-reel" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="professionalProfileLink" render={({ field }) => (
          <FormItem><FormLabel>Link to IMDb, StaffMeUp, etc. (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FormField control={form.control} name="yearsOfExperience" render={({ field }) => (
            <FormItem><FormLabel>Years of Experience</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select your experience level" /></SelectTrigger></FormControl><SelectContent>{experienceLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="primaryRoles" render={({ field }) => (
            <FormItem><FormLabel>Primary Roles</FormLabel><FormControl><TagInput {...field} placeholder="Enter roles..." tags={field.value} setTags={(newTags) => field.onChange(newTags)} enableAutocomplete autocompleteOptions={filmmakerSkills.map(s => ({ id: s, text: s }))} /></FormControl><FormDescription>Search or type to add custom roles.</FormDescription><FormMessage /></FormItem>
          )} />
        </div>

        <div>
          <h3 className="text-xl font-bold mb-4">Top 3 Projects</h3>
          <div className="space-y-6">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border border-muted-gray rounded-lg relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name={`topProjects.${index}.title`} render={({ field }) => (
                    <FormItem><FormLabel>Project Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`topProjects.${index}.role`} render={({ field }) => (
                    <FormItem><FormLabel>Your Role</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name={`topProjects.${index}.link`} render={({ field }) => (
                  <FormItem className="mt-4"><FormLabel>Link (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name={`topProjects.${index}.description`} render={({ field }) => (
                  <FormItem className="mt-4"><FormLabel>Brief Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                {fields.length > 1 && (
                  <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
            ))}
          </div>
          {fields.length < 3 && (
            <Button type="button" variant="outline" onClick={() => append({ title: '', role: '', link: '', description: '' })} className="mt-4">Add Another Project</Button>
          )}
        </div>

        <FormField control={form.control} name="joinReason" render={({ field }) => (
          <FormItem><FormLabel>Why do you want to join Second Watch Network as a filmmaker?</FormLabel><FormControl><Textarea {...field} rows={5} /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isLoading} className="w-full">{isLoading ? 'Submitting...' : 'Submit Application'}</Button>
        </div>
      </form>
    </Form>
  );
};

export default FilmmakerApplicationForm;