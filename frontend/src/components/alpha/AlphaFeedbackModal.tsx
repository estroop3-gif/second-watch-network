import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bug, Lightbulb, Camera, X, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAlphaTracking } from '@/context/AlphaTrackingContext';
import { useScreenCapture } from '@/hooks/useScreenCapture';
import { api } from '@/lib/api';

interface AlphaFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'bug' | 'feedback';
}

const FEEDBACK_TYPES = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'ux', label: 'UX/Usability Issue' },
  { value: 'performance', label: 'Performance Issue' },
  { value: 'general', label: 'General Feedback' },
];

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low', description: 'Minor issue or nice-to-have' },
  { value: 'medium', label: 'Medium', description: 'Notable problem but workarounds exist' },
  { value: 'high', label: 'High', description: 'Major issue affecting core functionality' },
  { value: 'critical', label: 'Critical', description: 'Platform breaking, needs immediate fix' },
];

const AlphaFeedbackModal: React.FC<AlphaFeedbackModalProps> = ({
  isOpen,
  onClose,
  type,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [feedbackType, setFeedbackType] = useState(type === 'bug' ? 'bug' : 'feature');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCaptureConfirm, setShowCaptureConfirm] = useState(false);

  const { recentActions, consoleErrors, getBrowserInfo, getNetworkTiming } = useAlphaTracking();
  const { captureScreen, clearCapture, isCapturing, preview, capturedBlob } = useScreenCapture();

  const isBugReport = type === 'bug';

  const handleCaptureClick = () => {
    setShowCaptureConfirm(true);
  };

  const handleConfirmCapture = async () => {
    setShowCaptureConfirm(false);
    await captureScreen();
  };

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setFeedbackType(type === 'bug' ? 'bug' : 'feature');
    setPriority('medium');
    clearCapture();
  }, [type, clearCapture]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setIsSubmitting(true);

    try {
      let screenshotUrl: string | undefined;

      // Upload screenshot if captured
      if (capturedBlob) {
        try {
          const filename = `screenshot-${Date.now()}.png`;
          const uploadData = await api.getAlphaScreenshotUploadUrl(filename);

          // Upload directly to S3
          const formData = new FormData();
          Object.entries(uploadData.fields || {}).forEach(([key, value]) => {
            formData.append(key, value as string);
          });
          formData.append('file', capturedBlob, filename);

          await fetch(uploadData.upload_url, {
            method: 'POST',
            body: formData,
          });

          screenshotUrl = uploadData.public_url;
        } catch (err) {
          console.error('Screenshot upload failed:', err);
          // Continue without screenshot
        }
      }

      // Gather context
      const browserInfo = getBrowserInfo();
      const networkTiming = getNetworkTiming();

      const context = {
        recent_actions: recentActions.slice(-20),
        console_errors: consoleErrors.slice(-10),
        network_timing: networkTiming ? {
          domContentLoadedTime: networkTiming.domContentLoadedEventEnd - networkTiming.startTime,
          loadTime: networkTiming.loadEventEnd - networkTiming.startTime,
          responseTime: networkTiming.responseEnd - networkTiming.requestStart,
        } : null,
      };

      // Submit feedback
      await api.submitAlphaFeedback({
        title: title.trim(),
        description: description.trim(),
        feedback_type: feedbackType,
        priority: isBugReport ? priority : undefined,
        page_url: window.location.href,
        browser_info: browserInfo,
        context,
        screenshot_url: screenshotUrl,
      });

      toast.success(isBugReport ? 'Bug report submitted!' : 'Feedback submitted!');
      handleClose();
    } catch (err: any) {
      console.error('Submit failed:', err);
      toast.error(err.message || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="bg-charcoal-black border-purple-600 text-bone-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isBugReport ? (
                <>
                  <Bug className="h-5 w-5 text-red-400" />
                  <span>Report a Bug</span>
                </>
              ) : (
                <>
                  <Lightbulb className="h-5 w-5 text-yellow-400" />
                  <span>Give Feedback</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-gray">
              {isBugReport
                ? 'Help us improve by reporting issues you encounter.'
                : 'Share your ideas and suggestions with us.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isBugReport ? 'Brief description of the bug' : 'What is your feedback about?'}
                className="bg-charcoal-black/50 border-muted-gray"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isBugReport
                    ? 'Steps to reproduce, expected vs actual behavior...'
                    : 'Please provide details about your suggestion...'
                }
                className="bg-charcoal-black/50 border-muted-gray min-h-[120px]"
              />
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger className="bg-charcoal-black/50 border-muted-gray">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray">
                  {FEEDBACK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority (Bug reports only) */}
            {isBugReport && (
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-charcoal-black/50 border-muted-gray">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-charcoal-black border-muted-gray">
                    {PRIORITY_LEVELS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span>{p.label}</span>
                        <span className="text-xs text-muted-gray ml-2">- {p.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Screenshot */}
            <div className="space-y-2">
              <Label>Screenshot (optional)</Label>
              {preview ? (
                <div className="relative">
                  <img
                    src={preview}
                    alt="Screenshot preview"
                    className="w-full h-32 object-cover rounded-lg border border-muted-gray"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-charcoal-black/80 hover:bg-charcoal-black"
                    onClick={clearCapture}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-muted-gray hover:border-purple-500"
                  onClick={handleCaptureClick}
                  disabled={isCapturing}
                >
                  {isCapturing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  {isCapturing ? 'Capturing...' : 'Capture Screenshot'}
                </Button>
              )}
            </div>

            {/* Context info note */}
            <div className="flex items-start gap-2 text-xs text-muted-gray bg-purple-900/20 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Page URL and browser information will be automatically included to help us diagnose issues.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                `Submit ${isBugReport ? 'Bug Report' : 'Feedback'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshot Capture Confirmation Dialog */}
      <Dialog open={showCaptureConfirm} onOpenChange={setShowCaptureConfirm}>
        <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-purple-400" />
              Capture Screenshot?
            </DialogTitle>
            <DialogDescription className="text-muted-gray">
              This will open your browser's screen sharing dialog. Select the window or screen you want to capture.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCaptureConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCapture}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AlphaFeedbackModal;
