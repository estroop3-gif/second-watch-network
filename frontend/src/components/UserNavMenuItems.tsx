import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { User, Users, LogOut, Shield, Settings, UploadCloud, Mail, Film, Bell, LayoutDashboard, Megaphone, BarChart3, Gem, MessagesSquare, CreditCard, Trophy, Crown, Handshake, Wrench, Package, Building2, Home, Clapperboard, Send, Inbox, Contact } from 'lucide-react';
import { track } from '@/utils/telemetry';

interface UserNavMenuItemsProps {
  onLinkClick: () => void;
  handleLogout: () => void;
}

const MenuItem = ({ to, onClick, children }: { to: string; onClick: () => void; children: React.ReactNode }) => (
  <Link to={to} onClick={onClick} className="flex items-center p-2 -mx-2 rounded-md text-base font-medium text-bone-white hover:bg-muted-gray/50 focus:bg-muted-gray/50">
    {children}
  </Link>
);

export const UserNavMenuItems = ({ onLinkClick, handleLogout }: UserNavMenuItemsProps) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { hasRole } = usePermissions();

  if (!user) return null;

  const username = profile?.username || user.user_metadata?.username || user.email?.split('@')[0];
  const isAdmin = hasRole('admin');
  const isSuperadmin = hasRole('superadmin');
  const isFilmmakerRole = hasRole('filmmaker');
  const isPartner = hasRole('partner');
  const isOrderMember = hasRole('order_member');
  const isLodgeOfficer = hasRole('lodge_officer');

  // Check both user_metadata roles AND profile is_filmmaker flag for redundancy
  const isFilmmakerProfile = profile?.is_filmmaker === true;
  const isFilmmaker = isFilmmakerRole || isFilmmakerProfile;
  const hasOnboarded = profile?.has_completed_filmmaker_onboarding === true;

  const isSalesAdmin = hasRole('sales_admin');
  const isSalesAgent = hasRole('sales_agent');
  const isSalesRep = hasRole('sales_rep');
  const showAdminLink = isAdmin || isSuperadmin;
  const showPartnerLink = isPartner || isSalesRep || isAdmin || isSuperadmin;
  const showOnboardingLink = isFilmmaker && !hasOnboarded;
  const canSubmitAndManageSubmissions = isFilmmakerRole || isSalesRep || isAdmin || isSuperadmin;
  const showOrderLink = isOrderMember || isLodgeOfficer || isSalesRep || isAdmin || isSuperadmin;
  const showCRMLink = isSalesAdmin || isSalesAgent || isSalesRep || isAdmin || isSuperadmin;

  // Full Gear House is for non-free users (filmmaker, premium, admin, etc.)
  // Free users use My Gear (lite) instead
  const isFreeUser = profile?.role === 'free' || (!profile?.role && !isFilmmakerRole && !isAdmin);
  const hasFullGearHouseAccess = !isFreeUser;

  return (
    <div className="flex flex-col gap-1">
      {showAdminLink && (
        <MenuItem to="/admin/dashboard" onClick={onLinkClick}>
          <Shield className="mr-3 h-5 w-5" />
          <span>Admin Panel</span>
        </MenuItem>
      )}

      {showCRMLink && (
        <MenuItem to="/crm/dashboard" onClick={onLinkClick}>
          <Contact className="mr-3 h-5 w-5" />
          <span>Sales Dashboard</span>
        </MenuItem>
      )}

      {showPartnerLink && (
        <>
          <div className="text-sm font-semibold text-muted-gray mt-4 mb-2 px-2">Sponsor Tools</div>
          <MenuItem to="/partner/dashboard" onClick={onLinkClick}>
            <LayoutDashboard className="mr-3 h-5 w-5" />
            <span>Partner Dashboard</span>
          </MenuItem>
          <MenuItem to="/partner/ad-placements" onClick={onLinkClick}>
            <Megaphone className="mr-3 h-5 w-5" />
            <span>Ad Placements</span>
          </MenuItem>
          <MenuItem to="/partner/analytics" onClick={onLinkClick}>
            <BarChart3 className="mr-3 h-5 w-5" />
            <span>Analytics</span>
          </MenuItem>
          <MenuItem to="/partner/promotions" onClick={onLinkClick}>
            <Gem className="mr-3 h-5 w-5" />
            <span>Promotions</span>
          </MenuItem>
        </>
      )}

      {showOrderLink && (
        <>
          <div className="text-sm font-semibold text-muted-gray mt-4 mb-2 px-2">The Order</div>
          <MenuItem to="/order/dashboard" onClick={onLinkClick}>
            <Crown className="mr-3 h-5 w-5" />
            <span>Order Dashboard</span>
          </MenuItem>
          <MenuItem to="/order/directory" onClick={onLinkClick}>
            <Users className="mr-3 h-5 w-5" />
            <span>Member Directory</span>
          </MenuItem>
          <MenuItem to="/order/jobs" onClick={onLinkClick}>
            <Film className="mr-3 h-5 w-5" />
            <span>Order Jobs</span>
          </MenuItem>
        </>
      )}

      <div className="h-[1px] bg-muted-gray my-2" />

      <MenuItem to="/dashboard" onClick={onLinkClick}>
        <LayoutDashboard className="mr-3 h-5 w-5" />
        <span>Dashboard</span>
      </MenuItem>
      <MenuItem to="/filmmakers" onClick={onLinkClick}>
        <Users className="mr-3 h-5 w-5" />
        <span>Community</span>
      </MenuItem>
      <MenuItem to="/backlot" onClick={onLinkClick}>
        <Film className="mr-3 h-5 w-5" />
        <span>The Backlot</span>
      </MenuItem>
      <MenuItem to="/organizations" onClick={onLinkClick}>
        <Building2 className="mr-3 h-5 w-5" />
        <span>Organizations</span>
      </MenuItem>
      {hasFullGearHouseAccess && (
        <MenuItem to="/gear" onClick={onLinkClick}>
          <Wrench className="mr-3 h-5 w-5" />
          <span>Gear House</span>
        </MenuItem>
      )}
      {hasFullGearHouseAccess && (
        <MenuItem to="/set-house" onClick={onLinkClick}>
          <Home className="mr-3 h-5 w-5" />
          <span>Set House</span>
        </MenuItem>
      )}
      <MenuItem to="/my-gear" onClick={onLinkClick}>
        <Package className="mr-3 h-5 w-5" />
        <span>My Gear</span>
      </MenuItem>
      <MenuItem to="/greenroom" onClick={onLinkClick}>
        <Clapperboard className="mr-3 h-5 w-5" />
        <span>Green Room</span>
      </MenuItem>
      <MenuItem to="/order" onClick={onLinkClick}>
        <Crown className="mr-3 h-5 w-5" />
        <span>The Order</span>
      </MenuItem>
      {canSubmitAndManageSubmissions && (
        <MenuItem to="/submit-project" onClick={onLinkClick}>
          <UploadCloud className="mr-3 h-5 w-5" />
          <span>Submit Project</span>
        </MenuItem>
      )}

      <div className="h-[1px] bg-muted-gray my-2" />

      {/* My Profile link - always show */}
      <MenuItem to="/my-profile" onClick={onLinkClick}>
        <User className="mr-3 h-5 w-5" />
        <span>My Profile</span>
      </MenuItem>
      {canSubmitAndManageSubmissions && (
        <MenuItem to="/my-submissions" onClick={onLinkClick}>
          <Film className="mr-3 h-5 w-5" />
          <span>My Submissions</span>
        </MenuItem>
      )}
      <MenuItem to="/messages" onClick={onLinkClick}>
        <Mail className="mr-3 h-5 w-5" />
        <span>Messages</span>
      </MenuItem>
      <MenuItem to="/notifications" onClick={onLinkClick}>
        <Bell className="mr-3 h-5 w-5" />
        <span>Notifications</span>
      </MenuItem>
      <MenuItem to="/connections" onClick={onLinkClick}>
        <Handshake className="mr-3 h-5 w-5" />
        <span>My Connections</span>
      </MenuItem>
      <MenuItem to="/my-applications" onClick={onLinkClick}>
        <Send className="mr-3 h-5 w-5" />
        <span>My Applications</span>
      </MenuItem>
      <MenuItem to="/applications-received" onClick={onLinkClick}>
        <Inbox className="mr-3 h-5 w-5" />
        <span>Applications Received</span>
      </MenuItem>
      <MenuItem
        to="/account/subscription-settings"
        onClick={() => {
          try { track("nav_subscriptions_click"); } catch {}
          onLinkClick();
        }}
      >
        <CreditCard className="mr-3 h-5 w-5" />
        <span>Subscriptions</span>
      </MenuItem>
      <MenuItem to="/account" onClick={onLinkClick}>
        <Settings className="mr-3 h-5 w-5" />
        <span>Account Settings</span>
      </MenuItem>

      <div className="h-[1px] bg-muted-gray my-2" />
      <button onClick={() => { onLinkClick(); handleLogout(); }} className="flex items-center p-2 -mx-2 rounded-md text-base font-medium text-bone-white hover:bg-muted-gray/50 focus:bg-muted-gray/50 w-full">
        <LogOut className="mr-3 h-5 w-5" />
        <span>Log out</span>
      </button>
    </div>
  );
};