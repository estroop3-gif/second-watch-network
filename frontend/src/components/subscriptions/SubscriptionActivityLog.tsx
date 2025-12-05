import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { SubscriptionActivity } from '@/types';

const fetchSubscriptionActivity = async (userId: string): Promise<SubscriptionActivity[]> => {
  const { data, error } = await supabase
    .from('subscription_activity')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscription activity:', error);
    throw error;
  }
  return data;
};

export const SubscriptionActivityLog = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: activities, isLoading } = useQuery({
    queryKey: ['subscriptionActivity', user?.id],
    queryFn: () => fetchSubscriptionActivity(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`subscription-activity-${user.id}`)
      .on<SubscriptionActivity>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'subscription_activity',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['subscriptionActivity', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return (
    <Card className="bg-muted-gray/20 border-muted-gray">
      <CardHeader>
        <CardTitle>Subscription Activity</CardTitle>
        <CardDescription>A log of all changes and events related to your subscription.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                </TableRow>
              ))
            ) : activities && activities.length > 0 ? (
              activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>{format(new Date(activity.created_at), 'MMM d, yyyy, h:mm a')}</TableCell>
                  <TableCell className="capitalize">{activity.event_type.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{activity.details?.message || 'N/A'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No subscription activity yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};