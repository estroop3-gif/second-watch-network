/**
 * PeopleView - Unified view of all people associated with a project
 * Shows team members and contacts in one place with filtering options
 */
import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  UserCheck,
  UserPlus,
  Building,
  Phone,
  Mail,
  Briefcase,
  HelpCircle,
  Clock,
  UserCog,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePeopleList, PersonListItem, getRoleLabel, BACKLOT_ROLE_LABELS } from '@/hooks/backlot';
import { useUnifiedPeople, UnifiedPerson } from '@/hooks/backlot/useProjectAccess';
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

type ViewMode = 'all' | 'team' | 'contacts';

export default function PeopleView({ projectId, canEdit, onSelectPerson }: PeopleViewProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [showTipsPanel, setShowTipsPanel] = useState(false);

  // Fetch team members (existing hook)
  const { data: people, isLoading: isLoadingPeople } = usePeopleList(projectId, {
    search: search || undefined,
    role: roleFilter || undefined,
    department: deptFilter || undefined,
  });

  // Fetch unified people (includes contacts)
  const { data: unifiedData, isLoading: isLoadingUnified } = useUnifiedPeople(projectId);

  const isLoading = isLoadingPeople || isLoadingUnified;

  // Filter unified people based on view mode and search
  const filteredUnified = useMemo(() => {
    if (!unifiedData?.unified) return [];

    let filtered = unifiedData.unified;

    // Filter by view mode
    if (viewMode === 'team') {
      filtered = filtered.filter(p => p.is_team_member);
    } else if (viewMode === 'contacts') {
      filtered = filtered.filter(p => !p.is_team_member);
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.email?.toLowerCase().includes(searchLower) ||
        p.company?.toLowerCase().includes(searchLower) ||
        p.role_interest?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by role (for team members)
    if (roleFilter) {
      filtered = filtered.filter(p =>
        p.backlot_roles.includes(roleFilter) || p.primary_role === roleFilter
      );
    }

    return filtered;
  }, [unifiedData?.unified, viewMode, search, roleFilter]);

  // Count stats
  const totalTeam = unifiedData?.unified.filter(p => p.is_team_member).length || 0;
  const totalContacts = unifiedData?.unified.filter(p => !p.is_team_member).length || 0;
  const totalAll = unifiedData?.unified.length || 0;

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
          <h2 className="text-2xl font-heading text-bone-white">People</h2>
          <p className="text-sm text-muted-gray">
            {totalAll} total • {totalTeam} team members • {totalContacts} contacts
            {withPendingTimecards > 0 && ` • ${withPendingTimecards} with pending timecards`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            Tips
          </Button>
          {/* View Mode Tabs */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="bg-charcoal-black/50">
              <TabsTrigger value="all" className="data-[state=active]:bg-accent-yellow/20">
                <Users className="w-4 h-4 mr-2" />
                All ({totalAll})
              </TabsTrigger>
              <TabsTrigger value="team" className="data-[state=active]:bg-green-500/20">
                <UserCheck className="w-4 h-4 mr-2" />
                Team ({totalTeam})
              </TabsTrigger>
              <TabsTrigger value="contacts" className="data-[state=active]:bg-blue-500/20">
                <Briefcase className="w-4 h-4 mr-2" />
                Contacts ({totalContacts})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {viewMode !== 'contacts' && (
          <Select value={roleFilter || 'all'} onValueChange={(v) => setRoleFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40 bg-charcoal-black border-muted-gray/30">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {Object.entries(BACKLOT_ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {viewMode === 'team' && (
          <Select value={deptFilter || 'all'} onValueChange={(v) => setDeptFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40 bg-charcoal-black border-muted-gray/30">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {DEPARTMENTS.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search by name, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-charcoal-black border-muted-gray/30"
          />
        </div>
      </div>

      {/* People Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUnified.map((person) => (
          <UnifiedPersonCard
            key={person.id}
            person={person}
            teamMemberDetails={people?.find(p => p.user_id === person.user_id)}
            onClick={() => {
              // If team member, use existing detail view
              if (person.is_team_member && person.user_id) {
                const teamPerson = people?.find(p => p.user_id === person.user_id);
                if (teamPerson) {
                  onSelectPerson(teamPerson);
                }
              }
              // For contacts, could navigate to contacts view in future
            }}
          />
        ))}

        {filteredUnified.length === 0 && (
          <Card className="bg-charcoal-black border-muted-gray/20 col-span-full">
            <CardContent className="py-12 text-center text-muted-gray">
              {search || roleFilter || deptFilter
                ? 'No people match your filters'
                : viewMode === 'team'
                  ? 'No team members added to this project yet'
                  : viewMode === 'contacts'
                    ? 'No contacts added to this project yet'
                    : 'No people associated with this project yet'}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tips Panel Dialog */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="sm:max-w-lg bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              People Tips
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <UserCheck className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Team Members</h4>
                <p className="text-sm text-muted-gray">
                  Team members have accounts and can access the project. They can
                  be assigned roles, scheduled, and submit timecards.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Briefcase className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Contacts</h4>
                <p className="text-sm text-muted-gray">
                  Contacts are external people (vendors, agents, etc.) tracked
                  for communication. They can be converted to team members.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent-yellow/10 rounded-lg">
                <UserCog className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Roles & Permissions</h4>
                <p className="text-sm text-muted-gray">
                  Assign roles like Producer, Director, or Crew to control what
                  each team member can view and edit in the project.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Timecards</h4>
                <p className="text-sm text-muted-gray">
                  Team members with pending timecards are flagged. Click their
                  card to view and approve submitted hours.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Search className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Filtering</h4>
                <p className="text-sm text-muted-gray">
                  Use tabs to switch between All, Team, and Contacts views.
                  Filter by role or department, or search by name.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTipsPanel(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Unified Person Card Component
function UnifiedPersonCard({
  person,
  teamMemberDetails,
  onClick,
}: {
  person: UnifiedPerson;
  teamMemberDetails?: PersonListItem;
  onClick: () => void;
}) {
  const isClickable = person.is_team_member;

  return (
    <Card
      className={cn(
        "bg-charcoal-black border-muted-gray/20 transition-colors",
        isClickable && "cursor-pointer hover:border-muted-gray/40"
      )}
      onClick={isClickable ? onClick : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={person.user_avatar || undefined} />
              <AvatarFallback className={cn(
                person.is_team_member
                  ? "bg-green-500/20 text-green-400"
                  : "bg-blue-500/20 text-blue-400"
              )}>
                {person.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-bone-white truncate">
                {person.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {/* Source badge */}
                {person.source === 'both' ? (
                  <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                    Team + Contact
                  </Badge>
                ) : person.is_team_member ? (
                  <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                    <UserCheck className="w-3 h-3 mr-1" />
                    Team
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                    <Briefcase className="w-3 h-3 mr-1" />
                    Contact
                  </Badge>
                )}

                {/* Role for team members */}
                {person.primary_role && (
                  <Badge variant="outline" className="text-xs border-accent-yellow/30 text-accent-yellow">
                    {getRoleLabel(person.primary_role)}
                  </Badge>
                )}

                {/* Contact status */}
                {person.contact_status && !person.is_team_member && (
                  <Badge variant="outline" className={cn("text-xs",
                    person.contact_status === 'confirmed' && "border-green-500/30 text-green-400",
                    person.contact_status === 'in_discussion' && "border-orange-500/30 text-orange-400",
                    person.contact_status === 'contacted' && "border-purple-500/30 text-purple-400",
                    person.contact_status === 'new' && "border-blue-500/30 text-blue-400"
                  )}>
                    {person.contact_status.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {isClickable && <ChevronRight className="w-4 h-4 text-muted-gray shrink-0" />}
        </div>

        {/* Contact Info */}
        <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-gray">
          {person.company && (
            <span className="flex items-center gap-1">
              <Building className="w-3 h-3" />
              {person.company}
            </span>
          )}
          {person.role_interest && !person.is_team_member && (
            <span className="text-bone-white/70">{person.role_interest}</span>
          )}
        </div>

        {/* Contact details */}
        <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-gray">
          {person.email && (
            <a
              href={`mailto:${person.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 hover:text-accent-yellow"
            >
              <Mail className="w-3 h-3" />
              <span className="truncate max-w-32">{person.email}</span>
            </a>
          )}
          {person.phone && (
            <a
              href={`tel:${person.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 hover:text-accent-yellow"
            >
              <Phone className="w-3 h-3" />
              {person.phone}
            </a>
          )}
        </div>

        {/* Stats Row - for team members */}
        {person.is_team_member && teamMemberDetails && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-muted-gray/10">
            {teamMemberDetails.days_scheduled > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-muted-gray">
                <Calendar className="w-3.5 h-3.5" />
                <span>{teamMemberDetails.days_scheduled} days</span>
              </div>
            )}
            {teamMemberDetails.task_count > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-muted-gray">
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{teamMemberDetails.task_count} tasks</span>
              </div>
            )}
            {teamMemberDetails.has_pending_timecard && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                <Timer className="w-3 h-3 mr-1" />
                Timecard
              </Badge>
            )}
          </div>
        )}

        {/* Add to Team hint for contacts with accounts */}
        {!person.is_team_member && person.has_account && (
          <div className="mt-3 pt-3 border-t border-muted-gray/10">
            <p className="text-xs text-green-400/70 flex items-center gap-1">
              <UserPlus className="w-3 h-3" />
              Has account - can be added to team
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
