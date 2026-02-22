/**
 * Admin Billing Dashboard — Subscriptions, Transactions, Stats
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import {
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Users,
  Receipt,
  Loader2,
  TestTube,
  DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BillingStats {
  total_subscribers: number;
  mrr_cents: number;
  past_due_count: number;
  active_trials: number;
}

interface Subscription {
  id: string;
  product: string;
  name: string;
  tier: string;
  status: string;
  amount_cents: number | null;
  interval: string;
  past_due_since: string | null;
  created_at: string | null;
}

interface Transaction {
  id: string;
  type: string;
  description: string;
  status: string;
  amount_cents: number | null;
  created_at: string | null;
}

const PRODUCT_LABELS: Record<string, string> = {
  backlot_org: 'Backlot',
  premium: 'Premium',
  order_dues: 'Order',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  past_due: 'bg-red-500/20 text-red-400 border-red-500/30',
  canceled: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
  trialing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  succeeded: 'bg-green-500/20 text-green-400 border-green-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const Billing = () => {
  const [subFilter, setSubFilter] = useState<string>('');
  const [productFilter, setProductFilter] = useState<string>('');

  const { data: stats, isLoading: statsLoading } = useQuery<BillingStats>({
    queryKey: ['admin-billing-stats'],
    queryFn: () => api.get('/api/v1/admin/billing/stats'),
  });

  const { data: subsData, isLoading: subsLoading } = useQuery<{ subscriptions: Subscription[] }>({
    queryKey: ['admin-billing-subs', subFilter, productFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (subFilter) params.append('status', subFilter);
      if (productFilter) params.append('product', productFilter);
      return api.get(`/api/v1/admin/billing/subscriptions?${params}`);
    },
  });

  const { data: txData, isLoading: txLoading } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ['admin-billing-transactions'],
    queryFn: () => api.get('/api/v1/admin/billing/transactions'),
  });

  const mrr = stats ? (stats.mrr_cents / 100).toFixed(0) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl md:text-5xl font-heading tracking-tighter">
          Billing <span className="text-accent-yellow">Management</span>
        </h1>
        <p className="text-muted-gray mt-1">Stripe subscription overview and billing events</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, title: 'Subscribers', value: statsLoading ? '...' : String(stats?.total_subscribers || 0) },
          { icon: DollarSign, title: 'MRR', value: statsLoading ? '...' : `$${mrr}`, subtitle: 'Monthly recurring' },
          { icon: AlertTriangle, title: 'Past Due', value: statsLoading ? '...' : String(stats?.past_due_count || 0) },
          { icon: TestTube, title: 'Active Trials', value: statsLoading ? '...' : String(stats?.active_trials || 0) },
        ].map((s, i) => (
          <motion.div
            key={s.title}
            className="bg-charcoal-black border-2 border-muted-gray p-4 text-center transform hover:scale-105 transition-transform"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex justify-center mb-2"><s.icon className="h-8 w-8 text-accent-yellow" /></div>
            <h3 className="text-2xl font-heading text-accent-yellow">{s.value}</h3>
            <p className="text-muted-gray text-xs uppercase tracking-wide">{s.title}</p>
            {s.subtitle && <p className="text-xs text-muted-gray/60 mt-1">{s.subtitle}</p>}
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="subscriptions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-charcoal-black border border-muted-gray">
          <TabsTrigger value="subscriptions" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Subscriptions</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Transactions</span>
          </TabsTrigger>
        </TabsList>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-bone-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-accent-yellow" />
                  Active Subscriptions
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {['', 'active', 'past_due', 'canceled'].map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className={`cursor-pointer ${
                        subFilter === s ? 'bg-accent-yellow/20 border-accent-yellow text-accent-yellow' : 'border-muted-gray text-muted-gray'
                      }`}
                      onClick={() => setSubFilter(s)}
                    >
                      {s || 'All'}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap mt-2">
                {['', 'backlot_org', 'premium', 'order_dues'].map((p) => (
                  <Badge
                    key={p}
                    variant="outline"
                    className={`cursor-pointer text-xs ${
                      productFilter === p ? 'bg-accent-yellow/20 border-accent-yellow text-accent-yellow' : 'border-muted-gray text-muted-gray'
                    }`}
                    onClick={() => setProductFilter(p)}
                  >
                    {p ? PRODUCT_LABELS[p] || p : 'All Products'}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {subsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-accent-yellow" />
                </div>
              ) : !subsData?.subscriptions?.length ? (
                <div className="text-center py-12">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                  <p className="text-muted-gray">No subscriptions found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {subsData.subscriptions.map((sub) => (
                    <div
                      key={`${sub.product}-${sub.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-muted-gray/30 hover:border-muted-gray/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant="outline" className="text-xs border-muted-gray whitespace-nowrap">
                          {PRODUCT_LABELS[sub.product] || sub.product}
                        </Badge>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate text-bone-white">{sub.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-gray">{sub.tier}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {sub.amount_cents != null && (
                          <span className="text-sm font-medium text-bone-white">
                            ${(sub.amount_cents / 100).toFixed(0)}/{sub.interval === 'year' ? 'yr' : 'mo'}
                          </span>
                        )}
                        <Badge className={STATUS_COLORS[sub.status] || 'border-muted-gray'}>
                          {sub.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Receipt className="h-5 w-5 text-accent-yellow" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {txLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-accent-yellow" />
                </div>
              ) : !txData?.transactions?.length ? (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                  <p className="text-muted-gray">No transactions found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {txData.transactions.map((tx) => (
                    <div
                      key={`${tx.type}-${tx.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-muted-gray/30 hover:border-muted-gray/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate text-bone-white">{tx.description}</p>
                        <p className="text-xs text-muted-gray">
                          {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {tx.amount_cents != null && tx.amount_cents > 0 && (
                          <span className="text-sm font-medium text-green-400">
                            +${(tx.amount_cents / 100).toFixed(2)}
                          </span>
                        )}
                        <Badge className={STATUS_COLORS[tx.status] || 'border-muted-gray'}>
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Billing;
