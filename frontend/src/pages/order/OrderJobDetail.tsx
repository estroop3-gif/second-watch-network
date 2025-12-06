/**
 * Order Job Detail Page
 * View job details and apply
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  orderAPI,
  OrderJob,
  OrderJobType,
  OrderJobVisibility,
  PRIMARY_TRACKS,
} from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  Loader2,
  Clock,
  CheckCircle2,
  Shield,
  Send,
  Building,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const JOB_TYPES: { value: OrderJobType; label: string }[] = [
  { value: 'shoot', label: 'On-Set / Shoot' },
  { value: 'edit', label: 'Post-Production' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'other', label: 'Other' },
];

export default function OrderJobDetail() {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<OrderJob | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const loadJob = async () => {
    try {
      setLoading(true);
      const data = await orderAPI.getJob(parseInt(jobId!));
      setJob(data);
    } catch (error: any) {
      console.error('Failed to load job:', error);
      if (error.message?.includes('not found')) {
        toast.error('Job not found');
        navigate('/order/jobs');
      } else {
        toast.error('Failed to load job details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!coverLetter.trim()) {
      toast.error('Please provide a cover letter or message');
      return;
    }

    try {
      setSubmitting(true);
      await orderAPI.applyToJob(parseInt(jobId!), { cover_letter: coverLetter });
      toast.success('Application submitted successfully!');
      setShowApplyModal(false);
      setCoverLetter('');
      loadJob();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const getJobTypeBadge = (type: OrderJobType) => {
    const config = JOB_TYPES.find(t => t.value === type);
    return <Badge variant="outline">{config?.label || type}</Badge>;
  };

  const getVisibilityBadge = (visibility: OrderJobVisibility) => {
    switch (visibility) {
      case 'order_only':
        return (
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" />
            Order Only
          </Badge>
        );
      case 'order_priority':
        return (
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" />
            Order Priority
          </Badge>
        );
      default:
        return <Badge variant="outline">Public</Badge>;
    }
  };

  const isDeadlinePassed = job?.application_deadline
    ? new Date(job.application_deadline) < new Date()
    : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/order/jobs')} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Jobs
      </Button>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Header Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2 mb-4">
                {getVisibilityBadge(job.visibility)}
                {getJobTypeBadge(job.job_type)}
                {!job.is_active && (
                  <Badge variant="destructive">Closed</Badge>
                )}
              </div>

              <h1 className="text-2xl font-bold mb-2">{job.title}</h1>

              {job.organization_name && (
                <p className="text-lg text-muted-foreground flex items-center gap-2 mb-4">
                  <Building className="h-5 w-5" />
                  {job.organization_name}
                </p>
              )}

              <div className="flex flex-wrap gap-4 text-muted-foreground">
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {job.location}
                  </span>
                )}

                {job.pay_info && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {job.pay_info}
                  </span>
                )}

                {job.application_count !== undefined && job.application_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {job.application_count} applicant{job.application_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Already Applied Notice */}
          {job.user_has_applied && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700 dark:text-green-300">Applied</AlertTitle>
              <AlertDescription>
                You have already applied to this job. The employer will contact you if interested.
              </AlertDescription>
            </Alert>
          )}

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{job.description}</p>
            </CardContent>
          </Card>

          {/* Requirements */}
          {job.requirements && (
            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{job.requirements}</p>
              </CardContent>
            </Card>
          )}

          {/* Required Tracks */}
          {job.required_tracks && (
            <Card>
              <CardHeader>
                <CardTitle>Required Skills/Tracks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(job.required_tracks).map((track: string) => (
                    <Badge key={track} variant="outline">
                      {PRIMARY_TRACKS.find(t => t.value === track)?.label || track}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact Info */}
          {user && job.contact_email && (
            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={`mailto:${job.contact_email}`}
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {job.contact_email}
                </a>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Apply Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Apply to This Job
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!user ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Sign in to apply to this job
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => navigate(`/login?redirect=/order/jobs/${jobId}`)}
                  >
                    Sign In to Apply
                  </Button>
                </>
              ) : job.user_has_applied ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="font-medium">Application Submitted</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You'll be contacted if selected
                  </p>
                </div>
              ) : !job.is_active ? (
                <div className="text-center py-4">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Job Closed</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This job is no longer accepting applications
                  </p>
                </div>
              ) : isDeadlinePassed ? (
                <div className="text-center py-4">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Deadline Passed</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The application deadline has passed
                  </p>
                </div>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setShowApplyModal(true)}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Apply Now
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Job Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.starts_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(job.starts_at).toLocaleDateString()}
                  </p>
                </div>
              )}

              {job.ends_at && (
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(job.ends_at).toLocaleDateString()}
                  </p>
                </div>
              )}

              {job.application_deadline && (
                <div>
                  <p className="text-sm text-muted-foreground">Application Deadline</p>
                  <p className={`font-medium flex items-center gap-1 ${isDeadlinePassed ? 'text-destructive' : ''}`}>
                    <Clock className="h-4 w-4" />
                    {new Date(job.application_deadline).toLocaleDateString()}
                    {isDeadlinePassed && ' (Passed)'}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground">Posted</p>
                <p className="font-medium">
                  {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Apply Modal */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply to {job.title}</DialogTitle>
            <DialogDescription>
              Submit your application for this position
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Order Member Application</AlertTitle>
              <AlertDescription>
                Your Order profile will be shared with the employer along with your application.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="cover_letter">Cover Letter / Message *</Label>
              <Textarea
                id="cover_letter"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell the employer why you're a great fit for this position..."
                rows={6}
              />
              <p className="text-sm text-muted-foreground">
                Introduce yourself and explain why you're interested in this opportunity.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
