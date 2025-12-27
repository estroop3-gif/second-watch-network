import React from 'react';
import { SubmissionForm } from '@/components/forms/SubmissionForm';
import { UploadCloud, FileText, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const InstructionStep = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
  <div className="flex items-start gap-4">
    <div className="flex-shrink-0 text-accent-yellow mt-1">{icon}</div>
    <div>
      <h3 className="font-heading text-xl uppercase">{title}</h3>
      <div className="text-muted-gray font-sans normal-case">{children}</div>
    </div>
  </div>
);

const SubmitContent = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-4">
          Submit Your Content
        </h1>
        <p className="max-w-2xl mx-auto text-muted-gray font-sans normal-case text-lg">
          Short film, doc, mini-series, or something that doesn’t fit in a box? We want it.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 lg:gap-16">
        {/* Left Column: Instructions */}
        <div className="space-y-12">
          <Card className="bg-transparent border-0">
            <CardHeader>
              <CardTitle className="font-heading text-3xl uppercase text-accent-yellow">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <InstructionStep icon={<UploadCloud size={24} />} title="Step 1: Get Your Link">
                <p>Upload your video to YouTube, Vimeo, or Google Drive, then provide the link in the submission form below.</p>
              </InstructionStep>
              <InstructionStep icon={<FileText size={24} />} title="Step 2: Fill The Form">
                <p>Fill out the short form on this page with your details and the YouTube link.</p>
              </InstructionStep>
              <InstructionStep icon={<CheckCircle size={24} />} title="Step 3: Review & Relax">
                <p className="mb-2">We’ll review your content. If accepted, we’ll feature it on the site, in the 24/7 stream, and share it with our community.</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>You keep your channel and your IP.</li>
                  <li>If it runs on the 24/7 stream, you get 60% of the ad revenue based on watch time.</li>
                </ul>
              </InstructionStep>
            </CardContent>
          </Card>

          <Card className="bg-muted-gray/10 border-muted-gray/20">
            <CardHeader>
              <CardTitle className="font-heading text-3xl uppercase text-accent-yellow">Asset Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-gray font-sans normal-case">
              <p>
                If your content is selected, you’ll be required to submit basic promotional assets for inclusion in the 24/7 stream. These are mandatory:
              </p>
              <ul className="space-y-3 pl-2">
                <li>
                  <strong className="text-bone-white block">A horizontal key image or thumbnail (JPG or PNG)</strong>
                  <ul className="list-disc list-inside pl-4 text-sm mt-1">
                    <li>Minimum size: 1920 x 1080 pixels</li>
                    <li>Recommended aspect ratio: 16:9</li>
                  </ul>
                </li>
                <li>
                  <strong className="text-bone-white">A 1-line logline (used as a headline for your content)</strong>
                </li>
                <li>
                  <strong className="text-bone-white">A short description (1–3 sentences, used for stream display and promotions)</strong>
                </li>
              </ul>
              <p className="text-sm pt-4">
                Additional uploading instructions will be sent with your acceptance letter.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Form */}
        <div className="mt-12 lg:mt-0">
          <div className="lg:sticky top-24">
            <Card className="bg-muted-gray/10 border-muted-gray/20">
              <CardHeader className="text-center">
                <CardTitle className="font-heading text-3xl uppercase text-accent-yellow">Submission Form</CardTitle>
              </CardHeader>
              <CardContent>
                <SubmissionForm />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmitContent;