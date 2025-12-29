import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Film,
  Users,
  FileText,
  Calendar,
  DollarSign,
  CheckCircle,
  Loader2,
  Lock,
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

interface BacklotUpgradePromptProps {
  className?: string;
}

const BacklotUpgradePrompt = ({ className }: BacklotUpgradePromptProps) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

  const checkoutMutation = useMutation({
    mutationFn: () => api.createCheckoutSession(selectedPlan, 'backlot', 'backlot_upgrade', '/backlot'),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start checkout');
    },
  });

  return (
    <div className={`min-h-[80vh] flex items-center justify-center p-6 ${className}`}>
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Lock className="h-8 w-8 text-accent-yellow" />
            <h1 className="text-4xl font-heading text-bone-white">Backlot Pro</h1>
          </div>
          <p className="text-lg text-muted-gray max-w-2xl mx-auto">
            Unlock the full power of production management. Get access to all Backlot tools
            and features to run your film productions professionally.
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

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
          {/* Monthly Plan */}
          <Card
            className={`cursor-pointer transition-all ${
              selectedPlan === 'monthly'
                ? 'border-accent-yellow ring-2 ring-accent-yellow/20'
                : 'border-muted-gray/30 hover:border-muted-gray/50'
            }`}
            onClick={() => setSelectedPlan('monthly')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span>Monthly</span>
                {selectedPlan === 'monthly' && (
                  <CheckCircle className="h-5 w-5 text-accent-yellow" />
                )}
              </CardTitle>
              <CardDescription>Pay as you go</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-bone-white">$14.99</span>
                <span className="text-muted-gray">/month</span>
              </div>
            </CardContent>
          </Card>

          {/* Yearly Plan */}
          <Card
            className={`cursor-pointer transition-all relative ${
              selectedPlan === 'yearly'
                ? 'border-accent-yellow ring-2 ring-accent-yellow/20'
                : 'border-muted-gray/30 hover:border-muted-gray/50'
            }`}
            onClick={() => setSelectedPlan('yearly')}
          >
            <Badge
              className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white"
            >
              Save 17%
            </Badge>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span>Yearly</span>
                {selectedPlan === 'yearly' && (
                  <CheckCircle className="h-5 w-5 text-accent-yellow" />
                )}
              </CardTitle>
              <CardDescription>Best value</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-bone-white">$149.99</span>
                <span className="text-muted-gray">/year</span>
              </div>
              <p className="text-xs text-muted-gray mt-1">
                That's $12.50/month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button
            size="lg"
            className="bg-accent-yellow text-charcoal-black hover:bg-yellow-500 px-8"
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
          >
            {checkoutMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Unlock Backlot Pro
              </>
            )}
          </Button>
          <p className="text-sm text-muted-gray mt-4">
            Cancel anytime. No questions asked.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BacklotUpgradePrompt;
