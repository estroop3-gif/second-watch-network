import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface PriceSummaryProps {
  config: {
    plan_type: 'tier' | 'a_la_carte';
    tier_name?: string;
    term_type: 'monthly' | 'annual';
    computed: {
      monthly_total: number;
      effective_monthly: number;
      annual_total?: number;
      annual_savings?: number;
      line_items: Array<{ label: string; total: number; category?: string }>;
    };
  } | null;
  showCTA?: boolean;
  ctaLabel?: string;
  ctaLoading?: boolean;
  onCTAClick?: () => void;
}

export default function PriceSummary({
  config,
  showCTA = false,
  ctaLabel = 'Subscribe Now',
  ctaLoading = false,
  onCTAClick,
}: PriceSummaryProps) {
  if (!config) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <p className="text-muted-gray text-sm text-center">Configure your plan to see pricing</p>
      </div>
    );
  }

  const { computed, plan_type, tier_name, term_type } = config;
  const { monthly_total, effective_monthly, annual_total, annual_savings, line_items } = computed;

  const planLabel = plan_type === 'tier' && tier_name
    ? `${tier_name.charAt(0).toUpperCase() + tier_name.slice(1)} Plan`
    : 'Custom Plan';

  // Group line items
  const baseItems = line_items.filter(i => i.category === 'base');
  const seatItems = line_items.filter(i => i.category === 'seats');
  const storageItems = line_items.filter(i => i.category === 'storage');
  const moduleItems = line_items.filter(i => i.category === 'modules');
  const discountItems = line_items.filter(i => i.category === 'discount');

  const isFree = tier_name === 'free' && plan_type === 'tier';

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 space-y-5">
      <div>
        <h3 className="text-lg font-bold text-bone-white mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {planLabel}
        </h3>
        <p className="text-xs text-muted-gray">
          {isFree
            ? 'Free forever — no credit card required'
            : term_type === 'annual'
              ? 'Annual billing (pay 10 months for 12)'
              : 'Monthly billing'
          }
        </p>
      </div>

      {/* Line items */}
      {!isFree && (
        <div className="space-y-3">
          {baseItems.length > 0 && (
            <ItemGroup label="Base" items={baseItems} />
          )}
          {seatItems.length > 0 && (
            <ItemGroup label="Seats" items={seatItems} />
          )}
          {storageItems.length > 0 && (
            <ItemGroup label="Storage & Bandwidth" items={storageItems} />
          )}
          {moduleItems.length > 0 && (
            <ItemGroup label="Modules" items={moduleItems} />
          )}
          {discountItems.length > 0 && (
            <ItemGroup label="Discounts" items={discountItems} />
          )}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-[#2a2a2a]" />

      {/* Total */}
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-bone-white/80">
            {isFree ? 'Total' : 'Monthly total'}
          </span>
          <span className="text-2xl font-bold text-accent-yellow" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {isFree ? 'Free' : `$${monthly_total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
          </span>
        </div>

        {!isFree && term_type === 'annual' && annual_total != null && annual_savings != null && (
          <>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-gray">Effective monthly</span>
              <span className="text-sm font-medium text-bone-white">
                ${effective_monthly.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-gray">Annual total (10 payments)</span>
              <span className="text-sm font-medium text-bone-white">
                ${annual_total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="rounded-lg bg-green-900/20 border border-green-800/30 p-2.5 text-center">
              <span className="text-green-400 text-sm font-medium">
                You save ${annual_savings.toLocaleString()}/year
              </span>
            </div>
          </>
        )}
      </div>

      {showCTA && onCTAClick && (
        <Button
          className="w-full bg-accent-yellow text-charcoal-black hover:bg-yellow-400 font-semibold h-11"
          onClick={onCTAClick}
          disabled={ctaLoading}
        >
          {ctaLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</>
          ) : (
            isFree ? 'Start Free' : ctaLabel
          )}
        </Button>
      )}
    </div>
  );
}

function ItemGroup({ label, items }: { label: string; items: Array<{ label: string; total: number }> }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-gray mb-1.5">{label}</p>
      {items.map((item, i) => (
        <div key={i} className="flex justify-between items-center py-0.5">
          <span className="text-xs text-bone-white/70">{item.label}</span>
          <span className={`text-xs font-medium ${item.total < 0 ? 'text-green-400' : 'text-bone-white'}`}>
            {item.total < 0 ? '-' : ''}${Math.abs(item.total).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
