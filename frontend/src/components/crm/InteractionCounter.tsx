import { Phone, Mail, MessageSquare, Users, Monitor, MoreHorizontal, Plus, Minus, Inbox, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InteractionCounterProps {
  counts: {
    calls: number;
    emails: number;
    texts: number;
    meetings: number;
    demos: number;
    other_interactions: number;
    emails_received?: number;
    campaign_emails?: number;
  };
  onIncrement: (type: string) => void;
  onDecrement?: (type: string) => void;
  isIncrementing?: boolean;
}

const INTERACTION_TYPES = [
  { key: 'calls', label: 'Calls', icon: Phone },
  { key: 'emails', label: 'Emails Sent', icon: Mail },
  { key: 'emails_received', label: 'Received', icon: Inbox, readOnly: true },
  { key: 'campaign_emails', label: 'Campaign', icon: Megaphone, readOnly: true },
  { key: 'texts', label: 'Texts', icon: MessageSquare },
  { key: 'meetings', label: 'Meetings', icon: Users },
  { key: 'demos', label: 'Demos', icon: Monitor },
  { key: 'other_interactions', label: 'Other', icon: MoreHorizontal },
];

const COUNT_KEYS = ['calls', 'emails', 'texts', 'meetings', 'demos', 'other_interactions', 'emails_received', 'campaign_emails'];

const InteractionCounter = ({ counts, onIncrement, onDecrement, isIncrementing }: InteractionCounterProps) => {
  const total = COUNT_KEYS.reduce((sum, key) => sum + ((counts as any)[key] || 0), 0);

  return (
    <Card className="bg-charcoal-black border-muted-gray/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-bone-white">Today's Interactions</CardTitle>
          <span className="text-2xl font-bold text-accent-yellow">{total}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {INTERACTION_TYPES.map(({ key, label, icon: Icon, readOnly }) => {
            const count = (counts as any)[key] || 0;
            return (
              <div
                key={key}
                className="flex items-center justify-between p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/20"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-gray" />
                  <div>
                    <div className="text-xs text-muted-gray">{label}</div>
                    <div className="text-lg font-semibold text-bone-white">{count}</div>
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isIncrementing}
                      onClick={() => onIncrement(key)}
                      className="h-7 w-7 p-0 text-accent-yellow hover:bg-accent-yellow/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    {onDecrement && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isIncrementing || count === 0}
                        onClick={() => onDecrement(key)}
                        className="h-7 w-7 p-0 text-muted-gray hover:bg-muted-gray/20 disabled:opacity-30"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default InteractionCounter;
