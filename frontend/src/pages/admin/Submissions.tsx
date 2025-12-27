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
import { MoreHorizontal, Search, CheckCircle, XCircle, FileText, Archive, Clock, Eye, ThumbsUp, MessageSquare } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SubmissionDetailsModal from '@/components/admin/SubmissionDetailsModal';
import { SubmissionNotesModal } from '@/components/admin/SubmissionNotesModal';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 15;
const SUBMISSION_STATUSES = ['all', 'pending', 'in review', 'considered', 'approved', 'rejected', 'archived'];

const statusColorClasses: Record<Submission['status'], string> = {
  pending: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
  'in review': 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  considered: 'bg-purple-400/20 text-purple-300 border-purple-400/30',
  approved: 'bg-green-400/20 text-green-300 border-green-400/30',
  rejected: 'bg-red-400/20 text-red-300 border-red-400/30',
  archived: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
};

const SubmissionManagement = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const status = searchParams.get('status') || 'pending';

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminSubmissions', { page, status, searchTerm }],
    queryFn: () => api.listSubmissionsAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      status,
      search: searchTerm || undefined,
    }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ submissionId, status: newStatus }: { submissionId: string; status: string }) => {
      await api.updateSubmissionStatus(submissionId, newStatus);
    },
    onSuccess: () => {
      toast.success('Submission status updated.');
      queryClient.invalidateQueries({ queryKey: ['adminSubmissions'] });
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

  const handleStatusChange = (newStatus: string) => {
    setSearchParams({ status: newStatus, page: '1' });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams({ status, page: newPage.toString() });
  };

  const handleViewDetails = (submission: Submission) => {
    setSelectedSubmission(submission);
    setModalOpen(true);
    if (submission.has_unread_admin_messages) {
      markAsReadMutation.mutate(submission.id);
    }
  };

  const handleNotes = (submission: Submission) => {
    setSelectedSubmission(submission);
    setNotesModalOpen(true);
  };

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-8 -rotate-1">
        Submission <span className="font-spray text-accent-yellow">Management</span>
      </h1>

      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-gray" />
          <Input
            placeholder="Search by title or submitter..."
            className="pl-10"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Tabs value={status} onValueChange={handleStatusChange}>
          <TabsList>
            {SUBMISSION_STATUSES.map(s => (
              <TabsTrigger key={s} value={s} className="capitalize">{s}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="border-2 border-muted-gray p-2 bg-charcoal-black/50">
        <Table>
          <TableHeader>
            <TableRow className="border-b-muted-gray hover:bg-charcoal-black/20">
              <TableHead>Project Title</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-48">Loading submissions...</TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={5} className="text-center h-48 text-primary-red">Error: {(error as Error).message}</TableCell></TableRow>
            ) : data?.submissions.map((submission) => (
              <TableRow
                key={submission.id}
                className={cn(
                  "border-b-muted-gray hover:bg-charcoal-black/20 cursor-pointer",
                  submission.has_unread_admin_messages && "bg-accent-yellow/5"
                )}
                onClick={() => handleViewDetails(submission)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {submission.has_unread_admin_messages && <div className="h-2 w-2 rounded-full bg-accent-yellow" title="Unread messages"></div>}
                    <span>{submission.project_title}</span>
                    {submission.admin_notes && (
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
                <TableCell>{submission.profiles?.full_name || submission.profiles?.username || 'N/A'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("capitalize", statusColorClasses[submission.status])}>
                    {submission.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(submission.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray text-bone-white">
                      <DropdownMenuItem onSelect={() => handleViewDetails(submission)}>
                        <MessageSquare className="mr-2 h-4 w-4" /> View Details & Messages
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleNotes(submission)}>
                        <FileText className="mr-2 h-4 w-4" /> Add/Edit Notes
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent className="bg-charcoal-black border-muted-gray text-bone-white">
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
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-6">
          <PaginationContent>
            <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePageChange(Math.max(1, page - 1)); }} /></PaginationItem>
            {[...Array(totalPages)].map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink href="#" isActive={page === i + 1} onClick={(e) => { e.preventDefault(); handlePageChange(i + 1); }}>{i + 1}</PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); handlePageChange(Math.min(totalPages, page + 1)); }} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <SubmissionDetailsModal isOpen={modalOpen} onClose={() => setModalOpen(false)} submission={selectedSubmission} />
      <SubmissionNotesModal isOpen={notesModalOpen} onClose={() => setNotesModalOpen(false)} submission={selectedSubmission} />
    </div>
  );
};

export default SubmissionManagement;
