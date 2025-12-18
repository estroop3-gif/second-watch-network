"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

const projectTypes = ["Short Film", "Documentary", "Web Series", "Animation", "Music Video", "Experimental", "Other"];

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  projectTitle: z.string().min(3, "Project title is required."),
  project_type: z.string().min(1, "Please select a project type."),
  logline: z.string().min(10, "Logline must be at least 10 characters.").max(150, "Logline must be 150 characters or less."),
  description: z.string().min(10, "Description must be at least 10 characters.").max(500, "Description must be 500 characters or less."),
  youtubeLink: z.string().url("Please enter a valid YouTube URL."),
  permission: z.boolean().refine((val) => val === true, {
    message: "You must grant permission to be considered.",
  }),
});

export function SubmissionForm() {
  const { session, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: (user as any)?.username || (user as any)?.full_name || "",
      email: (user as any)?.email || "",
      projectTitle: "",
      project_type: "",
      logline: "",
      description: "",
      youtubeLink: "",
      permission: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const submissionData = {
      name: values.name,
      email: values.email,
      project_title: values.projectTitle,
      project_type: values.project_type,
      logline: values.logline,
      description: values.description,
      youtube_link: values.youtubeLink,
      status: 'Pending',
    };

    try {
      await api.createSubmission(user?.id || '', submissionData);
      toast.success("Submission received! We'll be in touch.");
      form.reset();
    } catch (error: any) {
      toast.error(`Submission failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-heading uppercase text-bone-white">Name / Team Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Jane Doe" {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-heading uppercase text-bone-white">Contact Email</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. jane.doe@email.com" {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="projectTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-heading uppercase text-bone-white">Project Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. The Last Donut" {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="project_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-heading uppercase text-bone-white">Project Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray focus:border-accent-yellow">
                    <SelectValue placeholder="Select a project type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-charcoal-black border-muted-gray text-bone-white">
                  {projectTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="logline"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-heading uppercase text-bone-white">Logline (1 sentence)</FormLabel>
              <FormControl>
                <Input placeholder="A brief, catchy summary of your project." {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-heading uppercase text-bone-white">Description (1-3 sentences)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us what your project is about..."
                  {...field}
                  className="bg-charcoal-black border-muted-gray focus:border-accent-yellow"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="youtubeLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-heading uppercase text-bone-white">YouTube Link</FormLabel>
              <FormControl>
                <Input placeholder="https://www.youtube.com/watch?v=..." {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="permission"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-muted-gray p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="border-bone-white data-[state=checked]:bg-accent-yellow data-[state=checked]:text-charcoal-black"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="font-sans normal-case text-bone-white">
                  I give Second Watch Network permission to embed this video and feature it in the 24/7 stream if selected.
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 disabled:opacity-50">
          {isSubmitting ? "Submitting..." : "Submit My Content"}
        </Button>
      </form>
    </Form>
  );
}
