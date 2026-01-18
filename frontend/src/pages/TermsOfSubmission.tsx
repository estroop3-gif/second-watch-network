import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const TermsOfSubmission = () => {
  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Back Link */}
        <Link to="/submit">
          <Button variant="ghost" className="mb-8 text-muted-gray hover:text-bone-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Submit Content
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-heading tracking-tighter text-bone-white mb-4">
            Content Submission Terms and Conditions
          </h1>
          <p className="text-muted-gray">
            Last updated: January 2026
          </p>
        </div>

        {/* Terms Content */}
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <p className="text-bone-white/80 text-lg leading-relaxed">
              By submitting content to Second Watch Network ("SWN"), you agree to the following terms:
            </p>
          </section>

          <section className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-6">
            <h2 className="text-2xl font-heading text-accent-yellow mb-4">1. License Grant</h2>
            <p className="text-bone-white/80 leading-relaxed">
              You grant Second Watch Network a perpetual, worldwide, royalty-free, non-exclusive,
              sublicensable license to use, reproduce, modify, adapt, publish, translate, create
              derivative works from, distribute, publicly perform, and publicly display your
              submitted content ("Content") in any media format and through any media channels,
              including without limitation on SWN's 24/7 streaming platforms, websites, social
              media channels, promotional materials, and any future media platforms.
            </p>
          </section>

          <section className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-6">
            <h2 className="text-2xl font-heading text-accent-yellow mb-4">2. Representations and Warranties</h2>
            <p className="text-bone-white/80 leading-relaxed mb-4">
              You represent and warrant that:
            </p>
            <ul className="list-disc list-inside space-y-3 text-bone-white/80">
              <li>
                <strong>(a)</strong> You are the sole creator and owner of the Content, or have obtained all necessary
                rights, licenses, and permissions to grant the rights described herein;
              </li>
              <li>
                <strong>(b)</strong> The Content does not infringe upon any copyright, trademark, right of publicity,
                right of privacy, or any other intellectual property or proprietary right of any
                person or entity;
              </li>
              <li>
                <strong>(c)</strong> The Content does not contain any defamatory, libelous, or unlawful material;
              </li>
              <li>
                <strong>(d)</strong> You have obtained written consent from any identifiable individuals appearing
                in the Content.
              </li>
            </ul>
          </section>

          <section className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-6">
            <h2 className="text-2xl font-heading text-accent-yellow mb-4">3. Indemnification</h2>
            <p className="text-bone-white/80 leading-relaxed">
              You agree to indemnify, defend, and hold harmless Second Watch Network, its affiliates,
              officers, directors, employees, and agents from any claims, damages, losses, or expenses
              (including reasonable attorneys' fees) arising from your breach of these terms or
              any third-party claims relating to your Content.
            </p>
          </section>

          <section className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-6">
            <h2 className="text-2xl font-heading text-accent-yellow mb-4">4. No Obligation</h2>
            <p className="text-bone-white/80 leading-relaxed">
              SWN is under no obligation to use, feature, or display your Content. Selection for
              inclusion in SWN programming is at SWN's sole discretion.
            </p>
          </section>

          <section className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-6">
            <h2 className="text-2xl font-heading text-accent-yellow mb-4">5. Retention of Rights</h2>
            <p className="text-bone-white/80 leading-relaxed">
              You retain ownership of your Content. This agreement does not transfer ownership
              to SWN, but grants SWN the rights described in Section 1.
            </p>
          </section>

          <section className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-6">
            <h2 className="text-2xl font-heading text-accent-yellow mb-4">6. Governing Law</h2>
            <p className="text-bone-white/80 leading-relaxed">
              These terms shall be governed by the laws of the State of Georgia, USA.
            </p>
          </section>

          <section className="border-t border-muted-gray/30 pt-8 mt-8">
            <p className="text-bone-white/80 leading-relaxed text-lg">
              By checking the terms and conditions checkbox on the submission form, you acknowledge that you have read,
              understood, and agree to be bound by these Content Submission Terms and Conditions.
            </p>
          </section>

          <section className="pt-4">
            <p className="text-muted-gray text-sm">
              If you have any questions about these terms, please contact us at{" "}
              <a href="mailto:submissions@secondwatchnetwork.com" className="text-accent-yellow hover:underline">
                submissions@secondwatchnetwork.com
              </a>
            </p>
          </section>
        </div>

        {/* Back to Submit Button */}
        <div className="mt-12 pt-8 border-t border-muted-gray/30">
          <Link to="/submit">
            <Button className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Submit Content
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TermsOfSubmission;
