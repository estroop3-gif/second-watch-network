/**
 * NotificationsWidget
 * Shows recent notifications
 */

import { Link } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import {
  Bell,
  ChevronRight,
  MessageSquare,
  UserPlus,
  Film,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

const TYPE_ICONS: Record<string, typeof Bell> = {
  message: MessageSquare,
  connection_request: UserPlus,
  submission_update: Film,
  approval: CheckCircle,
  alert: AlertCircle,
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function NotificationsWidget({ className = '' }: SectionProps) {
  const { notifications, unreadCount, isLoading, markAsRead } = useNotifications();

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  const recentNotifications = notifications?.slice(0, 4) || [];

  return (
    <div className={`p-4 bg-charcoal-black border border-muted-gray/20 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-muted-gray" />
          <h3 className="font-heading text-bone-white">Activity</h3>
          {unreadCount > 0 && (
            <Badge variant="default" className="bg-primary-red text-white text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/notifications">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {recentNotifications.length === 0 ? (
        <p className="text-muted-gray text-sm text-center py-4">No notifications</p>
      ) : (
        <div className="space-y-2">
          {recentNotifications.map((notification: any) => {
            const Icon = TYPE_ICONS[notification.type] || Bell;
            const isUnread = notification.status === 'unread';

            return (
              <button
                key={notification.id}
                onClick={() => isUnread && markAsRead(notification.id)}
                className={`w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors ${
                  isUnread ? 'bg-accent-yellow/5 hover:bg-accent-yellow/10' : 'hover:bg-muted-gray/10'
                }`}
              >
                <div className={`mt-0.5 p-1.5 rounded-full ${isUnread ? 'bg-accent-yellow/20' : 'bg-muted-gray/20'}`}>
                  <Icon className={`w-4 h-4 ${isUnread ? 'text-accent-yellow' : 'text-muted-gray'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm line-clamp-2 ${isUnread ? 'text-bone-white' : 'text-muted-gray'}`}>
                    {notification.title}
                  </p>
                  <span className="text-muted-gray text-xs">
                    {formatTimeAgo(notification.created_at)}
                  </span>
                </div>
                {isUnread && (
                  <div className="w-2 h-2 rounded-full bg-accent-yellow mt-1.5" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NotificationsWidget;
