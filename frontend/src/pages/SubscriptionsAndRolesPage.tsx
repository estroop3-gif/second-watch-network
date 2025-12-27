import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import RoleCard from '@/components/subscriptions/RoleCard';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/hooks/useProfile';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import FilmmakerApplicationForm from '@/components/forms/FilmmakerApplicationForm';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { track } from '@/utils/telemetry';

const SubscriptionsAndRolesPage = () => {
  const { session } = useAuth();
  const { hasRole } = usePermissions();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isFilmmakerModalOpen, setIsFilmmakerModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleBecomeFilmmakerClick = () => {
    if (!session) {
      navigate('/signup?redirect=/subscriptions');
      return;
    }
    // Only navigate to profile if user has completed filmmaker onboarding
    if (hasRole('filmmaker') && profile?.has_completed_filmmaker_onboarding) {
      navigate(`/profile/${profile?.username}`);
    } else if (hasRole('filmmaker')) {
      // User is filmmaker but hasn't completed onboarding
      navigate('/filmmaker-onboarding');
    } else {
      setIsFilmmakerModalOpen(true);
    }
  };

  const isLoggedIn = !!session;
  const isPremium = hasRole('premium');

  // Show cancel notice if coming back from Checkout cancel
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('checkout') === 'cancelled') {
      try { track('checkout_cancel'); } catch {}
      toast.message('Checkout canceled');
    }
  }, [location.search]);

  const startCheckout = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      try { track('premium_subscribe_click'); } catch {}
      const returnTo = window.location.pathname + window.location.search;
      const result = await api.createCheckoutSession('premium', undefined, returnTo);
      try { track('checkout_session_created', { plan: 'premium' }); } catch {}
      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.error("Couldn't start checkout. Try again.");
        setSubmitting(false);
      }
    } catch {
      toast.error("Couldn't start checkout. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">
          Membership Tiers & Roles
        </h1>
        <p className="mt-3 max-w-md mx-auto text-lg text-muted-foreground sm:text-xl md:mt-5 md:max-w-3xl">
          Explore what each level offers and how to join the Second Watch Network community.
        </p>
      </header>

      <div className="flex items-center justify-center mb-12">
        <ToggleGroup
          type="single"
          defaultValue="monthly"
          value={billingCycle}
          onValueChange={(value: 'monthly' | 'yearly') => {
            if (value) setBillingCycle(value);
          }}
          className="bg-muted-gray/20 p-1 rounded-lg"
        >
          <ToggleGroupItem value="monthly" aria-label="Select monthly billing" className="data-[state=on]:bg-accent-yellow data-[state=on]:text-charcoal-black px-6 text-bone-white rounded-md">
            Monthly
          </ToggleGroupItem>
          <ToggleGroupItem value="yearly" aria-label="Select yearly billing" className="data-[state=on]:bg-accent-yellow data-[state=on]:text-charcoal-black px-6 text-bone-white rounded-md">
            Yearly
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="relative px-12">
        <Carousel
          opts={{
            align: "start",
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-8">
            {/* Free Membership */}
            <CarouselItem className="pl-8 md:basis-1/2 xl:basis-1/3">
              <RoleCard
                title="Free Membership"
                price="$0"
                description="The default for all registered users. Jump into the community."
                features={[
                  'View the community forum (The Backlot)',
                  'Watch community-submitted content with ads',
                  'Receive notifications about project submission updates',
                  'Ability to apply to become a Filmmaker or Partner',
                ]}
                badge={<Badge variant="secondary">Default</Badge>}
              />
            </CarouselItem>

            {/* Premium Subscription */}
            <CarouselItem className="pl-8 md:basis-1/2 xl:basis-1/3">
              <RoleCard
                title="Premium"
                price={
                  billingCycle === 'monthly' ? (
                    <>
                      <span className="text-base font-normal text-muted-foreground line-through mr-2">$9.99</span>
                      <span>$5.99 / month</span>
                    </>
                  ) : (
                    <span>$59.99 / year</span>
                  )
                }
                description="The ultimate viewing experience with exclusive perks."
                features={[
                  'No ads on all content',
                  'Watch all Second Watch Originals for free',
                  'Premium badge across the platform',
                  'Early access to new films and series',
                  'Smart notifications for content you love',
                  'Bookmark and favorite content',
                  'Enhanced visibility in community feed',
                  'Access to premium-only events and Q&As (future rollout)',
                ]}
                action={
                  isPremium ? (
                    <Button asChild className="w-full">
                      <Link to="/account/billing">Manage in Subscription settings</Link>
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                      onClick={startCheckout}
                      disabled={submitting}
                    >
                      {submitting ? 'Redirecting…' : 'Subscribe'}
                    </Button>
                  )
                }
              />
            </CarouselItem>

            {/* Filmmaker Role */}
            <CarouselItem className="pl-8 md:basis-1/2 xl:basis-1/3">
              <Dialog open={isFilmmakerModalOpen} onOpenChange={setIsFilmmakerModalOpen}>
                <RoleCard
                  title="Filmmaker"
                  description="For creators who want to build, share, and collaborate."
                  features={[
                    'Filmmaker profile tools with public profile',
                    'Add credits, reels, skills, and availability',
                    'Share status updates and posts',
                    'Submit content for distribution',
                    'Collaborate in The Backlot with advanced posting',
                  ]}
                  badge={<Badge variant="outline">Application-Based</Badge>}
                  action={
                    <DialogTrigger asChild>
                      <Button onClick={handleBecomeFilmmakerClick} className="w-full">
                        {hasRole('filmmaker') && profile?.has_completed_filmmaker_onboarding
                          ? 'View My Profile'
                          : hasRole('filmmaker')
                          ? 'Complete Profile'
                          : 'Become a Filmmaker'}
                      </Button>
                    </DialogTrigger>
                  }
                />
                <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl text-accent-yellow">Filmmaker Application</DialogTitle>
                    <DialogDescription>
                      Help us get to know your work. This application helps maintain trust and quality on our platform.
                    </DialogDescription>
                  </DialogHeader>
                  <FilmmakerApplicationForm onSuccess={() => setIsFilmmakerModalOpen(false)} />
                </DialogContent>
              </Dialog>
            </CarouselItem>

            {/* Partner Role */}
            <CarouselItem className="pl-8 md:basis-1/2 xl:basis-1/3">
              <RoleCard
                title="Partner"
                description="For brands and sponsors looking to support indie film."
                features={[
                  'Access to sponsor tools and analytics',
                  'Manage branded content campaigns',
                  'High-visibility placement across site',
                  'Custom partner badge and profile page',
                  'Publish sponsored content in featured areas',
                ]}
                badge={<Badge variant="outline">Sponsorship-Based</Badge>}
                action={
                  <Button asChild className="w-full">
                    <Link to="/partners">Become a Partner</Link>
                  </Button>
                }
              />
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 bg-muted-gray/50 hover:bg-muted-gray/80 border-muted-gray text-white" />
          <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 bg-muted-gray/50 hover:bg-muted-gray/80 border-muted-gray text-white" />
        </Carousel>
      </div>

      {isLoggedIn && (
        <div className="mt-12 text-center">
          <Button asChild size="lg">
            <Link to="/account/billing">Subscription settings</Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsAndRolesPage;