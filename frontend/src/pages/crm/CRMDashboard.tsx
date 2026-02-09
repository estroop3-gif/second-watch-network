import { Link } from 'react-router-dom';
import { Phone, Mail, CalendarCheck, Users, ArrowRight, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import InteractionCounter from '@/components/crm/InteractionCounter';
import ActivityTimeline from '@/components/crm/ActivityTimeline';
import { useMyInteractionsToday, useIncrementInteraction, useDecrementInteraction } from '@/hooks/crm';
import { useFollowUps, useActivities } from '@/hooks/crm';
import { useUnreadCount, useEmailInbox } from '@/hooks/crm/useEmail';
import { useEmailCompose } from '@/context/EmailComposeContext';

const CRMDashboard = () => {
  const { data: interactions } = useMyInteractionsToday();
  const { mutate: increment, isPending: isIncrementing } = useIncrementInteraction();
  const { mutate: decrement, isPending: isDecrementing } = useDecrementInteraction();
  const { data: followUpsData } = useFollowUps();
  const { data: recentData } = useActivities({ limit: 10 });
  const { data: unreadData } = useUnreadCount();
  const { data: inboxData } = useEmailInbox({ limit: 3 });
  const { openCompose } = useEmailCompose();

  const counts = interactions || {
    calls: 0, emails: 0, texts: 0,
    meetings: 0, demos: 0, other_interactions: 0,
  };

  const followUps = followUpsData?.follow_ups || [];
  const recentActivities = recentData?.activities || [];
  const unreadCount = unreadData?.count || 0;
  const recentThreads = inboxData?.threads?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-bone-white">Sales Dashboard</h1>
        <Link to="/crm/contacts">
          <Button variant="outline" className="border-accent-yellow text-accent-yellow hover:bg-accent-yellow/10">
            <Users className="h-4 w-4 mr-2" /> View Contacts
          </Button>
        </Link>
      </div>

      {/* Interaction Counter */}
      <InteractionCounter
        counts={counts}
        onIncrement={increment}
        onDecrement={decrement}
        isIncrementing={isIncrementing || isDecrementing}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Follow-ups */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-bone-white flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-accent-yellow" />
                Upcoming Follow-ups
              </CardTitle>
              <span className="text-sm text-muted-gray">{followUps.length} pending</span>
            </div>
          </CardHeader>
          <CardContent>
            {followUps.length === 0 ? (
              <p className="text-muted-gray text-sm py-4 text-center">No upcoming follow-ups</p>
            ) : (
              <div className="space-y-3">
                {followUps.slice(0, 5).map((fu: any) => (
                  <Link key={fu.id} to={`/crm/contacts/${fu.contact_id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted-gray/10 transition-colors">
                      <div>
                        <div className="text-sm font-medium text-bone-white">
                          {fu.contact_first_name} {fu.contact_last_name}
                        </div>
                        <div className="text-xs text-muted-gray">
                          {fu.follow_up_notes || fu.subject || 'Follow up'}
                        </div>
                      </div>
                      <div className="text-xs text-accent-yellow">
                        {new Date(fu.follow_up_date).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                ))}
                {followUps.length > 5 && (
                  <Link to="/crm/calendar" className="flex items-center gap-1 text-xs text-accent-yellow hover:underline justify-center pt-2">
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Widget */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-bone-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-accent-yellow" />
                Email
              </CardTitle>
              {unreadCount > 0 && (
                <Badge className="bg-accent-yellow text-charcoal-black text-xs">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentThreads.length === 0 ? (
              <p className="text-muted-gray text-sm py-4 text-center">No recent emails</p>
            ) : (
              <div className="space-y-2">
                {recentThreads.map((thread: any) => (
                  <Link key={thread.id} to={`/crm/email?thread=${thread.id}`}>
                    <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted-gray/10 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-bone-white truncate">
                          {thread.subject}
                        </div>
                        <div className="text-xs text-muted-gray truncate">
                          {thread.contact_first_name
                            ? `${thread.contact_first_name} ${thread.contact_last_name || ''}`.trim()
                            : thread.contact_email}
                        </div>
                      </div>
                      <div className="text-xs text-muted-gray ml-2 flex-shrink-0">
                        {thread.last_message_at ? new Date(thread.last_message_at).toLocaleDateString() : ''}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-muted-gray/20">
              <Link to="/crm/email" className="flex items-center gap-1 text-xs text-accent-yellow hover:underline">
                View Inbox <ArrowRight className="h-3 w-3" />
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openCompose()}
                className="text-accent-yellow h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" /> Compose
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-bone-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline activities={recentActivities.slice(0, 5)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CRMDashboard;
