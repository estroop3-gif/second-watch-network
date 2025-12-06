/**
 * Order Jobs Page
 * Browse and apply to jobs
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  orderAPI,
  OrderJob,
  OrderJobType,
  OrderJobVisibility,
} from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  ChevronRight,
  Loader2,
  Filter,
  Clock,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

const JOB_TYPES: { value: OrderJobType; label: string }[] = [
  { value: 'shoot', label: 'On-Set / Shoot' },
  { value: 'edit', label: 'Post-Production' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'other', label: 'Other' },
];

export default function OrderJobs() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<OrderJob[]>([]);
  const [total, setTotal] = useState(0);

  // Filters
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('all');
  const [activeOnly, setActiveOnly] = useState(true);

  useEffect(() => {
    loadJobs();
  }, [jobTypeFilter, activeOnly]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const options: any = { active_only: activeOnly };
      if (jobTypeFilter && jobTypeFilter !== 'all') {
        options.job_type = jobTypeFilter;
      }

      const data = await orderAPI.listJobs(options);
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
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

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <Button variant="ghost" onClick={() => navigate('/order/dashboard')} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Briefcase className="h-8 w-8" />
            Order Jobs
          </h1>
          <p className="text-muted-foreground">
            Exclusive job opportunities for Order members
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Job Type Filter */}
            <div className="w-full md:w-48">
              <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {JOB_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Only Checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="activeOnly"
                checked={activeOnly}
                onCheckedChange={(checked) => setActiveOnly(checked === true)}
              />
              <Label htmlFor="activeOnly">Active jobs only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-muted-foreground">
          {total} job{total !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No jobs found matching your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/order/jobs/${job.id}`)}
            >
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="text-xl font-semibold">{job.title}</h3>
                        {job.organization_name && (
                          <p className="text-muted-foreground">{job.organization_name}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {getVisibilityBadge(job.visibility)}
                        {getJobTypeBadge(job.job_type)}
                      </div>
                    </div>

                    <p className="text-muted-foreground line-clamp-2 mb-4">
                      {job.description}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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

                      {job.starts_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(job.starts_at).toLocaleDateString()}
                          {job.ends_at && ` - ${new Date(job.ends_at).toLocaleDateString()}`}
                        </span>
                      )}

                      {job.application_deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Apply by {new Date(job.application_deadline).toLocaleDateString()}
                        </span>
                      )}

                      {job.application_count !== undefined && job.application_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {job.application_count} applicant{job.application_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:flex-col md:items-end">
                    {job.user_has_applied && (
                      <Badge className="bg-green-500 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Applied
                      </Badge>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground hidden md:block" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
