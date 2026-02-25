import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useMyBacklotOrganizations } from '@/hooks/useOrganizations';
import { useCreateCheckout } from '@/hooks/useSubscriptionBilling';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronLeft, Minus, Plus, ArrowRight, Loader2 } from 'lucide-react';

// ─── Pricing constants (mirrored from backend pricing_engine.py) ──────────────

const TIER_DATA: Record<string, {
  name: string;
  tagline: string;
  basePrice: number;
  ownerSeats: number;
  collabSeats: number;
  features: string[];
}> = {
  indie: {
    name: 'Indie',
    tagline: 'For solo filmmakers',
    basePrice: 129,
    ownerSeats: 1,
    collabSeats: 5,
    features: [
      '5 active projects',
      '1 owner + 5 collaborative seats',
      '150 GB active + 100 GB archive storage',
      '500 GB bandwidth',
      'Full scenes & projects tools',
      'Unlimited script uploads',
      'Basic scheduling & 5 call sheets/mo',
      '20 locations',
      'Basic casting & auditions',
      '50 AI messages/mo',
      '3 active review links',
    ],
  },
  pro: {
    name: 'Pro',
    tagline: 'For small production teams',
    basePrice: 299,
    ownerSeats: 2,
    collabSeats: 15,
    features: [
      '15 active projects',
      '2 owner + 15 collaborative seats',
      '1 TB active + 1 TB archive storage',
      '3 TB bandwidth',
      'Full scheduling & Hot Set',
      'Unlimited call sheets & shot lists',
      'Full moodboards & unlimited locations',
      'Full casting & auditions',
      '500 AI messages/mo',
      '25 active review links',
      'Email support',
      'Module add-ons available',
    ],
  },
  business: {
    name: 'Business',
    tagline: 'For production companies',
    basePrice: 599,
    ownerSeats: 3,
    collabSeats: 25,
    features: [
      '50 active projects',
      '3 owner + 25 collaborative seats',
      '5 TB active + 10 TB archive storage',
      '10 TB bandwidth',
      'Full scheduling & Hot Set',
      'Budgeting & Top Sheets included',
      'Expense Tracking included',
      'Dailies & Transcoding included',
      'Continuity Tools included',
      'Unlimited AI Copilot',
      'Unlimited review links',
      'Read-only API',
      'Email + Chat support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    tagline: 'For studios & networks',
    basePrice: 1299,
    ownerSeats: -1,
    collabSeats: -1,
    features: [
      'Unlimited active projects',
      'Unlimited seats',
      'Unlimited storage & bandwidth',
      'Full scheduling & Hot Set',
      'All 8 modules included',
      'Unlimited AI + custom models',
      'Unlimited review links',
      'SSO / SAML',
      'Full API access',
      'Dedicated Customer Success Manager',
    ],
  },
};

const AVAILABLE_MODULES: Record<string, Record<string, { name: string; monthly: number }>> = {
  indie: {
    budgeting: { name: 'Budgeting & Top Sheets', monthly: 29 },
    expenses: { name: 'Expense Tracking & Receipts', monthly: 29 },
    dailies: { name: 'Dailies & Transcoding', monthly: 39 },
    continuity: { name: 'Continuity Tools', monthly: 29 },
  },
  pro: {
    budgeting: { name: 'Budgeting & Top Sheets', monthly: 29 },
    expenses: { name: 'Expense Tracking & Receipts', monthly: 29 },
    dailies: { name: 'Dailies & Transcoding', monthly: 39 },
    continuity: { name: 'Continuity Tools', monthly: 29 },
  },
  business: {
    po_invoicing: { name: 'Purchase Orders & Invoicing', monthly: 39 },
    timecards: { name: 'Timecards & Payroll', monthly: 39 },
    doc_signing: { name: 'Document Signing & Clearances', monthly: 29 },
    custom_branding: { name: 'Custom Branding', monthly: 15 },
  },
  enterprise: {},
};

const ADDON_PRICES = { owner_seat: 19, collaborative_seat: 14 };

// ─── Component ─────────────────────────────────────────────────────────────────

export default function BacklotTierPage() {
  const { tier } = useParams<{ tier: string }>();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [billingTerm, setBillingTerm] = useState<'monthly' | 'annual'>('monthly');
  const [extraOwnerSeats, setExtraOwnerSeats] = useState(0);
  const [extraCollabSeats, setExtraCollabSeats] = useState(0);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  // Redirect to signup if not logged in
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/signup?returnTo=/subscribe/backlot/${tier}`);
    }
  }, [isAuthenticated, navigate, tier]);

  const { data: orgs, isLoading: orgsLoading } = useMyBacklotOrganizations();
  const createCheckout = useCreateCheckout();

  // Validate tier
  const tierKey = tier?.toLowerCase();
  const tierData = tierKey ? TIER_DATA[tierKey] : null;
  const availableModules = tierKey ? (AVAILABLE_MODULES[tierKey] ?? {}) : {};

  if (!tierData) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-bone-white text-xl mb-4">Invalid tier: {tier}</p>
          <Button asChild>
            <Link to="/pricing">View All Plans</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ─── Live price calculation ────────────────────────────────────────────────
  const basePrice = tierData.basePrice;
  const extraOwnerCost = extraOwnerSeats * ADDON_PRICES.owner_seat;
  const extraCollabCost = extraCollabSeats * ADDON_PRICES.collaborative_seat;
  const modulesCost = selectedModules.reduce((sum, key) => {
    return sum + (availableModules[key]?.monthly ?? 0);
  }, 0);
  const monthlyTotal = basePrice + extraOwnerCost + extraCollabCost + modulesCost;
  const annualTotal = Math.round(monthlyTotal * 10);
  const effectiveMonthly = +(annualTotal / 12).toFixed(2);
  const annualSavings = +(monthlyTotal * 2).toFixed(2);

  // ─── Subscribe handler ────────────────────────────────────────────────────
  const handleSubscribe = async () => {
    const org = orgs?.[0];
    if (!org) {
      if (!orgsLoading) navigate('/organizations');
      return;
    }

    try {
      const totalOwnerSeats = (tierData.ownerSeats > 0 ? tierData.ownerSeats : 1) + extraOwnerSeats;
      const totalCollabSeats = (tierData.collabSeats > 0 ? tierData.collabSeats : 0) + extraCollabSeats;
      const result = await createCheckout.mutateAsync({
        org_id: org.id,
        plan_type: 'tier',
        tier_name: tierKey!,
        config: {
          term_type: billingTerm,
          owner_seats: totalOwnerSeats,
          collaborative_seats: totalCollabSeats,
          selected_modules: selectedModules,
          use_bundle: false,
        },
      });
      window.location.href = result.checkout_url;
    } catch {
      toast({ title: 'Failed to start checkout', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const toggleModule = (key: string) => {
    setSelectedModules(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    );
  };

  const org = orgs?.[0];
  const isSubmitting = createCheckout.isPending;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">

        {/* Back + Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-gray hover:text-bone-white mb-6 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-bone-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Backlot {tierData.name}
            </h1>
            <p className="text-muted-gray mt-1">{tierData.tagline}</p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1 self-start">
            <button
              onClick={() => setBillingTerm('monthly')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                billingTerm === 'monthly'
                  ? 'bg-accent-yellow text-charcoal-black'
                  : 'text-muted-gray hover:text-bone-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingTerm('annual')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                billingTerm === 'annual'
                  ? 'bg-accent-yellow text-charcoal-black'
                  : 'text-muted-gray hover:text-bone-white'
              }`}
            >
              Annual
              <span className={`text-xs ${billingTerm === 'annual' ? 'text-charcoal-black/70' : 'text-green-400'}`}>
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {billingTerm === 'annual' && (
          <p className="text-sm text-green-400 mb-6 -mt-4">
            Annual billing: pay 10 months, get 12 months of service.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Features + Configurator */}
          <div className="lg:col-span-2 space-y-6">

            {/* Included features */}
            <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
              <h2 className="text-base font-semibold text-bone-white mb-4">Included in this plan</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tierData.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-bone-white/80">
                    <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Extra seats */}
            <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
              <h2 className="text-base font-semibold text-bone-white mb-4">Extra Seats</h2>
              <div className="space-y-4">
                <SeatRow
                  label="Owner Seats"
                  description={`$${ADDON_PRICES.owner_seat}/seat/mo — full project creation rights`}
                  count={extraOwnerSeats}
                  onDecrement={() => setExtraOwnerSeats(n => Math.max(0, n - 1))}
                  onIncrement={() => setExtraOwnerSeats(n => n + 1)}
                />
                <SeatRow
                  label="Collaborative Seats"
                  description={`$${ADDON_PRICES.collaborative_seat}/seat/mo — project collaboration access`}
                  count={extraCollabSeats}
                  onDecrement={() => setExtraCollabSeats(n => Math.max(0, n - 1))}
                  onIncrement={() => setExtraCollabSeats(n => n + 1)}
                />
              </div>
            </div>

            {/* Add-on modules */}
            {Object.keys(availableModules).length > 0 && (
              <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
                <h2 className="text-base font-semibold text-bone-white mb-4">Add Production Tools</h2>
                <div className="space-y-2">
                  {Object.entries(availableModules).map(([key, mod]) => {
                    const checked = selectedModules.includes(key);
                    const displayPrice = billingTerm === 'annual'
                      ? `+$${Math.round(mod.monthly * 10 / 12)}/mo (billed annually)`
                      : `+$${mod.monthly}/mo`;
                    return (
                      <label
                        key={key}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? 'border-accent-yellow/60 bg-accent-yellow/5'
                            : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleModule(key)}
                            className="h-4 w-4 accent-[#FCDC58]"
                          />
                          <span className="text-sm text-bone-white">{mod.name}</span>
                        </div>
                        <span className="text-xs text-accent-yellow font-medium">{displayPrice}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Price summary + CTA */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
              <h2 className="text-base font-semibold text-bone-white mb-4">Price Summary</h2>

              <div className="space-y-2 mb-5">
                <LineItem label={`${tierData.name} base plan`} value={`$${basePrice}/mo`} />
                {extraOwnerSeats > 0 && (
                  <LineItem
                    label={`Extra owner seats (${extraOwnerSeats}×)`}
                    value={`+$${extraOwnerCost}/mo`}
                  />
                )}
                {extraCollabSeats > 0 && (
                  <LineItem
                    label={`Extra collab seats (${extraCollabSeats}×)`}
                    value={`+$${extraCollabCost}/mo`}
                  />
                )}
                {selectedModules.map(key => {
                  const mod = availableModules[key];
                  if (!mod) return null;
                  return (
                    <LineItem key={key} label={mod.name} value={`+$${mod.monthly}/mo`} />
                  );
                })}

                <div className="border-t border-[#2a2a2a] pt-3 mt-3 space-y-1">
                  {billingTerm === 'monthly' ? (
                    <div className="flex justify-between">
                      <span className="text-sm font-semibold text-bone-white">Total</span>
                      <span className="text-lg font-bold text-accent-yellow">${monthlyTotal}/mo</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-gray">Effective monthly</span>
                        <span className="text-sm text-bone-white">${effectiveMonthly}/mo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold text-bone-white">Annual total</span>
                        <span className="text-lg font-bold text-accent-yellow">${annualTotal}</span>
                      </div>
                      <p className="text-xs text-green-400 mt-1">
                        Pay 10 months, get 12 — save ${annualSavings}/yr
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* CTA */}
              {orgsLoading ? (
                <Button className="w-full" disabled>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </Button>
              ) : !org ? (
                <div>
                  <p className="text-xs text-muted-gray text-center mb-3">
                    You need a Backlot organization to subscribe.
                  </p>
                  <Button asChild className="w-full bg-accent-yellow text-charcoal-black hover:bg-yellow-400">
                    <Link to="/organizations">Create Organization</Link>
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full bg-accent-yellow text-charcoal-black hover:bg-yellow-400 font-semibold"
                  onClick={handleSubscribe}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Preparing checkout...
                    </>
                  ) : (
                    'Subscribe Now'
                  )}
                </Button>
              )}

              <div className="mt-4 text-center">
                <Link
                  to="/pricing"
                  className="text-xs text-muted-gray hover:text-bone-white inline-flex items-center gap-1 transition-colors"
                >
                  Compare all plans <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <p className="text-xs text-muted-gray text-center mt-3">
                Cancel anytime · Secure checkout via Stripe
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SeatRow({
  label,
  description,
  count,
  onDecrement,
  onIncrement,
}: {
  label: string;
  description: string;
  count: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-bone-white font-medium">{label}</p>
        <p className="text-xs text-muted-gray">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onDecrement}
          disabled={count === 0}
          className="h-8 w-8 rounded-md border border-[#3a3a3a] bg-[#2a2a2a] text-bone-white flex items-center justify-center hover:bg-[#3a3a3a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-6 text-center text-bone-white text-sm font-medium">{count}</span>
        <button
          onClick={onIncrement}
          className="h-8 w-8 rounded-md border border-[#3a3a3a] bg-[#2a2a2a] text-bone-white flex items-center justify-center hover:bg-[#3a3a3a] transition-colors"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function LineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-gray">{label}</span>
      <span className="text-sm text-bone-white">{value}</span>
    </div>
  );
}
