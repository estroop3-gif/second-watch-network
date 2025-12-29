import React from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building, Briefcase, BarChart3, FileText, Crown } from 'lucide-react';

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

const OrderManagement = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl md:text-5xl font-heading tracking-tighter">
          The <span className="text-accent-yellow">Order</span>
        </h1>
        <p className="text-muted-gray mt-1">Manage Second Watch Order members, lodges, and applications</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-8 w-8 text-accent-yellow" />} title="Members" value={0} delay={0} />
        <StatCard icon={<Building className="h-8 w-8 text-accent-yellow" />} title="Lodges" value={0} delay={1} />
        <StatCard icon={<FileText className="h-8 w-8 text-accent-yellow" />} title="Applications" value={0} delay={2} />
        <StatCard icon={<Briefcase className="h-8 w-8 text-accent-yellow" />} title="Active Jobs" value={0} delay={3} />
      </div>

      <Tabs defaultValue="applications" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-charcoal-black border border-muted-gray">
          <TabsTrigger value="applications" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Applications</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="lodges" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Lodges</span>
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Jobs</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent-yellow" />
                Order Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Crown className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Order membership applications will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">Pending applications require review and approval</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Users className="h-5 w-5 text-accent-yellow" />
                Order Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Active Order members management will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">View dues status, membership tier, and activity</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lodges" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Building className="h-5 w-5 text-accent-yellow" />
                Lodges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Building className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Lodge management will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">Create and manage local Order chapters</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-accent-yellow" />
                Job Postings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Briefcase className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Job posting moderation will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">Review and moderate Order job board listings</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-accent-yellow" />
                Order Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Order metrics and analytics will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">Member growth, dues revenue, and engagement</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrderManagement;
