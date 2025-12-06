/**
 * Order Member Profile Page
 * View a member's profile and request booking
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  orderAPI,
  OrderMemberProfile,
  OrderBookingRequestCreateRequest,
  PRIMARY_TRACKS,
} from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  User,
  MapPin,
  Calendar,
  ExternalLink,
  Mail,
  Loader2,
  Briefcase,
  Send,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

export default function OrderMemberProfilePage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<OrderMemberProfile | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Booking form state
  const [bookingForm, setBookingForm] = useState<Partial<OrderBookingRequestCreateRequest>>({
    requester_name: '',
    requester_email: '',
    requester_phone: '',
    requester_org: '',
    project_title: '',
    details: '',
    location: '',
    dates: '',
    budget_range: '',
  });

  useEffect(() => {
    if (!user) {
      navigate(`/login?redirect=/order/members/${userId}`);
      return;
    }
    loadProfile();
  }, [user, userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await orderAPI.getMemberProfile(userId!);
      setProfile(data);
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      if (error.message?.includes('Order membership required')) {
        toast.error('Order membership required to view profiles');
        navigate('/order');
      } else if (error.message?.includes('not found')) {
        toast.error('Member not found');
        navigate('/order/directory');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBooking = async () => {
    if (!bookingForm.requester_name || !bookingForm.requester_email || !bookingForm.details) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmittingBooking(true);
      await orderAPI.createBookingRequest({
        target_user_id: userId!,
        requester_name: bookingForm.requester_name!,
        requester_email: bookingForm.requester_email!,
        requester_phone: bookingForm.requester_phone,
        requester_org: bookingForm.requester_org,
        project_title: bookingForm.project_title,
        details: bookingForm.details!,
        location: bookingForm.location,
        dates: bookingForm.dates,
        budget_range: bookingForm.budget_range,
      });
      toast.success('Booking request sent successfully!');
      setShowBookingModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send booking request');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const getAvailabilityBadge = (status?: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500">Available for Hire</Badge>;
      case 'busy':
        return <Badge variant="secondary">Currently Busy</Badge>;
      case 'unavailable':
        return <Badge variant="outline">Unavailable</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active Member</Badge>;
      case 'probationary':
        return <Badge variant="secondary">Probationary</Badge>;
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

  if (!profile) {
    return null;
  }

  const secondaryTracks = profile.secondary_tracks
    ? JSON.parse(profile.secondary_tracks)
    : [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/order/directory')} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Directory
      </Button>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column - Main Profile */}
        <div className="md:col-span-2 space-y-6">
          {/* Header Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-12 w-12 text-muted-foreground" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold">
                      {profile.user_name || 'Order Member'}
                    </h1>
                    <Shield className="h-5 w-5 text-primary" title="Order Member" />
                  </div>

                  <p className="text-lg text-primary font-medium mb-2">
                    {PRIMARY_TRACKS.find(t => t.value === profile.primary_track)?.label || profile.primary_track}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {getStatusBadge(profile.status)}
                    {getAvailabilityBadge(profile.availability_status)}
                  </div>

                  {(profile.city || profile.region) && (
                    <p className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {profile.city}{profile.region ? `, ${profile.region}` : ''}
                    </p>
                  )}

                  {profile.lodge_name && (
                    <p className="text-muted-foreground mt-1">
                      {profile.lodge_name} Lodge
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bio */}
          {profile.bio && (
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{profile.bio}</p>
              </CardContent>
            </Card>
          )}

          {/* Skills & Experience */}
          <Card>
            <CardHeader>
              <CardTitle>Skills & Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.years_experience !== undefined && (
                <div>
                  <p className="text-sm text-muted-foreground">Years of Experience</p>
                  <p className="font-medium">{profile.years_experience} years</p>
                </div>
              )}

              {secondaryTracks.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Additional Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {secondaryTracks.map((track: string) => (
                      <Badge key={track} variant="outline">
                        {PRIMARY_TRACKS.find(t => t.value === track)?.label || track}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {profile.gear_summary && (
                <div>
                  <p className="text-sm text-muted-foreground">Gear & Equipment</p>
                  <p className="whitespace-pre-wrap">{profile.gear_summary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Portfolio Links */}
          {(profile.portfolio_url || profile.imdb_url || profile.youtube_url || profile.vimeo_url || profile.website_url) && (
            <Card>
              <CardHeader>
                <CardTitle>Portfolio & Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {profile.portfolio_url && (
                    <a
                      href={profile.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Portfolio
                    </a>
                  )}
                  {profile.imdb_url && (
                    <a
                      href={profile.imdb_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      IMDb
                    </a>
                  )}
                  {profile.youtube_url && (
                    <a
                      href={profile.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      YouTube
                    </a>
                  )}
                  {profile.vimeo_url && (
                    <a
                      href={profile.vimeo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Vimeo
                    </a>
                  )}
                  {profile.website_url && (
                    <a
                      href={profile.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Website
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Actions */}
        <div className="space-y-6">
          {/* Request Booking Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Hire This Member
              </CardTitle>
              <CardDescription>
                Send a booking request to work with this professional
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                size="lg"
                onClick={() => setShowBookingModal(true)}
                disabled={profile.availability_status === 'unavailable'}
              >
                <Mail className="h-4 w-4 mr-2" />
                Request Booking
              </Button>

              {profile.availability_status === 'unavailable' && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  This member is currently unavailable
                </p>
              )}
            </CardContent>
          </Card>

          {/* Member Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Member Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.joined_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Member since {new Date(profile.joined_at).toLocaleDateString()}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Verified Order Member</span>
              </div>

              {profile.lodge_name && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.lodge_name} Lodge</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Booking Request Modal */}
      <Dialog open={showBookingModal} onOpenChange={setShowBookingModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Booking</DialogTitle>
            <DialogDescription>
              Send a booking request to {profile.user_name || 'this member'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requester_name">Your Name *</Label>
                <Input
                  id="requester_name"
                  value={bookingForm.requester_name}
                  onChange={(e) => setBookingForm({ ...bookingForm, requester_name: e.target.value })}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requester_email">Email *</Label>
                <Input
                  id="requester_email"
                  type="email"
                  value={bookingForm.requester_email}
                  onChange={(e) => setBookingForm({ ...bookingForm, requester_email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requester_phone">Phone</Label>
                <Input
                  id="requester_phone"
                  value={bookingForm.requester_phone}
                  onChange={(e) => setBookingForm({ ...bookingForm, requester_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requester_org">Organization</Label>
                <Input
                  id="requester_org"
                  value={bookingForm.requester_org}
                  onChange={(e) => setBookingForm({ ...bookingForm, requester_org: e.target.value })}
                  placeholder="Company or church name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project_title">Project Title</Label>
              <Input
                id="project_title"
                value={bookingForm.project_title}
                onChange={(e) => setBookingForm({ ...bookingForm, project_title: e.target.value })}
                placeholder="Name of your project"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={bookingForm.location}
                  onChange={(e) => setBookingForm({ ...bookingForm, location: e.target.value })}
                  placeholder="Atlanta, GA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dates">Dates Needed</Label>
                <Input
                  id="dates"
                  value={bookingForm.dates}
                  onChange={(e) => setBookingForm({ ...bookingForm, dates: e.target.value })}
                  placeholder="Jan 15-17, 2025"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget_range">Budget Range</Label>
              <Input
                id="budget_range"
                value={bookingForm.budget_range}
                onChange={(e) => setBookingForm({ ...bookingForm, budget_range: e.target.value })}
                placeholder="$500-$1000/day"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="details">Project Details *</Label>
              <Textarea
                id="details"
                value={bookingForm.details}
                onChange={(e) => setBookingForm({ ...bookingForm, details: e.target.value })}
                placeholder="Describe your project, what you need, and any other relevant details..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBookingModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitBooking} disabled={submittingBooking}>
              {submittingBooking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
