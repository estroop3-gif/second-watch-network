import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, ArrowRightLeft, Briefcase } from 'lucide-react';
import LeadQueue from './LeadQueue';
import LeadManagement from './LeadManagement';
import DealLeads from './DealLeads';

const AdminLeads = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-heading text-accent-yellow">Lead Management</h1>

      <Tabs defaultValue="queue">
        <TabsList className="bg-muted-gray/10">
          <TabsTrigger value="queue" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Lead Queue
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" /> Lead Management
          </TabsTrigger>
          <TabsTrigger value="deals" className="flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> Deal Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          <LeadQueue />
        </TabsContent>
        <TabsContent value="management" className="mt-4">
          <LeadManagement />
        </TabsContent>
        <TabsContent value="deals" className="mt-4">
          <DealLeads />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminLeads;
