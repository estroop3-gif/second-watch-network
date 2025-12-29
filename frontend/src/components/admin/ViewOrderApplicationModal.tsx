import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import {
  MapPin,
  Briefcase,
  Clock,
  ExternalLink,
  User,
  Mail,
  FileText,
} from 'lucide-react';
import type { OrderApplication } from './OrderApplicationsTab';

interface ViewOrderApplicationModalProps {
  application: OrderApplication;
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason?: string) => void;
}

const TRACK_LABELS: Record<string, string> = {
  director: 'Director',
  producer: 'Producer',
  cinematographer: 'Cinematographer',
  editor: 'Editor',
  writer: 'Writer',
  sound: 'Sound',
  production_design: 'Production Design',
  vfx: 'VFX',
  music: 'Music',
  actor: 'Actor',
  other: 'Other',
};

const ViewOrderApplicationModal = ({
  application,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: ViewOrderApplicationModalProps) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const portfolioLinks = application.portfolio_links
    ? JSON.parse(application.portfolio_links)
    : [];

  const handleReject = () => {
    onReject(rejectionReason || undefined);
    setRejectionReason('');
    setShowRejectForm(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading flex items-center gap-3">
            Order Application
            <Badge
              variant={
                application.status === 'approved'
                  ? 'default'
                  : application.status === 'rejected'
                  ? 'destructive'
                  : 'secondary'
              }
              className="capitalize"
            >
              {application.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Submitted on {format(new Date(application.created_at), 'MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Applicant Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-gray" />
              <div>
                <p className="text-sm text-muted-gray">Name</p>
                <p className="font-medium">{application.applicant_name || 'Unknown'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-gray" />
              <div>
                <p className="text-sm text-muted-gray">Email</p>
                <p className="font-medium">{application.applicant_email || '-'}</p>
              </div>
            </div>
          </div>

          {/* Primary Track */}
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-gray" />
            <div>
              <p className="text-sm text-muted-gray">Primary Track</p>
              <Badge variant="outline" className="capitalize mt-1">
                {TRACK_LABELS[application.primary_track] || application.primary_track}
              </Badge>
            </div>
          </div>

          {/* Location */}
          {(application.city || application.region) && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-gray" />
              <div>
                <p className="text-sm text-muted-gray">Location</p>
                <p className="font-medium">
                  {[application.city, application.region].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Experience & Role */}
          <div className="grid grid-cols-2 gap-4">
            {application.years_experience !== undefined && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-gray" />
                <div>
                  <p className="text-sm text-muted-gray">Years Experience</p>
                  <p className="font-medium">{application.years_experience} years</p>
                </div>
              </div>
            )}
            {application.current_role && (
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-gray" />
                <div>
                  <p className="text-sm text-muted-gray">Current Role</p>
                  <p className="font-medium">{application.current_role}</p>
                </div>
              </div>
            )}
          </div>

          {/* Portfolio Links */}
          {portfolioLinks.length > 0 && (
            <div>
              <p className="text-sm text-muted-gray mb-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Portfolio Links
              </p>
              <div className="space-y-2">
                {portfolioLinks.map((link: string, index: number) => (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-accent-yellow hover:underline break-all"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Statement */}
          {application.statement && (
            <div>
              <p className="text-sm text-muted-gray mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Personal Statement
              </p>
              <div className="bg-charcoal-black/50 p-4 rounded-lg border border-muted-gray/20">
                <p className="whitespace-pre-wrap text-sm">{application.statement}</p>
              </div>
            </div>
          )}

          {/* Previous Rejection Reason */}
          {application.status === 'rejected' && application.rejection_reason && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
              <p className="text-sm text-red-400 font-medium mb-1">Rejection Reason</p>
              <p className="text-sm">{application.rejection_reason}</p>
            </div>
          )}

          {/* Rejection Form */}
          {showRejectForm && (
            <div className="border border-muted-gray/30 p-4 rounded-lg">
              <Label htmlFor="rejection-reason" className="text-sm text-muted-gray">
                Rejection Reason (Optional)
              </Label>
              <Textarea
                id="rejection-reason"
                placeholder="Provide a reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="mt-2 bg-charcoal-black border-muted-gray"
                rows={3}
              />
              <div className="flex gap-2 mt-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleReject}
                >
                  Confirm Rejection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {application.status === 'pending' && !showRejectForm && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowRejectForm(true)}
            >
              Reject
            </Button>
            <Button onClick={onApprove}>
              Approve
            </Button>
          </DialogFooter>
        )}

        {(application.status !== 'pending' || showRejectForm) && !showRejectForm && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ViewOrderApplicationModal;
