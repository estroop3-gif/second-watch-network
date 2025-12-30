/**
 * Order Craft House Detail Page
 * View a single craft house and its members
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { orderAPI, CraftHouse, CraftHouseMember, CraftHouseMembership, CraftHouseRole, PRIMARY_TRACKS } from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Users,
  Loader2,
  Camera,
  Zap,
  Waves,
  ClipboardList,
  Clapperboard,
  PenTool,
  Wand2,
  Palette,
  Hammer,
  UserPlus,
  UserMinus,
  Crown,
  MapPin,
  Flame,
  Radio,
  Youtube,
  MessageSquare,
  Calendar,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import CraftHouseDiscussions from '@/components/order/crafthouse/CraftHouseDiscussions';
import CraftHouseEvents from '@/components/order/crafthouse/CraftHouseEvents';
import CraftHouseMemberCard from '@/components/order/crafthouse/CraftHouseMemberCard';
import { useCraftHouseMemberRoleMutation } from '@/hooks/order/useCraftHouseDiscussions';

// Icon mapping for craft houses (new world-building names)
const CRAFT_HOUSE_ICONS: Record<string, React.ReactNode> = {
  'order-of-the-lens': <Camera className="h-8 w-8" />,
  'guild-of-sparks-and-steel': <Zap className="h-8 w-8" />,
  'echo-and-frame-guild': <Waves className="h-8 w-8" />,
  'keepers-of-the-line': <ClipboardList className="h-8 w-8" />,
  'scribes-of-the-second-draft': <PenTool className="h-8 w-8" />,
  'circle-of-action': <Clapperboard className="h-8 w-8" />,
  'worldbuilders-hall': <Palette className="h-8 w-8" />,
  'realm-of-illusions': <Wand2 className="h-8 w-8" />,
  'ground-game-order': <MapPin className="h-8 w-8" />,
  'fall-and-fire-circle': <Flame className="h-8 w-8" />,
  'live-signal-collective': <Radio className="h-8 w-8" />,
  'channel-and-feed-guild': <Youtube className="h-8 w-8" />,
};

export default function OrderCraftHouseDetail() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [craftHouse, setCraftHouse] = useState<CraftHouse | null>(null);
  const [members, setMembers] = useState<CraftHouseMember[]>([]);
  const [myMembership, setMyMembership] = useState<CraftHouseMembership | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Role mutation for stewards
  const roleMutation = useCraftHouseMemberRoleMutation(craftHouse?.id || null);

  const handleRoleChange = async (userId: string, newRole: CraftHouseRole) => {
    roleMutation.mutate(
      { userId, role: newRole },
      {
        onSuccess: () => {
          toast.success(`Role updated to ${newRole}`);
          loadData(); // Refresh member list
        },
        onError: () => {
          toast.error('Failed to update role');
        },
      }
    );
  };

  useEffect(() => {
    if (slug) {
      loadData();
    }
  }, [slug]);

  const loadData = async () => {
    try {
      setLoading(true);
      const houseData = await orderAPI.getCraftHouseBySlug(slug!);
      setCraftHouse(houseData);

      // Load members and membership status
      const [membersData, membershipsData] = await Promise.all([
        orderAPI.getCraftHouseMembers(houseData.id),
        orderAPI.getMyCraftHouseMemberships().catch(() => []),
      ]);

      setMembers(membersData.members || []);
      const membership = membershipsData.find((m: CraftHouseMembership) => m.craft_house_id === houseData.id);
      setMyMembership(membership || null);
    } catch (error) {
      console.error('Failed to load craft house:', error);
      toast.error('Failed to load craft house');
      navigate('/order/craft-houses');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!craftHouse) return;
    try {
      setActionLoading(true);
      const membership = await orderAPI.joinCraftHouse(craftHouse.id);
      setMyMembership(membership);
      toast.success(`Joined ${craftHouse.name}!`);
      loadData(); // Refresh data
    } catch (error: any) {
      console.error('Failed to join craft house:', error);
      toast.error(error.message || 'Failed to join craft house');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!craftHouse) return;
    try {
      setActionLoading(true);
      await orderAPI.leaveCraftHouse(craftHouse.id);
      setMyMembership(null);
      toast.success(`Left ${craftHouse.name}`);
      loadData(); // Refresh data
    } catch (error: any) {
      console.error('Failed to leave craft house:', error);
      toast.error(error.message || 'Failed to leave craft house');
    } finally {
      setActionLoading(false);
    }
  };

  const getTrackLabel = (track?: string) => {
    if (!track) return '';
    return PRIMARY_TRACKS.find(t => t.value === track)?.label || track;
  };

  const getRoleBadge = (role: string) => {
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

  if (!craftHouse) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <p className="text-muted-foreground">Craft house not found.</p>
        <Button onClick={() => navigate('/order/craft-houses')} className="mt-4">
          Back to Craft Houses
        </Button>
      </div>
    );
  }

  const icon = CRAFT_HOUSE_ICONS[craftHouse.slug] || <Hammer className="h-8 w-8" />;
  const stewards = members.filter(m => m.role === 'steward');
  const regularMembers = members.filter(m => m.role !== 'steward');

  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <Button variant="ghost" onClick={() => navigate('/order/craft-houses')} className="mb-6 text-bone-white hover:text-accent-yellow">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Craft Houses
        </Button>

        {/* Craft House Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-8 bg-charcoal-black/50 border-dashed border-muted-gray">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className={`w-20 h-20 rounded-lg flex items-center justify-center ${
                  myMembership ? 'bg-accent-yellow text-charcoal-black' : 'bg-muted-gray/20 text-accent-yellow'
                }`}>
                  {icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-4xl font-spray text-accent-yellow">{craftHouse.name}</h1>
                    {myMembership && getRoleBadge(myMembership.role)}
                  </div>
                  {craftHouse.description && (
                    <p className="text-muted-gray mb-4">{craftHouse.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-gray">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {members.length} member{members.length !== 1 ? 's' : ''}
                    </span>
                    {craftHouse.steward_name && (
                      <span className="flex items-center gap-1 text-accent-yellow">
                        <Crown className="h-4 w-4" />
                        Steward: {craftHouse.steward_name}
                      </span>
                    )}
                    {craftHouse.status !== 'active' && (
                      <Badge variant="outline" className="border-dashed border-muted-gray text-muted-gray">{craftHouse.status}</Badge>
                    )}
                  </div>
                </div>
                <div>
                  {myMembership ? (
                    <Button
                      variant="outline"
                      onClick={handleLeave}
                      disabled={actionLoading || myMembership.role === 'steward'}
                      className="border-muted-gray text-bone-white hover:bg-muted-gray/20"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <UserMinus className="h-4 w-4 mr-2" />
                      )}
                      Leave House
                    </Button>
                  ) : (
                    <Button onClick={handleJoin} disabled={actionLoading} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      Join House
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="discussions" className="mt-6">
          <TabsList className="bg-charcoal-black border border-muted-gray">
            <TabsTrigger value="discussions" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <MessageSquare className="h-4 w-4 mr-2" />
              Discussions
            </TabsTrigger>
            <TabsTrigger value="members" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <Users className="h-4 w-4 mr-2" />
              Members ({members.length})
            </TabsTrigger>
            <TabsTrigger value="events" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <Calendar className="h-4 w-4 mr-2" />
              Events
            </TabsTrigger>
            <TabsTrigger value="about" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <Info className="h-4 w-4 mr-2" />
              About
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discussions" className="mt-6">
            <CraftHouseDiscussions
              craftHouseId={craftHouse.id}
              myMembership={myMembership}
              isMember={!!myMembership}
            />
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            {/* Stewards */}
            {stewards.length > 0 && (
              <Card className="mb-6 bg-charcoal-black/50 border-accent-yellow/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-heading text-accent-yellow">
                    <Crown className="h-5 w-5" />
                    Stewards
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stewards.map((member) => (
                      <CraftHouseMemberCard
                        key={member.user_id}
                        member={member}
                        isSteward={myMembership?.role === 'steward'}
                        isCurrentUser={user?.profile_id === member.user_id}
                        craftHouseId={craftHouse.id}
                        onRoleChange={handleRoleChange}
                        variant="steward"
                        getTrackLabel={getTrackLabel}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Regular Members */}
            <Card className="bg-charcoal-black/50 border-dashed border-muted-gray">
              <CardHeader>
                <CardTitle className="font-heading text-bone-white">Members</CardTitle>
                <CardDescription className="text-muted-gray">
                  All members of {craftHouse.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {regularMembers.length === 0 ? (
                  <p className="text-center text-muted-gray py-8">
                    No members yet. Be the first to join!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {regularMembers.map((member, index) => (
                      <motion.div
                        key={member.user_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                      >
                        <CraftHouseMemberCard
                          member={member}
                          isSteward={myMembership?.role === 'steward'}
                          isCurrentUser={user?.profile_id === member.user_id}
                          craftHouseId={craftHouse.id}
                          onRoleChange={handleRoleChange}
                          getTrackLabel={getTrackLabel}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            <CraftHouseEvents
              craftHouseId={craftHouse.id}
              craftHouseName={craftHouse.name}
              isSteward={myMembership?.role === 'steward'}
              isMember={!!myMembership}
            />
          </TabsContent>

          <TabsContent value="about" className="mt-6">
            <Card className="bg-charcoal-black/50 border-dashed border-muted-gray">
              <CardHeader>
                <CardTitle className="font-spray text-accent-yellow">About {craftHouse.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {craftHouse.description && (
                  <div>
                    <h4 className="font-heading text-bone-white mb-2">Description</h4>
                    <p className="text-muted-gray">{craftHouse.description}</p>
                  </div>
                )}

                {craftHouse.primary_tracks && craftHouse.primary_tracks.length > 0 && (
                  <div>
                    <h4 className="font-heading text-bone-white mb-2">Primary Tracks</h4>
                    <div className="flex flex-wrap gap-2">
                      {craftHouse.primary_tracks.map((track) => (
                        <Badge key={track} variant="outline" className="border-muted-gray text-bone-white">
                          {getTrackLabel(track)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rank Ladder */}
                <div className="p-4 bg-charcoal-black rounded-lg border border-muted-gray">
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

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-charcoal-black rounded-lg border border-muted-gray">
                    <h4 className="font-heading text-bone-white mb-2">Skill Development</h4>
                    <p className="text-sm text-muted-gray">
                      Access specialized workshops and resources for your craft.
                    </p>
                  </div>
                  <div className="p-4 bg-charcoal-black rounded-lg border border-muted-gray">
                    <h4 className="font-heading text-bone-white mb-2">Mentorship</h4>
                    <p className="text-sm text-muted-gray">
                      Connect with experienced professionals in your department.
                    </p>
                  </div>
                  <div className="p-4 bg-charcoal-black rounded-lg border border-muted-gray">
                    <h4 className="font-heading text-bone-white mb-2">Community</h4>
                    <p className="text-sm text-muted-gray">
                      Build relationships with others who share your passion.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
