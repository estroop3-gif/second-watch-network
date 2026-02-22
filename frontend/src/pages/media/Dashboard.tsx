import { Link } from 'react-router-dom';
import {
  FileText, Clock, UserCheck, CheckCircle2, ArrowRight, Loader2, Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMediaDashboard } from '@/hooks/media';
import RequestStatusBadge from '@/components/media/RequestStatusBadge';
import RequestPriorityBadge from '@/components/media/RequestPriorityBadge';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatScheduledDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const StatCard = ({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
}) => (
  <Card className="bg-charcoal-black border-muted-gray/30">
    <CardContent className="p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-heading text-bone-white">{value}</p>
        <p className="text-xs text-muted-gray">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { data, isLoading } = useMediaDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
      </div>
    );
  }

  const totals = data?.totals || {
    active: 0,
    new_submissions: 0,
    my_assigned: 0,
    completed: 0,
  };
  const pendingRequests = data?.pending_requests || [];
  const upcomingPosts = data?.upcoming_posts || [];
  const myAssigned = data?.my_assigned || [];
  const upcomingEvents = data?.upcoming_events || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-heading text-bone-white">Media Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Requests"
          value={totals.active}
          icon={FileText}
          color="bg-blue-900/40 text-blue-300"
        />
        <StatCard
          label="New Submissions"
          value={totals.new_submissions}
          icon={Clock}
          color="bg-amber-900/40 text-amber-300"
        />
        <StatCard
          label="My Assigned"
          value={totals.my_assigned}
          icon={UserCheck}
          color="bg-purple-900/40 text-purple-300"
        />
        <StatCard
          label="Completed"
          value={totals.completed}
          icon={CheckCircle2}
          color="bg-green-900/40 text-green-300"
        />
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-bone-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent-yellow" />
                Upcoming Events
              </CardTitle>
              <Link to="/media/events" className="text-xs text-accent-yellow hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingEvents.slice(0, 5).map((ev: any) => (
                <Link key={ev.id} to={`/media/events/${ev.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted-gray/10 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-bone-white truncate">{ev.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-gray capitalize">{ev.event_type?.replace(/_/g, ' ')}</span>
                        {ev.attendee_count > 0 && (
                          <span className="text-xs text-muted-gray">{ev.attendee_count} attendees</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-accent-yellow ml-2 flex-shrink-0">
                      {formatScheduledDate(ev.start_date)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Requests */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-bone-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent-yellow" />
                Pending Requests
              </CardTitle>
              <span className="text-sm text-muted-gray">{pendingRequests.length} pending</span>
            </div>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 ? (
              <p className="text-muted-gray text-sm py-4 text-center">No pending requests</p>
            ) : (
              <div className="space-y-3">
                {pendingRequests.slice(0, 6).map((req: any) => (
                  <Link key={req.id} to={`/media/requests/${req.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted-gray/10 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-bone-white truncate">
                          {req.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-gray truncate">
                            {req.requester_name || 'Unknown'}
                          </span>
                          <RequestPriorityBadge priority={req.priority} />
                        </div>
                      </div>
                      <span className="text-xs text-muted-gray ml-2 flex-shrink-0">
                        {formatRelativeTime(req.created_at)}
                      </span>
                    </div>
                  </Link>
                ))}
                {pendingRequests.length > 6 && (
                  <Link
                    to="/media/requests?scope=all&status=submitted"
                    className="flex items-center gap-1 text-xs text-accent-yellow hover:underline justify-center pt-2"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Posts */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-bone-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent-yellow" />
                Upcoming Posts
              </CardTitle>
              <span className="text-sm text-muted-gray">{upcomingPosts.length} scheduled</span>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingPosts.length === 0 ? (
              <p className="text-muted-gray text-sm py-4 text-center">No upcoming posts</p>
            ) : (
              <div className="space-y-3">
                {upcomingPosts.slice(0, 6).map((post: any) => (
                  <Link key={post.id} to={post.request_id ? `/media/requests/${post.request_id}` : '/media/calendar'}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted-gray/10 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-bone-white truncate">
                          {post.title}
                        </div>
                        {post.platform_name && (
                          <span className="text-xs text-muted-gray">{post.platform_name}</span>
                        )}
                      </div>
                      <span className="text-xs text-accent-yellow ml-2 flex-shrink-0">
                        {formatScheduledDate(post.scheduled_date)}
                      </span>
                    </div>
                  </Link>
                ))}
                {upcomingPosts.length > 6 && (
                  <Link
                    to="/media/calendar"
                    className="flex items-center gap-1 text-xs text-accent-yellow hover:underline justify-center pt-2"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Assigned */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-bone-white flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-accent-yellow" />
                My Assigned
              </CardTitle>
              <span className="text-sm text-muted-gray">{myAssigned.length} active</span>
            </div>
          </CardHeader>
          <CardContent>
            {myAssigned.length === 0 ? (
              <p className="text-muted-gray text-sm py-4 text-center">No assigned requests</p>
            ) : (
              <div className="space-y-3">
                {myAssigned.slice(0, 6).map((req: any) => (
                  <Link key={req.id} to={`/media/requests/${req.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted-gray/10 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-bone-white truncate">
                          {req.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <RequestStatusBadge status={req.status} />
                          <RequestPriorityBadge priority={req.priority} />
                        </div>
                      </div>
                      <span className="text-xs text-muted-gray ml-2 flex-shrink-0">
                        {formatRelativeTime(req.created_at)}
                      </span>
                    </div>
                  </Link>
                ))}
                {myAssigned.length > 6 && (
                  <Link
                    to="/media/requests?scope=all&assigned=me"
                    className="flex items-center gap-1 text-xs text-accent-yellow hover:underline justify-center pt-2"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
