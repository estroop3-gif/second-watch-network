/**
 * DayDetailView - Comprehensive production day overview
 * Shows call sheets, dailies, budget, tasks, travel, and timecards
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Play,
  DollarSign,
  CheckSquare,
  Megaphone,
  Timer,
  Users,
  Film,
  ExternalLink,
} from 'lucide-react';
import { useDayOverview, formatCallTime, formatDate } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface DayDetailViewProps {
  projectId: string;
  dayId: string;
  canEdit: boolean;
  onBack: () => void;
}

export default function DayDetailView({ projectId, dayId, canEdit, onBack }: DayDetailViewProps) {
  const { data: overview, isLoading } = useDayOverview(projectId, dayId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-gray mb-4">Production day not found</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Days
        </Button>
      </div>
    );
  }

  const { day, call_sheets, daily_budget, dailies, tasks, updates, timecard_entries, scenes_scheduled, crew_summary } = overview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-heading text-bone-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-accent-yellow" />
              Day {day.day_number}
            </h2>
            {day.is_completed ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Wrapped</Badge>
            ) : call_sheets.length > 0 ? (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Scheduled</Badge>
            ) : (
              <Badge className="bg-muted-gray/20 text-muted-gray border-muted-gray/30">Planning</Badge>
            )}
          </div>
          <p className="text-lg text-muted-gray mt-1">{formatDate(day.date)}</p>
          {day.title && (
            <p className="text-sm text-muted-gray">{day.title}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-gray">
            {day.general_call_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Call: {formatCallTime(day.general_call_time)}
              </span>
            )}
            {day.wrap_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Wrap: {formatCallTime(day.wrap_time)}
              </span>
            )}
            {day.location_name && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {day.location_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-bone-white">{crew_summary.total_crew}</p>
            <p className="text-xs text-muted-gray">Crew</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-bone-white">{crew_summary.total_cast}</p>
            <p className="text-xs text-muted-gray">Cast</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{dailies?.clip_count || 0}</p>
            <p className="text-xs text-muted-gray">Dailies Clips</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{tasks.length}</p>
            <p className="text-xs text-muted-gray">Tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="call-sheet" className="w-full">
        <TabsList className="bg-charcoal-black border border-muted-gray/20">
          <TabsTrigger value="call-sheet">Call Sheet</TabsTrigger>
          <TabsTrigger value="scenes">Scenes ({scenes_scheduled.length})</TabsTrigger>
          <TabsTrigger value="dailies">Dailies</TabsTrigger>
          {daily_budget && <TabsTrigger value="budget">Budget</TabsTrigger>}
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="timecards">Timecards ({timecard_entries.length})</TabsTrigger>
        </TabsList>

        {/* Call Sheet Tab */}
        <TabsContent value="call-sheet" className="mt-4">
          {call_sheets.length > 0 ? (
            <div className="space-y-4">
              {call_sheets.map(cs => (
                <Card key={cs.id} className="bg-charcoal-black border-muted-gray/20">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-400" />
                        {cs.title}
                      </span>
                      {cs.is_published ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Published</Badge>
                      ) : (
                        <Badge className="bg-muted-gray/20 text-muted-gray border-muted-gray/30">Draft</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-gray">Call Time</p>
                        <p className="text-bone-white">{formatCallTime(cs.general_call_time) || '--'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-gray">Location</p>
                        <p className="text-bone-white">{cs.location_name || '--'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-gray">Crew</p>
                        <p className="text-bone-white">{cs.crew_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-gray">Cast</p>
                        <p className="text-bone-white">{cs.cast_count}</p>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-muted-gray">
                      {cs.scene_count} scenes scheduled
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No call sheet created for this day yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Scenes Tab */}
        <TabsContent value="scenes" className="mt-4">
          {scenes_scheduled.length > 0 ? (
            <div className="space-y-2">
              {scenes_scheduled.map(scene => (
                <Card key={scene.id} className="bg-charcoal-black border-muted-gray/20">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Film className="w-4 h-4 text-accent-yellow" />
                      <span className="font-medium text-bone-white">Scene {scene.scene_number}</span>
                      {scene.slugline && (
                        <span className="text-muted-gray">{scene.slugline}</span>
                      )}
                    </div>
                    {scene.page_length && (
                      <Badge variant="outline" className="border-muted-gray/30 text-muted-gray">
                        {scene.page_length.toFixed(1)} pg
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No scenes scheduled for this day
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Dailies Tab */}
        <TabsContent value="dailies" className="mt-4">
          {dailies ? (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-purple-400" />
                  Dailies Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-gray">Cards</p>
                    <p className="text-2xl font-bold text-bone-white">{dailies.card_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-gray">Clips</p>
                    <p className="text-2xl font-bold text-bone-white">{dailies.clip_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-gray">Circle Takes</p>
                    <p className="text-2xl font-bold text-accent-yellow">{dailies.circle_take_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-gray">Total Duration</p>
                    <p className="text-2xl font-bold text-bone-white">{dailies.total_duration_minutes.toFixed(0)} min</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No dailies recorded for this day yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Budget Tab */}
        {daily_budget && (
          <TabsContent value="budget" className="mt-4">
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  Daily Budget
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-gray">Planned</p>
                    <p className="text-2xl font-bold text-bone-white">
                      ${daily_budget.total_planned.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-gray">Actual</p>
                    <p className="text-2xl font-bold text-bone-white">
                      ${daily_budget.total_actual.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-gray">Variance</p>
                    <p className={cn(
                      'text-2xl font-bold',
                      daily_budget.variance >= 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {daily_budget.variance >= 0 ? '+' : ''}${daily_budget.variance.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-muted-gray">
                  {daily_budget.item_count} line items
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map(task => (
                <Card key={task.id} className="bg-charcoal-black border-muted-gray/20">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckSquare className={cn(
                        'w-4 h-4',
                        task.status === 'completed' ? 'text-green-400' : 'text-muted-gray'
                      )} />
                      <span className={cn(
                        'font-medium',
                        task.status === 'completed' ? 'text-muted-gray line-through' : 'text-bone-white'
                      )}>
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.priority && (
                        <Badge variant="outline" className={cn(
                          'border-muted-gray/30',
                          task.priority === 'urgent' && 'border-red-500/30 text-red-400',
                          task.priority === 'high' && 'border-orange-500/30 text-orange-400'
                        )}>
                          {task.priority}
                        </Badge>
                      )}
                      {task.assigned_to_name && (
                        <span className="text-sm text-muted-gray">{task.assigned_to_name}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No tasks due on this day
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timecards Tab */}
        <TabsContent value="timecards" className="mt-4">
          {timecard_entries.length > 0 ? (
            <div className="space-y-2">
              {timecard_entries.map(entry => (
                <Card key={entry.id} className="bg-charcoal-black border-muted-gray/20">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Timer className="w-4 h-4 text-blue-400" />
                      <span className="font-medium text-bone-white">
                        {entry.user_name || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {entry.call_time && entry.wrap_time && (
                        <span className="text-sm text-muted-gray">
                          {formatCallTime(entry.call_time)} - {formatCallTime(entry.wrap_time)}
                        </span>
                      )}
                      {entry.hours_worked && (
                        <Badge variant="outline" className="border-muted-gray/30 text-muted-gray">
                          {entry.hours_worked.toFixed(1)} hrs
                        </Badge>
                      )}
                      <Badge className={cn(
                        entry.status === 'approved' && 'bg-green-500/20 text-green-400 border-green-500/30',
                        entry.status === 'submitted' && 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                        entry.status === 'draft' && 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
                        entry.status === 'rejected' && 'bg-red-500/20 text-red-400 border-red-500/30'
                      )}>
                        {entry.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No timecard entries for this day
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Updates Section */}
      {updates.length > 0 && (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-accent-yellow" />
              Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {updates.map(update => (
                <div key={update.id} className="border-b border-muted-gray/10 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-bone-white">{update.title || update.update_type}</span>
                    <span className="text-xs text-muted-gray">
                      {update.author_name}
                    </span>
                  </div>
                  <p className="text-sm text-muted-gray mt-1 line-clamp-2">{update.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {(day.notes || day.weather_notes) && (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {day.notes && (
              <p className="text-muted-gray">{day.notes}</p>
            )}
            {day.weather_notes && (
              <p className="text-muted-gray">
                <span className="text-bone-white">Weather:</span> {day.weather_notes}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
