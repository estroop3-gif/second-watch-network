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
import { Play } from "lucide-react";

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
  shortlisted: 'bg-cyan-400/20 text-cyan-300 border-cyan-400/30',
  flagged: 'bg-orange-400/20 text-orange-300 border-orange-400/30',
};

/**
 * Extract YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 */
function extractYouTubeId(url: string | undefined | null): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // youtu.be short links
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }

    // youtube.com links
    if (urlObj.hostname.includes('youtube.com')) {
      // /watch?v=VIDEO_ID
      const vParam = urlObj.searchParams.get('v');
      if (vParam) return vParam;

      // /embed/VIDEO_ID or /v/VIDEO_ID
      const pathMatch = urlObj.pathname.match(/\/(embed|v)\/([^/?]+)/);
      if (pathMatch) return pathMatch[2];
    }

    return null;
  } catch {
    return null;
  }
}

const SubmissionDetailsModal = ({ isOpen, onClose, submission }: SubmissionDetailsModalProps) => {
  if (!submission) return null;

  // Support both content submissions (youtube_link) and greenroom projects (video_url)
  const videoUrl = (submission as any).youtube_link || (submission as any).video_url;
  const videoId = extractYouTubeId(videoUrl);
  const title = (submission as any).project_title || (submission as any).title || 'Untitled';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl font-heading">{title}</DialogTitle>
          <DialogDescription>
            Submitted by {submission.profiles?.full_name || submission.profiles?.username || (submission as any).filmmaker?.full_name || 'Unknown'} on {new Date(submission.created_at).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow overflow-hidden p-6 pt-0">
          {/* Left Column - Details */}
          <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2">
            <div>
              <h3 className="font-semibold mb-2">Status</h3>
              <Badge variant="outline" className={cn("capitalize", statusColorClasses[submission.status] || statusColorClasses.pending)}>
                {submission.status}
              </Badge>
            </div>

            {/* Video Preview */}
            {videoId && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Video Preview
                </h3>
                <div className="relative aspect-video rounded-lg overflow-hidden border border-muted-gray/30">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="Video Preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              </div>
            )}

            {submission.email && (
              <div>
                <h3 className="font-semibold mb-2">Submitter Email</h3>
                <a
                  href={`mailto:${submission.email}`}
                  className="text-sm text-accent-yellow hover:underline break-all"
                >
                  {submission.email}
                </a>
              </div>
            )}

            {(submission as any).project_type && (
              <div>
                <h3 className="font-semibold mb-2">Project Type</h3>
                <p className="text-sm text-muted-foreground">{(submission as any).project_type}</p>
              </div>
            )}

            {(submission as any).category && (
              <div>
                <h3 className="font-semibold mb-2">Category</h3>
                <p className="text-sm text-muted-foreground">{(submission as any).category}</p>
              </div>
            )}

            {(submission as any).logline && (
              <div>
                <h3 className="font-semibold mb-2">Logline</h3>
                <p className="text-sm text-muted-foreground">{(submission as any).logline}</p>
              </div>
            )}

            {submission.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.description}</p>
              </div>
            )}

            {videoUrl && (
              <div>
                <h3 className="font-semibold mb-2">Video Link</h3>
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent-yellow hover:underline break-all"
                >
                  {videoUrl}
                </a>
              </div>
            )}

            {/* Green Room specific fields */}
            {(submission as any).vote_count !== undefined && (submission as any).vote_count > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Vote Count</h3>
                <p className="text-sm text-accent-yellow font-bold">{(submission as any).vote_count} votes</p>
              </div>
            )}

            {(submission as any).cycle_id && (
              <div>
                <h3 className="font-semibold mb-2">Cycle</h3>
                <p className="text-sm text-muted-foreground">Cycle #{(submission as any).cycle_id}</p>
              </div>
            )}
          </div>

          {/* Right Column - Messaging */}
          <div className="md:col-span-2 bg-charcoal-black/50 rounded-lg flex flex-col overflow-hidden border border-muted-gray/20">
            <h3 className="font-semibold p-4 border-b border-muted-gray/20">Communication Center</h3>
            {(submission.profiles?.id || (submission as any).filmmaker?.id) && (
              <SubmissionMessaging
                submissionId={submission.id}
                submissionUserId={submission.profiles?.id || (submission as any).filmmaker?.id}
              />
            )}
            {!submission.profiles?.id && !(submission as any).filmmaker?.id && (
              <div className="flex-1 flex items-center justify-center text-muted-gray">
                <p>No messaging available for this submission</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubmissionDetailsModal;
