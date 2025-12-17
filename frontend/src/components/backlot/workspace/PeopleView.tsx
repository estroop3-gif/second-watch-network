/**
 * PeopleView - Crew list view for a project
 * Shows all team members with roles, schedule, and task status
 */
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Users,
  Calendar,
  CheckSquare,
  Timer,
  ChevronRight,
} from 'lucide-react';
import { usePeopleList, PersonListItem, getRoleLabel, BACKLOT_ROLE_LABELS } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface PeopleViewProps {
  projectId: string;
  canEdit: boolean;
  onSelectPerson: (person: PersonListItem) => void;
}

const DEPARTMENTS = [
  'Production',
  'Direction',
  'Camera',
  'Sound',
  'Lighting',
  'Art',
  'Wardrobe',
  'Makeup',
  'Post',
  'Other',
];

export default function PeopleView({ projectId, canEdit, onSelectPerson }: PeopleViewProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('');

  const { data: people, isLoading } = usePeopleList(projectId, {
    search: search || undefined,
    role: roleFilter || undefined,
    department: deptFilter || undefined,
  });

  const totalPeople = people?.length || 0;
  const withPendingTimecards = people?.filter(p => p.has_pending_timecard).length || 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Team</h2>
          <p className="text-sm text-muted-gray">
            {totalPeople} people {withPendingTimecards > 0 && `• ${withPendingTimecards} with pending timecards`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40 bg-charcoal-black border-muted-gray/30">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All roles</SelectItem>
              {Object.entries(BACKLOT_ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-40 bg-charcoal-black border-muted-gray/30">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All departments</SelectItem>
              {DEPARTMENTS.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-charcoal-black border-muted-gray/30"
            />
          </div>
        </div>
      </div>

      {/* People Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {people?.map((person) => (
          <Card
            key={person.user_id}
            className="bg-charcoal-black border-muted-gray/20 cursor-pointer hover:border-muted-gray/40 transition-colors"
            onClick={() => onSelectPerson(person)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={person.avatar_url || undefined} />
                    <AvatarFallback className="bg-accent-yellow/20 text-accent-yellow">
                      {(person.full_name || person.display_name || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-bone-white">
                      {person.full_name || person.display_name || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {person.primary_role && (
                        <Badge variant="outline" className="text-xs border-accent-yellow/30 text-accent-yellow">
                          {getRoleLabel(person.primary_role)}
                        </Badge>
                      )}
                      {person.department && (
                        <span className="text-xs text-muted-gray">{person.department}</span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-gray" />
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-muted-gray/10">
                {person.days_scheduled > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-gray">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{person.days_scheduled} days</span>
                  </div>
                )}
                {person.task_count > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-gray">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{person.task_count} tasks</span>
                  </div>
                )}
                {person.has_pending_timecard && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                    <Timer className="w-3 h-3 mr-1" />
                    Timecard
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {(!people || people.length === 0) && (
          <Card className="bg-charcoal-black border-muted-gray/20 col-span-full">
            <CardContent className="py-12 text-center text-muted-gray">
              {search || roleFilter || deptFilter
                ? 'No team members match your filters'
                : 'No team members added to this project yet'}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
