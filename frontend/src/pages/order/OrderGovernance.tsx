/**
 * Order Governance Page
 * View the governance structure and leadership of The Order
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { orderAPI, GovernancePosition, HighCouncil, GovernancePositionType, GovernanceScopeType } from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Loader2,
  Crown,
  Users,
  Building2,
  Hammer,
  Heart,
  Scale,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

const POSITION_TYPE_LABELS: Record<GovernancePositionType, string> = {
  high_council: 'High Council',
  grand_master: 'Grand Master',
  lodge_master: 'Lodge Master',
  lodge_council: 'Lodge Council',
  craft_master: 'Craft Master',
  craft_deputy: 'Craft Deputy',
  fellowship_leader: 'Fellowship Leader',
  regional_director: 'Regional Director',
};

const SCOPE_TYPE_LABELS: Record<GovernanceScopeType, string> = {
  order: 'The Order',
  lodge: 'Lodge',
  craft_house: 'Craft House',
  fellowship: 'Fellowship',
  region: 'Region',
};

const SCOPE_TYPE_ICONS: Record<GovernanceScopeType, React.ReactNode> = {
  order: <Shield className="h-5 w-5" />,
  lodge: <Building2 className="h-5 w-5" />,
  craft_house: <Hammer className="h-5 w-5" />,
  fellowship: <Heart className="h-5 w-5" />,
  region: <Users className="h-5 w-5" />,
};

export default function OrderGovernance() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [highCouncil, setHighCouncil] = useState<HighCouncil | null>(null);
  const [positions, setPositions] = useState<GovernancePosition[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [councilData, positionsData] = await Promise.all([
        orderAPI.getHighCouncil().catch(() => ({ council_members: [] })),
        orderAPI.listGovernancePositions({ active_only: true }),
      ]);
      setHighCouncil(councilData);
      setPositions(positionsData.positions || []);
    } catch (error) {
      console.error('Failed to load governance data:', error);
      toast.error('Failed to load governance data');
    } finally {
      setLoading(false);
    }
  };

  const getPositionsByScope = (scopeType: GovernanceScopeType) => {
    return positions.filter(p => p.scope_type === scopeType);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const orderPositions = positions.filter(p => !p.scope_type || p.scope_type === 'order');
  const lodgePositions = getPositionsByScope('lodge');
  const craftHousePositions = getPositionsByScope('craft_house');
  const fellowshipPositions = getPositionsByScope('fellowship');

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
            <Scale className="h-8 w-8" />
            Governance
          </h1>
          <p className="text-muted-foreground">
            The leadership structure of The Second Watch Order
          </p>
        </div>
      </div>

      {/* High Council Section */}
      <Card className="mb-8 border-yellow-500/50">
        <CardHeader className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10">
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            High Council
          </CardTitle>
          <CardDescription>
            The governing body of The Order
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Grand Master */}
          {highCouncil?.grand_master ? (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">Grand Master</h4>
              <div
                className="flex items-center gap-4 p-4 border-2 border-yellow-500/50 rounded-lg bg-yellow-500/5 cursor-pointer hover:bg-yellow-500/10"
                onClick={() => navigate(`/order/members/${highCouncil.grand_master?.user_id}`)}
              >
                <Avatar className="h-16 w-16 border-2 border-yellow-500">
                  <AvatarFallback className="text-xl bg-yellow-500/20">
                    {highCouncil.grand_master.user_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    {highCouncil.grand_master.user_name || 'Unknown'}
                    <Crown className="h-5 w-5 text-yellow-500" />
                  </h3>
                  <p className="text-muted-foreground">{highCouncil.grand_master.title}</p>
                  {highCouncil.grand_master.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {highCouncil.grand_master.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 border rounded-lg bg-muted/50 text-center text-muted-foreground">
              Grand Master position currently vacant
            </div>
          )}

          {/* Council Members */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Council Members</h4>
            {highCouncil?.council_members && highCouncil.council_members.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {highCouncil.council_members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/order/members/${member.user_id}`)}
                  >
                    <Avatar>
                      <AvatarFallback>
                        {member.user_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{member.user_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{member.title}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No council members currently appointed
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Other Positions by Scope */}
      <Tabs defaultValue="lodges">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lodges" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Lodges ({lodgePositions.length})
          </TabsTrigger>
          <TabsTrigger value="craft-houses" className="flex items-center gap-2">
            <Hammer className="h-4 w-4" />
            Craft Houses ({craftHousePositions.length})
          </TabsTrigger>
          <TabsTrigger value="fellowships" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Fellowships ({fellowshipPositions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lodges" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Lodge Leadership</CardTitle>
              <CardDescription>
                Lodge Masters and Council members manage local chapters
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lodgePositions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No lodge leadership positions currently filled
                </p>
              ) : (
                <div className="space-y-4">
                  {lodgePositions.map((position) => (
                    <div
                      key={position.id}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/order/members/${position.user_id}`)}
                    >
                      <Avatar>
                        <AvatarFallback>
                          {position.user_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{position.user_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {position.title}
                          {position.scope_name && ` - ${position.scope_name}`}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {POSITION_TYPE_LABELS[position.position_type]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="craft-houses" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Craft House Leadership</CardTitle>
              <CardDescription>
                Craft Masters and Deputies lead department-based groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              {craftHousePositions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No craft house leadership positions currently filled
                </p>
              ) : (
                <div className="space-y-4">
                  {craftHousePositions.map((position) => (
                    <div
                      key={position.id}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/order/members/${position.user_id}`)}
                    >
                      <Avatar>
                        <AvatarFallback>
                          {position.user_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{position.user_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {position.title}
                          {position.scope_name && ` - ${position.scope_name}`}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {POSITION_TYPE_LABELS[position.position_type]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fellowships" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Fellowship Leadership</CardTitle>
              <CardDescription>
                Fellowship Leaders coordinate special interest groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fellowshipPositions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No fellowship leadership positions currently filled
                </p>
              ) : (
                <div className="space-y-4">
                  {fellowshipPositions.map((position) => (
                    <div
                      key={position.id}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/order/members/${position.user_id}`)}
                    >
                      <Avatar>
                        <AvatarFallback>
                          {position.user_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{position.user_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {position.title}
                          {position.scope_name && ` - ${position.scope_name}`}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {POSITION_TYPE_LABELS[position.position_type]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Governance Info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>About Order Governance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            The Second Watch Order operates under a hierarchical governance structure designed
            to maintain our values while enabling local autonomy. Leadership positions are
            appointed based on experience, contribution, and demonstrated commitment to Order values.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                High Council
              </h4>
              <p className="text-sm text-muted-foreground">
                Sets overall direction and policy for The Order. Includes the Grand Master
                and senior council members.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Lodge Leadership
              </h4>
              <p className="text-sm text-muted-foreground">
                Lodge Masters and councils manage local chapters, organizing events
                and supporting members in their area.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Hammer className="h-4 w-4" />
                Craft House Leadership
              </h4>
              <p className="text-sm text-muted-foreground">
                Craft Masters oversee professional development and mentorship
                within their department.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Fellowship Leadership
              </h4>
              <p className="text-sm text-muted-foreground">
                Fellowship Leaders coordinate activities and resources for
                special interest groups.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
