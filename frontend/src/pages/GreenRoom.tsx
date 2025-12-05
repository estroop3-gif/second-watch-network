/**
 * Green Room Main Page
 * Voting arena for project development
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { greenroomAPI, Cycle } from '@/lib/api/greenroom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Trophy, Users, Ticket, ArrowRight, Lightbulb, Vote, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export default function GreenRoom() {
  const [loading, setLoading] = useState(true);
  const [activeCycles, setActiveCycles] = useState<Cycle[]>([]);
  const [upcomingCycles, setUpcomingCycles] = useState<Cycle[]>([]);
  const [closedCycles, setClosedCycles] = useState<Cycle[]>([]);

  useEffect(() => {
    loadCycles();
  }, []);

  const loadCycles = async () => {
    try {
      setLoading(true);
      const [active, upcoming, closed] = await Promise.all([
        greenroomAPI.listCycles('active'),
        greenroomAPI.listCycles('upcoming'),
        greenroomAPI.listCycles('closed'),
      ]);
      setActiveCycles(active);
      setUpcomingCycles(upcoming);
      setClosedCycles(closed);
    } catch (error) {
      console.error('Failed to load cycles:', error);
      toast.error('Failed to load voting cycles');
    } finally {
      setLoading(false);
    }
  };

  const CycleCard = ({ cycle }: { cycle: Cycle }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{cycle.name}</CardTitle>
            {cycle.description && (
              <CardDescription className="mt-2">{cycle.description}</CardDescription>
            )}
          </div>
          <Badge variant={cycle.status === 'active' ? 'default' : 'secondary'}>
            {cycle.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Cycle Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Ticket Price</p>
              <p className="font-semibold">${cycle.ticket_price.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Max Tickets/User</p>
              <p className="font-semibold">{cycle.max_tickets_per_user}</p>
            </div>
          </div>

          {/* Action Button */}
          <Link to={`/greenroom/cycles/${cycle.id}`}>
            <Button className="w-full">
              {cycle.status === 'active' ? 'Vote Now' : 'View Details'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Trophy className="h-10 w-10 text-accent-yellow" />
          <h1 className="text-5xl font-bold">The Green Room</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Vote for the next great projects to be developed on Second Watch Network
        </p>
      </div>

      {/* How It Works */}
      <Card className="mb-8 bg-muted/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Purchase Tickets
                </h3>
                <p className="text-sm text-muted-foreground">
                  Buy voting tickets ($10 each) for the active cycle. Max 100 tickets per user.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  <Vote className="h-4 w-4" />
                  Allocate Votes
                </h3>
                <p className="text-sm text-muted-foreground">
                  Review projects and allocate your tickets to your favorites. All votes are final!
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Win & Develop
                </h3>
                <p className="text-sm text-muted-foreground">
                  Top projects get developed into Second Watch Network content!
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Project CTA */}
      <Card className="mb-8 bg-gradient-to-r from-primary/10 to-accent-yellow/10 border-2">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Got a project idea?</h3>
              <p className="text-muted-foreground">
                Submit your project to the Green Room and let the community vote!
              </p>
            </div>
            <Link to="/greenroom/submit">
              <Button size="lg">
                <Users className="h-5 w-5 mr-2" />
                Submit Project
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Cycles Tabs */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="active">
              Active ({activeCycles.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingCycles.length})
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed ({closedCycles.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {activeCycles.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeCycles.map((cycle) => (
                  <CycleCard key={cycle.id} cycle={cycle} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No active voting cycles at the moment. Check back soon!
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="upcoming">
            {upcomingCycles.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingCycles.map((cycle) => (
                  <CycleCard key={cycle.id} cycle={cycle} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No upcoming cycles scheduled yet.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="closed">
            {closedCycles.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {closedCycles.map((cycle) => (
                  <CycleCard key={cycle.id} cycle={cycle} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No closed cycles yet.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
