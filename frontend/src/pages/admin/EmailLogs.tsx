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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Mail,
  Send,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  MousePointer,
  Search,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface EmailLog {
  id: string;
  message_id: string;
  recipient_email: string;
  sender_email: string;
  subject: string | null;
  email_type: string | null;
  status: string;
  source_service: string | null;
  source_action: string | null;
  sent_at: string | null;
  created_at: string;
}

interface EmailLogDetail {
  id: string;
  message_id: string;
  sender_email: string;
  sender_name: string | null;
  recipient_email: string;
  subject: string | null;
  email_type: string | null;
  status: string;
  bounce_type: string | null;
  bounce_subtype: string | null;
  bounce_diagnostic: string | null;
  complaint_feedback_type: string | null;
  complaint_sub_type: string | null;
  open_count: number;
  click_count: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  first_clicked_at: string | null;
  last_clicked_at: string | null;
  clicked_links: Array<{ link: string; timestamp: string }>;
  user_agent: string | null;
  ip_address: string | null;
  source_service: string | null;
  source_action: string | null;
  source_user_id: string | null;
  source_reference_id: string | null;
  ses_configuration_set: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EmailStats {
  total_sent: number;
  total_delivered: number;
  total_bounced: number;
  total_complained: number;
  total_opened: number;
  total_clicked: number;
  delivery_rate: number;
  bounce_rate: number;
  open_rate: number;
  click_rate: number;
}

const STATUS_BADGES: Record<string, { color: string; icon: React.ReactNode }> = {
  sent: { color: 'bg-blue-500', icon: <Send className="h-3 w-3" /> },
  queued: { color: 'bg-gray-500', icon: <Mail className="h-3 w-3" /> },
  delivered: { color: 'bg-emerald-600', icon: <CheckCircle className="h-3 w-3" /> },
  bounced: { color: 'bg-primary-red', icon: <XCircle className="h-3 w-3" /> },
  complained: { color: 'bg-orange-500', icon: <AlertTriangle className="h-3 w-3" /> },
  rejected: { color: 'bg-red-700', icon: <XCircle className="h-3 w-3" /> },
  opened: { color: 'bg-purple-500', icon: <Eye className="h-3 w-3" /> },
  clicked: { color: 'bg-accent-yellow text-charcoal-black', icon: <MousePointer className="h-3 w-3" /> },
  rendering_failure: { color: 'bg-red-900', icon: <AlertTriangle className="h-3 w-3" /> },
};

const StatCard = ({ icon, title, value, subValue, isGood, delay }: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subValue?: string;
  isGood?: boolean;
  delay: number;
}) => (
  <motion.div
    className="bg-charcoal-black border-2 border-muted-gray p-4 text-center transform hover:scale-105 transition-transform"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1 }}
  >
    <div className="flex justify-center mb-2">{icon}</div>
    <h3 className="text-2xl font-heading text-accent-yellow">{value}</h3>
    <p className="text-muted-gray text-xs uppercase tracking-wide">{title}</p>
    {subValue && (
      <p className={`text-xs mt-1 flex items-center justify-center gap-1 ${isGood ? 'text-emerald-500' : 'text-primary-red'}`}>
        {isGood ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {subValue}
      </p>
    )}
  </motion.div>
);

const EmailLogs = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('30');
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const pageSize = 25;

  const getDateFilters = () => {
    if (dateRange === 'all') return { start_date: undefined, end_date: undefined };
    const days = parseInt(dateRange);
    const startDate = subDays(new Date(), days).toISOString();
    return { start_date: startDate, end_date: undefined };
  };

  const dateFilters = getDateFilters();

  // Fetch email stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin', 'email-stats', dateRange],
    queryFn: async () => {
      const response = await api.get<EmailStats>(`/admin/emails/stats?days=${dateRange === 'all' ? 365 : dateRange}`);
      return response;
    },
  });

  // Fetch email logs
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['admin', 'email-logs', page, statusFilter, typeFilter, sourceFilter, searchQuery, dateFilters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });

      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('email_type', typeFilter);
      if (sourceFilter !== 'all') params.set('source_service', sourceFilter);
      if (searchQuery) params.set('search', searchQuery);
      if (dateFilters.start_date) params.set('start_date', dateFilters.start_date);

      const response = await api.get<{
        logs: EmailLog[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      }>(`/admin/emails/logs?${params.toString()}`);
      return response;
    },
  });

  // Fetch email log detail
  const { data: logDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin', 'email-log-detail', selectedLog],
    queryFn: async () => {
      if (!selectedLog) return null;
      const response = await api.get<EmailLogDetail>(`/admin/emails/logs/${selectedLog}`);
      return response;
    },
    enabled: !!selectedLog,
  });

  // Fetch email types for filter
  const { data: emailTypes } = useQuery({
    queryKey: ['admin', 'email-types'],
    queryFn: async () => {
      const response = await api.get<{ types: string[] }>('/admin/emails/types');
      return response.types || [];
    },
  });

  // Fetch sources for filter
  const { data: emailSources } = useQuery({
    queryKey: ['admin', 'email-sources'],
    queryFn: async () => {
      const response = await api.get<{ sources: string[] }>('/admin/emails/sources');
      return response.sources || [];
    },
  });

  const handleRefresh = () => {
    refetchStats();
    refetchLogs();
    toast.success('Email logs refreshed');
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('email_type', typeFilter);
      if (sourceFilter !== 'all') params.set('source_service', sourceFilter);
      if (dateFilters.start_date) params.set('start_date', dateFilters.start_date);

      const response = await fetch(`/api/v1/admin/emails/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email_logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Email logs exported successfully');
    } catch (error) {
      toast.error('Failed to export email logs');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_BADGES[status] || STATUS_BADGES.sent;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading text-accent-yellow">Email Logs</h1>
          <p className="text-muted-gray">Track all emails sent through AWS SES</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            icon={<Send className="h-6 w-6 text-blue-500" />}
            title="Total Sent"
            value={stats.total_sent.toLocaleString()}
            delay={0}
          />
          <StatCard
            icon={<CheckCircle className="h-6 w-6 text-emerald-500" />}
            title="Delivered"
            value={stats.total_delivered.toLocaleString()}
            subValue={`${stats.delivery_rate}%`}
            isGood={stats.delivery_rate >= 95}
            delay={1}
          />
          <StatCard
            icon={<XCircle className="h-6 w-6 text-primary-red" />}
            title="Bounced"
            value={stats.total_bounced.toLocaleString()}
            subValue={`${stats.bounce_rate}%`}
            isGood={stats.bounce_rate < 5}
            delay={2}
          />
          <StatCard
            icon={<Eye className="h-6 w-6 text-purple-500" />}
            title="Opened"
            value={stats.total_opened.toLocaleString()}
            subValue={`${stats.open_rate}%`}
            isGood={stats.open_rate >= 20}
            delay={3}
          />
          <StatCard
            icon={<MousePointer className="h-6 w-6 text-accent-yellow" />}
            title="Clicked"
            value={stats.total_clicked.toLocaleString()}
            subValue={`${stats.click_rate}%`}
            isGood={stats.click_rate >= 2}
            delay={4}
          />
        </div>
      )}

      {/* Filters */}
      <Card className="bg-gray-900 border-muted-gray">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-gray" />
              <Input
                placeholder="Search recipient or subject..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10 bg-charcoal-black border-muted-gray"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="complained">Complained</SelectItem>
                <SelectItem value="opened">Opened</SelectItem>
                <SelectItem value="clicked">Clicked</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray">
                <SelectItem value="all">All Types</SelectItem>
                {emailTypes?.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray">
                <SelectItem value="all">All Sources</SelectItem>
                {emailSources?.map((source) => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(1); }}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray">
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Email Logs Table */}
      <Card className="bg-gray-900 border-muted-gray">
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-muted-gray hover:bg-transparent">
                      <TableHead className="text-muted-gray">Recipient</TableHead>
                      <TableHead className="text-muted-gray">Subject</TableHead>
                      <TableHead className="text-muted-gray">Type</TableHead>
                      <TableHead className="text-muted-gray">Status</TableHead>
                      <TableHead className="text-muted-gray">Source</TableHead>
                      <TableHead className="text-muted-gray">Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsData?.logs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-gray py-8">
                          No email logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      logsData?.logs?.map((log) => (
                        <TableRow
                          key={log.id}
                          className="border-muted-gray/50 hover:bg-muted-gray/10 cursor-pointer"
                          onClick={() => setSelectedLog(log.id)}
                        >
                          <TableCell className="font-mono text-sm">{log.recipient_email}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {log.subject || <span className="text-muted-gray italic">No subject</span>}
                          </TableCell>
                          <TableCell>
                            {log.email_type ? (
                              <Badge variant="outline" className="border-muted-gray">
                                {log.email_type}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="text-muted-gray text-sm">
                            {log.source_service || '-'}
                            {log.source_action && <span className="text-xs block">{log.source_action}</span>}
                          </TableCell>
                          <TableCell className="text-muted-gray text-sm whitespace-nowrap">
                            {formatDate(log.sent_at || log.created_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {logsData && logsData.total_pages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-muted-gray/50">
                  <p className="text-sm text-muted-gray">
                    Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, logsData.total)} of {logsData.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm text-muted-gray">
                      Page {page} of {logsData.total_pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(logsData.total_pages, p + 1))}
                      disabled={page === logsData.total_pages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="bg-gray-900 border-muted-gray max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-accent-yellow">Email Details</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : logDetail && (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-4">
                {getStatusBadge(logDetail.status)}
                {logDetail.open_count > 0 && (
                  <Badge variant="outline" className="border-purple-500 text-purple-400">
                    <Eye className="h-3 w-3 mr-1" />
                    Opened {logDetail.open_count}x
                  </Badge>
                )}
                {logDetail.click_count > 0 && (
                  <Badge variant="outline" className="border-accent-yellow text-accent-yellow">
                    <MousePointer className="h-3 w-3 mr-1" />
                    Clicked {logDetail.click_count}x
                  </Badge>
                )}
              </div>

              {/* Email Info */}
              <div className="grid gap-4">
                <div>
                  <label className="text-xs text-muted-gray uppercase">To</label>
                  <p className="font-mono">{logDetail.recipient_email}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-gray uppercase">From</label>
                  <p>{logDetail.sender_name} &lt;{logDetail.sender_email}&gt;</p>
                </div>
                <div>
                  <label className="text-xs text-muted-gray uppercase">Subject</label>
                  <p>{logDetail.subject || <span className="italic text-muted-gray">No subject</span>}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-gray uppercase">Type</label>
                    <p>{logDetail.email_type || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-gray uppercase">Source</label>
                    <p>{logDetail.source_service || '-'} / {logDetail.source_action || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <label className="text-xs text-muted-gray uppercase mb-2 block">Timeline</label>
                <div className="space-y-2 text-sm">
                  {logDetail.sent_at && (
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-blue-500" />
                      <span>Sent: {formatDate(logDetail.sent_at)}</span>
                    </div>
                  )}
                  {logDetail.delivered_at && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span>Delivered: {formatDate(logDetail.delivered_at)}</span>
                    </div>
                  )}
                  {logDetail.first_opened_at && (
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-purple-500" />
                      <span>First Opened: {formatDate(logDetail.first_opened_at)}</span>
                    </div>
                  )}
                  {logDetail.first_clicked_at && (
                    <div className="flex items-center gap-2">
                      <MousePointer className="h-4 w-4 text-accent-yellow" />
                      <span>First Clicked: {formatDate(logDetail.first_clicked_at)}</span>
                    </div>
                  )}
                  {logDetail.bounced_at && (
                    <div className="flex items-center gap-2 text-primary-red">
                      <XCircle className="h-4 w-4" />
                      <span>Bounced: {formatDate(logDetail.bounced_at)}</span>
                    </div>
                  )}
                  {logDetail.complained_at && (
                    <div className="flex items-center gap-2 text-orange-500">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Complained: {formatDate(logDetail.complained_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bounce Info */}
              {logDetail.bounce_type && (
                <div className="bg-red-900/20 border border-primary-red/50 rounded-lg p-4">
                  <label className="text-xs text-primary-red uppercase mb-2 block">Bounce Details</label>
                  <p><strong>Type:</strong> {logDetail.bounce_type} - {logDetail.bounce_subtype}</p>
                  {logDetail.bounce_diagnostic && (
                    <p className="text-sm text-muted-gray mt-2">{logDetail.bounce_diagnostic}</p>
                  )}
                </div>
              )}

              {/* Complaint Info */}
              {logDetail.complaint_feedback_type && (
                <div className="bg-orange-900/20 border border-orange-500/50 rounded-lg p-4">
                  <label className="text-xs text-orange-500 uppercase mb-2 block">Complaint Details</label>
                  <p><strong>Type:</strong> {logDetail.complaint_feedback_type}</p>
                  {logDetail.complaint_sub_type && (
                    <p className="text-sm text-muted-gray">{logDetail.complaint_sub_type}</p>
                  )}
                </div>
              )}

              {/* Clicked Links */}
              {logDetail.clicked_links && logDetail.clicked_links.length > 0 && (
                <div>
                  <label className="text-xs text-muted-gray uppercase mb-2 block">Clicked Links</label>
                  <div className="space-y-1 text-sm">
                    {logDetail.clicked_links.map((click, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <MousePointer className="h-3 w-3 text-accent-yellow" />
                        <a href={click.link} target="_blank" rel="noopener noreferrer" className="text-accent-yellow hover:underline truncate">
                          {click.link}
                        </a>
                        <span className="text-muted-gray text-xs">{formatDate(click.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Details */}
              <div className="text-xs text-muted-gray border-t border-muted-gray/50 pt-4">
                <p>Message ID: {logDetail.message_id}</p>
                {logDetail.user_agent && <p className="truncate">User Agent: {logDetail.user_agent}</p>}
                {logDetail.ip_address && <p>IP Address: {logDetail.ip_address}</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailLogs;
