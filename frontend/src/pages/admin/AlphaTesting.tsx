/**
 * Alpha Testing Management
 * Admin interface for managing alpha testers, collecting bug reports, and tracking feedback
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FlaskConical,
  Users,
  Bug,
  Lightbulb,
  MessageSquare,
  Activity,
  Search,
  UserPlus,
  UserMinus,
  MoreVertical,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const PAGE_SIZE = 20;

const statusColors: Record<string, string> = {
  new: 'bg-blue-600',
  reviewing: 'bg-yellow-600',
  in_progress: 'bg-purple-600',
  resolved: 'bg-green-600',
  wont_fix: 'bg-gray-600',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-600',
};

const feedbackTypeIcons: Record<string, React.ReactNode> = {
  bug: <Bug className="h-4 w-4" />,
  feature: <Lightbulb className="h-4 w-4" />,
  ux: <MessageSquare className="h-4 w-4" />,
  performance: <Activity className="h-4 w-4" />,
  general: <MessageSquare className="h-4 w-4" />,
};

const AlphaTesting = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [testersPage, setTestersPage] = useState(1);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [testersSearch, setTestersSearch] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<string>('all');
  const [feedbackType, setFeedbackType] = useState<string>('all');
  const [feedbackPriority, setFeedbackPriority] = useState<string>('all');
  const [addTesterDialog, setAddTesterDialog] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['alpha-stats'],
    queryFn: () => api.getAlphaStats(),
  });

  // Fetch testers
  const { data: testersData, isLoading: testersLoading } = useQuery({
    queryKey: ['alpha-testers', testersPage, testersSearch],
    queryFn: () => api.listAlphaTesters({
      skip: (testersPage - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: testersSearch || undefined,
    }),
  });

  // Fetch feedback
  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ['alpha-feedback', feedbackPage, feedbackStatus, feedbackType, feedbackPriority],
    queryFn: () => api.listAlphaFeedback({
      skip: (feedbackPage - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      status: feedbackStatus === 'all' ? undefined : feedbackStatus,
      feedback_type: feedbackType === 'all' ? undefined : feedbackType,
      priority: feedbackPriority === 'all' ? undefined : feedbackPriority,
    }),
  });

  // Search users to add as testers
  const { data: searchResults } = useQuery({
    queryKey: ['user-search', userSearch],
    queryFn: () => api.listUsersAdmin({ search: userSearch, limit: 10 }),
    enabled: userSearch.length > 2,
  });

  // Toggle tester mutation
  const toggleTesterMutation = useMutation({
    mutationFn: ({ userId, isAlpha, notes }: { userId: string; isAlpha: boolean; notes?: string }) =>
      api.toggleAlphaTester(userId, isAlpha, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alpha-testers'] });
      queryClient.invalidateQueries({ queryKey: ['alpha-stats'] });
      toast.success('Alpha tester updated');
      setAddTesterDialog(false);
      setUserSearch('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update tester');
    },
  });

  // Update feedback mutation
  const updateFeedbackMutation = useMutation({
    mutationFn: ({ feedbackId, data }: { feedbackId: string; data: any }) =>
      api.updateAlphaFeedback(feedbackId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alpha-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['alpha-stats'] });
      toast.success('Feedback updated');
      setSelectedFeedback(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update feedback');
    },
  });

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const testers = testersData?.testers || [];
  const totalTesters = testersData?.total || 0;
  const testerPages = Math.ceil(totalTesters / PAGE_SIZE);

  const feedback = feedbackData?.feedback || [];
  const totalFeedback = feedbackData?.total || 0;
  const feedbackPages = Math.ceil(totalFeedback / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-heading tracking-tighter -rotate-1">
            Alpha <span className="font-spray text-purple-500">Testing</span>
          </h1>
          <p className="text-muted-gray mt-2">
            Manage testers, collect feedback, and track bug reports
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3 flex-wrap">
          <Card className="bg-gray-900 border-muted-gray min-w-[100px]">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-500">{stats?.total_testers || 0}</div>
              <div className="text-xs text-muted-gray">Testers</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-muted-gray min-w-[100px]">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{stats?.feedback_new || 0}</div>
              <div className="text-xs text-muted-gray">New</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-muted-gray min-w-[100px]">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{stats?.bugs_reported || 0}</div>
              <div className="text-xs text-muted-gray">Bugs</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-muted-gray min-w-[100px]">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-500">{stats?.features_requested || 0}</div>
              <div className="text-xs text-muted-gray">Features</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-900">
          <TabsTrigger
            value="overview"
            className="flex items-center gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="testers"
            className="flex items-center gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Testers</span>
          </TabsTrigger>
          <TabsTrigger
            value="bugs"
            className="flex items-center gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            <Bug className="h-4 w-4" />
            <span className="hidden sm:inline">Bug Reports</span>
          </TabsTrigger>
          <TabsTrigger
            value="feedback"
            className="flex items-center gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            <Lightbulb className="h-4 w-4" />
            <span className="hidden sm:inline">Feedback</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feedback Status Breakdown */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                  Feedback Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600" />
                    <span>New</span>
                  </div>
                  <span className="font-bold">{stats?.feedback_new || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-600" />
                    <span>Reviewing</span>
                  </div>
                  <span className="font-bold">{stats?.feedback_reviewing || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-600" />
                    <span>In Progress</span>
                  </div>
                  <span className="font-bold">{stats?.feedback_in_progress || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-600" />
                    <span>Resolved</span>
                  </div>
                  <span className="font-bold">{stats?.feedback_resolved || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Feedback Types */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-purple-500" />
                  Feedback Types
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-red-500" />
                    <span>Bugs</span>
                  </div>
                  <span className="font-bold">{stats?.bugs_reported || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    <span>Feature Requests</span>
                  </div>
                  <span className="font-bold">{stats?.features_requested || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <span>UX Issues</span>
                  </div>
                  <span className="font-bold">{stats?.ux_issues || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Activity */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-500" />
                  Activity (7 days)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Total Testers</span>
                  <span className="font-bold text-purple-500">{stats?.total_testers || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sessions This Week</span>
                  <span className="font-bold">{stats?.sessions_this_week || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Testers Tab */}
        <TabsContent value="testers" className="mt-6 space-y-4">
          {/* Testers Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search testers..."
                value={testersSearch}
                onChange={(e) => { setTestersSearch(e.target.value); setTestersPage(1); }}
                className="pl-10 bg-zinc-800 border-zinc-700"
              />
            </div>
            <Button
              onClick={() => setAddTesterDialog(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Tester
            </Button>
          </div>

          {/* Testers Table */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Tester</TableHead>
                    <TableHead className="text-zinc-400">Added</TableHead>
                    <TableHead className="text-zinc-400">Feedback</TableHead>
                    <TableHead className="text-zinc-400">Last Session</TableHead>
                    <TableHead className="text-zinc-400">Notes</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : testers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                        No alpha testers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    testers.map((tester: any) => (
                      <TableRow key={tester.id} className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={tester.avatar_url} />
                              <AvatarFallback className="bg-purple-900 text-purple-200">
                                {getInitials(tester.full_name || tester.username)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{tester.full_name || 'No name'}</div>
                              <div className="text-sm text-zinc-400">@{tester.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {tester.alpha_tester_since
                            ? formatDistanceToNow(new Date(tester.alpha_tester_since), { addSuffix: true })
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-purple-600">{tester.feedback_count || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {tester.last_session
                            ? formatDistanceToNow(new Date(tester.last_session), { addSuffix: true })
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-zinc-400 max-w-[200px] truncate">
                          {tester.alpha_tester_notes || '—'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700">
                              <DropdownMenuItem onClick={() => window.open(`/profile/${tester.username}`, '_blank')}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleTesterMutation.mutate({ userId: tester.id, isAlpha: false })}
                                className="text-red-400"
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Remove Tester
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {testerPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">
                Showing {((testersPage - 1) * PAGE_SIZE) + 1} - {Math.min(testersPage * PAGE_SIZE, totalTesters)} of {totalTesters}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTestersPage(p => Math.max(1, p - 1))}
                  disabled={testersPage === 1}
                  className="border-zinc-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-zinc-400">Page {testersPage} of {testerPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTestersPage(p => Math.min(testerPages, p + 1))}
                  disabled={testersPage >= testerPages}
                  className="border-zinc-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Bug Reports Tab */}
        <TabsContent value="bugs" className="mt-6 space-y-4">
          <FeedbackList
            feedbackData={feedbackData}
            feedbackLoading={feedbackLoading}
            feedbackPage={feedbackPage}
            setFeedbackPage={setFeedbackPage}
            feedbackStatus={feedbackStatus}
            setFeedbackStatus={setFeedbackStatus}
            feedbackType="bug"
            setFeedbackType={() => {}}
            feedbackPriority={feedbackPriority}
            setFeedbackPriority={setFeedbackPriority}
            onSelectFeedback={setSelectedFeedback}
            showTypeFilter={false}
            filterByType="bug"
          />
        </TabsContent>

        {/* Feedback Tab (Features & Recommendations) */}
        <TabsContent value="feedback" className="mt-6 space-y-4">
          <FeedbackList
            feedbackData={feedbackData}
            feedbackLoading={feedbackLoading}
            feedbackPage={feedbackPage}
            setFeedbackPage={setFeedbackPage}
            feedbackStatus={feedbackStatus}
            setFeedbackStatus={setFeedbackStatus}
            feedbackType={feedbackType}
            setFeedbackType={setFeedbackType}
            feedbackPriority={feedbackPriority}
            setFeedbackPriority={setFeedbackPriority}
            onSelectFeedback={setSelectedFeedback}
            showTypeFilter={true}
            excludeType="bug"
          />
        </TabsContent>
      </Tabs>

      {/* Add Tester Dialog */}
      <Dialog open={addTesterDialog} onOpenChange={setAddTesterDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Add Alpha Tester</DialogTitle>
            <DialogDescription>
              Search for a user to add as an alpha tester
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search users by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-10 bg-zinc-800 border-zinc-700"
              />
            </div>
            {searchResults?.users && searchResults.users.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {searchResults.users.filter((u: any) => !u.is_alpha_tester).map((user: any) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
                    onClick={() => toggleTesterMutation.mutate({ userId: user.id, isAlpha: true })}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="bg-purple-900 text-purple-200 text-xs">
                          {getInitials(user.full_name || user.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{user.full_name || user.username}</div>
                        <div className="text-xs text-zinc-400">{user.email}</div>
                      </div>
                    </div>
                    <UserPlus className="h-4 w-4 text-purple-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Detail Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedFeedback?.feedback_type && feedbackTypeIcons[selectedFeedback.feedback_type]}
              {selectedFeedback?.title}
            </DialogTitle>
            <DialogDescription>
              Submitted by {selectedFeedback?.user?.full_name || selectedFeedback?.user?.username}
              {' '}
              {selectedFeedback?.created_at && formatDistanceToNow(new Date(selectedFeedback.created_at), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge className={statusColors[selectedFeedback?.status] || 'bg-gray-600'}>
                {selectedFeedback?.status}
              </Badge>
              <Badge className={priorityColors[selectedFeedback?.priority] || 'bg-gray-500'}>
                {selectedFeedback?.priority}
              </Badge>
              <Badge variant="outline">{selectedFeedback?.feedback_type}</Badge>
            </div>

            <div className="p-4 rounded-lg bg-zinc-800">
              <p className="text-sm whitespace-pre-wrap">{selectedFeedback?.description || 'No description provided'}</p>
            </div>

            {selectedFeedback?.page_url && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <ExternalLink className="h-4 w-4" />
                <a href={selectedFeedback.page_url} target="_blank" rel="noopener noreferrer" className="hover:text-purple-400">
                  {selectedFeedback.page_url}
                </a>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Update Status</label>
              <Select
                value={selectedFeedback?.status}
                onValueChange={(value) => {
                  updateFeedbackMutation.mutate({
                    feedbackId: selectedFeedback.id,
                    data: { status: value }
                  });
                }}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Update Priority</label>
              <Select
                value={selectedFeedback?.priority}
                onValueChange={(value) => {
                  updateFeedbackMutation.mutate({
                    feedbackId: selectedFeedback.id,
                    data: { priority: value }
                  });
                }}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Notes</label>
              <Textarea
                value={adminNotes || selectedFeedback?.admin_notes || ''}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal notes about this feedback..."
                className="bg-zinc-800 border-zinc-700"
              />
              <Button
                size="sm"
                onClick={() => {
                  updateFeedbackMutation.mutate({
                    feedbackId: selectedFeedback.id,
                    data: { admin_notes: adminNotes }
                  });
                }}
                disabled={updateFeedbackMutation.isPending}
              >
                Save Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Feedback List Component
const FeedbackList = ({
  feedbackData,
  feedbackLoading,
  feedbackPage,
  setFeedbackPage,
  feedbackStatus,
  setFeedbackStatus,
  feedbackType,
  setFeedbackType,
  feedbackPriority,
  setFeedbackPriority,
  onSelectFeedback,
  showTypeFilter,
  filterByType,
  excludeType,
}: {
  feedbackData: any;
  feedbackLoading: boolean;
  feedbackPage: number;
  setFeedbackPage: (page: number) => void;
  feedbackStatus: string;
  setFeedbackStatus: (status: string) => void;
  feedbackType: string;
  setFeedbackType: (type: string) => void;
  feedbackPriority: string;
  setFeedbackPriority: (priority: string) => void;
  onSelectFeedback: (feedback: any) => void;
  showTypeFilter: boolean;
  filterByType?: string;
  excludeType?: string;
}) => {
  let feedback = feedbackData?.feedback || [];

  // Client-side filtering for type
  if (filterByType) {
    feedback = feedback.filter((f: any) => f.feedback_type === filterByType);
  }
  if (excludeType) {
    feedback = feedback.filter((f: any) => f.feedback_type !== excludeType);
  }

  const totalFeedback = feedback.length;
  const feedbackPages = Math.ceil((feedbackData?.total || 0) / PAGE_SIZE);

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={feedbackStatus} onValueChange={setFeedbackStatus}>
          <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="wont_fix">Won't Fix</SelectItem>
          </SelectContent>
        </Select>

        {showTypeFilter && (
          <Select value={feedbackType} onValueChange={setFeedbackType}>
            <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="feature">Feature Request</SelectItem>
              <SelectItem value="ux">UX Issue</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={feedbackPriority} onValueChange={setFeedbackPriority}>
          <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Feedback Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Title</TableHead>
                <TableHead className="text-zinc-400">Type</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400">Priority</TableHead>
                <TableHead className="text-zinc-400">Submitted By</TableHead>
                <TableHead className="text-zinc-400">Date</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedbackLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-zinc-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : feedback.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-zinc-400">
                    No feedback found
                  </TableCell>
                </TableRow>
              ) : (
                feedback.map((item: any) => (
                  <TableRow
                    key={item.id}
                    className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                    onClick={() => onSelectFeedback(item)}
                  >
                    <TableCell className="font-medium max-w-[250px] truncate">
                      {item.title}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {feedbackTypeIcons[item.feedback_type]}
                        <span className="capitalize">{item.feedback_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[item.status] || 'bg-gray-600'}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityColors[item.priority] || 'bg-gray-500'}>
                        {item.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={item.user?.avatar_url} />
                          <AvatarFallback className="bg-purple-900 text-purple-200 text-xs">
                            {(item.user?.full_name || item.user?.username || '?').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{item.user?.username || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Eye className="h-4 w-4 text-zinc-400" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {feedbackPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">
            Page {feedbackPage} of {feedbackPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFeedbackPage(Math.max(1, feedbackPage - 1))}
              disabled={feedbackPage === 1}
              className="border-zinc-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFeedbackPage(Math.min(feedbackPages, feedbackPage + 1))}
              disabled={feedbackPage >= feedbackPages}
              className="border-zinc-700"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default AlphaTesting;
