import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Phone, Mail, MessageSquare, Users, Monitor, CalendarCheck, FileText, StickyNote, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useActivityCalendar, useCreateActivity, useUpdateActivity, useDeleteActivity } from '@/hooks/crm/useActivities';
import { useContacts } from '@/hooks/crm/useContacts';
import CalendarFilters from '@/components/crm/CalendarFilters';
import CalendarDayPanel from '@/components/crm/CalendarDayPanel';
import CalendarActivityDialog from '@/components/crm/CalendarActivityDialog';
import FollowUpCompleteDialog from '@/components/crm/FollowUpCompleteDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone, email: Mail, text: MessageSquare,
  meeting: Users, demo: Monitor, follow_up: CalendarCheck,
  proposal_sent: FileText, note: StickyNote,
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ActivityCalendar = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterContact, setFilterContact] = useState('all');
  const [showFollowUps, setShowFollowUps] = useState(true);

  // Dialogs
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [editActivity, setEditActivity] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [completingFollowUp, setCompletingFollowUp] = useState<any>(null);

  const { data, isLoading } = useActivityCalendar(month, year);
  const { data: contactsData } = useContacts({ limit: 200 });
  const contacts = contactsData?.contacts || [];

  const calendar = data?.calendar || {};
  const followUpsMap = data?.follow_ups || {};

  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

  // Navigation
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
    setSelectedDay(null);
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getDateKey = useCallback((day: number) => {
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }, [month, year]);

  // Client-side filtering
  const filterActivities = useCallback((activities: any[]) => {
    let filtered = activities;
    if (filterType !== 'all') {
      filtered = filtered.filter(a => a.activity_type === filterType);
    }
    if (filterContact !== 'all') {
      filtered = filtered.filter(a => a.contact_id === filterContact);
    }
    return filtered;
  }, [filterType, filterContact]);

  const filterFollowUps = useCallback((fus: any[]) => {
    if (!showFollowUps) return [];
    let filtered = fus;
    if (filterContact !== 'all') {
      filtered = filtered.filter(fu => fu.contact_id === filterContact);
    }
    return filtered;
  }, [showFollowUps, filterContact]);

  // Day panel data
  const selectedActivities = useMemo(() => {
    if (!selectedDay) return [];
    return filterActivities(calendar[selectedDay] || []);
  }, [selectedDay, calendar, filterActivities]);

  const selectedFollowUps = useMemo(() => {
    if (!selectedDay) return [];
    return filterFollowUps(followUpsMap[selectedDay] || []);
  }, [selectedDay, followUpsMap, filterFollowUps]);

  // Cell data helpers
  const getCellCounts = useCallback((dateKey: string) => {
    const activities = filterActivities(calendar[dateKey] || []);
    const fus = filterFollowUps(followUpsMap[dateKey] || []);

    // Group activities by type
    const typeCounts: Record<string, number> = {};
    for (const a of activities) {
      typeCounts[a.activity_type] = (typeCounts[a.activity_type] || 0) + 1;
    }

    return { typeCounts, fuCount: fus.length };
  }, [calendar, followUpsMap, filterActivities, filterFollowUps]);

  // Handlers
  const handleLogActivity = (dateKey?: string) => {
    setEditActivity(null);
    setSelectedDay(prev => dateKey || prev);
    setActivityDialogOpen(true);
  };

  const handleEditActivity = (activity: any) => {
    setEditActivity(activity);
    setActivityDialogOpen(true);
  };

  const handleActivitySubmit = (data: any) => {
    if (editActivity) {
      updateActivity.mutate(
        { id: editActivity.id, data },
        { onSuccess: () => setActivityDialogOpen(false) },
      );
    } else {
      createActivity.mutate(data, {
        onSuccess: () => setActivityDialogOpen(false),
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirmId) return;
    deleteActivity.mutate(deleteConfirmId, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const handleCompleteFollowUp = (fu: any) => {
    setCompletingFollowUp(fu);
    setFollowUpDialogOpen(true);
  };

  const handleFollowUpSubmit = (newActivityData: any, originalActivityId: string) => {
    // 1. Create the new activity
    createActivity.mutate(newActivityData, {
      onSuccess: () => {
        // 2. Clear follow_up_date on the original
        updateActivity.mutate(
          { id: originalActivityId, data: { follow_up_date: null, follow_up_notes: null } },
          { onSuccess: () => setFollowUpDialogOpen(false) },
        );
      },
    });
  };

  const isToday = (day: number) =>
    day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <h1 className="text-3xl font-heading text-bone-white">Activity Calendar</h1>
        <Button onClick={() => handleLogActivity()} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
          <Plus className="h-4 w-4 mr-1" />
          Log Activity
        </Button>
      </div>

      {/* Filters */}
      <CalendarFilters
        activityType={filterType}
        onActivityTypeChange={setFilterType}
        contactId={filterContact}
        onContactIdChange={setFilterContact}
        showFollowUps={showFollowUps}
        onShowFollowUpsChange={setShowFollowUps}
        contacts={contacts}
      />

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-medium text-bone-white">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <Button variant="ghost" size="sm" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Main layout: calendar + day panel */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar Grid */}
        <Card className="bg-charcoal-black border-muted-gray/30 flex-1 min-w-0">
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-gray">Loading...</div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-xs text-muted-gray py-2 font-medium">
                    {d}
                  </div>
                ))}

                {days.map((day, i) => {
                  if (day === null) return <div key={`empty-${i}`} />;
                  const dateKey = getDateKey(day);
                  const { typeCounts, fuCount } = getCellCounts(dateKey);
                  const hasItems = Object.keys(typeCounts).length > 0 || fuCount > 0;
                  const today = isToday(day);
                  const selected = selectedDay === dateKey;

                  return (
                    <button
                      key={dateKey}
                      onClick={() => setSelectedDay(selected ? null : dateKey)}
                      className={`min-h-[80px] p-1.5 rounded border text-left transition-all ${
                        selected
                          ? 'border-accent-yellow ring-1 ring-accent-yellow/50 bg-accent-yellow/5'
                          : today
                            ? 'border-accent-yellow/50 bg-accent-yellow/5'
                            : 'border-muted-gray/10 hover:border-muted-gray/30'
                      }`}
                    >
                      <div className={`text-xs font-medium mb-1 ${
                        today ? 'text-accent-yellow' : selected ? 'text-accent-yellow' : 'text-bone-white/60'
                      }`}>
                        {day}
                      </div>

                      {hasItems && (
                        <div className="space-y-0.5">
                          {Object.entries(typeCounts).slice(0, 3).map(([type, count]) => {
                            const Icon = ACTIVITY_ICONS[type] || StickyNote;
                            return (
                              <div key={type} className="flex items-center gap-1 text-[10px] text-bone-white/70">
                                <Icon className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate capitalize">{type.replace('_', ' ')}</span>
                                {count > 1 && <span className="text-muted-gray">x{count}</span>}
                              </div>
                            );
                          })}
                          {Object.keys(typeCounts).length > 3 && (
                            <div className="text-[10px] text-muted-gray">
                              +{Object.keys(typeCounts).length - 3} more
                            </div>
                          )}
                          {fuCount > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-blue-400">
                              <CalendarCheck className="h-3 w-3 flex-shrink-0" />
                              <span>{fuCount} follow-up{fuCount > 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Day Detail Panel */}
        {selectedDay && (
          <CalendarDayPanel
            dateKey={selectedDay}
            activities={selectedActivities}
            followUps={selectedFollowUps}
            onClose={() => setSelectedDay(null)}
            onLogActivity={() => handleLogActivity(selectedDay)}
            onEditActivity={handleEditActivity}
            onDeleteActivity={setDeleteConfirmId}
            onCompleteFollowUp={handleCompleteFollowUp}
          />
        )}
      </div>

      {/* Activity Create/Edit Dialog */}
      <CalendarActivityDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        contacts={contacts}
        onSubmit={handleActivitySubmit}
        isSubmitting={createActivity.isPending || updateActivity.isPending}
        editActivity={editActivity}
        defaultDate={selectedDay || undefined}
      />

      {/* Follow-up Complete Dialog */}
      <FollowUpCompleteDialog
        open={followUpDialogOpen}
        onOpenChange={setFollowUpDialogOpen}
        followUp={completingFollowUp}
        onSubmit={handleFollowUpSubmit}
        isSubmitting={createActivity.isPending || updateActivity.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ActivityCalendar;
