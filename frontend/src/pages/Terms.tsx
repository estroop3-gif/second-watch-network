import React from 'react';

const Terms = () => {
  return (
    <div className="container mx-auto px-4 max-w-3xl py-12">
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-12 text-center -rotate-1">
        Terms of Use
      </h1>
      <div className="space-y-8 font-sans normal-case text-muted-gray leading-relaxed">
        <div className="space-y-2">
          <h2 className="text-2xl font-heading text-bone-white">1. Submission Agreement</h2>
          <p>By submitting content to Second Watch Network, you agree to the following terms. If you do not agree, do not submit content.</p>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-heading text-bone-white">2. You Retain Ownership</h2>
          <p>You keep full ownership of the content you submit. We do not claim copyright or exclusive control of your original work.</p>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-heading text-bone-white">3. Right to Use</h2>
          <p>By submitting content (e.g., videos, series, short films, music videos, etc.), you grant Second Watch Network a non-exclusive, royalty-free, worldwide license to:</p>
          <ul className="list-disc list-inside pl-4 space-y-1">
            <li>Embed and display your content on our website and network</li>
            <li>Include it in our 24/7 livestream</li>
            <li>Use it in marketing, editorial, promotional, and social materials</li>
            <li>Edit or modify the video only for formatting or presentation purposes (e.g., trimming bumpers or fitting stream specs)</li>
          </ul>
          <p>This license remains in effect unless you formally request removal (see Section 7).</p>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-heading text-bone-white">4. Revenue Share</h2>
          <p>If your content is featured in our monetized 24/7 livestream, you are eligible to receive 60% of the ad revenue based on watch time. Revenue is calculated based on airtime and performance within the stream.</p>
          <p>Additional paid opportunities may be offered on a per-project basis.</p>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-heading text-bone-white">5. Your Responsibility</h2>
          <p>You confirm that:</p>
          <ul className="list-disc list-inside pl-4 space-y-1">
            <li>You own all rights to the content you submit (including music, footage, and likenesses)</li>
            <li>Your content does not infringe on any third-party rights or violate any laws</li>
            <li>You’ve received all necessary releases, permissions, and licenses</li>
          </ul>
          <p>If any legal issues arise, you agree to indemnify and hold Second Watch Network harmless.</p>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-heading text-bone-white">6. Right to Refuse or Remove</h2>
          <p>We reserve the right to refuse submissions that don't meet quality, legal, or brand standards — or to remove published content at any time for any reason. However, we are committed to working with creators, not against them.</p>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-heading text-bone-white">7. Requesting Removal</h2>
          <p>If you want your content removed from Second Watch Network or the 24/7 stream, email us at [insert email]. Please allow up to 14 business days for complete removal across platforms.</p>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-heading text-bone-white">8. Changes to These Terms</h2>
          <p>We may update these terms at any time. We'll notify you if significant changes affect your rights or submissions.</p>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-heading text-bone-white">9. Questions</h2>
          <p>We’re a creator-first platform. If you have questions, reach out to us at [insert email].</p>
        </div>
      </div>
    </div>
  );
};

export default Terms;