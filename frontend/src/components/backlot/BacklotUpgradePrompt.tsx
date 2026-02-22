import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Film,
  Users,
  FileText,
  Calendar,
  DollarSign,
  Lock,
  Zap,
  Star,
  Rocket,
  Building2,
  Crown,
  ArrowRight,
} from 'lucide-react';

const BACKLOT_FEATURES = [
  {
    icon: Film,
    title: 'Full Project Management',
    description: 'Create and manage unlimited production projects',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Invite team members and assign roles with granular permissions',
  },
  {
    icon: FileText,
    title: 'Document Management',
    description: 'Contracts, clearances, call sheets, and release forms',
  },
  {
    icon: Calendar,
    title: 'Production Scheduling',
    description: 'Calendar integration, shooting schedules, and availability tracking',
  },
  {
    icon: DollarSign,
    title: 'Budget & Invoicing',
    description: 'Track expenses, create invoices, and manage project finances',
  },
];

const BACKLOT_TIERS = [
  { key: 'free', name: 'Free', price: '$0', tagline: 'Students & hobbyists', icon: Star, highlight: '1 project, 5 GB' },
  { key: 'indie', name: 'Indie', price: '$129', tagline: 'Solo filmmakers', icon: Rocket, highlight: '5 projects, 150 GB' },
  { key: 'pro', name: 'Pro', price: '$299', tagline: 'Small teams', icon: Zap, highlight: '15 projects, 1 TB', popular: true },
  { key: 'business', name: 'Business', price: '$599', tagline: 'Production companies', icon: Building2, highlight: '50 projects, 5 TB' },
  { key: 'enterprise', name: 'Enterprise', price: '$1,299', tagline: 'Studios & networks', icon: Crown, highlight: 'Unlimited everything' },
];

interface BacklotUpgradePromptProps {
  className?: string;
}

const BacklotUpgradePrompt = ({ className }: BacklotUpgradePromptProps) => {
  return (
    <div className={`min-h-[80vh] flex items-center justify-center p-6 ${className}`}>
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Lock className="h-8 w-8 text-accent-yellow" />
            <h1 className="text-4xl font-heading text-bone-white">Backlot Production Tools</h1>
          </div>
          <p className="text-lg text-muted-gray max-w-2xl mx-auto">
            Professional production management for every stage of your filmmaking journey.
            Start free and scale as you grow.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {BACKLOT_FEATURES.map((feature, index) => (
            <Card key={index} className="bg-charcoal-black/50 border-muted-gray/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-accent-yellow/10">
                    <feature.icon className="h-5 w-5 text-accent-yellow" />
                  </div>
                  <div>
                    <h3 className="font-medium text-bone-white">{feature.title}</h3>
                    <p className="text-sm text-muted-gray mt-1">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tier Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {BACKLOT_TIERS.map((tier) => (
            <div
              key={tier.key}
              className={`relative rounded-lg border p-4 text-center ${
                tier.popular
                  ? 'border-accent-yellow bg-accent-yellow/5'
                  : 'border-muted-gray/30 bg-charcoal-black/50'
              }`}
            >
              {tier.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent-yellow text-charcoal-black text-[10px]">
                  Popular
                </Badge>
              )}
              <tier.icon className={`h-5 w-5 mx-auto mb-2 ${tier.popular ? 'text-accent-yellow' : 'text-muted-gray'}`} />
              <div className="text-sm font-semibold text-bone-white">{tier.name}</div>
              <div className="text-lg font-bold text-accent-yellow">{tier.price}<span className="text-xs text-muted-gray font-normal">/mo</span></div>
              <div className="text-xs text-muted-gray mt-1">{tier.highlight}</div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="bg-accent-yellow text-charcoal-black hover:bg-yellow-500 px-8"
          >
            <Link to="/backlot/free-trial">
              <Star className="h-4 w-4 mr-2" />
              Start Free
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-muted-gray/50 text-bone-white hover:bg-muted-gray/20 px-8"
          >
            <Link to="/pricing">
              View All Plans
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-gray mt-4 text-center">
          No credit card required for the free plan.
        </p>
      </div>
    </div>
  );
};

export default BacklotUpgradePrompt;
