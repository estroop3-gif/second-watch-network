/**
 * Filmmaker Pro layout with sidebar navigation.
 * Follows the partner/Layout.tsx pattern.
 */
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  DollarSign,
  FileText,
  Calendar,
  Globe,
  Settings,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/filmmaker-pro/dashboard', icon: LayoutDashboard },
  { name: 'Analytics', href: '/filmmaker-pro/analytics', icon: BarChart3 },
  { name: 'Rate Card', href: '/filmmaker-pro/rate-card', icon: DollarSign },
  { name: 'Invoices', href: '/filmmaker-pro/invoices', icon: FileText },
  { name: 'Availability', href: '/filmmaker-pro/availability', icon: Calendar },
  { name: 'Portfolio', href: '/filmmaker-pro/portfolio', icon: Globe },
  { name: 'Settings', href: '/filmmaker-pro/settings', icon: Settings },
];

const FilmmakerProLayout = () => {
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <aside className="w-full md:w-64 bg-charcoal-black p-4 md:p-6 border-b md:border-r border-muted-gray">
        <h2 className="text-2xl font-heading text-amber-400 mb-6">Filmmaker Pro</h2>
        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500 text-charcoal-black'
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

export default FilmmakerProLayout;
