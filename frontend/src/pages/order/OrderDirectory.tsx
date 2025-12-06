/**
 * Order Member Directory
 * Searchable directory of Order members
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  orderAPI,
  OrderMemberDirectoryEntry,
  PRIMARY_TRACKS,
  Lodge,
} from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Search,
  User,
  MapPin,
  Loader2,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

export default function OrderDirectory() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<OrderMemberDirectoryEntry[]>([]);
  const [lodges, setLodges] = useState<Lodge[]>([]);

  // Filters
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [lodgeFilter, setLodgeFilter] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/order/directory');
      return;
    }
    loadData();
  }, [user]);

  useEffect(() => {
    if (user) {
      searchMembers();
    }
  }, [trackFilter, cityFilter, lodgeFilter, availabilityFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [membersData, lodgesData] = await Promise.all([
        orderAPI.getDirectory(),
        orderAPI.listLodges(),
      ]);
      setMembers(membersData);
      setLodges(lodgesData.lodges || []);
    } catch (error: any) {
      console.error('Failed to load directory:', error);
      if (error.message?.includes('Order membership required')) {
        toast.error('Order membership required to view directory');
        navigate('/order');
      }
    } finally {
      setLoading(false);
    }
  };

  const searchMembers = async () => {
    try {
      const options: any = {};
      if (trackFilter && trackFilter !== 'all') options.track = trackFilter;
      if (cityFilter) options.city = cityFilter;
      if (lodgeFilter && lodgeFilter !== 'all') options.lodge_id = parseInt(lodgeFilter);
      if (availabilityFilter && availabilityFilter !== 'all') options.availability = availabilityFilter;

      const data = await orderAPI.getDirectory(options);
      setMembers(data);
    } catch (error) {
      console.error('Failed to search:', error);
    }
  };

  const getAvailabilityBadge = (status?: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500">Available</Badge>;
      case 'busy':
        return <Badge variant="secondary">Busy</Badge>;
      case 'unavailable':
        return <Badge variant="outline">Unavailable</Badge>;
      default:
        return null;
    }
  };

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

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Member Directory</h1>
        <p className="text-muted-foreground">
          Find and connect with Order members across the network
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Track Filter */}
            <Select value={trackFilter} onValueChange={setTrackFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Tracks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tracks</SelectItem>
                {PRIMARY_TRACKS.map((track) => (
                  <SelectItem key={track.value} value={track.value}>
                    {track.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* City Filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by city..."
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Lodge Filter */}
            <Select value={lodgeFilter} onValueChange={setLodgeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Lodges" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lodges</SelectItem>
                {lodges.map((lodge) => (
                  <SelectItem key={lodge.id} value={lodge.id.toString()}>
                    {lodge.name} ({lodge.city})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Availability Filter */}
            <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Any Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Availability</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="mb-4">
        <p className="text-muted-foreground">
          {members.length} member{members.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No members found matching your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <Card
              key={member.user_id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/order/members/${member.user_id}`)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {/* Avatar placeholder */}
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold truncate">
                        {member.user_name || 'Order Member'}
                      </h3>
                      {getAvailabilityBadge(member.availability_status)}
                    </div>

                    <p className="text-sm text-primary font-medium">
                      {PRIMARY_TRACKS.find(t => t.value === member.primary_track)?.label || member.primary_track}
                    </p>

                    {(member.city || member.region) && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {member.city}{member.region ? `, ${member.region}` : ''}
                      </p>
                    )}

                    {member.lodge_name && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {member.lodge_name}
                      </p>
                    )}

                    {member.years_experience !== undefined && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {member.years_experience} years experience
                      </p>
                    )}

                    {member.bio && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {member.bio}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
