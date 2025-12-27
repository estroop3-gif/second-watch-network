import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Submission } from "@/types";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import SubmissionMessaging from "../shared/SubmissionMessaging";

interface SubmissionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: Submission | null;
}

const statusColorClasses: Record<string, string> = {
  pending: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
  'in review': 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  considered: 'bg-purple-400/20 text-purple-300 border-purple-400/30',
  approved: 'bg-green-400/20 text-green-300 border-green-400/30',
  rejected: 'bg-red-400/20 text-red-300 border-red-400/30',
  archived: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
};

const SubmissionDetailsModal = ({ isOpen, onClose, submission }: SubmissionDetailsModalProps) => {
  if (!submission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl font-heading">{submission.project_title}</DialogTitle>
          <DialogDescription>
            Submitted by {submission.profiles?.full_name || submission.profiles?.username} on {new Date(submission.created_at).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow overflow-hidden p-6 pt-0">
          <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2">
            <div>
              <h3 className="font-semibold mb-2">Status</h3>
              <Badge variant="outline" className={cn("capitalize", statusColorClasses[submission.status])}>
                {submission.status}
              </Badge>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Submitter Email</h3>
              {submission.email ? (
                <a
                  href={`mailto:${submission.email}`}
                  className="text-sm text-accent-yellow hover:underline break-all"
                >
                  {submission.email}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">N/A</p>
              )}
            </div>
            <div>
              <h3 className="font-semibold mb-2">Project Type</h3>
              <p className="text-sm text-muted-foreground">{submission.project_type || 'N/A'}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Logline</h3>
              <p className="text-sm text-muted-foreground">{submission.logline || 'N/A'}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">{submission.description}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">YouTube Link</h3>
              <a href={submission.youtube_link} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-yellow hover:underline break-all">
                {submission.youtube_link}
              </a>
            </div>
          </div>
          <div className="md:col-span-2 bg-charcoal-black/50 rounded-lg flex flex-col overflow-hidden border border-muted-gray/20">
            <h3 className="font-semibold p-4 border-b border-muted-gray/20">Communication Center</h3>
            {submission.profiles?.id && (
              <SubmissionMessaging submissionId={submission.id} submissionUserId={submission.profiles.id} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubmissionDetailsModal;