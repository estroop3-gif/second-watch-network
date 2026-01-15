import { Outlet, NavLink } from 'react-router-dom';
import {
  Users,
  FileText,
  MessageSquare,
  Film,
  Users2,
  BarChart,
  Settings,
  LayoutDashboard,
  ClipboardList,
  Clapperboard,
  Shield,
  CreditCard,
  Handshake,
  Flag,
  Heart,
  FlaskConical,
  UserCog,
  HardDrive,
  Mail,
  Building2,
} from 'lucide-react';

const AdminLayout = () => {
  const navItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Submissions', href: '/admin/submissions', icon: FileText },
    { name: 'Applications', href: '/admin/applications', icon: ClipboardList },
    { name: 'Forum', href: '/admin/forum', icon: MessageSquare },
    { name: 'Content', href: '/admin/content', icon: Film },
    { name: 'Green Room', href: '/admin/greenroom', icon: Clapperboard },
    { name: 'Filmmaker Profiles', href: '/admin/profiles', icon: Users2 },
    { name: 'Availability', href: '/admin/availability', icon: BarChart },
    // New tabs
    { name: 'Order', href: '/admin/order', icon: Users },
    { name: 'Backlot', href: '/admin/backlot', icon: Clapperboard },
    { name: 'Billing', href: '/admin/billing', icon: CreditCard },
    { name: 'Organizations', href: '/admin/organizations', icon: Building2 },
    { name: 'Partners', href: '/admin/partners', icon: Handshake },
    { name: 'Community', href: '/admin/community', icon: Users2 },
    { name: 'Moderation', href: '/admin/moderation', icon: Flag },
    { name: 'Audit Log', href: '/admin/audit-log', icon: Shield },
    { name: 'Donations', href: '/admin/donations', icon: Heart },
    { name: 'Alpha Testing', href: '/admin/alpha-testing', icon: FlaskConical },
    { name: 'Email Logs', href: '/admin/email-logs', icon: Mail },
    { name: 'Site Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-5rem)] bg-charcoal-black text-bone-white">
      {/* Sidebar - sticky on desktop, static on mobile */}
      <aside className="w-full md:w-64 md:fixed md:top-20 md:left-0 md:h-[calc(100vh-5rem)] bg-gray-900 border-b md:border-b-0 md:border-r border-muted-gray flex flex-col flex-shrink-0 md:z-40">
        {/* Fixed header */}
        <div className="p-4 md:p-6 pb-2 md:pb-4 border-b border-muted-gray/50">
          <h2 className="text-2xl font-heading text-accent-yellow">Admin Console</h2>
        </div>
        {/* Scrollable nav */}
        <nav className="flex flex-row md:flex-col gap-1 flex-wrap md:flex-nowrap p-4 md:p-4 overflow-y-auto flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/admin/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-yellow text-charcoal-black'
                    : 'text-bone-white hover:bg-muted-gray/50'
                }`
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className="hidden md:inline">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      {/* Main content area - scrolls independently */}
      <main className="flex-1 p-4 md:p-8 lg:p-12 md:ml-64 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
