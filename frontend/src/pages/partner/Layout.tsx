import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Megaphone, BarChart3, Gem } from 'lucide-react';

const PartnerLayout = () => {
  const navItems = [
    { name: 'Dashboard', href: '/partner/dashboard', icon: LayoutDashboard },
    { name: 'Ad Placements', href: '/partner/ad-placements', icon: Megaphone },
    { name: 'Analytics', href: '/partner/analytics', icon: BarChart3 },
    { name: 'Promotions', href: '/partner/promotions', icon: Gem },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <aside className="w-full md:w-64 bg-charcoal-black p-4 md:p-6 border-b md:border-r border-muted-gray">
        <h2 className="text-2xl font-heading text-accent-yellow mb-6">Sponsor Tools</h2>
        <nav className="flex flex-row md:flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-yellow text-charcoal-black'
                    : 'text-bone-white hover:bg-muted-gray/50'
                }`
              }
              end={item.href === '/partner/dashboard'}
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

export default PartnerLayout;