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
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Star, Rocket, Zap, Building2, Crown, ArrowRight, Film } from 'lucide-react';

const BACKLOT_TIERS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: '/mo',
    tagline: 'For students & hobbyists',
    icon: Star,
    highlights: ['1 active project', '1 owner seat', '5 GB storage'],
    cta: 'Start Free',
    ctaLink: '/backlot/free-trial',
    ctaPrimary: true,
  },
  {
    key: 'indie',
    name: 'Indie',
    price: '$69',
    period: '/mo',
    tagline: 'For solo filmmakers',
    icon: Rocket,
    highlights: ['5 active projects', '6 seats', '150 GB storage'],
    cta: 'View Plan',
    ctaLink: '/pricing',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$149',
    period: '/mo',
    tagline: 'For small teams',
    icon: Zap,
    highlights: ['15 active projects', '17 seats', '1 TB storage'],
    popular: true,
    cta: 'View Plan',
    ctaLink: '/pricing',
  },
  {
    key: 'business',
    name: 'Business',
    price: '$349',
    period: '/mo',
    tagline: 'For production companies',
    icon: Building2,
    highlights: ['50 active projects', '53 seats', '5 TB storage'],
    cta: 'View Plan',
    ctaLink: '/pricing',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: '$799',
    period: '/mo',
    tagline: 'For studios & networks',
    icon: Crown,
    highlights: ['Unlimited projects', 'Unlimited seats', '25 TB storage'],
    cta: 'View Plan',
    ctaLink: '/pricing',
  },
];

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

      {/* Backlot Production Plans */}
      <div className="mt-16 max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Film className="h-6 w-6 text-accent-yellow" />
            <h2 className="text-3xl font-bold text-white">Backlot Production Plans</h2>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Professional production management tools. Start free and scale as your productions grow.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {BACKLOT_TIERS.map((tier) => (
            <Card
              key={tier.key}
              className={`relative flex flex-col ${
                tier.popular
                  ? 'border-accent-yellow bg-accent-yellow/5'
                  : 'bg-muted-gray/20 border-muted-gray'
              }`}
            >
              {tier.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent-yellow text-charcoal-black text-[10px]">
                  Popular
                </Badge>
              )}
              <CardContent className="p-4 flex flex-col flex-grow">
                <div className="text-center mb-3">
                  <tier.icon className={`h-6 w-6 mx-auto mb-2 ${tier.popular ? 'text-accent-yellow' : 'text-muted-gray'}`} />
                  <div className="text-lg font-bold text-bone-white">{tier.name}</div>
                  <div className="text-2xl font-bold text-accent-yellow">
                    {tier.price}
                    <span className="text-xs text-muted-gray font-normal">{tier.period}</span>
                  </div>
                  <div className="text-xs text-muted-gray mt-1">{tier.tagline}</div>
                </div>
                <ul className="space-y-1.5 mb-4 flex-grow">
                  {tier.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-bone-white">
                      <CheckCircle className="h-3.5 w-3.5 text-accent-yellow mt-0.5 flex-shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  size="sm"
                  className={`w-full ${
                    tier.ctaPrimary
                      ? 'bg-accent-yellow text-charcoal-black hover:bg-yellow-500'
                      : tier.popular
                      ? 'bg-accent-yellow text-charcoal-black hover:bg-yellow-500'
                      : 'bg-muted-gray/30 text-bone-white hover:bg-muted-gray/50'
                  }`}
                >
                  <Link to={tier.ctaLink}>
                    {tier.cta}
                    {!tier.ctaPrimary && <ArrowRight className="h-3 w-3 ml-1" />}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-6">
          <Button asChild variant="outline" className="border-muted-gray/50 text-bone-white hover:bg-muted-gray/20">
            <Link to="/pricing">
              Compare All Plans & Features
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
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