/**
 * Order Fellowship Detail Page
 * View a single fellowship and manage membership
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { orderAPI, Fellowship, FellowshipMembership, FellowshipType } from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Users,
  Loader2,
  Heart,
  Globe,
  GraduationCap,
  Star,
  UserPlus,
  UserMinus,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

// Icon mapping for fellowship types
const FELLOWSHIP_TYPE_ICONS: Record<FellowshipType, React.ReactNode> = {
  entry_level: <GraduationCap className="h-8 w-8" />,
  faith_based: <Heart className="h-8 w-8" />,
  special_interest: <Star className="h-8 w-8" />,
  regional: <Globe className="h-8 w-8" />,
};

const FELLOWSHIP_TYPE_LABELS: Record<FellowshipType, string> = {
  entry_level: 'Entry Level',
  faith_based: 'Faith-Based',
  special_interest: 'Special Interest',
  regional: 'Regional',
};

export default function OrderFellowshipDetail() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [fellowship, setFellowship] = useState<Fellowship | null>(null);
  const [myMembership, setMyMembership] = useState<FellowshipMembership | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (slug) {
      loadData();
    }
  }, [slug]);

  const loadData = async () => {
    try {
      setLoading(true);
      const fellowshipData = await orderAPI.getFellowshipBySlug(slug!);
      setFellowship(fellowshipData);

      // Check membership status
      const membershipsData = await orderAPI.getMyFellowshipMemberships().catch(() => []);
      const membership = membershipsData.find((m: FellowshipMembership) => m.fellowship_id === fellowshipData.id);
      setMyMembership(membership || null);
    } catch (error) {
      console.error('Failed to load fellowship:', error);
      toast.error('Failed to load fellowship');
      navigate('/order/fellowships');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!fellowship) return;
    try {
      setActionLoading(true);
      const membership = await orderAPI.joinFellowship(fellowship.id);
      setMyMembership(membership);
      toast.success(`Joined ${fellowship.name}!`);
    } catch (error: any) {
      console.error('Failed to join fellowship:', error);
      toast.error(error.message || 'Failed to join fellowship');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!fellowship) return;
    try {
      setActionLoading(true);
      await orderAPI.leaveFellowship(fellowship.id);
      setMyMembership(null);
      toast.success(`Left ${fellowship.name}`);
    } catch (error: any) {
      console.error('Failed to leave fellowship:', error);
      toast.error(error.message || 'Failed to leave fellowship');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!fellowship) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <p className="text-muted-foreground">Fellowship not found.</p>
        <Button onClick={() => navigate('/order/fellowships')} className="mt-4">
          Back to Fellowships
        </Button>
      </div>
    );
  }

  const icon = FELLOWSHIP_TYPE_ICONS[fellowship.fellowship_type] || <Star className="h-8 w-8" />;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <Button variant="ghost" onClick={() => navigate('/order/fellowships')} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Fellowships
      </Button>

      {/* Fellowship Header */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
              myMembership ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
            }`}>
              {icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{fellowship.name}</h1>
                {myMembership && (
                  <Badge className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Member
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge variant="outline">
                  {FELLOWSHIP_TYPE_LABELS[fellowship.fellowship_type]}
                </Badge>
                {fellowship.is_opt_in && (
                  <Badge variant="secondary">Opt-In</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {fellowship.member_count || 0} member{fellowship.member_count !== 1 ? 's' : ''}
                </span>
                {fellowship.status !== 'active' && (
                  <Badge variant="outline">{fellowship.status}</Badge>
                )}
              </div>
            </div>
            <div>
              {fellowship.is_opt_in && (
                myMembership ? (
                  <Button
                    variant="outline"
                    onClick={handleLeave}
                    disabled={actionLoading || myMembership.role !== 'member'}
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserMinus className="h-4 w-4 mr-2" />
                    )}
                    Leave Fellowship
                  </Button>
                ) : (
                  <Button onClick={handleJoin} disabled={actionLoading}>
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Join Fellowship
                  </Button>
                )
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {fellowship.description && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>About This Fellowship</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {fellowship.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Requirements */}
      {fellowship.requirements && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {fellowship.requirements}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Fellowship Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Fellowship Benefits</CardTitle>
          <CardDescription>What you get as a member</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Community</h4>
              <p className="text-sm text-muted-foreground">
                Connect with others who share your interests and values within The Order.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Events</h4>
              <p className="text-sm text-muted-foreground">
                Access to fellowship-specific events, meetups, and gatherings.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Resources</h4>
              <p className="text-sm text-muted-foreground">
                Exclusive resources and content tailored to this fellowship's focus.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Networking</h4>
              <p className="text-sm text-muted-foreground">
                Build deeper relationships with like-minded professionals.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
