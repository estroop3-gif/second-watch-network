import React, { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useFormDraftRHF } from '@/hooks/useFormDraftRHF';
import { buildDraftKey } from '@/lib/formDraftStorage';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { invokeEdge } from "@/utils/invokeEdge";

const schema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  company_name: z.string().min(2, "Company/Brand name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional().or(z.literal("")),
  website_url: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type FormValues = z.infer<typeof schema>;

const PartnerApply = () => {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      company_name: "",
      email: "",
      phone: "",
      website_url: "",
      message: "",
    },
    mode: "onBlur",
  });

  const { clearDraft } = useFormDraftRHF(form, {
    key: buildDraftKey('partner', 'apply', 'new'),
  });

  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [refId, setRefId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (values: FormValues) => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    const { data, error } = await invokeEdge<{ id: string; status: string }>("partner-apply", { body: values });
    if (error) {
      setErrorMsg(error.message || "Unknown error");
      setErrorOpen(true);
      setSubmitting(false);
      return;
    }
    if (data?.id) {
      clearDraft();
      setRefId(data.id);
      setSuccessOpen(true);
      form.reset();
    } else {
      setErrorMsg("No ID returned");
      setErrorOpen(true);
    }
    setSubmitting(false);
  };

  const isBusy = submitting;
  const headerSubtitle = useMemo(() => "Apply to partner with Second Watch Network", []);

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-3 -rotate-1">
          Become a <span className="font-spray">Partner</span>
        </h1>
        <p className="max-w-2xl mx-auto text-muted-gray font-sans normal-case text-lg">
          {headerSubtitle}
        </p>
      </div>

      <div className="max-w-4xl mx-auto mb-10">
        <Card className="bg-muted-gray/10 border-muted-gray/20">
          <CardContent className="pt-6 space-y-6">
            <h2 className="font-heading text-2xl md:text-3xl text-accent-yellow">
              We&apos;re not a platform. We&apos;re a movement.
            </h2>
            <div className="space-y-2">
              <h3 className="font-heading text-lg uppercase text-bone-white">Why Partner With Us?</h3>
              <p className="text-muted-gray">
                Second Watch Network is redefining what it means to support creators. We champion raw, unfiltered
                storytelling — and we partner with brands that want to align with authenticity, not algorithms. If you
                believe in independent voices and creator-first culture, we want to build with you.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-heading text-lg uppercase text-bone-white">What We Offer</h3>
              <ul className="list-disc pl-5 text-bone-white/90 space-y-1">
                <li>Sponsored content and show integrations</li>
                <li>24/7 stream ad placement</li>
                <li>Product placement in docu-series</li>
                <li>Creator-led brand campaigns</li>
                <li>Social rollouts and cross-promotion</li>
                <li>Custom pitch opportunities based on your brand&apos;s mission</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="bg-muted-gray/10 border-muted-gray/20">
          <CardHeader>
            <CardTitle className="font-heading text-2xl md:text-3xl uppercase text-accent-yellow">
              Application Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8" aria-busy={isBusy}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="full_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input {...field} placeholder="Alex Doe" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="company_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company / Brand</FormLabel>
                      <FormControl><Input {...field} placeholder="Awesome Brand Inc." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" {...field} placeholder="alex@brand.com" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (optional)</FormLabel>
                      <FormControl><Input {...field} placeholder="(555) 123-4567" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="website_url" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website (optional)</FormLabel>
                      <FormControl><Input {...field} placeholder="https://yourbrand.com" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-[120px]"
                        placeholder="Describe your brand, goals, and confirm consent to be contacted by Second Watch Network."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="pt-2 flex">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isBusy}
                    aria-disabled={isBusy}
                    className="w-full md:w-auto ml-auto bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    {isBusy ? "Submitting…" : "Submit Application"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="bg-charcoal-black text-bone-white border-muted-gray max-w-md">
          <DialogHeader>
            <DialogTitle className="text-accent-yellow">Thanks for applying</DialogTitle>
            <DialogDescription>We'll review and email you soon.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {refId && (
              <p className="text-sm text-muted-foreground">
                Reference ID: <span className="font-mono">{refId}</span>
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button asChild variant="outline">
                <Link to="/">Back to Home</Link>
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
            <DialogTitle>Error submitting application</DialogTitle>
            <DialogDescription>
              {errorMsg || "This may be a temporary issue. Please try again."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setErrorOpen(false)}>Close</Button>
            <Button className="bg-accent-yellow text-charcoal-black hover:bg-bone-white" onClick={() => setErrorOpen(false)}>
              Retry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerApply;