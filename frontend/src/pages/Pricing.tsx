import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import PlanConfigurator from '@/components/pricing/PlanConfigurator';
import PriceSummary from '@/components/pricing/PriceSummary';
import { useCreateCheckout } from '@/hooks/useSubscriptionBilling';
import { useMyBacklotOrganizations } from '@/hooks/useOrganizations';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Check, Zap, Star, Building2, Crown, Rocket } from 'lucide-react';

const TIER_HIGHLIGHTS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    tagline: 'For students & hobbyists',
    icon: Star,
    features: ['1 Active project', '1 Owner seat', '5 GB Storage', '10 GB Bandwidth', 'Basic projects & scenes'],
    cta: 'Start Free',
    ctaStyle: 'border-[#2a2a2a] text-bone-white hover:bg-[#1a1a1a]',
  },
  {
    key: 'indie',
    name: 'Indie',
    price: '$129',
    annual: '$107.50',
    tagline: 'For solo filmmakers',
    icon: Rocket,
    features: ['5 Active projects', '1 Owner + 5 Collab seats', '150 GB Active storage', '500 GB Bandwidth', 'Full scheduling & call sheets'],
    cta: 'Start with Indie',
    ctaStyle: 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 hover:bg-accent-yellow/20',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$299',
    annual: '$249',
    tagline: 'For small production teams',
    icon: Zap,
    features: ['15 Active projects', '2 Owner + 15 Collab seats', '1 TB Active + Archive', '3 TB Bandwidth', 'Module add-ons available'],
    popular: true,
    cta: 'Start with Pro',
    ctaStyle: 'bg-accent-yellow text-charcoal-black hover:bg-yellow-400',
  },
  {
    key: 'business',
    name: 'Business',
    price: '$599',
    annual: '$499',
    tagline: 'For production companies',
    icon: Building2,
    features: ['50 Active projects', '3 Owner + 25 Collab seats', '5 TB Active / 10 TB Archive', '10 TB Bandwidth', 'All core modules included'],
    cta: 'Start with Business',
    ctaStyle: 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 hover:bg-accent-yellow/20',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: '$1,299',
    annual: '$1,082',
    tagline: 'For studios & networks',
    icon: Crown,
    features: ['Unlimited everything', 'Unlimited seats', 'Unlimited storage', 'Unlimited bandwidth', 'SSO, API, Dedicated CSM'],
    cta: 'Start with Enterprise',
    ctaStyle: 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 hover:bg-accent-yellow/20',
  },
];

const COMPARISON_SECTIONS = [
  {
    title: 'Core Features',
    rows: [
      { label: 'Projects & Scenes', free: 'Basic', indie: 'Full', pro: 'Full', business: 'Full', enterprise: 'Full' },
      { label: 'Script Upload', free: '1 script', indie: 'Unlimited', pro: 'Unlimited', business: 'Unlimited', enterprise: 'Unlimited' },
      { label: 'Scheduling', free: '—', indie: 'Basic', pro: 'Full + Hot Set', business: 'Full + Hot Set', enterprise: 'Full + Hot Set' },
      { label: 'Call Sheets', free: '—', indie: '5/mo', pro: 'Unlimited', business: 'Unlimited', enterprise: 'Unlimited' },
      { label: 'Shot Lists & Storyboards', free: '—', indie: 'Limited', pro: 'Unlimited', business: 'Unlimited', enterprise: 'Unlimited' },
      { label: 'Moodboards', free: 'View only', indie: 'Create', pro: 'Full', business: 'Full', enterprise: 'Full' },
      { label: 'Locations', free: '3', indie: '20', pro: 'Unlimited', business: 'Unlimited', enterprise: 'Unlimited' },
      { label: 'Tasks & Updates', free: 'Basic', indie: 'Full', pro: 'Full', business: 'Full', enterprise: 'Full' },
    ],
  },
  {
    title: 'Premium Modules',
    rows: [
      { label: 'Budgeting & Top Sheets', free: '—', indie: '—', pro: '+$29/mo', business: 'Included', enterprise: 'Included' },
      { label: 'Expense Tracking', free: '—', indie: '—', pro: '+$29/mo', business: 'Included', enterprise: 'Included' },
      { label: 'PO & Invoicing', free: '—', indie: '—', pro: '—', business: '+$39/mo', enterprise: 'Included' },
      { label: 'Timecards & Payroll', free: '—', indie: '—', pro: '—', business: '+$39/mo', enterprise: 'Included' },
      { label: 'Casting & Auditions', free: '—', indie: 'Basic', pro: 'Full', business: 'Full', enterprise: 'Full' },
      { label: 'Dailies & Transcoding', free: '—', indie: '—', pro: '+$39/mo', business: 'Included', enterprise: 'Included' },
      { label: 'Continuity Tools', free: '—', indie: '—', pro: '+$29/mo', business: 'Included', enterprise: 'Included' },
      { label: 'Document Signing', free: '—', indie: '—', pro: '—', business: '+$29/mo', enterprise: 'Included' },
      { label: 'AI Copilot', free: '—', indie: '50 msgs/mo', pro: '500 msgs/mo', business: 'Unlimited', enterprise: 'Unlimited + Custom' },
    ],
  },
  {
    title: 'Collaboration',
    rows: [
      { label: 'External Review Links', free: '—', indie: '3 active', pro: '25 active', business: 'Unlimited', enterprise: 'Unlimited' },
      { label: 'Custom Branding', free: '—', indie: '—', pro: '—', business: '+$15/mo', enterprise: 'Included' },
      { label: 'SSO / SAML', free: '—', indie: '—', pro: '—', business: '—', enterprise: 'Included' },
      { label: 'API Access', free: '—', indie: '—', pro: '—', business: 'Read-only', enterprise: 'Full' },
      { label: 'Priority Support', free: '—', indie: '—', pro: 'Email', business: 'Email + Chat', enterprise: 'Dedicated CSM' },
    ],
  },
];

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const createCheckout = useCreateCheckout();
  const { data: orgs, isLoading: orgsLoading } = useMyBacklotOrganizations();
  const { toast } = useToast();
  const [planConfig, setPlanConfig] = useState<any>(null);
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const handleConfigChange = useCallback((config: any) => {
    setPlanConfig(config);
  }, []);

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      navigate('/login?returnTo=/pricing');
      return;
    }
    if (!planConfig) {
      toast({ title: 'Please configure your plan first', variant: 'destructive' });
      return;
    }
    const org = orgs?.[0];
    if (!org) {
      navigate('/organizations');
      return;
    }
    try {
      const result = await createCheckout.mutateAsync({
        org_id: org.id,
        plan_type: planConfig.plan_type,
        tier_name: planConfig.tier_name,
        config: {
          ...planConfig.config,
          term_type: planConfig.term_type,
        },
      });
      window.location.href = result.checkout_url;
    } catch {
      toast({ title: 'Failed to start checkout', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const handleTierCTA = (tier: typeof TIER_HIGHLIGHTS[0]) => {
    if (tier.key === 'free') {
      navigate('/backlot/free-trial');
      return;
    }
    setShowConfigurator(true);
  };

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent-yellow/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 relative">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-bone-white mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Production Management,{' '}
              <span className="text-accent-yellow">For Everyone</span>
            </h1>
            <p className="text-lg text-muted-gray max-w-2xl mx-auto mb-2">
              From solo filmmakers to major studios. Start free, scale as you grow.
            </p>
            <p className="text-sm text-accent-yellow/80">
              Save ~17% with annual billing — pay 10 months, get 12.
            </p>
          </div>
        </div>
      </div>

      {/* Tier Cards */}
      {!showConfigurator && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
            {TIER_HIGHLIGHTS.map((tier) => {
              const Icon = tier.icon;
              return (
                <div
                  key={tier.key}
                  className={`relative rounded-xl border p-5 transition-all ${
                    tier.popular
                      ? 'border-accent-yellow/60 bg-[#1a1a1a] shadow-lg shadow-accent-yellow/10'
                      : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a]'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-accent-yellow text-charcoal-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Most Popular
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-accent-yellow" />
                    <h3 className="text-lg font-bold text-bone-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      {tier.name}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-gray mb-3">{tier.tagline}</p>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-accent-yellow">{tier.price}</span>
                    {tier.price !== '$0' && <span className="text-muted-gray text-sm">/mo</span>}
                    {tier.annual && (
                      <div className="text-xs text-green-400 mt-0.5">${tier.annual}/mo billed annually</div>
                    )}
                  </div>
                  <ul className="space-y-1.5 mb-5">
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-bone-white/80">
                        <Check className="h-3 w-3 text-accent-yellow mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full text-sm ${tier.ctaStyle}`}
                    onClick={() => handleTierCTA(tier)}
                  >
                    {tier.cta} <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 justify-center mb-12">
            <Button
              variant="outline"
              className="border-[#2a2a2a] text-bone-white hover:bg-[#1a1a1a]"
              onClick={() => setShowConfigurator(true)}
            >
              Build your own plan <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              className="border-[#2a2a2a] text-bone-white hover:bg-[#1a1a1a]"
              onClick={() => setShowComparison(!showComparison)}
            >
              {showComparison ? 'Hide' : 'Compare'} all features
            </Button>
          </div>

          {/* Comparison Table */}
          {showComparison && (
            <div className="overflow-x-auto rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] mb-12">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    <th className="text-left p-3 text-bone-white/60 font-normal w-48">Feature</th>
                    {['Free', 'Indie', 'Pro', 'Business', 'Enterprise'].map(t => (
                      <th key={t} className="text-center p-3 text-bone-white font-semibold">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_SECTIONS.map((section) => (
                    <>
                      <tr key={section.title} className="border-b border-[#2a2a2a] bg-[#141414]">
                        <td colSpan={6} className="p-2 px-3 text-xs uppercase tracking-wide text-accent-yellow font-semibold">
                          {section.title}
                        </td>
                      </tr>
                      {section.rows.map((row) => (
                        <tr key={row.label} className="border-b border-[#2a2a2a]/50 hover:bg-[#1e1e1e]">
                          <td className="p-2.5 px-3 text-bone-white/70">{row.label}</td>
                          {(['free', 'indie', 'pro', 'business', 'enterprise'] as const).map(k => (
                            <td key={k} className="p-2.5 text-center">
                              <span className={`text-xs ${
                                row[k] === '—' ? 'text-muted-gray' :
                                row[k] === 'Included' || row[k] === 'Full' || row[k] === 'Unlimited' ? 'text-green-400' :
                                row[k].startsWith('+$') ? 'text-accent-yellow' :
                                'text-bone-white/70'
                              }`}>
                                {row[k] === 'Included' ? <Check className="h-4 w-4 text-green-400 mx-auto" /> : row[k]}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add-on pricing callout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
              <h3 className="text-lg font-bold text-bone-white mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                A La Carte Resources
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  ['Extra Owner Seat', '$19/seat/mo'],
                  ['Extra Collab Seat', '$14/seat/mo'],
                  ['Extra Non-Collab Seat', '$6/seat/project/mo'],
                  ['Extra View-Only Seat', '$3/seat/project/mo'],
                  ['Extra Project', '$14/project/mo'],
                  ['Active Storage', '$15/100 GB/mo'],
                  ['Archive Storage', '$12/500 GB/mo'],
                  ['Bandwidth', '$14/500 GB/mo'],
                ].map(([label, price]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-bone-white/70">{label}</span>
                    <span className="text-accent-yellow">{price}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
              <h3 className="text-lg font-bold text-bone-white mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Production Bundle — $149/mo
              </h3>
              <p className="text-sm text-muted-gray mb-3">All premium modules at a discount ($124/mo with annual billing)</p>
              <div className="space-y-1.5 text-sm">
                {[
                  'Budgeting & Top Sheets',
                  'Expense Tracking & Receipts',
                  'PO & Invoicing',
                  'Timecards & Payroll',
                  'Dailies & Transcoding',
                  'Continuity Tools',
                  'Document Signing & Clearances',
                  'Custom Branding',
                ].map(m => (
                  <div key={m} className="flex items-center gap-2 text-bone-white/70">
                    <Check className="h-3 w-3 text-green-400 flex-shrink-0" />
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configurator */}
      {showConfigurator && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-bone-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Configure Your Plan
            </h2>
            <Button
              variant="ghost"
              className="text-muted-gray hover:text-bone-white"
              onClick={() => setShowConfigurator(false)}
            >
              Back to overview
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <PlanConfigurator
                onConfigChange={handleConfigChange}
                showCTA={false}
              />
            </div>
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                <PriceSummary
                  config={planConfig}
                  showCTA
                  ctaLabel={isAuthenticated ? 'Subscribe Now' : 'Sign Up to Subscribe'}
                  onCTAClick={handleSubscribe}
                  ctaLoading={createCheckout.isPending || orgsLoading}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="bg-[#1a1a1a] border-t border-[#2a2a2a] py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold text-bone-white mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Start free, upgrade anytime
          </h3>
          <p className="text-muted-gray mb-6">
            No credit card required. Get started with the Free plan and upgrade when you're ready.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              className="bg-accent-yellow text-charcoal-black hover:bg-yellow-400 font-semibold px-6"
              onClick={() => navigate('/backlot/free-trial')}
            >
              Start Free
            </Button>
            <Button
              variant="outline"
              className="border-[#2a2a2a] text-bone-white hover:bg-[#1a1a1a]"
              onClick={() => setShowConfigurator(true)}
            >
              View Pricing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
