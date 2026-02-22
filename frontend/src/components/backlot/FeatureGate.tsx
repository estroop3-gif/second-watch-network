import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Lock, ArrowUpRight } from 'lucide-react';

/**
 * Feature gate wrapper — shows upgrade prompt if the feature is locked for the org's plan.
 *
 * Usage:
 *   <FeatureGate feature="BUDGETING" hasAccess={featureAccess.BUDGETING}>
 *     <BudgetingTab />
 *   </FeatureGate>
 *
 * Or with inline mode (shows a banner instead of replacing content):
 *   <FeatureGate feature="DAILIES" hasAccess={false} inline>
 *     <DailiesContent />
 *   </FeatureGate>
 */

interface FeatureGateProps {
  feature: string;
  hasAccess: boolean;
  children: ReactNode;
  inline?: boolean;
  upgradeMessage?: string;
  minTier?: string;
  moduleName?: string;
}

const FEATURE_LABELS: Record<string, { label: string; description: string }> = {
  BUDGETING: { label: 'Budgeting & Top Sheets', description: 'Create and manage production budgets with detailed top sheets.' },
  EXPENSES: { label: 'Expense Tracking', description: 'Track expenses, receipts, and reimbursements.' },
  PO_INVOICING: { label: 'Purchase Orders & Invoicing', description: 'Create POs and manage vendor invoices.' },
  TIMECARDS: { label: 'Timecards & Payroll', description: 'Track crew hours and manage payroll.' },
  DAILIES: { label: 'Dailies & Transcoding', description: 'Upload, transcode, and review dailies.' },
  CONTINUITY: { label: 'Continuity Tools', description: 'Script supervision, continuity notes, and photos.' },
  DOC_SIGNING: { label: 'Document Signing & Clearances', description: 'Digital document signing and clearance tracking.' },
  CUSTOM_BRANDING: { label: 'Custom Branding', description: 'Add your logo and brand colors to exports.' },
  SCHEDULING: { label: 'Scheduling', description: 'Production scheduling and stripboard tools.' },
  CALL_SHEETS: { label: 'Call Sheets', description: 'Create and distribute call sheets.' },
  SHOT_LISTS: { label: 'Shot Lists & Storyboards', description: 'Plan your shots and create storyboards.' },
  CASTING: { label: 'Casting & Auditions', description: 'Manage casting calls, submissions, and auditions.' },
  API_ACCESS: { label: 'API Access', description: 'Programmatic access to your Backlot data.' },
  SSO: { label: 'SSO / SAML', description: 'Single sign-on for enterprise security.' },
};

const TIER_DISPLAY: Record<string, string> = {
  indie: 'Indie ($69/mo)',
  pro: 'Pro ($149/mo)',
  business: 'Business ($349/mo)',
  enterprise: 'Enterprise ($799/mo)',
};

export default function FeatureGate({
  feature,
  hasAccess,
  children,
  inline = false,
  upgradeMessage,
  minTier,
  moduleName,
}: FeatureGateProps) {
  const navigate = useNavigate();

  if (hasAccess) {
    return <>{children}</>;
  }

  const featureInfo = FEATURE_LABELS[feature] || { label: feature, description: '' };
  const tierDisplay = minTier ? TIER_DISPLAY[minTier] || minTier : null;

  const message = upgradeMessage || (
    moduleName
      ? `Add the ${moduleName} module or upgrade to a plan where it's included.`
      : tierDisplay
        ? `Upgrade to ${tierDisplay} or higher to unlock ${featureInfo.label}.`
        : `Upgrade your plan to unlock ${featureInfo.label}.`
  );

  if (inline) {
    return (
      <div>
        <div className="rounded-lg border border-accent-yellow/20 bg-accent-yellow/5 p-4 mb-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-accent-yellow mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-bone-white">{featureInfo.label}</p>
            <p className="text-xs text-muted-gray mt-0.5">{message}</p>
            <Button
              size="sm"
              className="mt-2 bg-accent-yellow text-charcoal-black hover:bg-yellow-400 text-xs h-7"
              onClick={() => navigate('/pricing')}
            >
              View Plans <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
        <div className="opacity-30 pointer-events-none select-none">
          {children}
        </div>
      </div>
    );
  }

  // Full replacement mode
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
      <div className="rounded-full bg-accent-yellow/10 p-4 mb-4">
        <Lock className="h-8 w-8 text-accent-yellow" />
      </div>
      <h3 className="text-xl font-bold text-bone-white mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        {featureInfo.label}
      </h3>
      <p className="text-sm text-muted-gray max-w-md mb-2">
        {featureInfo.description}
      </p>
      <p className="text-sm text-bone-white/70 max-w-md mb-6">
        {message}
      </p>
      <div className="flex gap-3">
        <Button
          className="bg-accent-yellow text-charcoal-black hover:bg-yellow-400 font-semibold"
          onClick={() => navigate('/pricing')}
        >
          View Plans <ArrowUpRight className="h-4 w-4 ml-1" />
        </Button>
        <Button
          variant="outline"
          className="border-[#2a2a2a] text-bone-white hover:bg-[#1a1a1a]"
          onClick={() => navigate('/organizations?action=subscribe')}
        >
          Manage Subscription
        </Button>
      </div>
    </div>
  );
}
