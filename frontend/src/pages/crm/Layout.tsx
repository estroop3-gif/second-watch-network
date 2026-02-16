import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, CalendarDays,
  Activity, Kanban, Target,
  ClipboardList, Star, Shield, AtSign,
  PanelLeftClose, PanelLeftOpen,
  GraduationCap, CreditCard, MessageSquare, ShieldOff, DollarSign,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useUnreadCount, useEmailSocket } from '@/hooks/crm/useEmail';
import { useSidebarBadges } from '@/hooks/crm/useSidebarBadges';
import { usePendingInviteCount } from '@/hooks/crm/useActivities';
import { useMarkTabViewed, getTabKeyFromPath } from '@/hooks/crm/useTabViewed';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

const CRMLayout = () => {
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin', 'sales_admin']);
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count || 0;
  const { data: pendingInviteData } = usePendingInviteCount();
  const pendingInvites = pendingInviteData?.count || 0;

  // Real-time WebSocket updates for sidebar badge
  useEmailSocket();
  const { data: badges } = useSidebarBadges();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const isEmailRoute = location.pathname.startsWith('/crm/email');
  const markTabViewed = useMarkTabViewed();
  const lastMarkedTab = useRef<string | null>(null);
  const qc = useQueryClient();

  // Prefetch business card data so the tab loads instantly
  useEffect(() => {
    qc.prefetchQuery({
      queryKey: ['crm-my-business-card'],
      queryFn: async () => {
        const res = await api.getCRMBusinessCard();
        return res.card;
      },
      staleTime: 5 * 60 * 1000,
    });
  }, []);

  // Mark tab as viewed when navigating to a new CRM tab
  useEffect(() => {
    const tabKey = getTabKeyFromPath(location.pathname);
    if (tabKey && tabKey !== lastMarkedTab.current) {
      lastMarkedTab.current = tabKey;
      markTabViewed.mutate(tabKey);
    }
  }, [location.pathname]);

  const navItems = [
    { name: 'Dashboard', href: '/crm/dashboard', icon: LayoutDashboard, badge: 0 },
    { name: 'Contacts', href: '/crm/contacts', icon: Users, badge: (badges?.contacts || 0) + (badges?.new_leads || 0) },
    { name: 'DNC List', href: '/crm/dnc', icon: ShieldOff, badge: badges?.dnc || 0 },
    { name: 'Email', href: '/crm/email', icon: AtSign, badge: unreadCount },
    { name: 'Pipeline', href: '/crm/pipeline', icon: Kanban, badge: badges?.pipeline || 0 },
    { name: 'Calendar', href: '/crm/calendar', icon: CalendarDays, badge: (badges?.calendar || 0) + pendingInvites },
    { name: 'Interactions', href: '/crm/interactions', icon: Activity, badge: badges?.interactions || 0 },
    { name: 'Goals', href: '/crm/goals', icon: Target, badge: badges?.goals || 0 },
    { name: 'Log', href: '/crm/log', icon: ClipboardList, badge: badges?.log || 0 },
    { name: 'Reviews', href: '/crm/reviews', icon: Star, badge: badges?.reviews || 0 },
    { name: 'Training', href: '/crm/training', icon: GraduationCap, badge: badges?.training || 0 },
    { name: 'Discussions', href: '/crm/discussions', icon: MessageSquare, badge: badges?.discussions || 0 },
    { name: 'Business Card', href: '/crm/business-card', icon: CreditCard, badge: badges?.business_card || 0 },
    { name: 'Pricing', href: '/crm/pricing', icon: DollarSign, badge: 0 },
  ];

  const adminItems = [
    { name: 'Admin', href: '/crm/admin', icon: Shield, badge: 0 },
  ];

  const allItems = isAdmin ? [...navItems, ...adminItems] : navItems;

  const sidebarWidth = collapsed ? 'md:w-16' : 'md:w-64';
  const mainMargin = collapsed ? 'md:ml-16' : 'md:ml-64';

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-5rem)] bg-charcoal-black text-bone-white">
      <TooltipProvider delayDuration={0}>
        <aside className={`w-full ${sidebarWidth} md:fixed md:top-20 md:left-0 md:h-[calc(100vh-5rem)] bg-charcoal-black border-b md:border-b-0 md:border-r border-muted-gray flex flex-col flex-shrink-0 md:z-40 transition-all duration-200`}>
          {!collapsed && (
            <div className="p-4 md:p-6 pb-2 md:pb-4 border-b border-muted-gray/50">
              <h2 className="text-2xl font-heading text-accent-yellow">Sales Department</h2>
            </div>
          )}
          {collapsed && (
            <div className="hidden md:block p-3 pb-2 border-b border-muted-gray/50">
              <div className="w-10 h-10 rounded-md bg-accent-yellow/10 flex items-center justify-center">
                <span className="text-accent-yellow font-heading text-lg">S</span>
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
                      isActive
                        ? 'bg-accent-yellow text-charcoal-black'
                        : 'text-bone-white hover:bg-muted-gray/50'
                    }`
                  }
                  end={item.href === '/crm/dashboard'}
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
      <main className={`flex-1 min-w-0 overflow-x-hidden ${isEmailRoute ? 'overflow-y-hidden' : 'overflow-y-auto'} p-4 md:p-6 ${mainMargin} transition-all duration-200`}>
        <Outlet />
      </main>
    </div>
  );
};

export default CRMLayout;
