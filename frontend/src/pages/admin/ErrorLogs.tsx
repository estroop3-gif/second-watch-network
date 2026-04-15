import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertTriangle,
  Bug,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface ErrorLog {
  id: string;
  error_name: string;
  error_message: string;
  error_stack: string | null;
  component_stack: string | null;
  pathname: string | null;
  url: string | null;
  user_agent: string | null;
  severity: 'warning' | 'error' | 'fatal';
  context: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  session_id: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
  resolved_by_email: string | null;
}

interface ErrorStats {
  total: number;
  unresolved: number;
  fatal: number;
  last_24h: number;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  warning: { label: 'Warning', color: 'bg-amber-500', icon: <AlertTriangle className="h-3 w-3" /> },
  error: { label: 'Error', color: 'bg-primary-red', icon: <XCircle className="h-3 w-3" /> },
  fatal: { label: 'Fatal', color: 'bg-red-800', icon: <Bug className="h-3 w-3" /> },
};

const StatCard = ({ icon, title, value, accent }: {
  icon: React.ReactNode;
  title: string;
  value: number | string;
  accent?: string;
}) => (
  <div className="bg-charcoal-black border-2 border-muted-gray p-4 text-center">
    <div className="flex justify-center mb-2">{icon}</div>
    <h3 className={`text-2xl font-heading ${accent || 'text-accent-yellow'}`}>{value}</h3>
    <p className="text-muted-gray text-xs uppercase tracking-wide">{title}</p>
  </div>
);

const ErrorLogs = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [resolvedFilter, setResolvedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const pageSize = 50;

  const buildParams = (extra?: Record<string, string>) => {
    const p = new URLSearchParams({
      limit: pageSize.toString(),
      offset: ((page - 1) * pageSize).toString(),
    });
    if (severityFilter !== 'all') p.set('severity', severityFilter);
    if (resolvedFilter === 'unresolved') p.set('resolved', 'false');
    if (resolvedFilter === 'resolved') p.set('resolved', 'true');
    if (searchQuery) p.set('search', searchQuery);
    if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'error-logs-stats'],
    queryFn: () => api.get<ErrorStats>('/api/v1/admin/client-errors?counts=true'),
    refetchInterval: 60_000,
  });

  const { data: logsData, isLoading: logsLoading, refetch } = useQuery({
    queryKey: ['admin', 'error-logs', page, severityFilter, resolvedFilter, searchQuery],
    queryFn: () =>
      api.get<{ errors: ErrorLog[]; total: number; limit: number; offset: number }>(
        `/api/v1/admin/client-errors?${buildParams()}`
      ),
    refetchInterval: 60_000,
  });

  const resolveMutation = useMutation({
    mutationFn: (errorId: string) =>
      api.patch(`/api/v1/admin/client-errors/${errorId}/resolve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'error-logs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'error-logs-stats'] });
      setSelectedError(null);
      toast.success('Error marked as resolved');
    },
    onError: () => toast.error('Failed to mark as resolved'),
  });

  const totalPages = logsData ? Math.ceil(logsData.total / pageSize) : 1;

  const getSeverityBadge = (severity: string) => {
    const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.error;
    return (
      <Badge className={`${cfg.color} flex items-center gap-1 text-white`}>
        {cfg.icon}
        {cfg.label}
      </Badge>
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    try { return format(new Date(d), 'MMM d, yyyy h:mm a'); } catch { return d; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading text-accent-yellow">Client Error Logs</h1>
          <p className="text-muted-gray">JavaScript errors reported from the browser</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetch(); toast.success('Refreshed'); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Bug className="h-6 w-6 text-accent-yellow" />} title="Total Errors" value={stats.total} />
          <StatCard icon={<XCircle className="h-6 w-6 text-primary-red" />} title="Unresolved" value={stats.unresolved} accent="text-primary-red" />
          <StatCard icon={<AlertTriangle className="h-6 w-6 text-red-800" />} title="Fatal" value={stats.fatal} accent="text-red-400" />
          <StatCard icon={<Info className="h-6 w-6 text-blue-400" />} title="Last 24h" value={stats.last_24h} accent="text-blue-400" />
        </div>
      )}

      {/* Filters */}
      <Card className="bg-gray-900 border-muted-gray">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
              <Input
                placeholder="Search error message or path..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-10 bg-charcoal-black border-muted-gray"
              />
            </div>
            <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray">
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="fatal">Fatal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resolvedFilter} onValueChange={(v) => { setResolvedFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-gray-900 border-muted-gray">
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-muted-gray hover:bg-transparent">
                      <TableHead className="text-muted-gray">Time</TableHead>
                      <TableHead className="text-muted-gray">Severity</TableHead>
                      <TableHead className="text-muted-gray">Error</TableHead>
                      <TableHead className="text-muted-gray">Path</TableHead>
                      <TableHead className="text-muted-gray">User</TableHead>
                      <TableHead className="text-muted-gray">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!logsData?.errors?.length ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-gray py-8">
                          No error logs found
                        </TableCell>
                      </TableRow>
                    ) : logsData.errors.map((log) => (
                      <TableRow
                        key={log.id}
                        className="border-muted-gray/50 hover:bg-muted-gray/10 cursor-pointer"
                        onClick={() => setSelectedError(log)}
                      >
                        <TableCell className="text-muted-gray text-sm whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </TableCell>
                        <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                        <TableCell className="max-w-xs">
                          <p className="font-mono text-xs text-muted-gray">{log.error_name}</p>
                          <p className="truncate text-sm">{log.error_message}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-gray max-w-[180px] truncate">
                          {log.pathname || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-gray">
                          {log.user_email || <span className="italic">Anonymous</span>}
                        </TableCell>
                        <TableCell>
                          {log.resolved ? (
                            <Badge className="bg-emerald-700 flex items-center gap-1 text-white w-fit">
                              <CheckCircle className="h-3 w-3" /> Resolved
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-primary-red text-primary-red w-fit">
                              Open
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {logsData && totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-muted-gray/50">
                  <p className="text-sm text-muted-gray">
                    {logsData.total} total errors
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm text-muted-gray">
                      Page {page} of {totalPages}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
        <DialogContent className="bg-gray-900 border-muted-gray max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-accent-yellow">Error Detail</DialogTitle>
          </DialogHeader>

          {selectedError && (
            <div className="space-y-5">
              {/* Severity + resolve action */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {getSeverityBadge(selectedError.severity)}
                {!selectedError.resolved && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-600 text-emerald-500 hover:bg-emerald-600/10"
                    onClick={() => resolveMutation.mutate(selectedError.id)}
                    disabled={resolveMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Resolved
                  </Button>
                )}
                {selectedError.resolved && (
                  <p className="text-xs text-emerald-500">
                    Resolved {formatDate(selectedError.resolved_at)}
                    {selectedError.resolved_by_email && ` by ${selectedError.resolved_by_email}`}
                  </p>
                )}
              </div>

              {/* Error info */}
              <div className="grid gap-3 text-sm">
                <div>
                  <label className="text-xs text-muted-gray uppercase">Error Name</label>
                  <p className="font-mono">{selectedError.error_name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-gray uppercase">Message</label>
                  <p>{selectedError.error_message}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-gray uppercase">Path</label>
                    <p className="font-mono text-xs">{selectedError.pathname || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-gray uppercase">User</label>
                    <p>{selectedError.user_email || <span className="italic text-muted-gray">Anonymous</span>}</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-gray uppercase">Time</label>
                  <p>{formatDate(selectedError.created_at)}</p>
                </div>
              </div>

              {/* Stack trace */}
              {selectedError.error_stack && (
                <div>
                  <label className="text-xs text-muted-gray uppercase mb-2 block">Stack Trace</label>
                  <pre className="bg-charcoal-black border border-muted-gray/50 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-bone-white/80 max-h-60">
                    {selectedError.error_stack}
                  </pre>
                </div>
              )}

              {/* Component stack */}
              {selectedError.component_stack && (
                <div>
                  <label className="text-xs text-muted-gray uppercase mb-2 block">Component Stack</label>
                  <pre className="bg-charcoal-black border border-muted-gray/50 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-muted-gray max-h-48">
                    {selectedError.component_stack}
                  </pre>
                </div>
              )}

              {/* Context */}
              {selectedError.context && (
                <div>
                  <label className="text-xs text-muted-gray uppercase mb-2 block">Context</label>
                  <pre className="bg-charcoal-black border border-muted-gray/50 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-bone-white/70">
                    {JSON.stringify(selectedError.context, null, 2)}
                  </pre>
                </div>
              )}

              {/* Technical footer */}
              <div className="text-xs text-muted-gray border-t border-muted-gray/50 pt-4 space-y-1">
                {selectedError.user_agent && (
                  <p className="truncate">User Agent: {selectedError.user_agent}</p>
                )}
                <p className="font-mono">ID: {selectedError.id}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ErrorLogs;
