import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  FileText, Plus, LayoutDashboard, Inbox, CalendarDays,
  Globe, AtSign, PanelLeftClose, PanelLeftOpen,
  Calendar, MessageSquare, BarChart3,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useUnreadCount, useEmailSocket } from '@/hooks/crm/useEmail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

const MediaLayout = () => {
  const { hasAnyRole } = usePermissions();
  const isTeam = hasAnyRole(['media_team', 'admin', 'superadmin']);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  // Email unread badge + real-time updates (team users only)
  const { data: unreadData } = useUnreadCount();
  useEmailSocket();
  const emailUnread = unreadData?.count || 0;

  const userItems = [
    { name: 'My Requests', href: '/media/requests', icon: FileText, badge: 0 },
    { name: 'New Request', href: '/media/requests/new', icon: Plus, badge: 0 },
    { name: 'Events', href: '/media/events', icon: Calendar, badge: 0 },
    { name: 'Discussions', href: '/media/discussions', icon: MessageSquare, badge: 0 },
  ];

  const teamItems = [
    { name: 'Dashboard', href: '/media/dashboard', icon: LayoutDashboard, badge: 0 },
    { name: 'All Requests', href: '/media/requests?scope=all', icon: Inbox, badge: 0 },
    { name: 'Calendar', href: '/media/calendar', icon: CalendarDays, badge: 0 },
    { name: 'Platforms', href: '/media/platforms', icon: Globe, badge: 0 },
    { name: 'Analytics', href: '/media/analytics', icon: BarChart3, badge: 0 },
    { name: 'Email', href: '/media/email', icon: AtSign, badge: emailUnread },
  ];

  const allItems = isTeam ? [...teamItems.slice(0, 1), ...userItems, ...teamItems.slice(1)] : userItems;

  const sidebarWidth = collapsed ? 'md:w-16' : 'md:w-64';
  const mainMargin = collapsed ? 'md:ml-16' : 'md:ml-64';

  const isActiveLink = (href: string, isActive: boolean) => {
    // For "All Requests" link, check if we have scope=all in search params
    if (href === '/media/requests?scope=all') {
      return location.pathname === '/media/requests' && location.search.includes('scope=all');
    }
    // For "My Requests", match exact path without scope=all
    if (href === '/media/requests') {
      return location.pathname === '/media/requests' && !location.search.includes('scope=all');
    }
    return isActive;
  };

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-5rem)] bg-charcoal-black text-bone-white">
      <TooltipProvider delayDuration={0}>
        <aside className={`w-full ${sidebarWidth} md:fixed md:top-20 md:left-0 md:h-[calc(100vh-5rem)] bg-charcoal-black border-b md:border-b-0 md:border-r border-muted-gray flex flex-col flex-shrink-0 md:z-40 transition-all duration-200`}>
          {!collapsed && (
            <div className="p-4 md:p-6 pb-2 md:pb-4 border-b border-muted-gray/50">
              <h2 className="text-2xl font-heading text-accent-yellow">Media Hub</h2>
            </div>
          )}
          {collapsed && (
            <div className="hidden md:block p-3 pb-2 border-b border-muted-gray/50">
              <div className="w-10 h-10 rounded-md bg-accent-yellow/10 flex items-center justify-center">
                <span className="text-accent-yellow font-heading text-lg">M</span>
              </div>
            </div>
          )}
          <nav className="flex flex-row md:flex-col gap-1 flex-wrap md:flex-nowrap p-2 md:p-2 overflow-y-auto flex-1">
            {allItems.map((item) => {
              const link = (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center ${collapsed ? 'justify-center' : ''} gap-3 rounded-md ${collapsed ? 'px-2 py-2' : 'px-3 py-2'} text-sm font-medium transition-colors ${
                      isActiveLink(item.href, isActive)
                        ? 'bg-accent-yellow text-charcoal-black'
                        : 'text-bone-white hover:bg-muted-gray/50'
                    }`
                  }
                  end={item.href === '/media/dashboard' || item.href === '/media/requests'}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="hidden md:inline">{item.name}</span>}
                  {!collapsed && item.badge > 0 && (
                    <Badge className="ml-auto bg-accent-yellow text-charcoal-black text-xs px-1.5 py-0 h-5 min-w-[20px] flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </Badge>
                  )}
                  {collapsed && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-accent-yellow text-charcoal-black text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center px-1 font-bold">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </NavLink>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      <div className="relative">{link}</div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="hidden md:block">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return link;
            })}
          </nav>
          <div className="hidden md:flex p-2 border-t border-muted-gray/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className={`text-muted-gray hover:text-bone-white ${collapsed ? 'w-full justify-center' : 'w-full justify-start'}`}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4 mr-2" /><span className="text-xs">Collapse</span></>}
            </Button>
          </div>
        </aside>
      </TooltipProvider>
      <main className={`flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 md:p-6 ${mainMargin} transition-all duration-200`}>
        <Outlet />
      </main>
    </div>
  );
};

export default MediaLayout;
