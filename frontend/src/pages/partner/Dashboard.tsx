import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const PartnerDashboard = () => {
  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-12 -rotate-1">
        Partner <span className="font-spray text-accent-yellow">Dashboard</span>
      </h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-muted-gray/10 border-muted-gray/20">
          <CardHeader>
            <CardTitle>Active Campaigns</CardTitle>
            <CardDescription>Your sponsored content performance.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">5</p>
          </CardContent>
        </Card>
        <Card className="bg-muted-gray/10 border-muted-gray/20">
          <CardHeader>
            <CardTitle>Total Views</CardTitle>
            <CardDescription>Across all sponsored productions.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">1.2M</p>
          </CardContent>
        </Card>
        <Card className="bg-muted-gray/10 border-muted-gray/20">
          <CardHeader>
            <CardTitle>Next Payout</CardTitle>
            <CardDescription>Scheduled for next month.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">$5,430</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PartnerDashboard;