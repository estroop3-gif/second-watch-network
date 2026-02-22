import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, UserPlus, Clock, CalendarDays, Globe, LinkIcon,
  MessageSquare, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useContentRequest, useUpdateRequestStatus, useAssignRequest,
  useRequestComments, useCreateRequestComment, useRequestHistory,
} from '@/hooks/media';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/context/AuthContext';
import RequestStatusBadge from '@/components/media/RequestStatusBadge';
import RequestPriorityBadge from '@/components/media/RequestPriorityBadge';
import RequestStatusTimeline from '@/components/media/RequestStatusTimeline';
import { formatDate } from '@/lib/dateUtils';
import { toast } from 'sonner';

// Ordered pipeline statuses
const PIPELINE_STATUSES = [
  'submitted',
  'in_review',
  'approved',
  'in_production',
  'ready_for_review',
  'approved_final',
  'scheduled',
  'posted',
];

// Allowed transitions from each status
const STATUS_TRANSITIONS: Record<string, string[]> = {
  submitted: ['in_review', 'cancelled'],
  in_review: ['approved', 'revision', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['ready_for_review', 'cancelled'],
  ready_for_review: ['approved_final', 'revision', 'cancelled'],
  revision: ['in_production'],
  approved_final: ['scheduled', 'cancelled'],
  scheduled: ['posted', 'cancelled'],
  posted: [],
  cancelled: ['submitted'],
};

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const StatusPipeline = ({ currentStatus }: { currentStatus: string }) => {
  const currentIdx = PIPELINE_STATUSES.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {PIPELINE_STATUSES.map((status, idx) => {
        const isCurrent = status === currentStatus;
        const isCompleted = currentIdx >= 0 && idx < currentIdx;
        const isFuture = currentIdx >= 0 && idx > currentIdx;

        let bgClass = 'bg-muted-gray/30 text-muted-gray';
        if (isCurrent) bgClass = 'bg-accent-yellow text-charcoal-black';
        else if (isCompleted) bgClass = 'bg-green-900/60 text-green-300';

        return (
          <div key={status} className="flex items-center">
            <div
              className={`${bgClass} px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors`}
            >
              {formatStatusLabel(status)}
            </div>
            {idx < PIPELINE_STATUSES.length - 1 && (
              <div className={`w-4 h-px mx-0.5 ${isCompleted || isCurrent ? 'bg-green-500' : 'bg-muted-gray/30'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const RequestDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { hasAnyRole } = usePermissions();
  const { profileId } = useAuth();
  const isTeam = hasAnyRole(['media_team', 'admin', 'superadmin']);

  const { data: request, isLoading } = useContentRequest(id);
  const updateStatus = useUpdateRequestStatus();
  const assignRequest = useAssignRequest();
  const { data: commentsData } = useRequestComments(id);
  const createComment = useCreateRequestComment();
  const { data: historyData } = useRequestHistory(id);

  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [commentText, setCommentText] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-gray">Request not found.</p>
        <Link to="/media/requests" className="text-accent-yellow text-sm hover:underline mt-2 inline-block">
          Back to requests
        </Link>
      </div>
    );
  }

  const allowedTransitions = isTeam ? (STATUS_TRANSITIONS[request.status] || []) : [];
  const comments = commentsData?.comments || [];
  const history = historyData?.history || [];

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus.mutateAsync({
        id: request.id,
        status: newStatus,
        notes: statusNotes || undefined,
      });
      setStatusNotes('');
      toast.success(`Status updated to ${formatStatusLabel(newStatus)}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleAssignToMe = async () => {
    if (!profileId) return;
    try {
      await assignRequest.mutateAsync({ id: request.id, assigned_to: profileId });
      toast.success('Assigned to you');
    } catch {
      toast.error('Failed to assign');
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      await createComment.mutateAsync({
        requestId: request.id,
        body: commentText.trim(),
      });
      setCommentText('');
    } catch {
      toast.error('Failed to add comment');
    }
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/media/requests"
        className="inline-flex items-center gap-1 text-sm text-muted-gray hover:text-bone-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to requests
      </Link>

      {/* Title row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading text-bone-white">{request.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-gray capitalize">
              {request.content_type?.replace(/_/g, ' ') || 'Content'}
            </span>
            <RequestPriorityBadge priority={request.priority} />
          </div>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      {/* Status Pipeline */}
      <StatusPipeline currentStatus={request.status} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="p-5">
              <h3 className="text-sm font-medium text-muted-gray mb-2">Description</h3>
              <p className="text-bone-white text-sm whitespace-pre-wrap">
                {request.description || 'No description provided.'}
              </p>
            </CardContent>
          </Card>

          {/* Details Grid */}
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {request.due_date && (
                <div className="flex items-start gap-2">
                  <CalendarDays className="h-4 w-4 text-accent-yellow mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-gray">Due Date</p>
                    <p className="text-sm text-bone-white">{formatDate(request.due_date)}</p>
                  </div>
                </div>
              )}
              {request.platforms && request.platforms.length > 0 && (
                <div className="flex items-start gap-2">
                  <Globe className="h-4 w-4 text-accent-yellow mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-gray">Platforms</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {request.platforms.map((p: any) => (
                        <span
                          key={p.id || p}
                          className="bg-muted-gray/20 text-bone-white text-xs px-2 py-0.5 rounded"
                        >
                          {p.name || p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {request.reference_urls && request.reference_urls.length > 0 && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <LinkIcon className="h-4 w-4 text-accent-yellow mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-gray">Reference Links</p>
                    <div className="space-y-1 mt-0.5">
                      {request.reference_urls.map((url: string, idx: number) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-accent-yellow hover:underline block truncate"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {isTeam && allowedTransitions.length > 0 && (
            <Card className="bg-charcoal-black border-muted-gray/30">
              <CardContent className="p-5 space-y-3">
                <h3 className="text-sm font-medium text-muted-gray">Update Status</h3>
                <input
                  type="text"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Add notes (optional)"
                  className="w-full bg-charcoal-black border border-muted-gray/30 rounded-md px-3 py-2 text-sm text-bone-white placeholder:text-muted-gray focus:outline-none focus:ring-1 focus:ring-accent-yellow"
                />
                <div className="flex flex-wrap gap-2">
                  {allowedTransitions.map((status) => (
                    <Button
                      key={status}
                      variant={status === 'cancelled' ? 'destructive' : 'outline'}
                      size="sm"
                      disabled={updateStatus.isPending}
                      onClick={() => handleStatusChange(status)}
                      className={
                        status === 'cancelled'
                          ? ''
                          : 'border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/10'
                      }
                    >
                      {updateStatus.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      {formatStatusLabel(status)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Info Sidebar */}
        <div className="space-y-4">
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="p-5 space-y-4">
              <div>
                <p className="text-xs text-muted-gray">Requested By</p>
                <p className="text-sm text-bone-white mt-0.5">
                  {request.requester_name || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-gray">Assigned To</p>
                <p className="text-sm text-bone-white mt-0.5">
                  {request.assigned_to_name || 'Unassigned'}
                </p>
                {isTeam && !request.assigned_to && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/10 w-full"
                    disabled={assignRequest.isPending}
                    onClick={handleAssignToMe}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Assign to me
                  </Button>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-gray">Created</p>
                <p className="text-sm text-bone-white mt-0.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(request.created_at)}
                </p>
              </div>
              {request.updated_at && (
                <div>
                  <p className="text-xs text-muted-gray">Last Updated</p>
                  <p className="text-sm text-bone-white mt-0.5">
                    {formatDate(request.updated_at)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs: Comments / History */}
      <div className="border-t border-muted-gray/30 pt-6">
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'comments'
                ? 'border-accent-yellow text-accent-yellow'
                : 'border-transparent text-muted-gray hover:text-bone-white'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Comments ({comments.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-accent-yellow text-accent-yellow'
                : 'border-transparent text-muted-gray hover:text-bone-white'
            }`}
          >
            <History className="h-4 w-4" />
            History ({history.length})
          </button>
        </div>

        {activeTab === 'comments' && (
          <div className="space-y-4">
            {/* Add comment */}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                className="flex-1 bg-charcoal-black border border-muted-gray/30 rounded-md px-3 py-2 text-sm text-bone-white placeholder:text-muted-gray focus:outline-none focus:ring-1 focus:ring-accent-yellow"
              />
              <Button
                size="sm"
                disabled={!commentText.trim() || createComment.isPending}
                onClick={handleAddComment}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {createComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Post'}
              </Button>
            </div>

            {/* Comment list */}
            {comments.length === 0 ? (
              <p className="text-muted-gray text-sm text-center py-6">No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment: any) => (
                  <div
                    key={comment.id}
                    className={`p-3 rounded-lg border ${
                      comment.is_internal
                        ? 'border-amber-500/30 bg-amber-900/10'
                        : 'border-muted-gray/20 bg-charcoal-black/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-bone-white">
                        {comment.author_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-gray">
                        {formatDate(comment.created_at, 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-bone-white/80 whitespace-pre-wrap">{comment.body}</p>
                    {comment.is_internal && (
                      <span className="text-xs text-amber-400 mt-1 inline-block">Internal note</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <RequestStatusTimeline history={history} />
        )}
      </div>
    </div>
  );
};

export default RequestDetail;
