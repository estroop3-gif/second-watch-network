/**
 * Order Dashboard Page
 * Member dashboard for Order members with role-based features
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import {
  orderAPI,
  OrderDashboardStats,
  OrderMemberProfile,
  OrderBookingRequest,
  OrderJobApplication,
  OrderJob,
  OrderApplication,
  PRIMARY_TRACKS,
} from '@/lib/api/order';
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
  Loader2,
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
} from 'lucide-react';
import { toast } from 'sonner';

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
  const [dashboard, setDashboard] = useState<OrderDashboardStats | null>(null);
  const [profile, setProfile] = useState<OrderMemberProfile | null>(null);
  const [application, setApplication] = useState<OrderApplication | null>(null);
  const [bookingRequests, setBookingRequests] = useState<OrderBookingRequest[]>([]);
  const [jobApplications, setJobApplications] = useState<OrderJobApplication[]>([]);
  const [jobsForYou, setJobsForYou] = useState<OrderJob[]>([]);

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

      // First get dashboard to check membership status
      const dashboardData = await orderAPI.getDashboard();
      setDashboard(dashboardData);

      if (dashboardData.is_order_member) {
        // Member - load full data
        const [profileData, bookingsData, applicationsData, jobsData] = await Promise.all([
          orderAPI.getMyProfile(),
          orderAPI.getMyBookingRequests().catch(() => []),
          orderAPI.getMyJobApplications().catch(() => ({ applications: [] })),
          orderAPI.listJobs({ active_only: true, limit: 5 }).catch(() => ({ jobs: [] })),
        ]);

        setProfile(profileData);
        setBookingRequests(bookingsData);
        setJobApplications(applicationsData.applications || []);
        setJobsForYou(jobsData.jobs || []);
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
        return <Badge className="bg-green-500">Active</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDuesStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Dues Current</Badge>;
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
        return <Badge className="bg-green-500 text-lg px-4 py-2">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-lg px-4 py-2">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-lg px-4 py-2">{status}</Badge>;
    }
  };

  // Loading state
  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // isAdmin and isLodgeOfficer now come from useEnrichedProfile

  // Non-member view
  if (!dashboard?.is_order_member) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="text-center mb-8">
          <Shield className="h-16 w-16 mx-auto mb-4 text-emerald-600" />
          <h1 className="text-3xl font-bold mb-2">The Second Watch Order</h1>
          <p className="text-muted-foreground">
            A professional, God-centered guild for filmmakers and crew
          </p>
        </div>

        {application ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Your Application Status</CardTitle>
              <CardDescription>
                Submitted on {new Date(application.created_at).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                {getApplicationStatusBadge(application.status)}
              </div>

              {application.status === 'pending' && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertTitle>Under Review</AlertTitle>
                  <AlertDescription>
                    Your application is being reviewed by our team. This typically takes 3-5 business days.
                    We'll notify you by email once a decision has been made.
                  </AlertDescription>
                </Alert>
              )}

              {application.status === 'approved' && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-600">Congratulations!</AlertTitle>
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

              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold">Application Details</h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Primary Track:</span>
                    <span>{PRIMARY_TRACKS.find(t => t.value === application.primary_track)?.label || application.primary_track}</span>
                  </div>
                  {application.city && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span>{application.city}{application.region ? `, ${application.region}` : ''}</span>
                    </div>
                  )}
                  {application.years_experience !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Experience:</span>
                      <span>{application.years_experience} years</span>
                    </div>
                  )}
                </div>
              </div>

              {application.status === 'approved' && (
                <Button className="w-full" onClick={() => navigate('/order/profile/edit')}>
                  Complete Profile Setup
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Not Yet a Member</CardTitle>
              <CardDescription>
                Join The Order to connect with fellow Christian filmmakers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Professional Network</p>
                    <p className="text-muted-foreground">Connect with skilled Christian filmmakers across the industry</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Exclusive Job Board</p>
                    <p className="text-muted-foreground">Access job opportunities posted by and for Order members</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Local Lodges</p>
                    <p className="text-muted-foreground">Join a local chapter for in-person community and support</p>
                  </div>
                </div>
              </div>

              <Button className="w-full" onClick={() => navigate('/order/apply')}>
                Apply to Join The Order
              </Button>
            </CardContent>
          </Card>
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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-emerald-600" />
            <h1 className="text-3xl font-bold">Order Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Welcome back,</span>
            <BadgeDisplay badge={primaryBadge} size="sm" />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 md:mt-0">
          {getStatusBadge(dashboard.membership_status || '')}
          {getDuesStatusBadge(dashboard.dues_status)}
        </div>
      </div>

      {/* Probationary Notice */}
      {dashboard.membership_status === 'probationary' && (
        <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-600">Probationary Member</AlertTitle>
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
            Please set up your membership dues to maintain your Order membership.
          </AlertDescription>
        </Alert>
      )}

      {/* Admin Tools Card */}
      {isAdmin && (
        <Card className="mb-6 border-yellow-500 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg">Admin Tools</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button variant="outline" size="sm" className="justify-start" onClick={() => navigate('/order/admin/applications')}>
                <FileText className="h-4 w-4 mr-2" />
                Applications
              </Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={() => navigate('/order/admin/members')}>
                <Users className="h-4 w-4 mr-2" />
                Members
              </Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={() => navigate('/order/admin/lodges')}>
                <Building2 className="h-4 w-4 mr-2" />
                Lodges
              </Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={() => navigate('/order/admin/stats')}>
                <Settings className="h-4 w-4 mr-2" />
                Stats
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lodge Officer Tools Card */}
      {isLodgeOfficer && dashboard.lodge_id && (
        <Card className="mb-6 border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-lg">Lodge Officer Tools</CardTitle>
              {dashboard.lodge_name && (
                <Badge variant="outline" className="ml-2">{dashboard.lodge_name}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Button variant="outline" size="sm" className="justify-start" onClick={() => navigate(`/order/lodges/${dashboard.lodge_id}/manage`)}>
                <Settings className="h-4 w-4 mr-2" />
                Manage Lodge
              </Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={() => navigate(`/order/lodges/${dashboard.lodge_id}/members`)}>
                <Users className="h-4 w-4 mr-2" />
                Members
              </Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={() => navigate('/order/jobs/create')}>
                <Briefcase className="h-4 w-4 mr-2" />
                Post Job
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Booking Requests</p>
                <p className="text-2xl font-bold">{dashboard.pending_booking_requests}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Job Applications</p>
                <p className="text-2xl font-bold">{dashboard.active_job_applications}</p>
              </div>
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Primary Track</p>
                <p className="text-lg font-medium truncate">
                  {PRIMARY_TRACKS.find(t => t.value === dashboard.primary_track)?.label || dashboard.primary_track || 'Not set'}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lodge</p>
                <p className="text-lg font-medium truncate">
                  {dashboard.lodge_name || 'Not joined'}
                </p>
              </div>
              <MapPin className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column - Quick Actions & Profile */}
        <div className="space-y-6">
          {/* Membership Card */}
          {profile && (
            <Card className="border-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-lg">Membership</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/order/profile/edit')}>
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
                    <span className="text-muted-foreground">Track</span>
                    <span className="font-medium">
                      {PRIMARY_TRACKS.find(t => t.value === profile.primary_track)?.label || profile.primary_track}
                    </span>
                  </div>
                  {profile.city && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span className="font-medium">
                        {profile.city}{profile.region ? `, ${profile.region}` : ''}
                      </span>
                    </div>
                  )}
                  {profile.years_experience !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Experience</span>
                      <span className="font-medium">{profile.years_experience} years</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Availability</span>
                    <Badge variant={profile.availability_status === 'available' ? 'default' : 'secondary'} className="text-xs">
                      {profile.availability_status || 'Not set'}
                    </Badge>
                  </div>
                  {profile.joined_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Member Since</span>
                      <span className="font-medium flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(profile.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/order/directory')}>
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Member Directory
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/order/jobs')}>
                <span className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Browse Jobs
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/order/lodges')}>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Find a Lodge
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Jobs For You */}
          {jobsForYou.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Jobs For You</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/order/jobs')}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {jobsForYou.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/order/jobs/${job.id}`)}
                  >
                    <h4 className="font-medium text-sm line-clamp-1">{job.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      {job.location && <span>{job.location}</span>}
                      {job.is_paid && <Badge variant="outline" className="text-xs">Paid</Badge>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Lodge Panel */}
          {dashboard.lodge_id && dashboard.lodge_name && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-lg">Your Lodge</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold">{dashboard.lodge_name}</p>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(`/order/lodges/${dashboard.lodge_id}`)}>
                  View Lodge
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Resources */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Resources</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => navigate('/order/resources')}>
                <GraduationCap className="h-4 w-4 mr-2" />
                Training & Tutorials
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => navigate('/order/events')}>
                <Calendar className="h-4 w-4 mr-2" />
                Events & Meetups
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => navigate('/greenroom')}>
                <Film className="h-4 w-4 mr-2" />
                Green Room
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Activity Tabs */}
        <div className="md:col-span-2">
          <Tabs defaultValue="bookings">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bookings" className="relative">
                Booking Requests
                {pendingBookings.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {pendingBookings.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="applications" className="relative">
                Job Applications
                {activeApplications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {activeApplications.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bookings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Booking Requests</CardTitle>
                  <CardDescription>
                    People interested in hiring you for projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {bookingRequests.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No booking requests yet. Make sure your profile is complete and visible!
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {bookingRequests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold">{request.project_title || 'Untitled Project'}</h4>
                              <p className="text-sm text-muted-foreground">
                                From: {request.requester_name} {request.requester_org ? `(${request.requester_org})` : ''}
                              </p>
                            </div>
                            <Badge variant={request.status === 'pending' ? 'secondary' : 'outline'}>
                              {request.status}
                            </Badge>
                          </div>
                          <p className="text-sm mb-2 line-clamp-2">{request.details}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {request.location && <span>{request.location}</span>}
                            {request.dates && <span>{request.dates}</span>}
                          </div>
                          {request.status === 'pending' && (
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" onClick={() => {
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
              <Card>
                <CardHeader>
                  <CardTitle>Job Applications</CardTitle>
                  <CardDescription>
                    Your applications to Order jobs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {jobApplications.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        You haven't applied to any jobs yet.
                      </p>
                      <Button onClick={() => navigate('/order/jobs')}>
                        Browse Jobs
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {jobApplications.map((application) => (
                        <div key={application.id} className="border rounded-lg p-4">
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
                          <p className="text-sm text-muted-foreground">
                            Applied on {new Date(application.created_at).toLocaleDateString()}
                          </p>
                          {application.feedback && (
                            <p className="text-sm mt-2 p-2 bg-muted rounded">
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
        </div>
      </div>
    </div>
  );
}
