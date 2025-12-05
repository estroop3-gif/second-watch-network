import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { User, Users, LogOut, Shield, Settings, UploadCloud, Mail, Film, Bell, LayoutDashboard, Megaphone, BarChart3, Gem, MessagesSquare, CreditCard } from 'lucide-react';
import { Badge } from './ui/badge';

export const UserNav = () => {
  const { session, user } = useAuth();
  const { profile } = useProfile();
  const { hasRole } = usePermissions();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error && error.message !== 'Auth session missing!') {
      toast.error("Failed to log out: " + error.message);
    } else {
      window.location.href = '/';
    }
  };

  if (!session || !user) {
    return (
      <Button asChild variant="outline" className="border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black font-bold rounded-[4px] uppercase">
        <Link to="/login">Log In</Link>
      </Button>
    );
  }
  
  const username = profile?.username || user.user_metadata?.username || user.email?.split('@')[0];
  const displayName = profile?.full_name || username;
  const avatarUrl = user.user_metadata?.avatar_url;
  
  const isAdmin = hasRole('admin');
  const isFilmmaker = hasRole('filmmaker');
  const isPartner = hasRole('partner');
  const isFree = hasRole('free');
  const hasOnboarded = profile?.has_completed_filmmaker_onboarding;

  const showFilmmakerLinks = (isFilmmaker && hasOnboarded) || isAdmin;
  const showPartnerLink = isPartner || isAdmin;
  const showOnboardingLink = isFilmmaker && !hasOnboarded;
  const canSubmitAndManageSubmissions = isFilmmaker || isAdmin;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 flex items-center gap-2 p-2 rounded-[4px] hover:bg-muted-gray/50">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback>
              <User className="h-5 w-5 text-bone-white" />
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-heading uppercase text-sm text-bone-white">{displayName}</span>
            {isAdmin && (
              <span className="bg-accent-yellow text-charcoal-black text-xs font-bold uppercase px-2 py-0.5 rounded-[4px] transform -rotate-3">Admin</span>
            )}
            {isPartner && !isAdmin && (
              <span className="bg-blue-400 text-charcoal-black text-xs font-bold uppercase px-2 py-0.5 rounded-[4px] transform -rotate-3">Partner</span>
            )}
            {isFree && !isAdmin && !isPartner && !isFilmmaker && (
              <Badge variant="free" className="transform -rotate-3 uppercase">Free</Badge>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-charcoal-black border-muted-gray text-bone-white" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-gray">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-muted-gray" />
        
        {isAdmin && (
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
            <Link to="/admin/dashboard">
              <Shield className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </Link>
          </DropdownMenuItem>
        )}
        
        {showPartnerLink && (
          <DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-muted-gray" />
            <DropdownMenuLabel>Sponsor Tools</DropdownMenuLabel>
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
              <Link to="/partner/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Partner Dashboard</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
              <Link to="/partner/ad-placements">
                <Megaphone className="mr-2 h-4 w-4" />
                <span>Ad Placements</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
              <Link to="/partner/analytics">
                <BarChart3 className="mr-2 h-4 w-4" />
                <span>Analytics</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
              <Link to="/partner/promotions">
                <Gem className="mr-2 h-4 w-4" />
                <span>Promotions</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
        
        <DropdownMenuSeparator className="bg-muted-gray" />
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
          <Link to="/dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
          <Link to="/filmmakers">
            <Users className="mr-2 h-4 w-4" />
            <span>Community</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
          <Link to="/the-backlot">
            <MessagesSquare className="mr-2 h-4 w-4" />
            <span>The Backlot</span>
          </Link>
        </DropdownMenuItem>
        {canSubmitAndManageSubmissions && (
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
            <Link to="/submit-project">
              <UploadCloud className="mr-2 h-4 w-4" />
              <span>Submit Project</span>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="bg-muted-gray" />
        
        {showFilmmakerLinks && (
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
            <Link to={`/profile/${username}`}>
              <User className="mr-2 h-4 w-4" />
              <span>My Profile</span>
            </Link>
          </DropdownMenuItem>
        )}
        {showOnboardingLink && (
           <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
              <Link to="/filmmaker-onboarding">
                <User className="mr-2 h-4 w-4" />
                <span>Complete Profile</span>
              </Link>
            </DropdownMenuItem>
        )}
        {canSubmitAndManageSubmissions && (
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
            <Link to="/my-submissions">
              <Film className="mr-2 h-4 w-4" />
              <span>My Submissions</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
          <Link to="/messages">
            <Mail className="mr-2 h-4 w-4" />
            <span>Messages</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
          <Link to="/notifications">
            <Bell className="mr-2 h-4 w-4" />
            <span>Notifications</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
          <Link to="/account/subscription-settings">
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Subscriptions</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted-gray/50">
          <Link to="/account">
            <Settings className="mr-2 h-4 w-4" />
            <span>Account Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-muted-gray" />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer focus:bg-muted-gray/50">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};