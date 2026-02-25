import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BacklotConfirmationPage() {
  const [searchParams] = useSearchParams();
  const configId = searchParams.get('config_id');
  const { toast } = useToast();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['subscription-config', configId],
    queryFn: () => api.getSubscriptionConfig(configId!),
    enabled: !!configId,
    retry: 3,
    retryDelay: 1500,
  });

  const handleDownloadReceipt = async () => {
    try {
      const token = api.getToken();
      const baseUrl = (api as any).baseURL || '';
      const response = await fetch(`${baseUrl}/api/v1/subscription-billing/receipt/${configId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backlot-receipt-${configId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Failed to download receipt', description: 'Please try again.', variant: 'destructive' });
    }
  };

  if (!configId) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-bone-white mb-4">No subscription found.</p>
          <Button asChild className="bg-accent-yellow text-charcoal-black hover:bg-yellow-400">
            <Link to="/backlot">Go to Backlot</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-accent-yellow mx-auto mb-4" />
          <p className="text-muted-gray text-sm">Loading your subscription details...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center max-w-sm">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-bone-white mb-2">Payment successful!</h1>
          <p className="text-muted-gray mb-6">
            Your subscription is being activated. Check your email for confirmation.
          </p>
          <Button asChild className="bg-accent-yellow text-charcoal-black hover:bg-yellow-400">
            <Link to="/backlot">Go to Backlot</Link>
          </Button>
        </div>
      </div>
    );
  }

  const tierLabel = (config.tier_name || 'A La Carte')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
  const termLabel = config.annual_prepay ? 'Annual (pay 10, get 12)' : 'Monthly';
  const monthlyTotal = (config.monthly_total_cents ?? 0) / 100;
  const effectiveMonthly = (config.effective_monthly_cents ?? 0) / 100;
  const annualTotal = config.annual_prepay ? Math.round(effectiveMonthly * 12 * 10 / 12 * 12) : null;

  const moduleLines = (config.line_items ?? []).filter((li: any) => li.category === 'modules');

  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-12">

        {/* Success header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-bone-white mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            You're all set!
          </h1>
          <p className="text-lg text-muted-gray">
            Welcome to Backlot {tierLabel}
          </p>
        </div>

        {/* Breakdown card */}
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 mb-6">
          <h2 className="text-base font-semibold text-bone-white mb-4">Subscription Details</h2>
          <div className="space-y-3">
            <ConfirmRow label="Plan" value={`Backlot ${tierLabel}`} />
            <ConfirmRow label="Billing" value={termLabel} />
            <ConfirmRow
              label="Owner Seats"
              value={config.owner_seats === -1 ? 'Unlimited' : String(config.owner_seats ?? 1)}
            />
            <ConfirmRow
              label="Collaborative Seats"
              value={config.collaborative_seats === -1 ? 'Unlimited' : String(config.collaborative_seats ?? 0)}
            />
            <ConfirmRow
              label="Active Projects"
              value={config.active_projects === -1 ? 'Unlimited' : String(config.active_projects ?? 1)}
            />

            {moduleLines.map((li: any, i: number) => (
              <ConfirmRow key={i} label={li.label} value={`$${li.total}/mo`} accent />
            ))}

            <div className="border-t border-[#2a2a2a] pt-3 mt-3 space-y-1.5">
              {config.annual_prepay ? (
                <>
                  <ConfirmRow
                    label="Annual total"
                    value={`$${annualTotal ?? Math.round(monthlyTotal * 10)}`}
                    bold
                  />
                  <ConfirmRow
                    label="Effective monthly"
                    value={`$${effectiveMonthly.toFixed(2)}/mo`}
                  />
                  <p className="text-xs text-green-400">
                    Pay 10 months, get 12 months of service (~17% savings)
                  </p>
                </>
              ) : (
                <ConfirmRow label="Monthly total" value={`$${monthlyTotal.toFixed(2)}/mo`} bold />
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 border-[#2a2a2a] text-bone-white hover:bg-[#1a1a1a]"
            onClick={handleDownloadReceipt}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Receipt
          </Button>
          <Button
            asChild
            className="flex-1 bg-accent-yellow text-charcoal-black hover:bg-yellow-400 font-semibold"
          >
            <Link to="/backlot">
              Go to Backlot <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>

        <p className="text-center text-xs text-muted-gray mt-6">
          A confirmation email has been sent with your subscription details.
        </p>
      </div>
    </div>
  );
}

function ConfirmRow({
  label,
  value,
  bold = false,
  accent = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'font-semibold text-bone-white' : 'text-muted-gray'}`}>
        {label}
      </span>
      <span className={`text-sm ${bold ? 'font-semibold text-accent-yellow' : accent ? 'text-accent-yellow' : 'text-bone-white'}`}>
        {value}
      </span>
    </div>
  );
}
