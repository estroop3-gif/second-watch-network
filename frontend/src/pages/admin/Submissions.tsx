import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { Submission } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MoreHorizontal, Search, CheckCircle, XCircle, FileText, Archive, Clock, Eye, ThumbsUp, MessageSquare, Clapperboard } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SubmissionDetailsModal from '@/components/admin/SubmissionDetailsModal';
import { SubmissionNotesModal } from '@/components/admin/SubmissionNotesModal';
import { SubmissionStatsHeader } from '@/components/admin/SubmissionStatsHeader';
import { SubmissionBulkActionsBar } from '@/components/admin/SubmissionBulkActionsBar';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 15;
const CONTENT_STATUSES = ['all', 'pending', 'in review', 'considered', 'approved', 'rejected', 'archived'];
const GREENROOM_STATUSES = ['all', 'pending', 'approved', 'shortlisted', 'rejected', 'flagged'];

const statusColorClasses: Record<string, string> = {
  pending: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
  'in review': 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  considered: 'bg-purple-400/20 text-purple-300 border-purple-400/30',
  approved: 'bg-green-400/20 text-green-300 border-green-400/30',
  rejected: 'bg-red-400/20 text-red-300 border-red-400/30',
  archived: 'bg-gray-400/20 text-gray-500 border-gray-400/30',
  shortlisted: 'bg-cyan-400/20 text-cyan-300 border-cyan-400/30',
  flagged: 'bg-orange-400/20 text-orange-300 border-orange-400/30',
};

const SubmissionManagement = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const status = searchParams.get('status') || 'pending';
  const source = (searchParams.get('source') || 'content') as 'content' | 'greenroom';

  // Content Submissions Query
  const { data: contentData, isLoading: contentLoading, error: contentError } = useQuery({
    queryKey: ['adminSubmissions', { page, status, searchTerm }],
    queryFn: () => api.listSubmissionsAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      status,
      search: searchTerm || undefined,
    }),
    enabled: source === 'content',
  });

  // Green Room Query
  const { data: greenRoomData, isLoading: greenRoomLoading, error: greenRoomError } = useQuery({
    queryKey: ['adminGreenRoom', { page, status, searchTerm }],
    queryFn: () => api.listGreenRoomAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      status,
      search: searchTerm || undefined,
    }),
    enabled: source === 'greenroom',
  });

  const data = source === 'content' ? contentData : greenRoomData;
  const isLoading = source === 'content' ? contentLoading : greenRoomLoading;
  const error = source === 'content' ? contentError : greenRoomError;
  const submissions = source === 'content'
    ? (contentData?.submissions || [])
    : (greenRoomData?.projects || []);
  const totalCount = source === 'content'
    ? (contentData?.count || 0)
    : (greenRoomData?.total || 0);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ submissionId, status: newStatus }: { submissionId: string; status: string }) => {
      await api.updateSubmissionStatus(submissionId, newStatus);
    },
    onSuccess: () => {
      toast.success('Submission status updated.');
      queryClient.invalidateQueries({ queryKey: ['adminSubmissions'] });
      queryClient.invalidateQueries({ queryKey: ['adminGreenRoom'] });
      queryClient.invalidateQueries({ queryKey: ['admin-submission-stats'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardStats'] });
    },
    onError: (err: any) => toast.error(`Failed to update status: ${err.message}`),
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      await api.markSubmissionRead(submissionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSubmissions'] });
    },
    onError: (err: any) => {
      console.error('Failed to mark as read:', err.message);
    },
  });

  const handleSourceChange = (newSource: string) => {
    setSearchParams({ source: newSource, status: 'pending', page: '1' });
    setSelectedIds([]);
  };

  const handleStatusChange = (newStatus: string) => {
    setSearchParams({ source, status: newStatus, page: '1' });
    setSelectedIds([]);
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams({ source, status, page: newPage.toString() });
  };

  const handleViewDetails = (submission: any) => {
    setSelectedSubmission(submission);
    setModalOpen(true);
    if (submission.has_unread_admin_messages) {
      markAsReadMutation.mutate(submission.id);
    }
  };

  const handleNotes = (submission: any) => {
    setSelectedSubmission(submission);
    setNotesModalOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(submissions.map((s: any) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const statuses = source === 'content' ? CONTENT_STATUSES : GREENROOM_STATUSES;
  const allSelected = submissions.length > 0 && selectedIds.length === submissions.length;

  return (
    <div className="space-y-6">
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter -rotate-1">
        Submission <span className="font-spray text-accent-yellow">Management</span>
      </h1>

      {/* Stats Header */}
      <SubmissionStatsHeader />

      {/* Source Tabs */}
      <div className="flex items-center gap-4">
        <Tabs value={source} onValueChange={handleSourceChange}>
          <TabsList className="bg-charcoal-black border border-muted-gray">
            <TabsTrigger value="content" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <FileText className="h-4 w-4 mr-2" />
              Content Submissions
            </TabsTrigger>
            <TabsTrigger value="greenroom" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <Clapperboard className="h-4 w-4 mr-2" />
              Green Room
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search and Status Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-gray" />
          <Input
            placeholder={source === 'content' ? "Search by title or submitter..." : "Search by title..."}
            className="pl-10 bg-charcoal-black border-muted-gray text-bone-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Tabs value={status} onValueChange={handleStatusChange}>
          <TabsList className="bg-charcoal-black border border-muted-gray">
            {statuses.map(s => (
              <TabsTrigger key={s} value={s} className="capitalize text-xs data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
                {s}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Data Table */}
      <div className="border-2 border-muted-gray p-2 bg-charcoal-black/50">
        <Table>
          <TableHeader>
            <TableRow className="border-b-muted-gray hover:bg-charcoal-black/20">
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  className="border-muted-gray data-[state=checked]:bg-accent-yellow data-[state=checked]:border-accent-yellow"
                />
              </TableHead>
              <TableHead>{source === 'content' ? 'Project Title' : 'Title'}</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center h-48">Loading submissions...</TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={6} className="text-center h-48 text-primary-red">Error: {(error as Error).message}</TableCell></TableRow>
            ) : submissions.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center h-48 text-muted-gray">No submissions found</TableCell></TableRow>
            ) : submissions.map((submission: any) => {
              const title = source === 'content' ? submission.project_title : submission.title;
              const submitter = source === 'content'
                ? (submission.profiles?.full_name || submission.profiles?.username || 'N/A')
                : (submission.filmmaker?.full_name || submission.filmmaker?.username || 'N/A');
              const hasNotes = submission.admin_notes;
              const hasUnread = source === 'content' && submission.has_unread_admin_messages;

              return (
                <TableRow
                  key={submission.id}
                  className={cn(
                    "border-b-muted-gray hover:bg-charcoal-black/20 cursor-pointer",
                    hasUnread && "bg-accent-yellow/5",
                    selectedIds.includes(submission.id) && "bg-accent-yellow/10"
                  )}
                  onClick={() => handleViewDetails(submission)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(submission.id)}
                      onCheckedChange={(checked) => handleSelectOne(submission.id, !!checked)}
                      className="border-muted-gray data-[state=checked]:bg-accent-yellow data-[state=checked]:border-accent-yellow"
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {hasUnread && <div className="h-2 w-2 rounded-full bg-accent-yellow" title="Unread messages"></div>}
                      <span>{title}</span>
                      {hasNotes && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNotes(submission);
                          }}
                          className="text-muted-gray hover:text-accent-yellow"
                          title="View Notes"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{submitter}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("capitalize", statusColorClasses[submission.status] || statusColorClasses.pending)}>
                      {submission.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(submission.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray text-bone-white">
                        <DropdownMenuItem onSelect={() => handleViewDetails(submission)}>
                          <MessageSquare className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        {source === 'content' && (
                          <DropdownMenuItem onSelect={() => handleNotes(submission)}>
                            <FileText className="mr-2 h-4 w-4" /> Add/Edit Notes
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent className="bg-charcoal-black border-muted-gray text-bone-white">
                              {source === 'content' ? (
                                <>
                                  <DropdownMenuItem onSelect={() => updateStatusMutation.mutate({ submissionId: submission.id, status: 'pending' })}>
                                    <Clock className="mr-2 h-4 w-4" /> Pending
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => updateStatusMutation.mutate({ submissionId: submission.id, status: 'in review' })}>
                                    <Eye className="mr-2 h-4 w-4" /> In Review
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => updateStatusMutation.mutate({ submissionId: submission.id, status: 'considered' })}>
                                    <ThumbsUp className="mr-2 h-4 w-4" /> Considered
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => updateStatusMutation.mutate({ submissionId: submission.id, status: 'approved' })} className="text-green-400 focus:bg-green-400/20 focus:text-green-300">
                                    <CheckCircle className="mr-2 h-4 w-4" /> Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => updateStatusMutation.mutate({ submissionId: submission.id, status: 'rejected' })} className="text-red-400 focus:bg-red-400/20 focus:text-red-300">
                                    <XCircle className="mr-2 h-4 w-4" /> Reject
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => updateStatusMutation.mutate({ submissionId: submission.id, status: 'archived' })}>
                                    <Archive className="mr-2 h-4 w-4" /> Archive
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuItem onSelect={() => updateStatusMutation.mutate({ submissionId: submission.id, status: 'pending' })}>
                                    <Clock className="mr-2 h-4 w-4" /> Pending
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => updateStatusMutation.mutate({ submissionId: submission.id, status: 'approved' })} className="text-green-400 focus:bg-green-400/20 focus:text-green-300">
                                    <CheckCircle className="mr-2 h-4 w-4" /> Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => updateStatusMutation.mutate({ submissionId: submission.id, status: 'rejected' })} className="text-red-400 focus:bg-red-400/20 focus:text-red-300">
                                    <XCircle className="mr-2 h-4 w-4" /> Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination className="mt-6">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => { e.preventDefault(); handlePageChange(Math.max(1, page - 1)); }}
                className={page === 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              const pageNum = i + 1;
              return (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={page === pageNum}
                    onClick={(e) => { e.preventDefault(); handlePageChange(pageNum); }}
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            {totalPages > 5 && page < totalPages - 2 && (
              <PaginationItem>
                <span className="px-2 text-muted-gray">...</span>
              </PaginationItem>
            )}
            {totalPages > 5 && (
              <PaginationItem>
                <PaginationLink
                  href="#"
                  isActive={page === totalPages}
                  onClick={(e) => { e.preventDefault(); handlePageChange(totalPages); }}
                >
                  {totalPages}
                </PaginationLink>
              </PaginationItem>
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => { e.preventDefault(); handlePageChange(Math.min(totalPages, page + 1)); }}
                className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Showing X of Y */}
      <div className="text-center text-sm text-muted-gray">
        Showing {submissions.length} of {totalCount} {source === 'content' ? 'submissions' : 'projects'}
      </div>

      {/* Bulk Actions Bar */}
      <SubmissionBulkActionsBar
        selectedIds={selectedIds}
        submissionType={source}
        onClearSelection={() => setSelectedIds([])}
      />

      {/* Modals */}
      <SubmissionDetailsModal isOpen={modalOpen} onClose={() => setModalOpen(false)} submission={selectedSubmission} />
      <SubmissionNotesModal isOpen={notesModalOpen} onClose={() => setNotesModalOpen(false)} submission={selectedSubmission} />
    </div>
  );
};

export default SubmissionManagement;
