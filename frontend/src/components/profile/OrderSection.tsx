/**
 * OrderSection Component
 * Displays Order membership information on the My Profile page
 * Respects visibility settings from order_profile_settings
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BadgeDisplay } from '@/components/UserBadge';
import {
  Shield,
  Edit,
  MapPin,
  Calendar,
  Briefcase,
  Users,
  Crown,
  Building2,
  ArrowRight,
  Film,
} from 'lucide-react';
import {
  OrderMemberProfile,
  LodgeMembership,
  OrderProfileSettings,
  PRIMARY_TRACKS,
} from '@/lib/api/order';
import { type BadgeConfig } from '@/lib/badges';

interface OrderActivityStats {
  jobApplicationsCount: number;
  acceptedJobsCount: number;
  greenRoomProjectsCount: number;
}

interface OrderSectionProps {
  // Order member profile data
  orderProfile: OrderMemberProfile | null;
  // Lodge membership data
  lodgeMembership: LodgeMembership | null;
  // Visibility settings
  settings: OrderProfileSettings | null;
  // Activity stats
  activityStats?: OrderActivityStats;
  // Badge info
  orderBadge?: BadgeConfig;
  lodgeOfficerBadge?: BadgeConfig;
  // Is this the profile owner viewing?
  isOwner: boolean;
  // Is the viewer an Order member? (for visibility checks)
  viewerIsOrderMember?: boolean;
  // Is the profile owner a lodge officer?
  isLodgeOfficer?: boolean;
}

// CTA for non-Order members
export const OrderJoinCTA: React.FC = () => {
  return (
    <Card className="bg-emerald-950/20 border-emerald-800/50 border-dashed">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="p-3 bg-emerald-600/20 rounded-full">
            <Shield className="h-8 w-8 text-emerald-400" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-semibold text-emerald-200 mb-1">
              The Second Watch Order
            </h3>
            <p className="text-sm text-emerald-300/70">
              A professional, God-centered guild for filmmakers and crew.
              Join to connect with fellow Christian creatives.
            </p>
          </div>
          <Button
            asChild
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Link to="/order">
              Learn More
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Minimal view for members-only visibility when viewer is not an Order member
const OrderMinimalView: React.FC = () => {
  return (
    <Card className="bg-emerald-950/20 border-emerald-800/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-emerald-400" />
          <span className="text-emerald-200 text-sm">
            This member is part of The Second Watch Order.
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export const OrderSection: React.FC<OrderSectionProps> = ({
  orderProfile,
  lodgeMembership,
  settings,
  activityStats,
  orderBadge,
  lodgeOfficerBadge,
  isOwner,
  viewerIsOrderMember = false,
  isLodgeOfficer = false,
}) => {
  // If no order profile, show join CTA for owner
  if (!orderProfile) {
    return isOwner ? <OrderJoinCTA /> : null;
  }

  // Apply visibility settings (use defaults if no settings)
  const showMembershipStatus = settings?.show_membership_status ?? true;
  const showOrderBadge = settings?.show_order_badge ?? true;
  const showJoinedDate = settings?.show_joined_date ?? true;
  const showCityRegion = settings?.show_city_region ?? true;
  const showLodgeInfo = settings?.show_lodge_info ?? true;
  const showOrderTrack = settings?.show_order_track ?? true;
  const showOrderActivity = settings?.show_order_activity ?? true;
  const publicVisibility = settings?.public_visibility ?? 'members-only';

  // Check visibility based on settings
  if (!isOwner) {
    if (publicVisibility === 'private') {
      return null;
    }
    if (publicVisibility === 'members-only' && !viewerIsOrderMember) {
      return <OrderMinimalView />;
    }
  }

  // Get track label
  const trackLabel = PRIMARY_TRACKS.find(t => t.value === orderProfile.primary_track)?.label || orderProfile.primary_track;

  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500 text-white';
      case 'probationary':
        return 'bg-amber-500 text-white';
      case 'suspended':
        return 'bg-red-500 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  return (
    <Card className="bg-emerald-950/30 border-emerald-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600/20 rounded-lg">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-emerald-100">The Order</CardTitle>
              <CardDescription className="text-emerald-300/70">
                Your role inside The Second Watch Order
              </CardDescription>
            </div>
          </div>
          {isOwner && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-emerald-600 text-emerald-300 hover:bg-emerald-600/20"
            >
              <Link to="/account/order-settings">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Membership Summary */}
        <div className="flex flex-wrap items-center gap-2">
          {showMembershipStatus && (
            <Badge className={getStatusColor(orderProfile.status)}>
              {orderProfile.status.charAt(0).toUpperCase() + orderProfile.status.slice(1)}
            </Badge>
          )}
          {showOrderBadge && orderBadge && (
            <BadgeDisplay badge={orderBadge} size="sm" />
          )}
          {showOrderBadge && isLodgeOfficer && lodgeOfficerBadge && (
            <BadgeDisplay badge={lodgeOfficerBadge} size="sm" />
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Joined Date */}
          {showJoinedDate && orderProfile.joined_at && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-300/70">Joined:</span>
              <span className="text-emerald-100">
                {new Date(orderProfile.joined_at).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}

          {/* Location */}
          {showCityRegion && (orderProfile.city || orderProfile.region) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-100">
                {[orderProfile.city, orderProfile.region].filter(Boolean).join(', ')}
              </span>
            </div>
          )}

          {/* Primary Track */}
          {showOrderTrack && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-300/70">Track:</span>
              <span className="text-emerald-100">{trackLabel}</span>
            </div>
          )}

          {/* Lodge Info */}
          {showLodgeInfo && lodgeMembership && lodgeMembership.status === 'active' && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-amber-400" />
              <span className="text-emerald-100">
                {lodgeMembership.lodge_name || 'Lodge Member'}
                {lodgeMembership.lodge_city && `, ${lodgeMembership.lodge_city}`}
              </span>
              {isLodgeOfficer && (
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-300">
                  <Crown className="h-3 w-3 mr-1" />
                  Officer
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Order Activity */}
        {showOrderActivity && activityStats && (
          <div className="pt-3 border-t border-emerald-700/50">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase mb-2">
              Order Activity
            </h4>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-100">
                  {activityStats.acceptedJobsCount} jobs booked
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-100">
                  {activityStats.greenRoomProjectsCount} Green Room projects
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Links for Owner */}
        {isOwner && (
          <div className="pt-3 border-t border-emerald-700/50 flex flex-wrap gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-emerald-600 text-emerald-300 hover:bg-emerald-600/20"
            >
              <Link to="/order/dashboard">
                Order Dashboard
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-emerald-300 hover:bg-emerald-600/20"
            >
              <Link to="/order/directory">
                Directory
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-emerald-300 hover:bg-emerald-600/20"
            >
              <Link to="/order/jobs">
                Jobs
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderSection;
