/**
 * Order Dashboard Page
 * Member dashboard for Order members with role-based features
 * Enhanced with fun personality and comprehensive features
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import {
  orderAPI,
  OrderDashboardStatsExtended,
  OrderMemberProfile,
  OrderBookingRequest,
  OrderJobApplication,
  OrderJob,
  OrderApplication,
  OrderEvent,
  MembershipStatus,
  PRIMARY_TRACKS,
  CraftHouseMembership,
} from '@/lib/api/order';
import OrderDuesCard from '@/components/order/OrderDuesCard';
import { BadgeDisplay } from '@/components/UserBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Users,
  Briefcase,
  MapPin,
  Calendar,
  Edit,
  ChevronRight,
  Clock,
  Bell,
  CheckCircle2,
  AlertCircle,
  Settings,
  Crown,
  FileText,
  Film,
  GraduationCap,
  BookOpen,
  Building2,
  UserCog,
  AlertTriangle,
  Hammer,
  Camera,
  Zap,
  Waves,
  ClipboardList,
  Clapperboard,
  PenTool,
  Wand2,
  Palette,
  Flame,
  Radio,
  Youtube,
  Heart,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Craft house icon mapping (new world-building names)
const CRAFT_ICONS: Record<string, React.ReactNode> = {
  'order-of-the-lens': <Camera className="h-4 w-4" />,
  'guild-of-sparks-and-steel': <Zap className="h-4 w-4" />,
  'echo-and-frame-guild': <Waves className="h-4 w-4" />,
  'keepers-of-the-line': <ClipboardList className="h-4 w-4" />,
  'scribes-of-the-second-draft': <PenTool className="h-4 w-4" />,
  'circle-of-action': <Clapperboard className="h-4 w-4" />,
  'worldbuilders-hall': <Palette className="h-4 w-4" />,
  'realm-of-illusions': <Wand2 className="h-4 w-4" />,
  'ground-game-order': <MapPin className="h-4 w-4" />,
  'fall-and-fire-circle': <Flame className="h-4 w-4" />,
  'live-signal-collective': <Radio className="h-4 w-4" />,
  'channel-and-feed-guild': <Youtube className="h-4 w-4" />,
};

export default function OrderDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    profile: userProfile,
    isLoading: profileLoading,
    isAdmin,
    isLodgeOfficer,
    primaryBadge,
    allBadges,
  } = useEnrichedProfile();

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<OrderDashboardStatsExtended | null>(null);
  const [profile, setProfile] = useState<OrderMemberProfile | null>(null);
  const [application, setApplication] = useState<OrderApplication | null>(null);
  const [bookingRequests, setBookingRequests] = useState<OrderBookingRequest[]>([]);
  const [jobApplications, setJobApplications] = useState<OrderJobApplication[]>([]);
  const [jobsForYou, setJobsForYou] = useState<OrderJob[]>([]);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/order/dashboard');
      return;
    }
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      // First get extended dashboard to check membership status
      const dashboardData = await orderAPI.getDashboardExtended();
      console.log('Dashboard data received:', dashboardData);
      setDashboard(dashboardData);

      if (dashboardData.is_order_member) {
        // Member - load full data
        const [profileData, bookingsData, applicationsData, jobsData, eventsData, membershipData] = await Promise.all([
          orderAPI.getMyProfile(),
          orderAPI.getMyBookingRequests().catch(() => []),
          orderAPI.getMyJobApplications().catch(() => ({ applications: [] })),
          orderAPI.listJobs({ active_only: true, limit: 5 }).catch(() => ({ jobs: [] })),
          orderAPI.listEvents({ upcoming_only: true, limit: 5 }).catch(() => ({ events: [] })),
          orderAPI.getMyMembershipStatus().catch(() => null),
        ]);

        setProfile(profileData);
        setBookingRequests(bookingsData);
        setJobApplications(applicationsData.applications || []);
        setJobsForYou(jobsData.jobs || []);
        setEvents(eventsData.events || []);
        setMembershipStatus(membershipData);
      } else {
        // Not a member - check for application
        const appData = await orderAPI.getMyApplication().catch(() => null);
        setApplication(appData);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'probationary':
        return <Badge variant="secondary">Probationary</Badge>;
      case 'active':
        return <Badge className="bg-accent-yellow text-charcoal-black">Active</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDuesStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-accent-yellow text-charcoal-black">Dues Current</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending Setup</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const getApplicationStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="text-lg px-4 py-2">Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-accent-yellow text-charcoal-black text-lg px-4 py-2">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-lg px-4 py-2">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-lg px-4 py-2">{status}</Badge>;
    }
  };

  // Loading state - playful
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.p
          className="text-accent-yellow font-spray text-3xl"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading The Order...
        </motion.p>
      </div>
    );
  }

  // Non-member view
  if (!dashboard?.is_order_member) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Shield className="h-16 w-16 mx-auto mb-4 text-accent-yellow" />
          <h1 className="text-4xl font-heading tracking-tighter mb-2">
            The <span className="font-spray text-accent-yellow">Order</span>
          </h1>
          <p className="text-muted-gray">
            A professional guild for filmmakers and crew, united by craft and calling
          </p>
        </motion.div>

        {application ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-dashed border-muted-gray">
              <CardHeader className="text-center">
                <CardTitle className="font-heading">Your Application Status</CardTitle>
                <CardDescription>
                  Submitted on {new Date(application.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  {getApplicationStatusBadge(application.status)}
                </div>

                {application.status === 'pending' && (
                  <Alert className="border-muted-gray">
                    <Clock className="h-4 w-4 text-accent-yellow" />
                    <AlertTitle>Under Review</AlertTitle>
                    <AlertDescription>
                      Your application is being reviewed by our team. This typically takes 3-5 business days.
                      We'll notify you by email once a decision has been made.
                    </AlertDescription>
                  </Alert>
                )}

                {application.status === 'approved' && (
                  <Alert className="border-accent-yellow bg-accent-yellow/10">
                    <CheckCircle2 className="h-4 w-4 text-accent-yellow" />
                    <AlertTitle className="text-accent-yellow">Congratulations!</AlertTitle>
                    <AlertDescription>
                      Your application has been approved. Please complete your profile setup to access Order features.
                    </AlertDescription>
                  </Alert>
                )}

                {application.status === 'rejected' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Application Not Approved</AlertTitle>
                    <AlertDescription>
                      {application.rejection_reason ||
                        'Unfortunately, your application was not approved at this time. You may reapply after 6 months.'}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="border border-muted-gray rounded-lg p-4 space-y-3">
                  <h4 className="font-heading text-sm uppercase tracking-wider">Application Details</h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Primary Track:</span>
                      <span>{PRIMARY_TRACKS.find(t => t.value === application.primary_track)?.label || application.primary_track}</span>
                    </div>
                    {application.city && (
                      <div className="flex justify-between">
                        <span className="text-muted-gray">Location:</span>
                        <span>{application.city}{application.region ? `, ${application.region}` : ''}</span>
                      </div>
                    )}
                    {application.years_experience !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-gray">Experience:</span>
                        <span>{application.years_experience} years</span>
                      </div>
                    )}
                  </div>
                </div>

                {application.status === 'approved' && (
                  <Button className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white" onClick={() => navigate('/order/profile/edit')}>
                    Complete Profile Setup
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-dashed border-muted-gray">
              <CardHeader className="text-center">
                <CardTitle className="font-heading">Not Yet a Member</CardTitle>
                <CardDescription>
                  Join The Order to connect with fellow Christian filmmakers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-accent-yellow mt-0.5" />
                    <div>
                      <p className="font-medium">Professional Network</p>
                      <p className="text-muted-gray">Connect with skilled Christian filmmakers across the industry</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Briefcase className="h-5 w-5 text-accent-yellow mt-0.5" />
                    <div>
                      <p className="font-medium">Exclusive Job Board</p>
                      <p className="text-muted-gray">Access job opportunities posted by and for Order members</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-accent-yellow mt-0.5" />
                    <div>
                      <p className="font-medium">Local Lodges</p>
                      <p className="text-muted-gray">Join a local chapter for in-person community and support</p>
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white" onClick={() => navigate('/order/apply')}>
                  Apply to Join The Order
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    );
  }

  // Member view
  const pendingBookings = bookingRequests.filter(r => r.status === 'pending');
  const activeApplications = jobApplications.filter(a => ['submitted', 'reviewed'].includes(a.status));

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Suspended Banner */}
      {dashboard.membership_status === 'suspended' && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Account Suspended</AlertTitle>
          <AlertDescription>
            Your Order membership has been suspended. Please contact support for more information.
          </AlertDescription>
        </Alert>
      )}

      {/* Header - Fun and On-Brand */}
      <motion.div
        className="flex flex-col md:flex-row md:items-center md:justify-between mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-4xl md:text-5xl font-heading tracking-tighter -rotate-1">
            The <span className="font-spray text-accent-yellow">Order</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-muted-gray">Welcome back,</span>
            <BadgeDisplay badge={primaryBadge} size="sm" />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 md:mt-0">
          {getStatusBadge(dashboard.membership_status || '')}
          {getDuesStatusBadge(dashboard.dues_status)}
        </div>
      </motion.div>

      {/* Probationary Notice */}
      {dashboard.membership_status === 'probationary' && (
        <Alert className="mb-6 border-accent-yellow bg-accent-yellow/10">
          <Clock className="h-4 w-4 text-accent-yellow" />
          <AlertTitle className="text-accent-yellow">Probationary Member</AlertTitle>
          <AlertDescription>
            You're currently in your probationary period. Continue engaging with the community to become a full member.
          </AlertDescription>
        </Alert>
      )}

      {/* Dues Notice */}
      {dashboard.dues_status === 'pending' && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Dues Setup Required</AlertTitle>
          <AlertDescription>
            Please set up your membership dues below to maintain your Order membership.
          </AlertDescription>
        </Alert>
      )}

      {/* Past Due Notice */}
      {dashboard.dues_status === 'past_due' && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Dues Past Due</AlertTitle>
          <AlertDescription>
            Your membership dues payment has failed. Please update your payment method to avoid losing your membership.
          </AlertDescription>
        </Alert>
      )}

      {/* Admin Tools Card - Fixed styling */}
      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="mb-6 border-2 border-dashed border-accent-yellow bg-charcoal-black/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-accent-yellow" />
                <CardTitle className="text-lg font-heading">Admin Tools</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button variant="outline" size="sm" className="justify-start border-muted-gray hover:border-accent-yellow hover:text-accent-yellow" onClick={() => navigate('/admin/order')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Order Admin
                </Button>
                <Button variant="outline" size="sm" className="justify-start border-muted-gray hover:border-accent-yellow hover:text-accent-yellow" onClick={() => navigate('/admin/order?tab=members')}>
                  <Users className="h-4 w-4 mr-2" />
                  Members
                </Button>
                <Button variant="outline" size="sm" className="justify-start border-muted-gray hover:border-accent-yellow hover:text-accent-yellow" onClick={() => navigate('/admin/order?tab=lodges')}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Lodges
                </Button>
                <Button variant="outline" size="sm" className="justify-start border-muted-gray hover:border-accent-yellow hover:text-accent-yellow" onClick={() => navigate('/admin/order?tab=stats')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Stats
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Lodge Officer Tools Card - Fixed styling */}
      {isLodgeOfficer && dashboard.lodge_id && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="mb-6 border-2 border-dashed border-amber-500 bg-charcoal-black/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-lg font-heading">Lodge Officer Tools</CardTitle>
                {dashboard.lodge_name && (
                  <Badge variant="outline" className="ml-2 border-amber-500 text-amber-500">{dashboard.lodge_name}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Button variant="outline" size="sm" className="justify-start border-muted-gray hover:border-amber-500 hover:text-amber-500" onClick={() => navigate(`/order/lodges/${dashboard.lodge_id}/manage`)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Lodge
                </Button>
                <Button variant="outline" size="sm" className="justify-start border-muted-gray hover:border-amber-500 hover:text-amber-500" onClick={() => navigate(`/order/lodges/${dashboard.lodge_id}/members`)}>
                  <Users className="h-4 w-4 mr-2" />
                  Members
                </Button>
                <Button variant="outline" size="sm" className="justify-start border-muted-gray hover:border-amber-500 hover:text-amber-500" onClick={() => navigate('/order/jobs/create')}>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Post Job
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Stats */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-muted-gray/50 hover:border-accent-yellow/50 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-gray uppercase tracking-wider">Bookings</p>
                <p className="text-2xl font-bold text-accent-yellow">{dashboard.pending_booking_requests}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-gray" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted-gray/50 hover:border-accent-yellow/50 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-gray uppercase tracking-wider">Applications</p>
                <p className="text-2xl font-bold text-accent-yellow">{dashboard.active_job_applications}</p>
              </div>
              <Briefcase className="h-8 w-8 text-muted-gray" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted-gray/50 hover:border-accent-yellow/50 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-gray uppercase tracking-wider">Track</p>
                <p className="text-lg font-medium truncate">
                  {PRIMARY_TRACKS.find(t => t.value === dashboard.primary_track)?.label || dashboard.primary_track || 'Not set'}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-gray" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted-gray/50 hover:border-accent-yellow/50 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-gray uppercase tracking-wider">Lodge</p>
                <p className="text-lg font-medium truncate">
                  {dashboard.lodge_name || 'Not joined'}
                </p>
              </div>
              <MapPin className="h-8 w-8 text-muted-gray" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column - Quick Actions & Profile */}
        <div className="space-y-6">
          {/* Membership Card */}
          {profile && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="border-2 border-accent-yellow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-accent-yellow" />
                    <CardTitle className="text-lg font-heading">Membership</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" className="hover:text-accent-yellow" onClick={() => navigate('/order/profile/edit')}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-1">
                    {allBadges.map((badge) => (
                      <BadgeDisplay key={badge.role} badge={badge} size="sm" />
                    ))}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Track</span>
                      <span className="font-medium">
                        {PRIMARY_TRACKS.find(t => t.value === profile.primary_track)?.label || profile.primary_track}
                      </span>
                    </div>
                    {profile.city && (
                      <div className="flex justify-between">
                        <span className="text-muted-gray">Location</span>
                        <span className="font-medium">
                          {profile.city}{profile.region ? `, ${profile.region}` : ''}
                        </span>
                      </div>
                    )}
                    {profile.years_experience !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-gray">Experience</span>
                        <span className="font-medium">{profile.years_experience} years</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Availability</span>
                      <Badge variant={profile.availability_status === 'available' ? 'default' : 'secondary'} className="text-xs">
                        {profile.availability_status || 'Not set'}
                      </Badge>
                    </div>
                    {profile.joined_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-gray">Member Since</span>
                        <span className="font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(profile.joined_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Membership Dues Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.28 }}
          >
            <OrderDuesCard membershipStatus={membershipStatus || undefined} />
          </motion.div>

          {/* Upcoming Events Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-dashed border-muted-gray">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-accent-yellow" />
                    <CardTitle className="text-lg font-heading">Upcoming Events</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" className="hover:text-accent-yellow" onClick={() => navigate('/order/events')}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {events.length === 0 ? (
                  <p className="text-center text-muted-gray py-4 text-sm">No upcoming events</p>
                ) : (
                  events.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-muted-gray/10 cursor-pointer transition-colors"
                      onClick={() => navigate(`/order/events/${event.id}`)}
                    >
                      <div className="text-center min-w-[45px] bg-charcoal-black border border-muted-gray rounded p-1">
                        <p className="text-xs text-muted-gray uppercase">{format(new Date(event.start_date), 'MMM')}</p>
                        <p className="text-lg font-bold text-accent-yellow">{format(new Date(event.start_date), 'd')}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{event.title}</p>
                        <p className="text-xs text-muted-gray truncate">
                          {event.is_online ? 'Online' : event.location || 'TBD'}
                        </p>
                      </div>
                      {event.user_rsvp_status === 'attending' && (
                        <Badge variant="outline" className="text-xs border-accent-yellow text-accent-yellow">Going</Badge>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Your Craft Houses Card */}
          {dashboard.craft_houses && dashboard.craft_houses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="border-dashed border-muted-gray">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hammer className="h-5 w-5 text-accent-yellow" />
                      <CardTitle className="text-lg font-heading">Your Craft Houses</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" className="hover:text-accent-yellow" onClick={() => navigate('/order/craft-houses')}>
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dashboard.craft_houses.map((house: CraftHouseMembership) => (
                    <Button
                      key={house.id}
                      variant="ghost"
                      className="w-full justify-start hover:bg-muted-gray/10"
                      onClick={() => navigate(`/order/craft-houses/${house.craft_house_id}`)}
                    >
                      <span className="text-accent-yellow mr-2">
                        {CRAFT_ICONS[house.craft_house_name?.toLowerCase().replace(/ /g, '-') || ''] || <Hammer className="h-4 w-4" />}
                      </span>
                      <span className="flex-1 text-left truncate">{house.craft_house_name}</span>
                      {house.role && (
                        house.role === 'steward' ? (
                          <Badge className="ml-2 text-xs bg-accent-yellow text-charcoal-black">
                            <Crown className="h-3 w-3 mr-1" />
                            Steward
                          </Badge>
                        ) : house.role !== 'member' ? (
                          <Badge variant="outline" className="ml-2 text-xs border-muted-gray text-bone-white capitalize">
                            {house.role}
                          </Badge>
                        ) : null
                      )}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-muted-gray/50">
              <CardHeader>
                <CardTitle className="font-heading">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-between border-muted-gray/50 hover:border-accent-yellow hover:text-accent-yellow" onClick={() => navigate('/order/directory')}>
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Member Directory
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between border-muted-gray/50 hover:border-accent-yellow hover:text-accent-yellow" onClick={() => navigate('/order/jobs')}>
                  <span className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Browse Jobs
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between border-muted-gray/50 hover:border-accent-yellow hover:text-accent-yellow" onClick={() => navigate('/order/lodges')}>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Find a Lodge
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between border-muted-gray/50 hover:border-accent-yellow hover:text-accent-yellow" onClick={() => navigate('/order/craft-houses')}>
                  <span className="flex items-center gap-2">
                    <Hammer className="h-4 w-4" />
                    Craft Houses
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between border-muted-gray/50 hover:border-accent-yellow hover:text-accent-yellow" onClick={() => navigate('/order/fellowships')}>
                  <span className="flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Fellowships
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between border-muted-gray/50 hover:border-accent-yellow hover:text-accent-yellow" onClick={() => navigate('/order/governance')}>
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Governance
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Jobs For You */}
          {jobsForYou.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Card className="border-muted-gray/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-heading">Jobs For You</CardTitle>
                    <Button variant="ghost" size="sm" className="hover:text-accent-yellow" onClick={() => navigate('/order/jobs')}>
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {jobsForYou.slice(0, 3).map((job) => (
                    <div
                      key={job.id}
                      className="border border-muted-gray/50 rounded-lg p-3 cursor-pointer hover:border-accent-yellow/50 transition-colors"
                      onClick={() => navigate(`/order/jobs/${job.id}`)}
                    >
                      <h4 className="font-medium text-sm line-clamp-1">{job.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-gray mt-1">
                        {job.location && <span>{job.location}</span>}
                        {job.is_paid && <Badge variant="outline" className="text-xs border-accent-yellow text-accent-yellow">Paid</Badge>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Lodge Panel */}
          {dashboard.lodge_id && dashboard.lodge_name && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-muted-gray/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-lg font-heading">Your Lodge</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-semibold">{dashboard.lodge_name}</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full border-muted-gray/50 hover:border-amber-500 hover:text-amber-500" onClick={() => navigate(`/order/lodges/${dashboard.lodge_id}`)}>
                    View Lodge
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Resources */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.55 }}
          >
            <Card className="border-muted-gray/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-lg font-heading">Resources</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="ghost" size="sm" className="w-full justify-start hover:text-accent-yellow" onClick={() => navigate('/order/resources')}>
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Training & Tutorials
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start hover:text-accent-yellow" onClick={() => navigate('/order/events')}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Events & Meetups
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start hover:text-accent-yellow" onClick={() => navigate('/greenroom')}>
                  <Film className="h-4 w-4 mr-2" />
                  Green Room
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Column - Activity Tabs */}
        <motion.div
          className="md:col-span-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs defaultValue="bookings">
            <TabsList className="grid w-full grid-cols-2 bg-charcoal-black border border-muted-gray">
              <TabsTrigger value="bookings" className="relative data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
                Booking Requests
                {pendingBookings.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {pendingBookings.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="applications" className="relative data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
                Job Applications
                {activeApplications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {activeApplications.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bookings" className="mt-4">
              <Card className="border-muted-gray/50">
                <CardHeader>
                  <CardTitle className="font-heading">Booking Requests</CardTitle>
                  <CardDescription>
                    People interested in hiring you for projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {bookingRequests.length === 0 ? (
                    <p className="text-center text-muted-gray py-8">
                      No booking requests yet. Make sure your profile is complete and visible!
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {bookingRequests.map((request) => (
                        <div key={request.id} className="border border-muted-gray/50 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold">{request.project_title || 'Untitled Project'}</h4>
                              <p className="text-sm text-muted-gray">
                                From: {request.requester_name} {request.requester_org ? `(${request.requester_org})` : ''}
                              </p>
                            </div>
                            <Badge variant={request.status === 'pending' ? 'secondary' : 'outline'}>
                              {request.status}
                            </Badge>
                          </div>
                          <p className="text-sm mb-2 line-clamp-2">{request.details}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-gray">
                            {request.location && <span>{request.location}</span>}
                            {request.dates && <span>{request.dates}</span>}
                          </div>
                          {request.status === 'pending' && (
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" className="bg-accent-yellow text-charcoal-black hover:bg-bone-white" onClick={() => {
                                toast.info('Booking response coming soon');
                              }}>
                                Respond
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="applications" className="mt-4">
              <Card className="border-muted-gray/50">
                <CardHeader>
                  <CardTitle className="font-heading">Job Applications</CardTitle>
                  <CardDescription>
                    Your applications to Order jobs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {jobApplications.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-gray mb-4">
                        You haven't applied to any jobs yet.
                      </p>
                      <Button className="bg-accent-yellow text-charcoal-black hover:bg-bone-white" onClick={() => navigate('/order/jobs')}>
                        Browse Jobs
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {jobApplications.map((application) => (
                        <div key={application.id} className="border border-muted-gray/50 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold">{application.job_title || `Job #${application.job_id}`}</h4>
                            <Badge variant={
                              application.status === 'accepted' ? 'default' :
                              application.status === 'rejected' ? 'destructive' :
                              'secondary'
                            }>
                              {application.status === 'submitted' && <Clock className="h-3 w-3 mr-1" />}
                              {application.status === 'accepted' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {application.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-gray">
                            Applied on {new Date(application.created_at).toLocaleDateString()}
                          </p>
                          {application.feedback && (
                            <p className="text-sm mt-2 p-2 bg-muted-gray/10 rounded">
                              <strong>Feedback:</strong> {application.feedback}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
