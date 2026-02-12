import { Phone, Mail, MessageSquare, Users, Monitor, CalendarCheck, FileText, StickyNote, MoreHorizontal, Inbox, Megaphone, Zap, UserPlus, UserMinus } from 'lucide-react';
import { formatDateTime, formatDate } from '@/lib/dateUtils';

const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  email_received: Inbox,
  email_campaign: Megaphone,
  email_sequence: Zap,
  sequence_enrolled: UserPlus,
  sequence_unenrolled: UserMinus,
  text: MessageSquare,
  meeting: Users,
  demo: Monitor,
  follow_up: CalendarCheck,
  proposal_sent: FileText,
  note: StickyNote,
  other: MoreHorizontal,
};

const OUTCOME_COLORS: Record<string, string> = {
  completed: 'text-green-400',
  interested: 'text-green-400',
  no_answer: 'text-muted-gray',
  left_voicemail: 'text-yellow-400',
  callback_requested: 'text-blue-400',
  not_interested: 'text-red-400',
};

interface ActivityTimelineProps {
  activities: any[];
}

const ActivityTimeline = ({ activities }: ActivityTimelineProps) => {
  if (!activities?.length) {
    return (
      <div className="text-center py-8 text-muted-gray">
        No activities logged yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity: any) => {
        const Icon = ACTIVITY_ICONS[activity.activity_type] || MoreHorizontal;
        const outcomeColor = activity.outcome ? OUTCOME_COLORS[activity.outcome] || 'text-muted-gray' : '';
        const date = new Date(activity.activity_date);

        return (
          <div key={activity.id} className="flex gap-3 p-3 rounded-lg bg-charcoal-black/50 border border-muted-gray/20">
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-full bg-muted-gray/20 flex items-center justify-center">
                <Icon className="h-4 w-4 text-accent-yellow" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-bone-white capitalize">
                    {activity.activity_type.replace('_', ' ')}
                  </span>
                  {activity.subject && (
                    <span className="text-sm text-muted-gray ml-2">- {activity.subject}</span>
                  )}
                </div>
                <span className="text-xs text-muted-gray whitespace-nowrap">
                  {formatDateTime(activity.activity_date)}
                </span>
              </div>

              {activity.description && (
                <p className="text-sm text-bone-white/70 mt-1">{activity.description}</p>
              )}

              <div className="flex items-center gap-3 mt-2 text-xs">
                {activity.outcome && (
                  <span className={outcomeColor}>
                    {activity.outcome.replace('_', ' ')}
                  </span>
                )}
                {activity.duration_minutes && (
                  <span className="text-muted-gray">{activity.duration_minutes} min</span>
                )}
                {activity.rep_name && (
                  <span className="text-muted-gray">by {activity.rep_name}</span>
                )}
              </div>

              {activity.follow_up_date && (
                <div className="mt-2 text-xs text-blue-400">
                  Follow up: {formatDate(activity.follow_up_date)}
                  {activity.follow_up_notes && ` - ${activity.follow_up_notes}`}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActivityTimeline;
