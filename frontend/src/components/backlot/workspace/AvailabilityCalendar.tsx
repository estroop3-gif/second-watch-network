/**
 * AvailabilityCalendar - Shows availability for booked cast/crew
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUserAvailability, useProductionDays } from '@/hooks/backlot';
import {
  BacklotBookedPerson,
  BacklotUserAvailability,
  AVAILABILITY_STATUS_LABELS,
  AVAILABILITY_STATUS_COLORS,
} from '@/types/backlot';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  isSameDay,
} from 'date-fns';
import { parseLocalDate, formatDate } from '@/lib/dateUtils';

interface AvailabilityCalendarProps {
  projectId: string;
  bookedPeople: BacklotBookedPerson[];
}

export function AvailabilityCalendar({
  projectId,
  bookedPeople,
}: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPersonId, setSelectedPersonId] = useState<string>('all');

  // Get production days for the project
  const { data: productionDays } = useProductionDays(projectId);

  // Calculate date range for the month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDateStr = format(monthStart, 'yyyy-MM-dd');
  const endDateStr = format(monthEnd, 'yyyy-MM-dd');

  // Get availability for selected person or all
  const filteredPeople =
    selectedPersonId === 'all'
      ? bookedPeople
      : bookedPeople.filter((p) => p.user_id === selectedPersonId);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [currentMonth]);

  // Map production days by date
  const productionDaysByDate = useMemo(() => {
    const map = new Map<string, any>();
    productionDays?.forEach((day) => {
      map.set(day.date, day);
    });
    return map;
  }, [productionDays]);

  // Get status color class
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      available: 'bg-green-500',
      unavailable: 'bg-red-500',
      hold: 'bg-yellow-500',
      booked: 'bg-blue-500',
      tentative: 'bg-orange-500',
    };
    return colors[status] || 'bg-gray-300';
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  if (bookedPeople.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No booked people yet</h3>
          <p className="text-muted-foreground">
            Book cast and crew from your role postings to see their availability here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-semibold min-w-[150px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by person" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Booked People</SelectItem>
            {bookedPeople.map((person) => (
              <SelectItem key={person.user_id} value={person.user_id}>
                {person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500" />
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500" />
          <span>On Hold</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span>Unavailable</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-500" />
          <span>Production Day</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month start */}
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {calendarDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isProductionDay = productionDaysByDate.has(dateStr);
              const productionDay = productionDaysByDate.get(dateStr);

              return (
                <TooltipProvider key={dateStr}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`
                          aspect-square p-1 rounded-lg border
                          ${isToday(day) ? 'ring-2 ring-primary' : ''}
                          ${isProductionDay ? 'bg-purple-50 border-purple-200' : 'bg-background'}
                        `}
                      >
                        <div className="text-xs font-medium mb-1">
                          {format(day, 'd')}
                        </div>
                        {/* Availability indicators */}
                        <div className="flex flex-wrap gap-0.5">
                          {filteredPeople.slice(0, 4).map((person) => {
                            // Check if this person is scheduled for this date based on role dates
                            const isRoleDate =
                              person.start_date &&
                              person.end_date &&
                              day >= parseLocalDate(person.start_date) &&
                              day <= parseLocalDate(person.end_date);

                            return (
                              <div
                                key={person.user_id}
                                className={`w-2 h-2 rounded-full ${
                                  isRoleDate ? 'bg-blue-500' : 'bg-gray-300'
                                }`}
                                title={person.name}
                              />
                            );
                          })}
                          {filteredPeople.length > 4 && (
                            <span className="text-[8px] text-muted-foreground">
                              +{filteredPeople.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-medium">
                          {format(day, 'EEEE, MMMM d, yyyy')}
                        </p>
                        {isProductionDay && (
                          <Badge variant="secondary" className="bg-purple-100">
                            Production Day: {productionDay?.title || 'Shoot Day'}
                          </Badge>
                        )}
                        {filteredPeople.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              Booked People:
                            </p>
                            {filteredPeople.map((person) => {
                              const isRoleDate =
                                person.start_date &&
                                person.end_date &&
                                day >= parseLocalDate(person.start_date) &&
                                day <= parseLocalDate(person.end_date);
                              return (
                                <div
                                  key={person.user_id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <div
                                    className={`w-2 h-2 rounded-full ${
                                      isRoleDate ? 'bg-blue-500' : 'bg-gray-300'
                                    }`}
                                  />
                                  <span>{person.name}</span>
                                  <span className="text-muted-foreground">
                                    ({person.role_title})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* People List with Role Dates */}
      <div className="space-y-3">
        <h4 className="font-medium">Booked Cast & Crew</h4>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((person) => (
            <PersonAvailabilityCard key={person.user_id} person={person} />
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Person Availability Card
// =============================================================================

interface PersonAvailabilityCardProps {
  person: BacklotBookedPerson;
}

function PersonAvailabilityCard({ person }: PersonAvailabilityCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={person.avatar_url || undefined} />
            <AvatarFallback>{person.name?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{person.name}</p>
            <p className="text-sm text-muted-foreground">{person.role_title}</p>
            {person.department && (
              <Badge variant="outline" className="text-xs mt-1">
                {person.department}
              </Badge>
            )}
            {person.start_date && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {formatDate(person.start_date, 'MMM d')}
                {person.end_date && (
                  <> - {formatDate(person.end_date, 'MMM d')}</>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
