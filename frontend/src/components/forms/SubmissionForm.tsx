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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";
import { InlineAuthModal } from "@/components/auth/InlineAuthModal";

const projectTypes = [
  "Short Film",
  "Documentary",
  "Web Series",
  "Animation",
  "Music Video",
  "Experimental",
  "Other"
];

const submitterRoles = [
  { value: "director", label: "Director" },
  { value: "producer", label: "Producer" },
  { value: "writer", label: "Writer" },
  { value: "cinematographer", label: "Cinematographer" },
  { value: "editor", label: "Editor" },
  { value: "other", label: "Other" },
];

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  projectTitle: z.string().min(3, "Project title is required."),
  project_type: z.string().min(1, "Please select a project type."),
  logline: z.string().min(10, "Logline must be at least 10 characters.").max(150, "Logline must be 150 characters or less."),
  description: z.string().min(10, "Description must be at least 10 characters.").max(500, "Description must be 500 characters or less."),
  youtubeLink: z.string().url("Please enter a valid YouTube URL."),
  // New professional fields
  companyName: z.string().optional(),
  submitterRole: z.string().optional(),
  yearsExperience: z.coerce.number().min(0).max(50).optional().or(z.literal("")),
  // Replace permission with terms
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms and Conditions to submit.",
  }),
});

export type SubmissionFormValues = z.infer<typeof formSchema>;

interface SubmissionFormProps {
  onSubmitSuccess?: () => void;
  onAuthRequired?: (formData: SubmissionFormValues) => void;
}

export function SubmissionForm({ onSubmitSuccess, onAuthRequired }: SubmissionFormProps) {
  const { session, user, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<SubmissionFormValues | null>(null);

  const form = useForm<SubmissionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      projectTitle: "",
      project_type: "",
      logline: "",
      description: "",
      youtubeLink: "",
      companyName: "",
      submitterRole: "",
      yearsExperience: "",
      termsAccepted: false,
    },
  });

  // Pre-fill form with user data when authenticated
  useEffect(() => {
    if (profile) {
      const currentValues = form.getValues();
      if (!currentValues.name) {
        form.setValue("name", profile.full_name || profile.username || "");
      }
      if (!currentValues.email) {
        form.setValue("email", profile.email || "");
      }
    }
  }, [profile, form]);

  const handleSubmission = async (values: SubmissionFormValues) => {
    setIsSubmitting(true);

    const submissionData = {
      name: values.name,
      email: values.email,
      project_title: values.projectTitle,
      project_type: values.project_type,
      logline: values.logline,
      description: values.description,
      youtube_link: values.youtubeLink,
      company_name: values.companyName || null,
      submitter_role: values.submitterRole || null,
      years_experience: values.yearsExperience ? Number(values.yearsExperience) : null,
      terms_accepted: values.termsAccepted,
    };

    try {
      await api.createSubmission(submissionData);
      toast.success("Submission received! We'll be in touch.");
      form.reset();
      onSubmitSuccess?.();
    } catch (error: any) {
      if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
        toast.error("Please sign in to submit content.");
        setPendingFormData(values);
        setShowAuthModal(true);
      } else {
        toast.error(`Submission failed: ${error.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  async function onSubmit(values: SubmissionFormValues) {
    // Check if user is authenticated
    if (!session) {
      setPendingFormData(values);
      setShowAuthModal(true);
      onAuthRequired?.(values);
      return;
    }

    await handleSubmission(values);
  }

  const handleAuthSuccess = async () => {
    setShowAuthModal(false);
    if (pendingFormData) {
      // Re-submit with the pending form data after authentication
      await handleSubmission(pendingFormData);
      setPendingFormData(null);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info Section */}
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

          {/* Professional Info Section */}
          <div className="border border-muted-gray/30 rounded-lg p-4 space-y-4">
            <p className="text-sm text-muted-gray font-medium uppercase tracking-wide">Professional Info (Optional)</p>
            <div className="grid md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white text-sm">Company / Studio</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Indie Films LLC" {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="submitterRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white text-sm">Your Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-charcoal-black border-muted-gray focus:border-accent-yellow">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-charcoal-black border-muted-gray text-bone-white">
                        {submitterRoles.map(role => (
                          <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="yearsExperience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white text-sm">Years of Experience</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="50"
                        placeholder="e.g. 5"
                        {...field}
                        value={field.value ?? ""}
                        className="bg-charcoal-black border-muted-gray focus:border-accent-yellow"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Project Info Section */}
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
                <Select onValueChange={field.onChange} value={field.value}>
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
                <FormDescription className="text-muted-gray text-xs">
                  {field.value?.length || 0}/150 characters
                </FormDescription>
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
                <FormDescription className="text-muted-gray text-xs">
                  {field.value?.length || 0}/500 characters
                </FormDescription>
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

          {/* Terms and Conditions */}
          <FormField
            control={form.control}
            name="termsAccepted"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-muted-gray p-4 bg-charcoal-black/50">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="border-bone-white data-[state=checked]:bg-accent-yellow data-[state=checked]:text-charcoal-black mt-1"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="font-sans normal-case text-bone-white">
                    I agree to the{" "}
                    <Link
                      to="/terms-of-submission"
                      target="_blank"
                      className="text-accent-yellow hover:underline inline-flex items-center gap-1"
                    >
                      Terms and Conditions
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </FormLabel>
                  <p className="text-xs text-muted-gray">
                    By checking this box, you grant Second Watch Network a perpetual, worldwide license to use your submitted content.
                  </p>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          {/* Auth Status Message */}
          {!session && (
            <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg p-4">
              <p className="text-sm text-accent-yellow">
                You'll need to sign in or create a free account to submit your content. Don't worry - your form data will be preserved!
              </p>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : session ? (
              "Submit My Content"
            ) : (
              "Sign In & Submit"
            )}
          </Button>
        </form>
      </Form>

      {/* Auth Modal */}
      <InlineAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={handleAuthSuccess}
        title="Sign in to submit"
        description="Create a free account or sign in to submit your content. Your form data has been saved."
      />
    </>
  );
}

export default SubmissionForm;
