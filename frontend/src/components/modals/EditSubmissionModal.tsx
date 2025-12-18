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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

type Submission = {
  id: string;
  project_title: string;
  status: string;
  project_type: string;
  created_at: string;
  name: string;
  email: string;
  logline: string;
  description: string;
  youtube_link: string;
};

const projectTypes = ["Short Film", "Documentary", "Web Series", "Animation", "Music Video", "Experimental", "Other"];

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  projectTitle: z.string().min(3, "Project title is required."),
  project_type: z.string().min(1, "Please select a project type."),
  logline: z.string().min(10, "Logline must be at least 10 characters.").max(150, "Logline must be 150 characters or less."),
  description: z.string().min(10, "Description must be at least 10 characters.").max(500, "Description must be 500 characters or less."),
  youtubeLink: z.string().url("Please enter a valid YouTube URL."),
});

interface EditSubmissionModalProps {
  submission: Submission | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmissionUpdated: () => void;
}

export function EditSubmissionModal({ submission, isOpen, onOpenChange, onSubmissionUpdated }: EditSubmissionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      projectTitle: "",
      project_type: "",
      logline: "",
      description: "",
      youtubeLink: "",
    },
  });

  useEffect(() => {
    if (submission) {
      form.reset({
        name: submission.name,
        email: submission.email,
        projectTitle: submission.project_title,
        project_type: submission.project_type,
        logline: submission.logline,
        description: submission.description,
        youtubeLink: submission.youtube_link,
      });
    }
  }, [submission, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!submission) return;

    setIsSubmitting(true);
    const updatedData = {
      name: values.name,
      email: values.email,
      project_title: values.projectTitle,
      project_type: values.project_type,
      logline: values.logline,
      description: values.description,
      youtube_link: values.youtubeLink,
    };

    try {
      await api.updateSubmission(submission.id, updatedData);
      toast.success("Submission updated successfully!");
      onSubmissionUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Update failed: ${error?.message || 'Unknown error'}`);
    }
    setIsSubmitting(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-3xl uppercase text-accent-yellow">Edit Submission</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Make changes to your project submission below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="projectTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-heading uppercase text-bone-white text-xs">Project Title</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-muted-gray/10 border-muted-gray focus:border-accent-yellow" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-heading uppercase text-bone-white text-xs">Name / Team Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-muted-gray/10 border-muted-gray focus:border-accent-yellow" />
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
                    <FormLabel className="font-heading uppercase text-bone-white text-xs">Contact Email</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-muted-gray/10 border-muted-gray focus:border-accent-yellow" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="project_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-heading uppercase text-bone-white text-xs">Project Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-muted-gray/10 border-muted-gray focus:border-accent-yellow">
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
                  <FormLabel className="font-heading uppercase text-bone-white text-xs">Logline</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-muted-gray/10 border-muted-gray focus:border-accent-yellow" />
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
                  <FormLabel className="font-heading uppercase text-bone-white text-xs">Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="bg-muted-gray/10 border-muted-gray focus:border-accent-yellow" />
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
                  <FormLabel className="font-heading uppercase text-bone-white text-xs">YouTube Link</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-muted-gray/10 border-muted-gray focus:border-accent-yellow" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSubmitting} className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
