/**
 * OnboardingDocumentView - PDF viewer wrapper for onboarding wizard
 */
import { DealMemoPDFPreview } from '../DealMemoPDFPreview';

interface OnboardingDocumentViewProps {
  pdfUrl: string | null;
  title?: string;
}

export function OnboardingDocumentView({ pdfUrl, title }: OnboardingDocumentViewProps) {
  return (
    <DealMemoPDFPreview
      pdfUrl={pdfUrl}
      title={title}
      inline
      height={500}
    />
  );
}
