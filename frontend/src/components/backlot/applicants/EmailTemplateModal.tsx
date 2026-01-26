/**
 * EmailTemplateModal - Modal for selecting and customizing email templates for applicants
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Mail, Sparkles } from 'lucide-react';

interface EmailTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicantName: string;
  applicantEmail: string;
  jobTitle: string;
  projectName?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'interview',
    name: 'Interview Invitation',
    subject: 'Interview Invitation - {jobTitle}',
    body: `Hi {applicantName},

Thank you for your application for the {jobTitle} position{projectContext}. We were impressed by your profile and would like to invite you for an interview.

We'd love to discuss the role further and learn more about your experience. Please let me know your availability for a conversation in the coming days.

Looking forward to speaking with you!

Best regards`,
  },
  {
    id: 'rejection',
    name: 'Application Declined',
    subject: 'Update on Your Application - {jobTitle}',
    body: `Hi {applicantName},

Thank you for taking the time to apply for the {jobTitle} position{projectContext}. We appreciate your interest in working with us.

After careful consideration, we've decided to move forward with other candidates whose experience more closely aligns with our current needs. We were impressed by your background and encourage you to apply for future opportunities that match your skills.

We wish you all the best in your career.

Best regards`,
  },
  {
    id: 'followup',
    name: 'Request Additional Information',
    subject: 'Additional Information Needed - {jobTitle}',
    body: `Hi {applicantName},

Thank you for your application for the {jobTitle} position{projectContext}. We're reviewing your profile and would like to request some additional information to help us move forward.

Could you please provide:
- [List what you need here]

Please send this information at your earliest convenience.

Thank you!

Best regards`,
  },
  {
    id: 'offer',
    name: 'Job Offer',
    subject: 'Job Offer - {jobTitle}',
    body: `Hi {applicantName},

We're excited to offer you the {jobTitle} position{projectContext}! Your experience and skills make you an excellent fit for our team.

We'd like to discuss the details of the offer, including:
- Start date
- Compensation
- Project schedule

Please let me know when you're available for a call to go over everything.

Looking forward to working with you!

Best regards`,
  },
];

export function EmailTemplateModal({
  isOpen,
  onClose,
  applicantName,
  applicantEmail,
  jobTitle,
  projectName,
}: EmailTemplateModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const projectContext = projectName ? ` on ${projectName}` : '';

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = EMAIL_TEMPLATES.find((t) => t.id === templateId);

    if (template) {
      // Replace placeholders in subject and body
      const filledSubject = template.subject
        .replace('{jobTitle}', jobTitle)
        .replace('{applicantName}', applicantName)
        .replace('{projectContext}', projectContext);

      const filledBody = template.body
        .replace('{jobTitle}', jobTitle)
        .replace('{applicantName}', applicantName)
        .replace('{projectContext}', projectContext);

      setSubject(filledSubject);
      setMessage(filledBody);
    }
  };

  const handleSend = () => {
    // Encode subject and body for mailto: link
    const mailtoLink = `mailto:${applicantEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(message)}`;

    // Open mailto: link
    window.location.href = mailtoLink;

    // Close modal
    onClose();

    // Reset form
    setSelectedTemplateId('');
    setSubject('');
    setMessage('');
  };

  const handleClose = () => {
    onClose();
    // Reset form after a short delay to avoid visual glitch
    setTimeout(() => {
      setSelectedTemplateId('');
      setSubject('');
      setMessage('');
    }, 200);
  };

  const isFormValid = subject.trim() && message.trim();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-dark-surface border-muted-gray/20">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-accent-yellow" />
            Email {applicantName}
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Select a template or write a custom email. This will open your email client
            with the message pre-filled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Template Selection */}
          <div>
            <Label htmlFor="template" className="text-bone-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-yellow" />
              Email Template (Optional)
            </Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger
                id="template"
                className="mt-1.5 bg-charcoal-black border-muted-gray/30 text-bone-white"
              >
                <SelectValue placeholder="Choose a template or write your own" />
              </SelectTrigger>
              <SelectContent className="bg-dark-surface border-muted-gray/30">
                {EMAIL_TEMPLATES.map((template) => (
                  <SelectItem
                    key={template.id}
                    value={template.id}
                    className="text-bone-white hover:bg-muted-gray/10"
                  >
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplateId && (
              <p className="text-xs text-muted-gray mt-1">
                Template selected. You can edit the subject and message below.
              </p>
            )}
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="subject" className="text-bone-white">
              Subject
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject"
              maxLength={200}
              className="mt-1.5 bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray/50"
            />
            <p className="text-xs text-muted-gray mt-1">
              {subject.length}/200 characters
            </p>
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message" className="text-bone-white">
              Message
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message"
              rows={12}
              maxLength={5000}
              className="mt-1.5 bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray/50 resize-none"
            />
            <p className="text-xs text-muted-gray mt-1">
              {message.length}/5000 characters
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg p-3">
            <p className="text-sm text-bone-white">
              <strong>Note:</strong> This will open your default email client (Gmail,
              Outlook, etc.) with the message pre-filled. You can make final edits before
              sending.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-muted-gray/20">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-muted-gray/30 text-bone-white hover:bg-muted-gray/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!isFormValid}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4 mr-2" />
            Open Email Client
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
