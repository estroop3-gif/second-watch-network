import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Inbox, Pencil, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EditSubmissionModal } from "@/components/modals/EditSubmissionModal";
import { SubmissionConversationModal } from "@/components/modals/SubmissionConversationModal";

type Submission = {
  id: string;
  project_title: string;
  status: string;
  project_type: string;
  created_at: string;
  name: string;
  email: string;
  logline: string;
  description: string;
  youtube_link: string;
  has_unread_user_messages: boolean;
};

const MySubmissions = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConversationModalOpen, setIsConversationModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("submissions")
      .select("id, project_title, status, project_type, created_at, name, email, logline, description, youtube_link, has_unread_user_messages")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching submissions:", error);
    } else if (data) {
      setSubmissions(data as Submission[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleEditClick = (submission: Submission) => {
    setSelectedSubmission(submission);
    setIsEditModalOpen(true);
  };

  const handleConversationClick = (submission: Submission) => {
    setSelectedSubmission(submission);
    setIsConversationModalOpen(true);
    if (submission.has_unread_user_messages) {
      supabase
        .from('submissions')
        .update({ has_unread_user_messages: false })
        .eq('id', submission.id)
        .then(({ error }) => {
          if (!error) {
            fetchSubmissions();
          }
        });
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "success" => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const renderSubmissions = () => {
    if (loading) {
      return (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      );
    }

    if (submissions.length === 0) {
      return (
        <div className="text-center py-16 border border-dashed border-muted-gray/30 rounded-lg">
          <Inbox className="mx-auto h-12 w-12 text-muted-gray" />
          <h3 className="mt-4 text-xl font-semibold">No Submissions Yet</h3>
          <p className="mt-2 text-muted-gray">You haven't submitted any projects.</p>
          <Button asChild className="mt-6 bg-accent-yellow text-charcoal-black hover:bg-bone-white">
            <Link to="/submit-project">Submit Your First Project</Link>
          </Button>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => (
            <TableRow key={submission.id}>
              <TableCell className="font-medium">{submission.project_title}</TableCell>
              <TableCell className="capitalize">{submission.project_type}</TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(submission.status)} className="capitalize">
                  {submission.status}
                </Badge>
              </TableCell>
              <TableCell>{format(new Date(submission.created_at), "PPP")}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleConversationClick(submission)}
                  title="View conversation"
                >
                  <div className="relative">
                    <MessageSquare className="h-4 w-4" />
                    {submission.has_unread_user_messages && (
                      <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-yellow ring-2 ring-muted-gray/10" />
                    )}
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditClick(submission)}
                  disabled={submission.status.toLowerCase() !== 'pending'}
                  title={submission.status.toLowerCase() !== 'pending' ? 'Can only edit pending submissions' : 'Edit submission'}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-muted-gray/10 border-muted-gray/20">
        <CardHeader>
          <CardTitle className="font-heading text-3xl uppercase text-accent-yellow">
            My Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderSubmissions()}
        </CardContent>
      </Card>
      <EditSubmissionModal
        submission={selectedSubmission}
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSubmissionUpdated={fetchSubmissions}
      />
      <SubmissionConversationModal
        submission={selectedSubmission}
        isOpen={isConversationModalOpen}
        onOpenChange={setIsConversationModalOpen}
      />
    </div>
  );
};

export default MySubmissions;