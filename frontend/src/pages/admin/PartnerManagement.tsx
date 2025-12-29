import React from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Handshake, Megaphone, Layout, BarChart3, Building2, DollarSign, TrendingUp, Eye } from 'lucide-react';

const StatCard = ({ icon, title, value, delay }: { icon: React.ReactNode, title: string, value: string | number, delay: number }) => (
  <motion.div
    className="bg-charcoal-black border-2 border-muted-gray p-4 text-center transform hover:scale-105 transition-transform"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1 }}
  >
    <div className="flex justify-center mb-2">{icon}</div>
    <h3 className="text-2xl font-heading text-accent-yellow">{value}</h3>
    <p className="text-muted-gray text-xs uppercase tracking-wide">{title}</p>
  </motion.div>
);

const PartnerManagement = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl md:text-5xl font-heading tracking-tighter">
          Partner <span className="text-accent-yellow">Management</span>
        </h1>
        <p className="text-muted-gray mt-1">Manage partners, campaigns, and ad placements</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Building2 className="h-8 w-8 text-accent-yellow" />} title="Partners" value={0} delay={0} />
        <StatCard icon={<Megaphone className="h-8 w-8 text-accent-yellow" />} title="Campaigns" value={0} delay={1} />
        <StatCard icon={<Eye className="h-8 w-8 text-accent-yellow" />} title="Impressions" value="0" delay={2} />
        <StatCard icon={<DollarSign className="h-8 w-8 text-accent-yellow" />} title="Revenue" value="$0" delay={3} />
      </div>

      <Tabs defaultValue="partners" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-charcoal-black border border-muted-gray">
          <TabsTrigger value="partners" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Handshake className="h-4 w-4" />
            <span className="hidden sm:inline">Partners</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">Campaigns</span>
          </TabsTrigger>
          <TabsTrigger value="placements" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Layout className="h-4 w-4" />
            <span className="hidden sm:inline">Placements</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partners" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Handshake className="h-5 w-5 text-accent-yellow" />
                Active Partners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Handshake className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Partner organizations management will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">View and manage active partner relationships</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-accent-yellow" />
                Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Megaphone className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Promotion campaigns will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">Active and scheduled promotional campaigns</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="placements" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Layout className="h-5 w-5 text-accent-yellow" />
                Ad Placements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Layout className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Ad placement configuration will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">Manage where partner content appears</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-accent-yellow" />
                Partner Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Partner performance metrics will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">Impressions, clicks, and ROI tracking</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PartnerManagement;
