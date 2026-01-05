import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import SubmissionMessaging from "@/components/shared/SubmissionMessaging";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

// A simplified version of the Submission type for this component
interface Submission {
  id: string;
  project_title: string;
  status: string;
}

interface SubmissionConversationModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  submission: Submission | null;
}

const statusColorClasses: Record<string, string> = {
  pending: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
  'in review': 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  considered: 'bg-purple-400/20 text-purple-300 border-purple-400/30',
  approved: 'bg-green-400/20 text-green-300 border-green-400/30',
  rejected: 'bg-red-400/20 text-red-300 border-red-400/30',
  archived: 'bg-gray-400/20 text-gray-500 border-gray-400/30',
};

export const SubmissionConversationModal = ({ isOpen, onOpenChange, submission }: SubmissionConversationModalProps) => {
  const { user } = useAuth();

  if (!submission || !user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl font-heading">Conversation for: {submission.project_title}</DialogTitle>
          <DialogDescription>
            Status: <Badge variant="outline" className={cn("capitalize", statusColorClasses[submission.status])}>{submission.status}</Badge>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow bg-charcoal-black/50 flex flex-col overflow-hidden">
          <SubmissionMessaging submissionId={submission.id} submissionUserId={user.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
};