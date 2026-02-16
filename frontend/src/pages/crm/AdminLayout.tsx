import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  TrendingUp, UserCheck, Inbox, Mail, Shield, ShieldOff, BarChart3, Star, CreditCard, Database,
} from 'lucide-react';

const ADMIN_TABS = [
  { name: 'Overview', href: '/crm/admin', icon: TrendingUp, end: true },
  { name: 'Team', href: '/crm/admin/team', icon: UserCheck },
  { name: 'Leads', href: '/crm/admin/leads', icon: Inbox },
  { name: 'Campaigns', href: '/crm/admin/campaigns', icon: Mail },
  { name: 'Email Tools', href: '/crm/admin/email', icon: Mail },
  { name: 'Business Cards', href: '/crm/admin/business-cards', icon: CreditCard },
  { name: 'Reviews', href: '/crm/admin/reviews', icon: Star },
  { name: 'DNC', href: '/crm/admin/dnc', icon: ShieldOff },
  { name: 'Reports', href: '/crm/admin/reports', icon: BarChart3 },
  { name: 'Scraping', href: '/crm/admin/scraping', icon: Database },
];

const AdminLayout = () => {
  const location = useLocation();
  // Hide tabs on campaign detail and rep detail pages to reduce clutter
  const isCampaignDetail = /\/crm\/admin\/campaigns\/.+/.test(location.pathname);
  const isRepDetail = /\/crm\/admin\/team\/.+/.test(location.pathname);
  const hideNav = isCampaignDetail || isRepDetail;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-6 w-6 text-accent-yellow" />
        <h1 className="text-2xl font-heading text-bone-white">Admin</h1>
      </div>

      {!hideNav && (
        <nav className="flex gap-1 mb-6 overflow-x-auto border-b border-muted-gray/30 pb-0">
          {ADMIN_TABS.map((tab) => (
            <NavLink
              key={tab.name}
              to={tab.href}
              end={tab.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-accent-yellow text-accent-yellow'
                    : 'border-transparent text-muted-gray hover:text-bone-white hover:border-muted-gray/50'
                }`
              }
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </NavLink>
          ))}
        </nav>
      )}

      <Outlet />
    </div>
  );
};

export default AdminLayout;
