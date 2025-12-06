/**
 * Order Lodge Detail Page
 * View lodge details and join
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { orderAPI, Lodge, OrderMemberDirectoryEntry, PRIMARY_TRACKS } from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  MapPin,
  Users,
  Loader2,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  User,
  ChevronRight,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';

export default function OrderLodgeDetail() {
  const navigate = useNavigate();
  const { lodgeId } = useParams<{ lodgeId: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [lodge, setLodge] = useState<Lodge | null>(null);
  const [members, setMembers] = useState<OrderMemberDirectoryEntry[]>([]);
  const [joining, setJoining] = useState(false);
  const [userIsMember, setUserIsMember] = useState(false);

  useEffect(() => {
    loadLodge();
  }, [lodgeId]);

  const loadLodge = async () => {
    try {
      setLoading(true);
      const lodgeData = await orderAPI.getLodge(parseInt(lodgeId!));
      setLodge(lodgeData);

      // Try to load lodge members
      if (user) {
        try {
          const directoryData = await orderAPI.getDirectory({ lodge_id: parseInt(lodgeId!) });
          setMembers(directoryData);

          // Check if user is in this lodge
          const dashboard = await orderAPI.getDashboard();
          if (dashboard.lodge_id === parseInt(lodgeId!)) {
            setUserIsMember(true);
          }
        } catch (error) {
          // User might not be Order member
        }
      }
    } catch (error: any) {
      console.error('Failed to load lodge:', error);
      if (error.message?.includes('not found')) {
        toast.error('Lodge not found');
        navigate('/order/lodges');
      } else {
        toast.error('Failed to load lodge details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      navigate(`/login?redirect=/order/lodges/${lodgeId}`);
      return;
    }

    try {
      setJoining(true);
      await orderAPI.joinLodge(parseInt(lodgeId!));
      toast.success('Successfully joined lodge!');
      setUserIsMember(true);
      loadLodge();
    } catch (error: any) {
      toast.error(error.message || 'Failed to join lodge');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!lodge) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/order/lodges')} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Lodges
      </Button>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Header Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold">{lodge.name}</h1>
                    {lodge.status !== 'active' && (
                      <Badge variant="secondary">
                        {lodge.status === 'forming' ? 'Forming' : lodge.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-lg text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-5 w-5" />
                    {lodge.city}{lodge.region ? `, ${lodge.region}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-muted-foreground">
                {lodge.member_count !== undefined && (
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {lodge.member_count} member{lodge.member_count !== 1 ? 's' : ''}
                  </span>
                )}

                {lodge.meeting_schedule && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {lodge.meeting_schedule}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Member Notice */}
          {userIsMember && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700 dark:text-green-300">Your Lodge</AlertTitle>
              <AlertDescription>
                You are a member of this lodge. Connect with your fellow lodge members below.
              </AlertDescription>
            </Alert>
          )}

          {/* Description */}
          {lodge.description && (
            <Card>
              <CardHeader>
                <CardTitle>About This Lodge</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{lodge.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Meeting Info */}
          {(lodge.meeting_location || lodge.meeting_schedule) && (
            <Card>
              <CardHeader>
                <CardTitle>Meetings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lodge.meeting_schedule && (
                  <div>
                    <p className="text-sm text-muted-foreground">Schedule</p>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {lodge.meeting_schedule}
                    </p>
                  </div>
                )}
                {lodge.meeting_location && (
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {lodge.meeting_location}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Lodge Members */}
          {user && members.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Lodge Members</CardTitle>
                <CardDescription>
                  {members.length} member{members.length !== 1 ? 's' : ''} in this lodge
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.slice(0, 10).map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => navigate(`/order/members/${member.user_id}`)}
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {member.user_name || 'Order Member'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {PRIMARY_TRACKS.find(t => t.value === member.primary_track)?.label || member.primary_track}
                        </p>
                      </div>
                      <Badge
                        variant={member.availability_status === 'available' ? 'default' : 'secondary'}
                        className="shrink-0"
                      >
                        {member.availability_status || 'Unknown'}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                  {members.length > 10 && (
                    <p className="text-center text-sm text-muted-foreground pt-2">
                      And {members.length - 10} more members...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Join Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Join This Lodge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!user ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Sign in and become an Order member to join this lodge.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => navigate(`/login?redirect=/order/lodges/${lodgeId}`)}
                  >
                    Sign In
                  </Button>
                </>
              ) : userIsMember ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="font-medium">You're a Member</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You're part of this lodge
                  </p>
                </div>
              ) : lodge.status === 'inactive' ? (
                <div className="text-center py-4">
                  <p className="font-medium text-muted-foreground">Lodge Inactive</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This lodge is not currently accepting members
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Join this lodge to connect with local Order members and participate in meetings.
                  </p>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleJoin}
                    disabled={joining}
                  >
                    {joining ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        <Users className="h-4 w-4 mr-2" />
                        Join Lodge
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Lodge Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Lodge Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lodge.created_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Founded {new Date(lodge.created_at).toLocaleDateString()}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>
                  {lodge.status === 'active' ? 'Active Lodge' :
                   lodge.status === 'forming' ? 'Forming Lodge' : 'Inactive Lodge'}
                </span>
              </div>

              {lodge.contact_email && (
                <a
                  href={`mailto:${lodge.contact_email}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  Contact Lodge
                </a>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
