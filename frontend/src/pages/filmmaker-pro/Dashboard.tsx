/**
 * Filmmaker Pro Dashboard — Overview with subscription status,
 * quick analytics, and recent invoices.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { BarChart3, FileText, Eye, Search, Calendar, Globe } from 'lucide-react';
import {
  useFilmmakerProStatus,
  useProAnalyticsOverview,
  useInvoices,
} from '@/hooks/useFilmmakerPro';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import ProUpgradePrompt from '@/components/filmmaker-pro/ProUpgradePrompt';

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useEnrichedProfile();
  const { data: subStatus } = useFilmmakerProStatus();
  const { data: analytics } = useProAnalyticsOverview(30);
  const { data: invoiceData } = useInvoices(undefined, 5, 0);

  const isPro = profile?.is_filmmaker_pro || subStatus?.is_pro;

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-heading text-bone-white mb-6">Filmmaker Pro</h1>
        <ProUpgradePrompt />
      </div>
    );
  }

  const stats = [
    { label: 'Profile Views', value: analytics?.views ?? 0, icon: Eye, color: 'text-blue-400' },
    { label: 'Unique Visitors', value: analytics?.unique_viewers ?? 0, icon: BarChart3, color: 'text-green-400' },
    { label: 'Search Appearances', value: analytics?.search_appearances ?? 0, icon: Search, color: 'text-purple-400' },
  ];

  const recentInvoices = invoiceData?.invoices?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-bone-white">Dashboard</h1>
        {subStatus?.status && (
          <Badge className={
            subStatus.status === 'active' ? 'bg-green-600' :
            subStatus.status === 'trialing' ? 'bg-blue-600' :
            'bg-muted-gray'
          }>
            {subStatus.status === 'trialing' ? 'Free Trial' : subStatus.status}
          </Badge>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="bg-charcoal-black border-muted-gray">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-2 rounded-lg bg-muted-gray/20 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bone-white">{s.value}</p>
                <p className="text-xs text-muted-gray">{s.label} (30d)</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'View Analytics', icon: BarChart3, href: '/filmmaker-pro/analytics' },
          { label: 'New Invoice', icon: FileText, href: '/filmmaker-pro/invoices/new' },
          { label: 'Calendar', icon: Calendar, href: '/filmmaker-pro/availability' },
          { label: 'Portfolio', icon: Globe, href: '/filmmaker-pro/portfolio' },
        ].map((a) => (
          <Button
            key={a.label}
            variant="outline"
            className="flex items-center gap-2 h-auto py-3 border-muted-gray text-bone-white hover:bg-muted-gray/30"
            onClick={() => navigate(a.href)}
          >
            <a.icon className="h-4 w-4" />
            {a.label}
          </Button>
        ))}
      </div>

      {/* Recent Invoices */}
      <Card className="bg-charcoal-black border-muted-gray">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-bone-white text-lg">Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/filmmaker-pro/invoices')}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-muted-gray text-sm py-4 text-center">No invoices yet. Create your first invoice to get started.</p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted-gray/20 cursor-pointer transition-colors"
                  onClick={() => navigate(`/filmmaker-pro/invoices/${inv.id}`)}
                >
                  <div>
                    <p className="text-sm text-bone-white font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-gray">{inv.recipient_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-bone-white font-medium">${(inv.total_cents / 100).toFixed(2)}</p>
                    <Badge variant="outline" className={
                      inv.status === 'paid' ? 'border-green-500 text-green-400' :
                      inv.status === 'sent' ? 'border-blue-500 text-blue-400' :
                      inv.status === 'overdue' ? 'border-red-500 text-red-400' :
                      'border-muted-gray text-muted-gray'
                    }>
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
