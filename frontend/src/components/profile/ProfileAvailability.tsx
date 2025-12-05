import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Availability } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CalendarDays, Eye, EyeOff } from 'lucide-react';
import AvailabilityCalendar from './AvailabilityCalendar';
import { Button } from '@/components/ui/button';

interface ProfileAvailabilityProps {
  user_id: string;
}

const ProfileAvailability = ({ user_id }: ProfileAvailabilityProps) => {
  const [showCalendar, setShowCalendar] = useState(false);

  const fetchAvailability = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('user_id', user_id)
      .gte('end_date', today) // Only fetch upcoming or current
      .order('start_date', { ascending: true });
    if (error) throw new Error(error.message);
    return data as Availability[];
  };

  const { data: availabilities, isLoading } = useQuery({
    queryKey: ['public_availability', user_id],
    queryFn: fetchAvailability,
  });

  return (
    <div className="space-y-4">
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg font-heading">Upcoming Availability</CardTitle>
           <Button variant="outline" size="sm" onClick={() => setShowCalendar(!showCalendar)}>
            {showCalendar ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : availabilities && availabilities.length > 0 ? (
            <ul className="space-y-4">
              {availabilities.map(item => (
                <li key={item.id} className="flex gap-4 items-start">
                  <CalendarDays className="h-5 w-5 text-accent-yellow mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-bone-white">
                      {format(new Date(item.start_date), 'MMM d, yyyy')} - {format(new Date(item.end_date), 'MMM d, yyyy')}
                    </p>
                    {item.notes && <p className="text-sm text-muted-gray">{item.notes}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-gray text-sm">No upcoming availability posted.</p>
          )}
        </CardContent>
      </Card>
      {showCalendar && (
        <div>
          {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : availabilities && availabilities.length > 0 ? (
              <AvailabilityCalendar availabilities={availabilities} className="bg-charcoal-black/50 border-muted-gray/20 p-4" />
          ) : (
            <p className="text-muted-gray text-sm text-center py-4">No availability to show on calendar.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileAvailability;