import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { format, subDays } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Filter, RefreshCw, ChevronLeft, ChevronRight, Shield, Activity, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
  admin: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface AdminUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  user_banned: 'bg-primary-red',
  user_unbanned: 'bg-emerald-600',
  user_deleted: 'bg-red-700',
  role_updated: 'bg-blue-500',
  submission_approved: 'bg-emerald-600',
  submission_rejected: 'bg-primary-red',
  submission_status_changed: 'bg-accent-yellow text-charcoal-black',
  application_approved: 'bg-emerald-600',
  application_rejected: 'bg-primary-red',
  thread_deleted: 'bg-primary-red',
  reply_deleted: 'bg-primary-red',
  category_created: 'bg-blue-500',
  category_updated: 'bg-accent-yellow text-charcoal-black',
  category_deleted: 'bg-primary-red',
  settings_updated: 'bg-purple-600',
  default: 'bg-muted-gray',
};

const StatCard = ({ icon, title, value, delay }: { icon: React.ReactNode, title: string, value: string | number, delay: number }) => (
  <motion.div
    className="bg-charcoal-black border-2 border-muted-gray p-4 text-center transform hover:scale-105 transition-transform"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1 }}
  >
    <div className="flex justify-center mb-2">{icon}</div>
    <h3 className="text-2xl font-heading text-accent-yellow">{value}</h3>
    <p className="text-muted-gray text-xs uppercase tracking-wide">{title}</p>
  </motion.div>
);

const AuditLog = () => {
  const [page, setPage] = useState(0);
  const [adminFilter, setAdminFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7');
  const pageSize = 25;

  const getDateFilters = () => {
    if (dateRange === 'all') return { start_date: undefined, end_date: undefined };
    const days = parseInt(dateRange);
    const startDate = subDays(new Date(), days).toISOString();
    return { start_date: startDate, end_date: undefined };
  };

  const dateFilters = getDateFilters();

  const { data: auditData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-audit-log', page, adminFilter, actionFilter, targetTypeFilter, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `${api.getBaseUrl()}/admin/audit-log?` + new URLSearchParams({
          skip: String(page * pageSize),
          limit: String(pageSize),
          ...(adminFilter !== 'all' && { admin_id: adminFilter }),
          ...(actionFilter !== 'all' && { action: actionFilter }),
          ...(targetTypeFilter !== 'all' && { target_type: targetTypeFilter }),
          ...(dateFilters.start_date && { start_date: dateFilters.start_date }),
        }).toString(),
        { headers: api.getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch audit log');
      return response.json();
    },
  });

  const { data: actionsData } = useQuery({
    queryKey: ['admin-audit-log-actions'],
    queryFn: async () => {
      const response = await fetch(`${api.getBaseUrl()}/admin/audit-log/actions`, {
        headers: api.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch actions');
      return response.json();
    },
  });

  const { data: adminsData } = useQuery({
    queryKey: ['admin-audit-log-admins'],
    queryFn: async () => {
      const response = await fetch(`${api.getBaseUrl()}/admin/audit-log/admins`, {
        headers: api.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch admins');
      return response.json();
    },
  });

  const entries: AuditLogEntry[] = auditData?.data || [];
  const totalCount = auditData?.total || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const actions: string[] = actionsData?.actions || [];
  const admins: AdminUser[] = adminsData?.admins || [];

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...(adminFilter !== 'all' && { admin_id: adminFilter }),
        ...(actionFilter !== 'all' && { action: actionFilter }),
        ...(targetTypeFilter !== 'all' && { target_type: targetTypeFilter }),
        ...(dateFilters.start_date && { start_date: dateFilters.start_date }),
      });

      const response = await fetch(`${api.getBaseUrl()}/admin/audit-log/export?${params}`, {
        headers: api.getHeaders(),
      });

      if (!response.ok) throw new Error('Failed to export');
      const data = await response.json();

      if (data.data.length === 0) {
        toast.error('No data to export');
        return;
      }

      const headers = Object.keys(data.data[0]);
      const csvContent = [
        headers.join(','),
        ...data.data.map((row: any) =>
          headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${data.count} entries`);
    } catch (error) {
      toast.error('Failed to export audit log');
    }
  };

  const getActionColor = (action: string) => ACTION_COLORS[action] || ACTION_COLORS.default;

  const formatAction = (action: string) =>
    action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const formatDetails = (details: Record<string, any>) => {
    if (!details || Object.keys(details).length === 0) return '-';
    const detailEntries = Object.entries(details).slice(0, 3);
    return detailEntries.map(([k, v]) => `${k}: ${String(v).substring(0, 30)}`).join(', ');
  };

  const resetFilters = () => {
    setAdminFilter('all');
    setActionFilter('all');
    setTargetTypeFilter('all');
    setDateRange('7');
    setPage(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-4xl md:text-5xl font-heading tracking-tighter">
            Audit <span className="text-accent-yellow">Log</span>
          </h1>
          <p className="text-muted-gray mt-1">Track all administrative actions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-muted-gray hover:border-accent-yellow hover:text-accent-yellow"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Activity className="h-8 w-8 text-accent-yellow" />} title="Total Entries" value={totalCount} delay={0} />
        <StatCard icon={<Users className="h-8 w-8 text-accent-yellow" />} title="Active Admins" value={admins.length} delay={1} />
        <StatCard icon={<Shield className="h-8 w-8 text-accent-yellow" />} title="Action Types" value={actions.length} delay={2} />
        <StatCard icon={<Clock className="h-8 w-8 text-accent-yellow" />} title="Time Range" value={dateRange === 'all' ? 'All' : `${dateRange}d`} delay={3} />
      </div>

      {/* Filters */}
      <Card className="bg-charcoal-black border-2 border-muted-gray">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-bone-white">
            <Filter className="h-5 w-5 text-accent-yellow" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-muted-gray mb-1 block">Admin</label>
              <Select value={adminFilter} onValueChange={(v) => { setAdminFilter(v); setPage(0); }}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray">
                  <SelectValue placeholder="All Admins" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Admins</SelectItem>
                  {admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.full_name || admin.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-gray mb-1 block">Action</label>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatAction(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-gray mb-1 block">Target Type</label>
              <Select value={targetTypeFilter} onValueChange={(v) => { setTargetTypeFilter(v); setPage(0); }}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="submission">Submission</SelectItem>
                  <SelectItem value="application">Application</SelectItem>
                  <SelectItem value="thread">Thread</SelectItem>
                  <SelectItem value="reply">Reply</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-gray mb-1 block">Date Range</label>
              <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(0); }}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 hours</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t border-muted-gray/30">
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-gray hover:text-bone-white">
              Reset Filters
            </Button>
            <p className="text-sm text-muted-gray">
              {totalCount} total entries
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-charcoal-black border-2 border-muted-gray overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-muted-gray/20" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-gray mb-4" />
              <p className="text-muted-gray">No audit log entries found</p>
              <p className="text-sm text-muted-gray/70 mt-1">
                Admin actions will appear here as they occur
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-muted-gray hover:bg-transparent">
                  <TableHead className="text-bone-white">Timestamp</TableHead>
                  <TableHead className="text-bone-white">Admin</TableHead>
                  <TableHead className="text-bone-white">Action</TableHead>
                  <TableHead className="text-bone-white">Target</TableHead>
                  <TableHead className="text-bone-white">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} className="border-muted-gray/50 hover:bg-muted-gray/10">
                    <TableCell className="text-bone-white/80 whitespace-nowrap">
                      {format(new Date(entry.created_at), 'MMM d, yyyy')}
                      <br />
                      <span className="text-xs text-muted-gray">
                        {format(new Date(entry.created_at), 'h:mm:ss a')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.admin ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={entry.admin.avatar_url || ''} />
                            <AvatarFallback className="bg-muted-gray text-bone-white text-xs">
                              {(entry.admin.username || '?')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-bone-white text-sm">
                              {entry.admin.full_name || entry.admin.username}
                            </p>
                            <p className="text-xs text-muted-gray">@{entry.admin.username}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-gray">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getActionColor(entry.action)}`}>
                        {formatAction(entry.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-bone-white/80">
                      {entry.target_type ? (
                        <div>
                          <span className="capitalize">{entry.target_type}</span>
                          {entry.target_id && (
                            <p className="text-xs text-muted-gray font-mono">
                              {entry.target_id.substring(0, 8)}...
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-gray">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-bone-white/70 text-sm max-w-xs truncate">
                      {formatDetails(entry.details)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-gray">
            Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="border-muted-gray"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-gray px-2">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="border-muted-gray"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
