/**
 * Order Lodges Listing Page
 * Browse and find local lodges
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { orderAPI, Lodge } from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  MapPin,
  Users,
  Loader2,
  Search,
  ChevronRight,
  Building2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

export default function OrderLodges() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadLodges();
  }, []);

  const loadLodges = async () => {
    try {
      setLoading(true);
      const data = await orderAPI.listLodges();
      setLodges(data.lodges || []);
    } catch (error) {
      console.error('Failed to load lodges:', error);
      toast.error('Failed to load lodges');
    } finally {
      setLoading(false);
    }
  };

  const filteredLodges = lodges.filter(lodge => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lodge.name.toLowerCase().includes(query) ||
      lodge.city.toLowerCase().includes(query) ||
      (lodge.region && lodge.region.toLowerCase().includes(query))
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
            <Building2 className="h-8 w-8" />
            Order Lodges
          </h1>
          <p className="text-muted-foreground">
            Find and join a local lodge to connect with Order members in your area
          </p>
        </div>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, city, or region..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-muted-foreground">
          {filteredLodges.length} lodge{filteredLodges.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Lodges Grid */}
      {filteredLodges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No lodges found matching your search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLodges.map((lodge) => (
            <Card
              key={lodge.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/order/lodges/${lodge.id}`)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{lodge.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {lodge.city}{lodge.region ? `, ${lodge.region}` : ''}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>

                {lodge.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {lodge.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
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

                {lodge.status !== 'active' && (
                  <Badge variant="secondary" className="mt-3">
                    {lodge.status === 'forming' ? 'Forming' : lodge.status}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>About Lodges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Lodges are local chapters of The Second Watch Order where members gather for fellowship,
            networking, and professional development. Each lodge operates semi-autonomously while
            adhering to Order standards and values.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Regular Meetings</h4>
              <p className="text-sm text-muted-foreground">
                Lodges meet regularly for networking, workshops, and fellowship.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Local Network</h4>
              <p className="text-sm text-muted-foreground">
                Connect with Order members in your area for collaboration.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Professional Growth</h4>
              <p className="text-sm text-muted-foreground">
                Access workshops, mentorship, and skill-sharing opportunities.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
