/**
 * Green Room - Main Page
 * Project Development & Voting Arena
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { greenroomAPI, Cycle, CycleStatus } from '@/lib/api/greenroom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Trophy, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GreenRoomPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'closed'>('active');

  useEffect(() => {
    loadCycles(activeTab);
  }, [activeTab]);

  const loadCycles = async (status: CycleStatus) => {
    try {
      setLoading(true);
      const data = await greenroomAPI.listCycles(status);
      setCycles(data);
    } catch (error) {
      console.error('Failed to load cycles:', error);
      toast.error('Failed to load voting cycles');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: CycleStatus) => {
    const variants: Record<CycleStatus, { variant: any; icon: any; label: string }> = {
      active: { variant: 'default', icon: TrendingUp, label: 'Active' },
      upcoming: { variant: 'secondary', icon: Clock, label: 'Upcoming' },
      closed: { variant: 'outline', icon: CheckCircle2, label: 'Closed' },
    };

    const config = variants[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Green Room</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Project Development & Voting Arena - Where community chooses what gets made
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>Filmmakers submit project proposals</li>
              <li>Community purchases voting tickets ($10 each)</li>
              <li>Allocate tickets to projects you love</li>
              <li>Top voted projects get greenlit!</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Voting Rules</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li>• Max 100 tickets per cycle</li>
              <li>• $10 per voting ticket</li>
              <li>• Votes are final (no changes)</li>
              <li>• Premium+ members can vote</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit a Project</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Filmmakers can submit their project ideas to active voting cycles.
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => router.push('/greenroom/submit')}
            >
              Submit Project
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Cycles Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cycles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No {activeTab} voting cycles at this time.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cycles.map((cycle) => (
                <Card key={cycle.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-xl">{cycle.name}</CardTitle>
                      {getStatusBadge(cycle.status)}
                    </div>
                    {cycle.description && (
                      <CardDescription>{cycle.description}</CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1">
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Voting Period</p>
                        <p className="font-medium">
                          {formatDate(cycle.start_date)} - {formatDate(cycle.end_date)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground">Projects</p>
                          <p className="text-2xl font-bold">{cycle.project_count || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Votes</p>
                          <p className="text-2xl font-bold">{cycle.total_votes || 0}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-muted-foreground">Ticket Price</p>
                        <p className="font-medium">${cycle.ticket_price.toFixed(2)} each</p>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => router.push(`/greenroom/cycles/${cycle.id}`)}
                    >
                      {cycle.status === 'active' ? 'Vote Now' : 'View Details'}
                    </Button>
                    {cycle.status === 'closed' && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/greenroom/cycles/${cycle.id}/results`)}
                      >
                        Results
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
