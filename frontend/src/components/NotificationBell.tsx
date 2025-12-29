import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from './ui/button';
import { useNotifications } from '@/hooks/useNotifications';

export const NotificationBell = () => {
  const { unreadCount } = useNotifications();

  return (
    <Button asChild variant="ghost" size="icon" className="relative hover:bg-muted-gray/50">
      <Link to="/notifications">
        <Bell className="h-5 w-5 text-bone-white" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-red text-xs font-bold text-bone-white">
            {unreadCount}
          </span>
        )}
        <span className="sr-only">View notifications</span>
      </Link>
    </Button>
  );
};