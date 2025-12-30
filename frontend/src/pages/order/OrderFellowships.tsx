/**
 * Order Fellowships Listing Page
 * Browse and join cross-craft special interest groups
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { orderAPI, Fellowship, FellowshipMembership, FellowshipType } from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Users,
  Loader2,
  Search,
  ChevronRight,
  Heart,
  Globe,
  GraduationCap,
  Star,
  CheckCircle2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

// Icon mapping for fellowship types
const FELLOWSHIP_TYPE_ICONS: Record<FellowshipType, React.ReactNode> = {
  entry_level: <GraduationCap className="h-6 w-6" />,
  faith_based: <Heart className="h-6 w-6" />,
  special_interest: <Star className="h-6 w-6" />,
  regional: <Globe className="h-6 w-6" />,
};

const FELLOWSHIP_TYPE_LABELS: Record<FellowshipType, string> = {
  entry_level: 'Entry Level',
  faith_based: 'Faith-Based',
  special_interest: 'Special Interest',
  regional: 'Regional',
};

export default function OrderFellowships() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [fellowships, setFellowships] = useState<Fellowship[]>([]);
  const [myMemberships, setMyMemberships] = useState<FellowshipMembership[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fellowshipsData, membershipsData] = await Promise.all([
        orderAPI.listFellowships({ visible_only: true }),
        orderAPI.getMyFellowshipMemberships().catch(() => []),
      ]);
      setFellowships(fellowshipsData.fellowships || []);
      setMyMemberships(membershipsData || []);
    } catch (error) {
      console.error('Failed to load fellowships:', error);
      toast.error('Failed to load fellowships');
    } finally {
      setLoading(false);
    }
  };

  const isMember = (fellowshipId: number) => {
    return myMemberships.some(m => m.fellowship_id === fellowshipId);
  };

  const getMembership = (fellowshipId: number) => {
    return myMemberships.find(m => m.fellowship_id === fellowshipId);
  };

  const handleJoin = async (fellowship: Fellowship, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const membership = await orderAPI.joinFellowship(fellowship.id);
      setMyMemberships([...myMemberships, membership]);
      toast.success(`Joined ${fellowship.name}!`);
    } catch (error: any) {
      console.error('Failed to join fellowship:', error);
      toast.error(error.message || 'Failed to join fellowship');
    }
  };

  const filteredFellowships = fellowships.filter(fellowship => {
    // Apply type filter
    if (typeFilter !== 'all' && fellowship.fellowship_type !== typeFilter) {
      return false;
    }
    // Apply search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      fellowship.name.toLowerCase().includes(query) ||
      (fellowship.description && fellowship.description.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <Button variant="ghost" onClick={() => navigate('/order/dashboard')} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Heart className="h-8 w-8" />
            Fellowships
          </h1>
          <p className="text-muted-foreground">
            Cross-craft special interest groups for deeper connection and community
          </p>
        </div>
        {myMemberships.length > 0 && (
          <Badge variant="outline" className="mt-4 md:mt-0">
            Member of {myMemberships.length} fellowship{myMemberships.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search fellowships..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="entry_level">Entry Level</SelectItem>
                <SelectItem value="faith_based">Faith-Based</SelectItem>
                <SelectItem value="special_interest">Special Interest</SelectItem>
                <SelectItem value="regional">Regional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-muted-foreground">
          {filteredFellowships.length} fellowship{filteredFellowships.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Fellowships Grid */}
      {filteredFellowships.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No fellowships found matching your criteria.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFellowships.map((fellowship) => {
            const membership = getMembership(fellowship.id);
            const icon = FELLOWSHIP_TYPE_ICONS[fellowship.fellowship_type] || <Star className="h-6 w-6" />;

            return (
              <Card
                key={fellowship.id}
                className={`hover:shadow-lg transition-shadow cursor-pointer ${
                  membership ? 'border-primary/50 bg-primary/5' : ''
                }`}
                onClick={() => navigate(`/order/fellowships/${fellowship.slug}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        membership ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                      }`}>
                        {icon}
                      </div>
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {fellowship.name}
                          {membership && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {FELLOWSHIP_TYPE_LABELS[fellowship.fellowship_type]}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>

                  {fellowship.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {fellowship.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {fellowship.member_count || 0} member{fellowship.member_count !== 1 ? 's' : ''}
                    </span>

                    {!membership && fellowship.is_opt_in && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleJoin(fellowship, e)}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Join
                      </Button>
                    )}

                    {membership && (
                      <Badge variant="secondary" className="capitalize">
                        {membership.role}
                      </Badge>
                    )}
                  </div>

                  {fellowship.status !== 'active' && (
                    <Badge variant="outline" className="mt-3">
                      {fellowship.status}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>About Fellowships</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Fellowships are special interest groups that transcend craft boundaries. They bring
            together Order members who share common values, experiences, or interests. Some
            fellowships are opt-in (you choose to join), while others are based on your profile.
          </p>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="h-5 w-5 text-blue-500" />
                <h4 className="font-semibold">Entry Level</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                For those new to the industry - mentorship and guidance.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="h-5 w-5 text-red-500" />
                <h4 className="font-semibold">Faith-Based</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Deeper spiritual connection and faith-centered fellowship.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <h4 className="font-semibold">Special Interest</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Groups based on shared interests or demographics.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-5 w-5 text-green-500" />
                <h4 className="font-semibold">Regional</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Connect with members in your geographic area.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
