/**
 * Moderation Tab
 * Admin interface for managing content reports, mutes, bans, and warnings
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Ban,
  Check,
  Clock,
  Eye,
  Flag,
  Loader2,
  MessageSquare,
  Search,
  Shield,
  ShieldAlert,
  ShieldOff,
  User,
  VolumeX,
  X
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const reasonColors: Record<string, string> = {
  spam: 'bg-gray-600',
  harassment: 'bg-red-600',
  inappropriate: 'bg-orange-600',
  copyright: 'bg-purple-600',
  other: 'bg-zinc-600',
};

const restrictionTypeColors: Record<string, string> = {
  warning: 'bg-yellow-600',
  mute: 'bg-orange-600',
  read_only: 'bg-blue-600',
  full_block: 'bg-red-600',
  shadow_restrict: 'bg-purple-600',
};

const ModerationTab = () => {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('reports');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Fetch reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['admin-reports', statusFilter],
    queryFn: () => api.listContentReports({ status: statusFilter }),
  });

  // Fetch active mutes
  const { data: mutesData, isLoading: mutesLoading } = useQuery({
    queryKey: ['admin-active-mutes'],
    queryFn: () => api.listActiveMutes(),
  });

  // Fetch forum bans
  const { data: bansData, isLoading: bansLoading } = useQuery({
    queryKey: ['admin-forum-bans'],
    queryFn: () => api.listForumBans(),
  });

  const reports = reportsData?.reports || reportsData || [];
  const mutes = mutesData || [];
  const bans = bansData || [];

  // Resolve report mutation
  const resolveReportMutation = useMutation({
    mutationFn: ({ reportId, notes }: { reportId: string; notes: string }) =>
      api.resolveReport(reportId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      toast.success('Report resolved');
      setResolveDialogOpen(false);
      setSelectedReport(null);
      setResolutionNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resolve report');
    },
  });

  // Dismiss report mutation
  const dismissReportMutation = useMutation({
    mutationFn: (reportId: string) => api.dismissReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      toast.success('Report dismissed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to dismiss report');
    },
  });

  // Remove mute mutation
  const removeMuteMutation = useMutation({
    mutationFn: (userId: string) => api.unmuteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-active-mutes'] });
      toast.success('User unmuted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unmute user');
    },
  });

  // Remove ban mutation
  const removeBanMutation = useMutation({
    mutationFn: (userId: string) => api.removeForumBan(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-forum-bans'] });
      toast.success('Forum ban removed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove ban');
    },
  });

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const pendingReportsCount = reports.filter((r: any) => r.status === 'pending').length;
  const activeMutesCount = mutes.length;
  const activeBansCount = bans.filter((b: any) => b.is_active).length;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-600/20">
              <Flag className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{pendingReportsCount}</div>
              <div className="text-sm text-zinc-400">Pending Reports</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-orange-600/20">
              <VolumeX className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeMutesCount}</div>
              <div className="text-sm text-zinc-400">Active Mutes</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-red-600/20">
              <Ban className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeBansCount}</div>
              <div className="text-sm text-zinc-400">Forum Bans</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="bg-zinc-900 border-zinc-800">
          <TabsTrigger
            value="reports"
            className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
          >
            <Flag className="h-4 w-4 mr-2" />
            Reports Queue
            {pendingReportsCount > 0 && (
              <Badge className="ml-2 bg-yellow-600 text-white">{pendingReportsCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="restrictions"
            className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
          >
            <ShieldAlert className="h-4 w-4 mr-2" />
            Active Restrictions
          </TabsTrigger>
        </TabsList>

        {/* Reports Queue */}
        <TabsContent value="reports" className="mt-4">
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reports Table */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Content</TableHead>
                      <TableHead className="text-zinc-400">Reported By</TableHead>
                      <TableHead className="text-zinc-400">Reason</TableHead>
                      <TableHead className="text-zinc-400">Date</TableHead>
                      <TableHead className="text-zinc-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportsLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-zinc-400">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : reports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-zinc-400">
                          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          No reports to review
                        </TableCell>
                      </TableRow>
                    ) : (
                      reports.map((report: any) => (
                        <TableRow key={report.id} className="border-zinc-800 hover:bg-zinc-800/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize">
                                {report.content_type}
                              </Badge>
                              <span className="text-sm text-zinc-400 truncate max-w-[200px]">
                                {report.content_preview || `ID: ${report.content_id?.slice(0, 8)}...`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={report.reporter?.avatar_url} />
                                <AvatarFallback className="text-xs bg-zinc-700">
                                  {getInitials(report.reporter?.full_name || 'U')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{report.reporter?.username || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${reasonColors[report.reason] || reasonColors.other} capitalize`}>
                              {report.reason}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-zinc-400 text-sm">
                            {report.created_at
                              ? formatDistanceToNow(new Date(report.created_at), { addSuffix: true })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedReport(report);
                                  setResolveDialogOpen(true);
                                }}
                                className="text-green-400 hover:text-green-300"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => dismissReportMutation.mutate(report.id)}
                                disabled={dismissReportMutation.isPending}
                                className="text-zinc-400 hover:text-red-400"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Active Restrictions */}
        <TabsContent value="restrictions" className="mt-4 space-y-6">
          {/* Muted Users */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <VolumeX className="h-5 w-5 text-orange-500" />
                Muted Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mutesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-400" />
                </div>
              ) : mutes.length === 0 ? (
                <div className="text-center py-8 text-zinc-400">
                  No muted users
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">User</TableHead>
                      <TableHead className="text-zinc-400">Reason</TableHead>
                      <TableHead className="text-zinc-400">Expires</TableHead>
                      <TableHead className="text-zinc-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mutes.map((mute: any) => (
                      <TableRow key={mute.id} className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={mute.user?.avatar_url} />
                              <AvatarFallback className="bg-orange-900 text-orange-200">
                                {getInitials(mute.user?.full_name || 'U')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{mute.user?.full_name || 'Unknown'}</div>
                              <div className="text-sm text-zinc-400">@{mute.user?.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {mute.reason || 'No reason provided'}
                        </TableCell>
                        <TableCell>
                          {mute.expires_at ? (
                            <div className="flex items-center gap-2 text-zinc-400">
                              <Clock className="h-4 w-4" />
                              {format(new Date(mute.expires_at), 'MMM d, yyyy')}
                            </div>
                          ) : (
                            <Badge className="bg-red-600">Permanent</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMuteMutation.mutate(mute.user_id)}
                            disabled={removeMuteMutation.isPending}
                            className="text-green-400 hover:text-green-300"
                          >
                            <ShieldOff className="h-4 w-4 mr-1" />
                            Unmute
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Forum Bans */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-500" />
                Forum Bans
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bansLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-400" />
                </div>
              ) : bans.filter((b: any) => b.is_active).length === 0 ? (
                <div className="text-center py-8 text-zinc-400">
                  No active forum bans
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">User</TableHead>
                      <TableHead className="text-zinc-400">Restriction</TableHead>
                      <TableHead className="text-zinc-400">Reason</TableHead>
                      <TableHead className="text-zinc-400">Expires</TableHead>
                      <TableHead className="text-zinc-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bans.filter((b: any) => b.is_active).map((ban: any) => (
                      <TableRow key={ban.id} className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={ban.user?.avatar_url} />
                              <AvatarFallback className="bg-red-900 text-red-200">
                                {getInitials(ban.user?.full_name || 'U')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{ban.user?.full_name || 'Unknown'}</div>
                              <div className="text-sm text-zinc-400">@{ban.user?.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${restrictionTypeColors[ban.restriction_type] || 'bg-zinc-600'} capitalize`}>
                            {ban.restriction_type?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-zinc-400 max-w-[200px] truncate">
                          {ban.reason || 'No reason provided'}
                        </TableCell>
                        <TableCell>
                          {ban.expires_at ? (
                            <div className="flex items-center gap-2 text-zinc-400">
                              <Clock className="h-4 w-4" />
                              {format(new Date(ban.expires_at), 'MMM d, yyyy')}
                            </div>
                          ) : (
                            <Badge className="bg-red-600">Permanent</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBanMutation.mutate(ban.user_id)}
                            disabled={removeBanMutation.isPending}
                            className="text-green-400 hover:text-green-300"
                          >
                            <ShieldOff className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Resolve Report Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Resolve Report</DialogTitle>
            <DialogDescription>
              Add notes about how this report was resolved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Resolution Notes</label>
              <Textarea
                placeholder="Describe the action taken..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedReport && resolveReportMutation.mutate({
                reportId: selectedReport.id,
                notes: resolutionNotes
              })}
              disabled={resolveReportMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {resolveReportMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModerationTab;
