/**
 * MentorshipWidget
 * Shows CraftHouse progression and mentorship opportunities for Order members
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { orderAPI, CraftHouseRole, PRIMARY_TRACKS, TRACK_TO_CRAFT_HOUSE } from '@/lib/api/order';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { GraduationCap, Users, Award, ChevronRight, Star, Compass, TrendingUp } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

// CraftHouse progression stages
const ROLE_PROGRESSION: CraftHouseRole[] = ['apprentice', 'associate', 'member', 'steward'];

const ROLE_INFO: Record<CraftHouseRole, { label: string; description: string; icon: typeof Star }> = {
  apprentice: { label: 'Apprentice', description: 'Learning the fundamentals', icon: Compass },
  associate: { label: 'Associate', description: 'Developing skills', icon: TrendingUp },
  member: { label: 'Member', description: 'Full craft house member', icon: Users },
  steward: { label: 'Steward', description: 'Mentor & leader', icon: Award },
};

// Get role progress percentage
function getRoleProgress(role: CraftHouseRole): number {
  const index = ROLE_PROGRESSION.indexOf(role);
  return ((index + 1) / ROLE_PROGRESSION.length) * 100;
}

// Get initials from name
function getInitials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Get track label
function getTrackLabel(track: string): string {
  const found = PRIMARY_TRACKS.find(t => t.value === track);
  return found?.label || track;
}

export function MentorshipWidget({ className = '' }: SectionProps) {
  // Get user's extended dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['order-dashboard-extended'],
    queryFn: () => orderAPI.getDashboardExtended(),
    staleTime: 5 * 60 * 1000,
  });

  // Get user's profile for track info
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['order-my-profile'],
    queryFn: () => orderAPI.getMyProfile(),
    staleTime: 5 * 60 * 1000,
  });

  // Get potential mentors (experienced members in the same track)
  const { data: mentors } = useQuery({
    queryKey: ['order-directory-mentors', profile?.primary_track],
    queryFn: () => orderAPI.getDirectory({
      track: profile?.primary_track,
      limit: 6,
    }),
    enabled: !!profile?.primary_track,
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = dashboardLoading || profileLoading;

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  // Only show if user is an Order member
  if (!dashboard?.is_order_member) {
    return null;
  }

  const primaryCraftHouse = dashboard.craft_houses?.[0];
  const currentRole = primaryCraftHouse?.role || 'apprentice';
  const roleInfo = ROLE_INFO[currentRole];
  const RoleIcon = roleInfo?.icon || Star;
  const progressPercent = getRoleProgress(currentRole);

  // Filter mentors to those with more experience
  const experiencedMentors = mentors?.filter(m =>
    m.years_experience && m.years_experience >= 5 &&
    m.user_id !== profile?.user_id
  ).slice(0, 3) || [];

  // If no craft house and no profile, minimal widget
  if (!primaryCraftHouse && !profile) {
    return null;
  }

  return (
    <div className={`p-4 bg-charcoal-black border border-primary-red/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary-red" />
          <h3 className="font-heading text-bone-white">Professional Growth</h3>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/order/craft-houses">
            Craft Houses
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* CraftHouse Progress */}
      {primaryCraftHouse && (
        <div className="mb-4 p-3 bg-muted-gray/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <RoleIcon className="w-4 h-4 text-primary-red" />
              <span className="font-medium text-bone-white">{roleInfo.label}</span>
            </div>
            <Badge variant="outline" className="bg-primary-red/20 text-primary-red border-primary-red/30">
              {primaryCraftHouse.craft_house_name || 'Craft House'}
            </Badge>
          </div>
          <Progress value={progressPercent} className="h-2 mb-2 [&>div]:bg-primary-red" />
          <div className="flex justify-between text-xs text-muted-gray">
            {ROLE_PROGRESSION.map((role, index) => (
              <span
                key={role}
                className={currentRole === role ? 'text-primary-red font-medium' : ''}
              >
                {ROLE_INFO[role].label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Track Info */}
      {profile?.primary_track && (
        <div className="mb-4 p-2 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-accent-yellow" />
            <span className="text-sm text-bone-white">
              Primary Track: <strong>{getTrackLabel(profile.primary_track)}</strong>
            </span>
            {profile.years_experience && (
              <Badge variant="outline" className="ml-auto text-xs">
                {profile.years_experience}+ years
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Mentors / Experienced Members */}
      {experiencedMentors.length > 0 && (
        <div>
          <p className="text-xs text-muted-gray uppercase tracking-wider mb-2">
            Connect With Experienced Members
          </p>
          <div className="space-y-2">
            {experiencedMentors.map(mentor => (
              <Link
                key={mentor.user_id}
                to={`/order/directory/${mentor.user_id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted-gray/10 transition-colors"
              >
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary-red/20 text-primary-red text-xs">
                    {getInitials(mentor.user_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-bone-white text-sm truncate">
                    {mentor.user_name || 'Order Member'}
                  </p>
                  <p className="text-xs text-muted-gray truncate">
                    {mentor.city || 'Unknown'} · {mentor.years_experience}+ years
                  </p>
                </div>
                {mentor.availability_status === 'available' && (
                  <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                    Available
                  </Badge>
                )}
              </Link>
            ))}
          </div>
          <Button variant="ghost" className="w-full mt-2 text-muted-gray hover:text-bone-white" asChild>
            <Link to={`/order/directory?track=${profile?.primary_track}`}>
              View Full Directory
            </Link>
          </Button>
        </div>
      )}

      {/* CTA to explore Craft Houses if not in one */}
      {!primaryCraftHouse && (
        <div className="text-center py-4">
          <p className="text-muted-gray text-sm mb-3">
            Join a Craft House to unlock mentorship and professional growth
          </p>
          <Button className="bg-primary-red text-white hover:bg-primary-red/90" asChild>
            <Link to="/order/craft-houses">
              <Users className="w-4 h-4 mr-2" />
              Explore Craft Houses
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default MentorshipWidget;
