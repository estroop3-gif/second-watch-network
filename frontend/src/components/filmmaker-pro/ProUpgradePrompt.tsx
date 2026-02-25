/**
 * ProUpgradePrompt — CTA card shown to non-Pro filmmakers on gated pages.
 * Displays feature highlights and upgrade button.
 */
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, BarChart3, FileText, Calendar, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProUpgradePromptProps {
  feature?: string;
  compact?: boolean;
}

const FEATURES = [
  { icon: BarChart3, label: 'Profile Analytics', desc: 'See who views your profile' },
  { icon: FileText, label: 'Standalone Invoicing', desc: 'Create and send professional invoices' },
  { icon: Calendar, label: 'Advanced Calendar', desc: 'Rich availability with shareable link' },
  { icon: Globe, label: 'Portfolio Site', desc: 'Build your personal filmmaker website' },
];

const ProUpgradePrompt = ({ feature, compact = false }: ProUpgradePromptProps) => {
  const navigate = useNavigate();

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <Sparkles className="h-5 w-5 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-bone-white font-medium">
            {feature ? `${feature} requires Filmmaker Pro` : 'Upgrade to Filmmaker Pro'}
          </p>
          <p className="text-xs text-muted-gray mt-0.5">$10/month — 14-day free trial</p>
        </div>
        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-charcoal-black shrink-0"
          onClick={() => navigate('/filmmaker-pro/settings')}
        >
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <Card className="bg-charcoal-black border-amber-500/30">
      <CardContent className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-4">
          <Sparkles className="h-8 w-8 text-amber-400" />
        </div>
        <h3 className="text-2xl font-heading text-bone-white mb-2">Filmmaker Pro</h3>
        <p className="text-muted-gray mb-6 max-w-md mx-auto">
          Unlock professional tools to grow your career.
          {feature && <> This feature requires an active Pro subscription.</>}
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8 max-w-lg mx-auto">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex items-start gap-2 text-left">
              <f.icon className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-bone-white font-medium">{f.label}</p>
                <p className="text-xs text-muted-gray">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-charcoal-black font-bold px-8"
            onClick={() => navigate('/filmmaker-pro/settings')}
          >
            Start 14-Day Free Trial
          </Button>
          <p className="text-xs text-muted-gray">$10/month or $100/year</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProUpgradePrompt;
