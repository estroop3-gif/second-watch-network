import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import InteractionCounter from '@/components/crm/InteractionCounter';
import ActivityTimeline from '@/components/crm/ActivityTimeline';
import { useMyInteractionsToday, useIncrementInteraction, useDecrementInteraction } from '@/hooks/crm';
import { useActivities } from '@/hooks/crm';

const InteractionTracker = () => {
  const { data: interactions } = useMyInteractionsToday();
  const { mutate: increment, isPending: isIncrementing } = useIncrementInteraction();
  const { mutate: decrement, isPending: isDecrementing } = useDecrementInteraction();
  const { data: todayData } = useActivities({
    date_from: new Date().toISOString().split('T')[0],
    limit: 20,
  });

  const counts = interactions || {
    calls: 0, emails: 0, texts: 0,
    meetings: 0, demos: 0, other_interactions: 0,
  };

  const todayActivities = todayData?.activities || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-heading text-bone-white">Interaction Tracker</h1>

      <InteractionCounter
        counts={counts}
        onIncrement={increment}
        onDecrement={decrement}
        isIncrementing={isIncrementing || isDecrementing}
      />

      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-bone-white text-base">Today's Logged Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline activities={todayActivities} />
        </CardContent>
      </Card>
    </div>
  );
};

export default InteractionTracker;
