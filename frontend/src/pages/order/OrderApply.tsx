/**
 * Order Application Page
 * Apply to join The Second Watch Order
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  orderAPI,
  OrderApplication,
  OrderApplicationCreateRequest,
  PrimaryTrack,
  PRIMARY_TRACKS,
} from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

export default function OrderApply() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingApplication, setExistingApplication] = useState<OrderApplication | null>(null);

  // Form state
  const [formData, setFormData] = useState<OrderApplicationCreateRequest>({
    primary_track: 'other',
    city: '',
    region: '',
    portfolio_links: '',
    statement: '',
    years_experience: undefined,
    current_role: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/order/apply');
      return;
    }
    checkExistingApplication();
  }, [user]);

  const checkExistingApplication = async () => {
    try {
      const application = await orderAPI.getMyApplication();
      setExistingApplication(application);
    } catch (error) {
      console.error('Error checking application:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.primary_track) {
      toast.error('Please select your primary track');
      return;
    }

    if (!formData.statement || formData.statement.length < 50) {
      toast.error('Please provide a statement of at least 50 characters');
      return;
    }

    try {
      setSubmitting(true);
      const application = await orderAPI.submitApplication(formData);
      setExistingApplication(application);
      toast.success('Application submitted successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending Review
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Not Approved
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show existing application status
  if (existingApplication) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate('/order')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Order
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Order Application</CardTitle>
              {getStatusBadge(existingApplication.status)}
            </div>
            <CardDescription>
              Submitted on {new Date(existingApplication.created_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {existingApplication.status === 'pending' && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertTitle>Application Under Review</AlertTitle>
                <AlertDescription>
                  Your application is being reviewed by our team. You'll receive a notification once a decision is made.
                </AlertDescription>
              </Alert>
            )}

            {existingApplication.status === 'approved' && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle className="text-green-700 dark:text-green-300">Application Approved!</AlertTitle>
                <AlertDescription>
                  Welcome to The Order! You can now access your dashboard and start connecting with other members.
                </AlertDescription>
              </Alert>
            )}

            {existingApplication.status === 'rejected' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Application Not Approved</AlertTitle>
                <AlertDescription>
                  {existingApplication.rejection_reason || 'Your application was not approved at this time. You may reapply in the future.'}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Primary Track</Label>
                <p className="font-medium">
                  {PRIMARY_TRACKS.find(t => t.value === existingApplication.primary_track)?.label || existingApplication.primary_track}
                </p>
              </div>

              {existingApplication.city && (
                <div>
                  <Label className="text-muted-foreground">Location</Label>
                  <p className="font-medium">
                    {existingApplication.city}{existingApplication.region ? `, ${existingApplication.region}` : ''}
                  </p>
                </div>
              )}

              {existingApplication.years_experience !== undefined && (
                <div>
                  <Label className="text-muted-foreground">Years of Experience</Label>
                  <p className="font-medium">{existingApplication.years_experience} years</p>
                </div>
              )}

              {existingApplication.statement && (
                <div>
                  <Label className="text-muted-foreground">Statement</Label>
                  <p className="whitespace-pre-wrap">{existingApplication.statement}</p>
                </div>
              )}
            </div>

            {existingApplication.status === 'approved' && (
              <Button className="w-full" onClick={() => navigate('/order/dashboard')}>
                Go to Order Dashboard
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show application form
  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Button variant="ghost" onClick={() => navigate('/order')} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Order
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Apply to The Second Watch Order</CardTitle>
          <CardDescription>
            Tell us about your professional background and why you want to join The Order.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Primary Track */}
            <div className="space-y-2">
              <Label htmlFor="primary_track">Primary Professional Track *</Label>
              <Select
                value={formData.primary_track}
                onValueChange={(value) => setFormData({ ...formData, primary_track: value as PrimaryTrack })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your primary track" />
                </SelectTrigger>
                <SelectContent>
                  {PRIMARY_TRACKS.map((track) => (
                    <SelectItem key={track.value} value={track.value}>
                      {track.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Atlanta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">State/Region</Label>
                <Input
                  id="region"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="Georgia"
                />
              </div>
            </div>

            {/* Years Experience */}
            <div className="space-y-2">
              <Label htmlFor="years_experience">Years of Professional Experience</Label>
              <Input
                id="years_experience"
                type="number"
                min={0}
                max={50}
                value={formData.years_experience || ''}
                onChange={(e) => setFormData({ ...formData, years_experience: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="5"
              />
            </div>

            {/* Current Role */}
            <div className="space-y-2">
              <Label htmlFor="current_role">Current Role/Title</Label>
              <Input
                id="current_role"
                value={formData.current_role}
                onChange={(e) => setFormData({ ...formData, current_role: e.target.value })}
                placeholder="Director of Photography"
              />
            </div>

            {/* Portfolio Links */}
            <div className="space-y-2">
              <Label htmlFor="portfolio_links">Portfolio Links</Label>
              <Textarea
                id="portfolio_links"
                value={formData.portfolio_links}
                onChange={(e) => setFormData({ ...formData, portfolio_links: e.target.value })}
                placeholder="IMDb, Vimeo, YouTube, personal website (one per line)"
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                Enter your portfolio links, one per line
              </p>
            </div>

            {/* Statement */}
            <div className="space-y-2">
              <Label htmlFor="statement">Personal Statement *</Label>
              <Textarea
                id="statement"
                value={formData.statement}
                onChange={(e) => setFormData({ ...formData, statement: e.target.value })}
                placeholder="Tell us about yourself, your work, and why you want to join The Second Watch Order..."
                rows={6}
                required
                minLength={50}
              />
              <p className="text-sm text-muted-foreground">
                Minimum 50 characters. Share your background, passion for your craft, and alignment with Order values.
              </p>
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
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

            <p className="text-sm text-muted-foreground text-center">
              By submitting, you agree to uphold the values and standards of The Second Watch Order.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
