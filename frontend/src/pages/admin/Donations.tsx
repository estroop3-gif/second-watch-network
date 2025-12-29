import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, TrendingUp, Users, Target, DollarSign, Calendar, Gift } from 'lucide-react';

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

const Donations = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl md:text-5xl font-heading tracking-tighter">
          <span className="text-accent-yellow">Donations</span>
        </h1>
        <p className="text-muted-gray mt-1">Track platform donations and fundraising via Donorbox</p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp className="h-8 w-8 text-accent-yellow" />}
          title="This Month"
          value="$0.00"
          delay={0}
        />
        <StatCard
          icon={<DollarSign className="h-8 w-8 text-accent-yellow" />}
          title="All Time"
          value="$0.00"
          delay={1}
        />
        <StatCard
          icon={<Users className="h-8 w-8 text-accent-yellow" />}
          title="Total Donors"
          value={0}
          delay={2}
        />
        <StatCard
          icon={<Target className="h-8 w-8 text-accent-yellow" />}
          title="Goal Progress"
          value="0%"
          delay={3}
        />
      </div>

      {/* Recent Donations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-charcoal-black border-2 border-muted-gray">
          <CardHeader>
            <CardTitle className="text-bone-white flex items-center gap-2">
              <Gift className="h-5 w-5 text-accent-yellow" />
              Recent Donations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Heart className="h-12 w-12 mx-auto text-muted-gray mb-4" />
              <p className="text-muted-gray">No donations recorded yet</p>
              <p className="text-sm text-muted-gray/70 mt-1">
                Donations from Donorbox will appear here
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Donors */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-charcoal-black border-2 border-muted-gray">
          <CardHeader>
            <CardTitle className="text-bone-white flex items-center gap-2">
              <Users className="h-5 w-5 text-accent-yellow" />
              Top Donors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Users className="h-10 w-10 mx-auto text-muted-gray mb-3" />
              <p className="text-muted-gray">No donor data available</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Monthly Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="bg-charcoal-black border-2 border-muted-gray">
          <CardHeader>
            <CardTitle className="text-bone-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent-yellow" />
              Monthly Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <TrendingUp className="h-10 w-10 mx-auto text-muted-gray mb-3" />
              <p className="text-muted-gray">Monthly donation trends will be displayed here</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Donations;
