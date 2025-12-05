import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FilmmakerApplicationsTab from "@/components/admin/FilmmakerApplicationsTab";
import PartnerApplicationsTab from "@/components/admin/PartnerApplicationsTab";

const ApplicationsManagement = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Application Management</h1>
      <Tabs defaultValue="filmmaker" className="w-full">
        <TabsList>
          <TabsTrigger value="filmmaker">Filmmaker Applications</TabsTrigger>
          <TabsTrigger value="partner">Partner Applications</TabsTrigger>
        </TabsList>
        <TabsContent value="filmmaker">
          <FilmmakerApplicationsTab />
        </TabsContent>
        <TabsContent value="partner">
          <PartnerApplicationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApplicationsManagement;