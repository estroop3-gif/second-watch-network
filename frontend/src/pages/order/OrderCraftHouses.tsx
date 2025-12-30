/**
 * Order Craft Houses Listing Page
 * Browse all craft houses (department-based groups)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { orderAPI, CraftHouse, CraftHouseMembership, PRIMARY_TRACKS, TRACK_TO_CRAFT_HOUSE } from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Users,
  Loader2,
  Search,
  ChevronRight,
  Hammer,
  Camera,
  Zap,
  Waves,
  ClipboardList,
  Clapperboard,
  PenTool,
  Wand2,
  Palette,
  MapPin,
  Flame,
  Radio,
  Youtube,
  CheckCircle2,
  Crown,
} from 'lucide-react';
import { toast } from 'sonner';

// Icon mapping for craft houses (new world-building names)
const CRAFT_HOUSE_ICONS: Record<string, React.ReactNode> = {
  'order-of-the-lens': <Camera className="h-6 w-6" />,
  'guild-of-sparks-and-steel': <Zap className="h-6 w-6" />,
  'echo-and-frame-guild': <Waves className="h-6 w-6" />,
  'keepers-of-the-line': <ClipboardList className="h-6 w-6" />,
  'scribes-of-the-second-draft': <PenTool className="h-6 w-6" />,
  'circle-of-action': <Clapperboard className="h-6 w-6" />,
  'worldbuilders-hall': <Palette className="h-6 w-6" />,
  'realm-of-illusions': <Wand2 className="h-6 w-6" />,
  'ground-game-order': <MapPin className="h-6 w-6" />,
  'fall-and-fire-circle': <Flame className="h-6 w-6" />,
  'live-signal-collective': <Radio className="h-6 w-6" />,
  'channel-and-feed-guild': <Youtube className="h-6 w-6" />,
};

// Rank badge styling helper
const getRankBadge = (role: string) => {
  switch (role) {
    case 'steward':
      return (
        <Badge className="bg-accent-yellow text-charcoal-black">
          <Crown className="h-3 w-3 mr-1" />
          Steward
        </Badge>
      );
    case 'member':
      return <Badge variant="secondary">Member</Badge>;
    case 'associate':
      return <Badge variant="outline">Associate</Badge>;
    case 'apprentice':
      return <Badge variant="outline" className="border-dashed">Apprentice</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{role}</Badge>;
  }
};

export default function OrderCraftHouses() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [craftHouses, setCraftHouses] = useState<CraftHouse[]>([]);
  const [myMemberships, setMyMemberships] = useState<CraftHouseMembership[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [housesData, membershipsData] = await Promise.all([
        orderAPI.listCraftHouses(),
        orderAPI.getMyCraftHouseMemberships().catch(() => []),
      ]);
      setCraftHouses(housesData.craft_houses || []);
      setMyMemberships(membershipsData || []);
    } catch (error) {
      console.error('Failed to load craft houses:', error);
      toast.error('Failed to load craft houses');
    } finally {
      setLoading(false);
    }
  };

  const isMember = (craftHouseId: number) => {
    return myMemberships.some(m => m.craft_house_id === craftHouseId);
  };

  const getMembership = (craftHouseId: number) => {
    return myMemberships.find(m => m.craft_house_id === craftHouseId);
  };

  const filteredHouses = craftHouses.filter(house => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      house.name.toLowerCase().includes(query) ||
      (house.description && house.description.toLowerCase().includes(query))
    );
  });

  const getTrackLabels = (tracks?: string[]) => {
    if (!tracks || tracks.length === 0) return '';
    return tracks
      .map(t => PRIMARY_TRACKS.find(pt => pt.value === t)?.label || t)
      .join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <Button variant="ghost" onClick={() => navigate('/order/dashboard')} className="mb-6 text-bone-white hover:text-accent-yellow">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between mb-8"
        >
          <div>
            <h1 className="text-4xl font-spray text-accent-yellow mb-2 flex items-center gap-3">
              <Hammer className="h-10 w-10" />
              Craft Houses
            </h1>
            <p className="text-muted-gray font-heading">
              Where craftspeople gather to hone their art
            </p>
          </div>
          {myMemberships.length > 0 && (
            <Badge className="mt-4 md:mt-0 bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/50">
              Member of {myMemberships[0]?.craft_house?.name || 'a house'}
            </Badge>
          )}
        </motion.div>

        {/* Search */}
        <Card className="mb-6 bg-charcoal-black/50 border-dashed border-muted-gray">
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
              <Input
                placeholder="Search craft houses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-charcoal-black border-muted-gray text-bone-white placeholder:text-muted-gray"
              />
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-muted-gray">
            {filteredHouses.length} craft house{filteredHouses.length !== 1 ? 's' : ''} available
          </p>
        </div>

        {/* Craft Houses Grid */}
        {filteredHouses.length === 0 ? (
          <Card className="bg-charcoal-black/50 border-dashed border-muted-gray">
            <CardContent className="py-12 text-center text-muted-gray">
              No craft houses found matching your search.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHouses.map((house, index) => {
              const membership = getMembership(house.id);
              const icon = CRAFT_HOUSE_ICONS[house.slug] || <Hammer className="h-6 w-6" />;

              return (
                <motion.div
                  key={house.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, rotate: index % 2 === 0 ? 0.5 : -0.5 }}
                  className="cursor-pointer"
                  onClick={() => navigate(`/order/craft-houses/${house.slug}`)}
                >
                  <Card
                    className={`h-full transition-all duration-300 ${
                      membership
                        ? 'bg-accent-yellow/10 border-accent-yellow/50 border-2'
                        : 'bg-charcoal-black/50 border-dashed border-muted-gray hover:border-accent-yellow/30'
                    }`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            membership
                              ? 'bg-accent-yellow text-charcoal-black'
                              : 'bg-muted-gray/20 text-accent-yellow'
                          }`}>
                            {icon}
                          </div>
                          <div>
                            <h3 className="font-heading text-bone-white flex items-center gap-2">
                              {house.name}
                              {membership && (
                                <CheckCircle2 className="h-4 w-4 text-accent-yellow" />
                              )}
                            </h3>
                            {house.primary_tracks && house.primary_tracks.length > 0 && (
                              <p className="text-xs text-muted-gray">
                                {getTrackLabels(house.primary_tracks)}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-gray" />
                      </div>

                      {house.description && (
                        <p className="text-sm text-muted-gray line-clamp-2 mb-4">
                          {house.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-gray">
                          <Users className="h-4 w-4" />
                          {house.member_count || 0} member{house.member_count !== 1 ? 's' : ''}
                        </span>

                        {membership && getRankBadge(membership.role)}

                        {house.status !== 'active' && (
                          <Badge variant="outline" className="border-dashed border-muted-gray text-muted-gray">
                            {house.status === 'forming' ? 'Forming' : house.status}
                          </Badge>
                        )}
                      </div>

                      {house.steward_name && (
                        <p className="text-xs text-muted-gray mt-2 flex items-center gap-1">
                          <Crown className="h-3 w-3 text-accent-yellow" />
                          Steward: {house.steward_name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="mt-8 bg-charcoal-black/50 border-dashed border-muted-gray">
            <CardHeader>
              <CardTitle className="font-spray text-accent-yellow">About Craft Houses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-bone-white">
                Craft Houses are where craftspeople of similar disciplines gather within The Order.
                Each member belongs to <span className="text-accent-yellow font-semibold">one primary Craft House</span> based
                on their specialty, forming tight-knit communities for training, mentorship, and
                professional development.
              </p>

              {/* Rank Ladder */}
              <div className="mt-6 p-4 bg-charcoal-black rounded-lg border border-muted-gray">
                <h4 className="font-heading text-bone-white mb-3">The Rank Ladder</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-dashed text-muted-gray">Apprentice</Badge>
                  <span className="text-muted-gray">→</span>
                  <Badge variant="outline" className="text-bone-white">Associate</Badge>
                  <span className="text-muted-gray">→</span>
                  <Badge variant="secondary">Member</Badge>
                  <span className="text-muted-gray">→</span>
                  <Badge className="bg-accent-yellow text-charcoal-black">
                    <Crown className="h-3 w-3 mr-1" />
                    Steward
                  </Badge>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div className="p-4 bg-charcoal-black rounded-lg border border-muted-gray">
                  <h4 className="font-heading text-bone-white mb-2">Skill Development</h4>
                  <p className="text-sm text-muted-gray">
                    Access specialized workshops, tutorials, and resources for your craft.
                  </p>
                </div>
                <div className="p-4 bg-charcoal-black rounded-lg border border-muted-gray">
                  <h4 className="font-heading text-bone-white mb-2">Mentorship</h4>
                  <p className="text-sm text-muted-gray">
                    Connect with experienced professionals in your department.
                  </p>
                </div>
                <div className="p-4 bg-charcoal-black rounded-lg border border-muted-gray">
                  <h4 className="font-heading text-bone-white mb-2">Networking</h4>
                  <p className="text-sm text-muted-gray">
                    Build relationships with others in your area of expertise.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
