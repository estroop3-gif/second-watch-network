/**
 * OnboardingStepRenderer - Renders step content based on type
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DealMemoPDFPreview } from '../DealMemoPDFPreview';
import { SignaturePad, SignatureType } from '../SignaturePad';
import { FormFieldRenderer, FormFieldSchema } from './FormFieldRenderer';
import { FileText, Pen, ClipboardList, CheckCircle2, Loader2 } from 'lucide-react';
import type { OnboardingStep } from '@/hooks/backlot/useOnboarding';

interface OnboardingStepRendererProps {
  step: OnboardingStep;
  onComplete: (data: { formData?: Record<string, unknown>; signatureData?: string }) => Promise<void>;
  onSaveProgress?: (formData: Record<string, unknown>) => void;
  isCompleting?: boolean;
}

export function OnboardingStepRenderer({
  step,
  onComplete,
  onSaveProgress,
  isCompleting,
}: OnboardingStepRendererProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(step.form_data || {});
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<SignatureType>('draw');
  const [saveToProfile, setSaveToProfile] = useState<Set<string>>(new Set());

  // Auto-save debounce
  useEffect(() => {
    if (step.step_type !== 'form_fill' || !onSaveProgress) return;
    const timer = setTimeout(() => {
      onSaveProgress(formData);
    }, 2000);
    return () => clearTimeout(timer);
  }, [formData, step.step_type, onSaveProgress]);

  const handleFieldChange = (name: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleComplete = async () => {
    await onComplete({
      formData: step.step_type === 'form_fill' ? formData : undefined,
      signatureData: signatureData || undefined,
    });
  };

  const canComplete = () => {
    if (step.step_type === 'deal_memo_review') return !!signatureData;
    if (step.step_type === 'document_sign') return !!signatureData;
    if (step.step_type === 'form_fill') {
      // Check required fields
      return step.form_fields.every(f => !f.required || formData[f.name]);
    }
    return true;
  };

  if (step.status === 'completed') {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-medium">Step Completed</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Document review steps */}
      {(step.step_type === 'deal_memo_review' || step.step_type === 'document_sign') && (
        <>
          {step.document_url && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {step.document_title || 'Document'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DealMemoPDFPreview pdfUrl={step.document_url} inline height={400} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Pen className="w-4 h-4" />
                Signature Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SignaturePad
                onSignatureChange={(data, type) => {
                  setSignatureData(data);
                  setSignatureType(type);
                }}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Form fill step */}
      {step.step_type === 'form_fill' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Fill in Required Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FormFieldRenderer
              fields={step.form_fields}
              values={formData}
              onChange={handleFieldChange}
              saveToProfileFields={saveToProfile}
              onToggleSaveToProfile={(name, save) => {
                setSaveToProfile(prev => {
                  const next = new Set(prev);
                  save ? next.add(name) : next.delete(name);
                  return next;
                });
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Complete button */}
      <Button
        className="w-full"
        size="lg"
        onClick={handleComplete}
        disabled={!canComplete() || isCompleting}
      >
        {isCompleting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4 mr-2" />
        )}
        {step.step_type === 'form_fill' ? 'Save & Continue' : 'Sign & Continue'}
      </Button>
    </div>
  );
}
