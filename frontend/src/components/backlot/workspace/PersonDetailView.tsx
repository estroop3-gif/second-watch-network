/**
 * PersonDetailView - Comprehensive person overview within a project
 * Shows identity, roles, schedule, timecards, tasks, and credits
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  User,
  Calendar,
  Timer,
  CheckSquare,
  Award,
  MapPin,
  Clock,
  Mail,
  Phone,
} from 'lucide-react';
import {
  usePersonOverview,
  getRoleLabel,
  getTimecardStatusColor,
  getTimecardStatusLabel,
  formatDate,
  formatCallTime,
} from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface PersonDetailViewProps {
  projectId: string;
  userId: string;
  canEdit: boolean;
  onBack: () => void;
}

export default function PersonDetailView({ projectId, userId, canEdit, onBack }: PersonDetailViewProps) {
  const { data: overview, isLoading } = usePersonOverview(projectId, userId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
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
        <p className="text-muted-gray mb-4">Person not found</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Team
        </Button>
      </div>
    );
  }

  const { identity, roles, schedule, timecards, tasks, credit, stats } = overview;
  const primaryRole = roles.find(r => r.is_primary) || roles[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={identity.avatar_url || undefined} />
            <AvatarFallback className="bg-accent-yellow/20 text-accent-yellow text-xl">
              {(identity.full_name || identity.display_name || 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-heading text-bone-white">
              {identity.full_name || identity.display_name || 'Unknown'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {roles.map(role => (
                <Badge
                  key={role.id}
                  variant="outline"
                  className={cn(
                    'border-accent-yellow/30 text-accent-yellow',
                    !role.is_primary && 'border-muted-gray/30 text-muted-gray'
                  )}
                >
                  {getRoleLabel(role.backlot_role)}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-gray">
              {identity.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {identity.email}
                </span>
              )}
              {identity.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {identity.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-bone-white">{stats.days_scheduled}</p>
            <p className="text-xs text-muted-gray">Days Scheduled</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.total_hours_logged}</p>
            <p className="text-xs text-muted-gray">Hours Logged</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-accent-yellow">{stats.pending_tasks}</p>
            <p className="text-xs text-muted-gray">Pending Tasks</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.timecards_pending}</p>
            <p className="text-xs text-muted-gray">Timecards Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="bg-charcoal-black border border-muted-gray/20">
          <TabsTrigger value="schedule">Schedule ({schedule.length})</TabsTrigger>
          <TabsTrigger value="timecards">Timecards ({timecards.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        </TabsList>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="mt-4">
          {schedule.length > 0 ? (
            <div className="space-y-2">
              {schedule.map(day => (
                <Card key={day.day_id} className="bg-charcoal-black border-muted-gray/20">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-muted-gray/10">
                        <span className="text-xs text-muted-gray">Day</span>
                        <span className="text-lg font-bold text-bone-white">{day.day_number}</span>
                      </div>
                      <div>
                        <p className="font-medium text-bone-white">{formatDate(day.date)}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-gray">
                          {day.call_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatCallTime(day.call_time)}
                            </span>
                          )}
                          {day.location_name && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {day.location_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {day.is_completed ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Wrapped</Badge>
                    ) : (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Upcoming</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                Not scheduled for any days yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timecards Tab */}
        <TabsContent value="timecards" className="mt-4">
          {timecards.length > 0 ? (
            <div className="space-y-2">
              {timecards.map(tc => (
                <Card key={tc.id} className="bg-charcoal-black border-muted-gray/20">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Timer className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="font-medium text-bone-white">
                          Week of {formatDate(tc.week_start_date)}
                        </p>
                        <p className="text-sm text-muted-gray">
                          {tc.entry_count} entries • {tc.total_hours.toFixed(1)} hrs
                          {tc.total_overtime > 0 && ` (+${tc.total_overtime.toFixed(1)} OT)`}
                        </p>
                      </div>
                    </div>
                    <Badge className={getTimecardStatusColor(tc.status)}>
                      {getTimecardStatusLabel(tc.status)}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No timecards submitted yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

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
                      <div>
                        <span className={cn(
                          'font-medium',
                          task.status === 'completed' ? 'text-muted-gray line-through' : 'text-bone-white'
                        )}>
                          {task.title}
                        </span>
                        {task.task_list_name && (
                          <p className="text-xs text-muted-gray">{task.task_list_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.due_date && (
                        <span className="text-sm text-muted-gray">{formatDate(task.due_date)}</span>
                      )}
                      {task.priority && (
                        <Badge variant="outline" className={cn(
                          'border-muted-gray/30',
                          task.priority === 'urgent' && 'border-red-500/30 text-red-400',
                          task.priority === 'high' && 'border-orange-500/30 text-orange-400'
                        )}>
                          {task.priority}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No tasks assigned
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Credit Info */}
      {credit && (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-accent-yellow" />
              Credit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-lg font-medium text-bone-white">{credit.role}</p>
                {credit.department && (
                  <p className="text-sm text-muted-gray">{credit.department}</p>
                )}
              </div>
              {credit.credit_order && (
                <Badge variant="outline" className="border-muted-gray/30 text-muted-gray">
                  Order: {credit.credit_order}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
