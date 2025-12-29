import React from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clapperboard, FileText, Shield, Activity, Eye, DollarSign, Users, Calendar } from 'lucide-react';

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

const BacklotOversight = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-4xl md:text-5xl font-heading tracking-tighter">
            Backlot <span className="text-accent-yellow">Oversight</span>
          </h1>
          <p className="text-muted-gray mt-1">Read-only monitoring of all productions</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-900/30 border border-blue-600 rounded">
          <Eye className="h-4 w-4 text-blue-400" />
          <span className="text-sm text-blue-400">View Only</span>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Clapperboard className="h-8 w-8 text-accent-yellow" />} title="Projects" value={0} delay={0} />
        <StatCard icon={<FileText className="h-8 w-8 text-accent-yellow" />} title="Invoices" value={0} delay={1} />
        <StatCard icon={<Shield className="h-8 w-8 text-accent-yellow" />} title="Clearances" value={0} delay={2} />
        <StatCard icon={<Users className="h-8 w-8 text-accent-yellow" />} title="Active Crew" value={0} delay={3} />
      </div>

      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-charcoal-black border border-muted-gray">
          <TabsTrigger value="projects" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Clapperboard className="h-4 w-4" />
            <span className="hidden sm:inline">Projects</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Invoices</span>
          </TabsTrigger>
          <TabsTrigger value="clearances" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Clearances</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-accent-yellow" />
                All Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Clapperboard className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Production projects oversight will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">View all projects with status, owner, and dates</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-accent-yellow" />
                Invoices Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Invoices across all projects will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">Monitor pending approvals and payment status</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clearances" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent-yellow" />
                Clearances Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Shield className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Legal clearances monitoring will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">Track compliance and expiring clearances</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent-yellow" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto text-muted-gray mb-4" />
                <p className="text-muted-gray">Project activity log will be displayed here</p>
                <p className="text-sm text-muted-gray/70 mt-1">Recent changes and updates across all projects</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BacklotOversight;
