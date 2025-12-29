/**
 * CrewDocumentDashboard - Table view of all crew document status
 * Shows onboarding progress for every booked person
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Send,
  Eye,
  MailWarning,
} from 'lucide-react';
import { useCrewDocumentSummary } from '@/hooks/backlot';
import {
  getCompletionStatus,
  getCompletionStatusConfig,
  getCrewSummaryStats,
  CompletionStatus,
} from '@/hooks/backlot/useCrewDocuments';
import { CrewDocumentSummary } from '@/types/backlot';
import { cn } from '@/lib/utils';
import { OnboardingProgressBar } from './OnboardingProgressBar';

interface CrewDocumentDashboardProps {
  projectId: string;
  canEdit: boolean;
  onViewPerson?: (personId: string) => void;
  onSendPackage?: (personId: string, personName: string) => void;
  onSendReminder?: (personId: string) => void;
}

type FilterStatus = 'all' | CompletionStatus;

export function CrewDocumentDashboard({
  projectId,
  canEdit,
  onViewPerson,
  onSendPackage,
  onSendReminder,
}: CrewDocumentDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const { data: summaries, isLoading, error } = useCrewDocumentSummary(projectId);

  // Calculate overall stats
  const stats = useMemo(() => {
    if (!summaries) return null;
    return getCrewSummaryStats(summaries);
  }, [summaries]);

  // Filter summaries
  const filteredSummaries = useMemo(() => {
    if (!summaries) return [];

    return summaries.filter((summary) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (
          !summary.person_name.toLowerCase().includes(query) &&
          !summary.role_title?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (filterStatus !== 'all') {
        const status = getCompletionStatus(summary);
        if (status !== filterStatus) {
          return false;
        }
      }

      return true;
    });
  }, [summaries, searchQuery, filterStatus]);

  if (error) {
    return (
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load crew document summary</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary-red" />
          <h2 className="text-lg font-semibold text-bone-white">Crew Document Status</h2>
        </div>

        {stats && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {stats.total} Total
            </Badge>
            <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
              <CheckCircle className="h-3 w-3 mr-1" />
              {stats.complete} Complete
            </Badge>
            <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
              <Clock className="h-3 w-3 mr-1" />
              {stats.inProgress} In Progress
            </Badge>
            <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">
              <AlertCircle className="h-3 w-3 mr-1" />
              {stats.missing} Missing
            </Badge>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
          </SelectContent>
        </Select>

        {canEdit && stats && stats.missing > 0 && (
          <Button variant="outline" size="sm" onClick={() => onSendReminder?.('all')}>
            <MailWarning className="h-4 w-4 mr-2" />
            Send Reminders
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || filterStatus !== 'all'
                  ? 'No crew members match your filters'
                  : 'No booked crew members yet'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[200px]">Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummaries.map((summary) => (
                  <CrewDocumentRow
                    key={summary.person_id}
                    summary={summary}
                    canEdit={canEdit}
                    onView={() => onViewPerson?.(summary.person_id)}
                    onSendPackage={() =>
                      onSendPackage?.(summary.person_id, summary.person_name)
                    }
                    onSendReminder={() => onSendReminder?.(summary.person_id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Individual Row Component
function CrewDocumentRow({
  summary,
  canEdit,
  onView,
  onSendPackage,
  onSendReminder,
}: {
  summary: CrewDocumentSummary;
  canEdit: boolean;
  onView?: () => void;
  onSendPackage?: () => void;
  onSendReminder?: () => void;
}) {
  const status = getCompletionStatus(summary);
  const statusConfig = getCompletionStatusConfig(status);

  return (
    <TableRow className="hover:bg-muted-gray/5">
      <TableCell>
        <span className="font-medium text-bone-white">{summary.person_name}</span>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground">{summary.role_title || 'No role'}</span>
      </TableCell>
      <TableCell>
        <OnboardingProgressBar summary={summary} size="sm" />
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn('text-xs', statusConfig.bgColor, statusConfig.color)}>
          {statusConfig.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onView}
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {canEdit && status !== 'complete' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onSendPackage}
                title="Send document package"
              >
                <Send className="h-4 w-4" />
              </Button>

              {(status === 'in_progress' || status === 'missing') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-yellow-400 hover:text-yellow-300"
                  onClick={onSendReminder}
                  title="Send reminder"
                >
                  <MailWarning className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
