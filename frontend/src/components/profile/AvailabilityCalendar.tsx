import React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Availability } from '@/types';

interface AvailabilityCalendarProps {
  availabilities: Availability[];
  className?: string;
}

const AvailabilityCalendar = ({ availabilities, className }: AvailabilityCalendarProps) => {
  const availableRanges = availabilities.map(a => ({
    from: new Date(a.start_date),
    to: new Date(a.end_date),
  }));

  // Add a dummy range to ensure the component renders if there's only one day.
  if (availableRanges.length > 0) {
    availableRanges.push({ from: new Date(0), to: new Date(0) });
  }

  return (
    <Calendar
      mode="multiple"
      selected={availableRanges}
      modifiers={{ available: availableRanges }}
      modifiersClassNames={{
        available: 'bg-green-500/30 text-green-200 rounded-md',
        selected: 'bg-green-500/30 text-green-200 rounded-md',
      }}
      className={className || "rounded-md border border-muted-gray/20 p-0"}
      showOutsideDays
    />
  );
};

export default AvailabilityCalendar;