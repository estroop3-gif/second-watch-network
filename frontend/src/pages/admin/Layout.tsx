import { Outlet, NavLink } from 'react-router-dom';
import { Users, FileText, MessageSquare, Film, Users2, BarChart, Settings, LayoutDashboard, ClipboardList } from 'lucide-react';

const AdminLayout = () => {
  const navItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Submissions', href: '/admin/submissions', icon: FileText },
    { name: 'Applications', href: '/admin/applications', icon: ClipboardList },
    { name: 'Forum', href: '/admin/forum', icon: MessageSquare },
    { name: 'Content', href: '/admin/content', icon: Film },
    { name: 'Filmmaker Profiles', href: '/admin/profiles', icon: Users2 },
    { name: 'Availability', href: '/admin/availability', icon: BarChart },
    { name: 'Site Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-charcoal-black text-bone-white">
      <aside className="w-full md:w-64 bg-gray-900 p-4 md:p-6 border-b md:border-r border-muted-gray">
        <h2 className="text-2xl font-heading text-accent-yellow mb-6">Admin Console</h2>
        <nav className="flex flex-row md:flex-col gap-2">
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
              <item.icon className="h-5 w-5" />
              <span className="hidden md:inline">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8 lg:p-12">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;