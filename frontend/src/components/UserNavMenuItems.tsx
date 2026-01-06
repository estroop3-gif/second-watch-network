import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { User, Users, LogOut, Shield, Settings, UploadCloud, Mail, Film, Bell, LayoutDashboard, Megaphone, BarChart3, Gem, MessagesSquare, CreditCard, Trophy, Crown, Handshake, Wrench } from 'lucide-react';
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
  const isFilmmakerRole = hasRole('filmmaker');
  const isPartner = hasRole('partner');
  const isOrderMember = hasRole('order_member');

  // Check both user_metadata roles AND profile is_filmmaker flag for redundancy
  const isFilmmakerProfile = profile?.is_filmmaker === true;
  const isFilmmaker = isFilmmakerRole || isFilmmakerProfile;
  const hasOnboarded = profile?.has_completed_filmmaker_onboarding === true;

  const showPartnerLink = isPartner || isAdmin;
  const showOnboardingLink = isFilmmaker && !hasOnboarded;
  const canSubmitAndManageSubmissions = isFilmmakerRole || isAdmin;
  const showOrderLink = isOrderMember || isAdmin;

  return (
    <div className="flex flex-col gap-1">
      {isAdmin && (
        <MenuItem to="/admin/dashboard" onClick={onLinkClick}>
          <Shield className="mr-3 h-5 w-5" />
          <span>Admin Panel</span>
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
      <MenuItem to="/gear" onClick={onLinkClick}>
        <Wrench className="mr-3 h-5 w-5" />
        <span>Gear House</span>
      </MenuItem>
      <MenuItem to="/greenroom" onClick={onLinkClick}>
        <Trophy className="mr-3 h-5 w-5" />
        <span>Green Room</span>
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
      <MenuItem
        to="/account/membership"
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