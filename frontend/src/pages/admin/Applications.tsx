import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Filmmaker applications hidden for now - can be re-enabled later
// import FilmmakerApplicationsTab from "@/components/admin/FilmmakerApplicationsTab";
import PartnerApplicationsTab from "@/components/admin/PartnerApplicationsTab";
import OrderApplicationsTab from "@/components/admin/OrderApplicationsTab";

const ApplicationsManagement = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Application Management</h1>
      <Tabs defaultValue="order" className="w-full">
        <TabsList>
          <TabsTrigger value="order">Order Applications</TabsTrigger>
          <TabsTrigger value="partner">Partner Applications</TabsTrigger>
        </TabsList>
        <TabsContent value="order">
          <OrderApplicationsTab />
        </TabsContent>
        <TabsContent value="partner">
          <PartnerApplicationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApplicationsManagement;
