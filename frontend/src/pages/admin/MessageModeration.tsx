/**
 * MessageModeration - Admin page for managing message reports and blocks
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Flag,
  Ban,
  User,
  Eye,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Unlock,
  BarChart3,
} from 'lucide-react';
import {
  useAdminMessageReports,
  useAdminReportStats,
  useAdminBlocks,
  useAdminBlockStats,
  useAdminForceUnblock,
  MessageReportDetail,
  BlockRecord,
} from '@/hooks/useMessageSettings';
import { MessageReportDetailDialog } from '@/components/admin/MessageReportDetailDialog';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export default function MessageModeration() {
  const [activeTab, setActiveTab] = useState<'reports' | 'blocks'>('reports');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<MessageReportDetail | null>(null);

  const { data: reports, isLoading: reportsLoading } = useAdminMessageReports({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    reason: reasonFilter !== 'all' ? reasonFilter : undefined,
    limit: 100,
  });

  const { data: reportStats } = useAdminReportStats();
  const { data: blocks, isLoading: blocksLoading } = useAdminBlocks({ limit: 100 });
  const { data: blockStats } = useAdminBlockStats();
  const forceUnblock = useAdminForceUnblock();
  const { toast } = useToast();

  const handleForceUnblock = async (block: BlockRecord) => {
    if (!confirm(`Are you sure you want to remove this block? ${block.blocker_name} will be able to message ${block.blocked_user_name} again.`)) {
      return;
    }

    try {
      await forceUnblock.mutateAsync(block.id);
      toast({
        title: 'Block removed',
        description: 'The block has been removed by admin.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to remove block',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'reviewing':
        return <Badge variant="outline" className="text-blue-500 border-blue-500"><Eye className="h-3 w-3 mr-1" />Reviewing</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>;
      case 'dismissed':
        return <Badge variant="outline" className="text-gray-500 border-gray-500"><XCircle className="h-3 w-3 mr-1" />Dismissed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case 'spam':
        return <Badge className="bg-orange-600">Spam</Badge>;
      case 'harassment':
        return <Badge className="bg-red-600">Harassment</Badge>;
      case 'inappropriate':
        return <Badge className="bg-purple-600">Inappropriate</Badge>;
      case 'other':
        return <Badge className="bg-gray-600">Other</Badge>;
      default:
        return <Badge>{reason}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-bone-white">Message Moderation</h1>
          <p className="text-muted-foreground">Review reports and manage user blocks</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'reports' | 'blocks')}>
        <TabsList className="bg-muted-gray/20 mb-6">
          <TabsTrigger value="reports" className="data-[state=active]:bg-accent-yellow/20">
            <Flag className="h-4 w-4 mr-2" />
            Reports
            {reportStats?.pending_reports ? (
              <Badge className="ml-2 bg-red-600">{reportStats.pending_reports}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="blocks" className="data-[state=active]:bg-accent-yellow/20">
            <Ban className="h-4 w-4 mr-2" />
            User Blocks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          {/* Stats cards */}
          {reportStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm">Total Reports</span>
                </div>
                <p className="text-2xl font-bold">{reportStats.total_reports}</p>
              </div>
              <div className="p-4 rounded-lg bg-yellow-900/20 border border-yellow-700/30">
                <div className="flex items-center gap-2 text-yellow-400 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Pending</span>
                </div>
                <p className="text-2xl font-bold text-yellow-400">{reportStats.pending_reports}</p>
              </div>
              <div className="p-4 rounded-lg bg-green-900/20 border border-green-700/30">
                <div className="flex items-center gap-2 text-green-400 mb-1">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Resolved</span>
                </div>
                <p className="text-2xl font-bold text-green-400">{reportStats.resolved_reports}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">Dismissed</span>
                </div>
                <p className="text-2xl font-bold">{reportStats.dismissed_reports}</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-muted-gray/20 border-muted-gray">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-[180px] bg-muted-gray/20 border-muted-gray">
                <SelectValue placeholder="Reason" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray">
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="harassment">Harassment</SelectItem>
                <SelectItem value="inappropriate">Inappropriate</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reports table */}
          <div className="rounded-lg border border-muted-gray/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted-gray/10 hover:bg-muted-gray/10">
                  <TableHead>Reporter</TableHead>
                  <TableHead>Reported User</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Message Preview</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportsLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : reports?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No reports found
                    </TableCell>
                  </TableRow>
                ) : (
                  reports?.map((report) => (
                    <TableRow key={report.id} className="hover:bg-muted-gray/10">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={report.reporter_avatar} />
                            <AvatarFallback>{report.reporter_name?.[0] || <User className="h-3 w-3" />}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{report.reporter_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={report.message_sender_avatar} />
                            <AvatarFallback>{report.message_sender_name?.[0] || <User className="h-3 w-3" />}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{report.message_sender_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getReasonBadge(report.reason)}</TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">
                          {report.message_content || '[No content]'}
                        </p>
                      </TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReport(report)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="blocks">
          {/* Block stats */}
          {blockStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Ban className="h-4 w-4" />
                  <span className="text-sm">Total Blocks</span>
                </div>
                <p className="text-2xl font-bold">{blockStats.total_blocks}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Today</span>
                </div>
                <p className="text-2xl font-bold">{blockStats.blocks_today}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm">This Week</span>
                </div>
                <p className="text-2xl font-bold">{blockStats.blocks_this_week}</p>
              </div>
              <div className="p-4 rounded-lg bg-red-900/20 border border-red-700/30 col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 text-red-400 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Most Blocked</span>
                </div>
                {blockStats.most_blocked_users?.[0] ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={blockStats.most_blocked_users[0].avatar_url} />
                      <AvatarFallback>{blockStats.most_blocked_users[0].name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{blockStats.most_blocked_users[0].name || 'Unknown'}</span>
                    <Badge className="bg-red-600">{blockStats.most_blocked_users[0].block_count}</Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data</p>
                )}
              </div>
            </div>
          )}

          {/* Blocks table */}
          <div className="rounded-lg border border-muted-gray/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted-gray/10 hover:bg-muted-gray/10">
                  <TableHead>Blocker</TableHead>
                  <TableHead>Blocked User</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Admin Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocksLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : blocks?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No blocks found
                    </TableCell>
                  </TableRow>
                ) : (
                  blocks?.map((block) => (
                    <TableRow key={block.id} className="hover:bg-muted-gray/10">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={block.blocker_avatar} />
                            <AvatarFallback>{block.blocker_name?.[0] || <User className="h-3 w-3" />}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{block.blocker_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={block.blocked_user_avatar} />
                            <AvatarFallback>{block.blocked_user_name?.[0] || <User className="h-3 w-3" />}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{block.blocked_user_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">
                          {block.reason || 'No reason provided'}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(block.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleForceUnblock(block)}
                          disabled={forceUnblock.isPending}
                          className="text-red-400 hover:text-red-400"
                        >
                          {forceUnblock.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Unlock className="h-4 w-4 mr-1" />
                              Unblock
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Report detail dialog */}
      {selectedReport && (
        <MessageReportDetailDialog
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          report={selectedReport}
        />
      )}
    </div>
  );
}
