import React from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Receipt, RefreshCcw, Tag, DollarSign, Users, TrendingUp, AlertCircle } from 'lucide-react';

const StatCard = ({ icon, title, value, subtitle, delay }: { icon: React.ReactNode, title: string, value: string | number, subtitle?: string, delay: number }) => (
  <motion.div
    className="bg-charcoal-black border-2 border-muted-gray p-4 text-center transform hover:scale-105 transition-transform"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1 }}
  >
    <div className="flex justify-center mb-2">{icon}</div>
    <h3 className="text-2xl font-heading text-accent-yellow">{value}</h3>
    <p className="text-muted-gray text-xs uppercase tracking-wide">{title}</p>
    {subtitle && <p className="text-xs text-muted-gray/60 mt-1">{subtitle}</p>}
  </motion.div>
);

const Billing = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl md:text-5xl font-heading tracking-tighter">
          Billing <span className="text-accent-yellow">Management</span>
        </h1>
        <p className="text-muted-gray mt-1">Manage subscriptions, transactions, and refunds via Stripe</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-8 w-8 text-accent-yellow" />} title="Subscribers" value={0} delay={0} />
        <StatCard icon={<DollarSign className="h-8 w-8 text-accent-yellow" />} title="MRR" value="$0" delay={1} />
        <StatCard icon={<TrendingUp className="h-8 w-8 text-accent-yellow" />} title="Growth" value="0%" delay={2} />
        <StatCard icon={<AlertCircle className="h-8 w-8 text-accent-yellow" />} title="Past Due" value={0} delay={3} />
      </div>

      <Tabs defaultValue="subscriptions" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-charcoal-black border border-muted-gray">
          <TabsTrigger value="subscriptions" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Subscriptions</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Transactions</span>
          </TabsTrigger>
          <TabsTrigger value="refunds" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Refunds</span>
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Plans</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-accent-yellow" />
                Active Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Subscription management will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">View active, cancelled, and past due subscriptions</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Receipt className="h-5 w-5 text-accent-yellow" />
                Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Payment transactions will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">All charges, payments, and failed transactions</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refunds" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <RefreshCcw className="h-5 w-5 text-accent-yellow" />
                Refunds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <RefreshCcw className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Refund processing will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">Issue refunds and credits to customers</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Tag className="h-5 w-5 text-accent-yellow" />
                Subscription Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Tag className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Plan configuration will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">View and configure subscription tiers</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Billing;
