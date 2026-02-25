import { Link, useNavigate } from 'react-router-dom';
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
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import FilmmakerApplicationForm from '@/components/forms/FilmmakerApplicationForm';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Star, Rocket, Zap, Building2, Crown, ArrowRight, Film, Shield } from 'lucide-react';
import { useFilmmakerProCheckout } from '@/hooks/useFilmmakerPro';
import { useToast } from '@/hooks/use-toast';

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
    price: '$129',
    period: '/mo',
    tagline: 'For solo filmmakers',
    icon: Rocket,
    highlights: ['5 active projects', '6 seats', '150 GB storage'],
    cta: 'Subscribe',
    ctaLink: '/subscribe/backlot/indie',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$299',
    period: '/mo',
    tagline: 'For small teams',
    icon: Zap,
    highlights: ['15 active projects', '17 seats', '1 TB storage'],
    popular: true,
    cta: 'Subscribe',
    ctaLink: '/subscribe/backlot/pro',
  },
  {
    key: 'business',
    name: 'Business',
    price: '$599',
    period: '/mo',
    tagline: 'For production companies',
    icon: Building2,
    highlights: ['50 active projects', '28 seats', '5 TB storage'],
    cta: 'Subscribe',
    ctaLink: '/subscribe/backlot/business',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: '$1,299',
    period: '/mo',
    tagline: 'For studios & networks',
    icon: Crown,
    highlights: ['Unlimited everything', 'Unlimited seats', 'Unlimited storage'],
    cta: 'Subscribe',
    ctaLink: '/subscribe/backlot/enterprise',
  },
];

const SubscriptionsAndRolesPage = () => {
  const { session } = useAuth();
  const { hasRole } = usePermissions();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isFilmmakerModalOpen, setIsFilmmakerModalOpen] = useState(false);
  const [isOrderComingSoonOpen, setIsOrderComingSoonOpen] = useState(false);
  const checkoutMutation = useFilmmakerProCheckout();

  const handleFilmmakerProCheckout = async () => {
    try {
      const result = await checkoutMutation.mutateAsync({ plan: 'monthly' });
      if (result?.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch {
      toast({ title: 'Error starting checkout', variant: 'destructive' });
    }
  };

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
  const isOrderMember = hasRole('order_member');

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
                  'Watch all shows, films, and originals for free',
                  'Browse the community forum',
                  'Receive notifications about content and updates',
                  'Apply to become a Filmmaker or Partner',
                ]}
                badge={<Badge variant="secondary">Default</Badge>}
              />
            </CarouselItem>

            {/* The Second Watch Order */}
            <CarouselItem className="pl-8 md:basis-1/2 xl:basis-1/3">
              <RoleCard
                title="The Second Watch Order"
                description="A professional guild for film industry craftspeople."
                features={[
                  'Professional networking & member directory',
                  'Exclusive job opportunities',
                  'Local lodges & in-person events',
                  'Booking system & industry recognition',
                ]}
                badge={<Badge variant="outline">Application-Based</Badge>}
                action={
                  isOrderMember ? (
                    <Button asChild className="w-full">
                      <Link to="/order/dashboard">Go to Dashboard</Link>
                    </Button>
                  ) : (
                    <Button onClick={() => setIsOrderComingSoonOpen(true)} className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
                      Apply for Membership
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
                    'Upgrade to Filmmaker Pro for $9.99/mo',
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
                <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-4xl max-h-[90vh] flex flex-col p-0">
                  <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
                    <DialogTitle className="text-2xl text-accent-yellow">Filmmaker Application</DialogTitle>
                    <DialogDescription>
                      Help us get to know your work. This application helps maintain trust and quality on our platform.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto flex-1 px-6 pb-6">
                    <FilmmakerApplicationForm onSuccess={() => setIsFilmmakerModalOpen(false)} />
                  </div>
                </DialogContent>
              </Dialog>
            </CarouselItem>

            {/* Filmmaker Pro — only visible to approved filmmakers */}
            {hasRole('filmmaker') && (
              <CarouselItem className="pl-8 md:basis-1/2 xl:basis-1/3">
                <RoleCard
                  title="Filmmaker Pro"
                  price="$9.99"
                  description="Professional tools for approved filmmakers to grow their career."
                  features={[
                    'Profile analytics & visitor insights',
                    'Boosted visibility in directory',
                    'Public rate card & standalone invoicing',
                    'Advanced availability calendar',
                    'Portfolio site generator',
                    'PRO badge on all listings',
                  ]}
                  badge={<Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-charcoal-black">$9.99/mo</Badge>}
                  action={
                    profile?.is_filmmaker_pro ? (
                      <Button asChild className="w-full bg-amber-500 hover:bg-amber-600 text-charcoal-black">
                        <Link to="/filmmaker-pro/settings">Manage Subscription</Link>
                      </Button>
                    ) : (
                      <Button
                        onClick={handleFilmmakerProCheckout}
                        disabled={checkoutMutation.isPending}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-charcoal-black"
                      >
                        {checkoutMutation.isPending ? 'Loading...' : 'Start Free Trial'}
                      </Button>
                    )
                  }
                />
              </CarouselItem>
            )}

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

      {/* The Second Watch Order Tiers */}
      <div className="mt-16 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Shield className="h-6 w-6 text-accent-yellow" />
            <h2 className="text-3xl font-bold text-white">The Second Watch Order</h2>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A professional guild for film industry craftspeople. Application required — dues begin after approval.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            {
              name: 'Base',
              price: '$50',
              tagline: 'For working professionals',
              highlights: [
                'Full member access',
                'Lodge membership',
                'Job board access',
                'Booking system',
              ],
            },
            {
              name: 'Steward',
              price: '$100',
              tagline: 'For committed craftspeople',
              popular: true,
              highlights: [
                'Everything in Base',
                'Priority job listings',
                'Craft house leadership',
                'Enhanced profile',
              ],
            },
            {
              name: 'Patron',
              price: '$250',
              tagline: 'For industry leaders',
              highlights: [
                'Everything in Steward',
                'Governance voting',
                'Featured placement & VIP events',
                'Patron badge',
              ],
            },
          ].map((tier) => (
            <Card
              key={tier.name}
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
              <CardContent className="p-5 flex flex-col flex-grow">
                <div className="text-center mb-4">
                  <Shield className={`h-6 w-6 mx-auto mb-2 ${tier.popular ? 'text-accent-yellow' : 'text-muted-gray'}`} />
                  <div className="text-lg font-bold text-bone-white">{tier.name}</div>
                  <div className="text-2xl font-bold text-accent-yellow">
                    {tier.price}
                    <span className="text-xs text-muted-gray font-normal">/mo</span>
                  </div>
                  <div className="text-xs text-muted-gray mt-1">{tier.tagline}</div>
                </div>
                <ul className="space-y-2 mb-4 flex-grow">
                  {tier.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-bone-white">
                      <CheckCircle className="h-4 w-4 text-accent-yellow mt-0.5 flex-shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                {isOrderMember ? (
                  <Button
                    asChild
                    size="sm"
                    className={`w-full ${
                      tier.popular
                        ? 'bg-accent-yellow text-charcoal-black hover:bg-yellow-500'
                        : 'bg-muted-gray/30 text-bone-white hover:bg-muted-gray/50'
                    }`}
                  >
                    <Link to="/order/dashboard">Go to Dashboard</Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setIsOrderComingSoonOpen(true)}
                    className={`w-full ${
                      tier.popular
                        ? 'bg-accent-yellow text-charcoal-black hover:bg-yellow-500'
                        : 'bg-muted-gray/30 text-bone-white hover:bg-muted-gray/50'
                    }`}
                  >
                    Apply for Membership
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-6">
          <Button asChild variant="outline" className="border-muted-gray/50 text-bone-white hover:bg-muted-gray/20">
            <Link to="/order">
              Learn More About The Order
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
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

      {/* Order Coming Soon Dialog */}
      <Dialog open={isOrderComingSoonOpen} onOpenChange={setIsOrderComingSoonOpen}>
        <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white">
          <DialogHeader>
            <DialogTitle className="text-xl text-accent-yellow">Coming Soon</DialogTitle>
            <DialogDescription className="text-muted-gray">
              The Second Watch Order is currently in the process of being implemented. Stay tuned!
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsOrderComingSoonOpen(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionsAndRolesPage;