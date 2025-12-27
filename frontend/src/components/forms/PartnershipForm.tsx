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
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { invokeEdge } from "@/utils/invokeEdge";

const formSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  company_name: z.string().min(2, "Brand/Company name is required."),
  message: z.string().min(10, "Message must be at least 10 characters.").max(500, "Message must be 500 characters or less."),
});

type FormValues = z.infer<typeof formSchema>;

export function PartnershipForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      email: "",
      company_name: "",
      message: "",
    },
  });

  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [refId, setRefId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(values: FormValues) {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    const { data, error } = await invokeEdge<{ id: string; status: string }>("partner-apply", { body: values });
    if (error) {
      setErrorMsg(error.message || "An unknown error occurred. Please try again.");
      setErrorOpen(true);
      setSubmitting(false);
      return;
    }

    if (data?.id) {
      setRefId(data.id);
      setSuccessOpen(true);
      form.reset();
    } else {
      setErrorMsg("Submission failed: No ID returned from server.");
      setErrorOpen(true);
    }
    setSubmitting(false);
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-heading uppercase text-bone-white">Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Alex Doe" {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
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
                  <FormLabel className="font-heading uppercase text-bone-white">Email</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. alex@brand.com" {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="company_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-heading uppercase text-bone-white">Brand / Company</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Awesome Brand Inc." {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-heading uppercase text-bone-white">Message</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us a bit about your brand and what you're looking for..."
                    {...field}
                    className="bg-charcoal-black border-muted-gray focus:border-accent-yellow"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" disabled={submitting} className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:-rotate-2">
            {submitting ? "Submitting..." : "Start the Conversation"}
          </Button>
        </form>
      </Form>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="bg-charcoal-black text-bone-white border-muted-gray max-w-md">
          <DialogHeader>
            <DialogTitle className="text-accent-yellow">Thanks for applying</DialogTitle>
            <DialogDescription>We'll review your application and be in touch soon.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {refId && (
              <p className="text-sm text-muted-foreground">
                Reference ID: <span className="font-mono">{refId}</span>
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSuccessOpen(false)}>
                Close
              </Button>
              <Button asChild className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
                <Link to="/signup">Create an Account</Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
        <DialogContent className="bg-charcoal-black text-bone-white border-muted-gray max-w-md">
          <DialogHeader>
            <DialogTitle>Error Submitting Application</DialogTitle>
            <DialogDescription>
              {errorMsg || "This may be a temporary issue. Please try again."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setErrorOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}