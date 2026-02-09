import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Mail, MessageSquare, Users, Monitor, MoreHorizontal, BarChart3 } from 'lucide-react';
import { useCRMAdminInteractions, useCRMReps } from '@/hooks/crm';

const Reports = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [repId, setRepId] = useState('all');

  const { data: repsData } = useCRMReps();
  const { data, isLoading } = useCRMAdminInteractions({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    rep_id: repId !== 'all' ? repId : undefined,
  });

  const reps = repsData?.reps || [];
  const byRep = data?.by_rep || [];
  const teamTotals = data?.team_totals || {};

  const STAT_ITEMS = [
    { key: 'total_calls', label: 'Calls', icon: Phone },
    { key: 'total_emails', label: 'Emails', icon: Mail },
    { key: 'total_texts', label: 'Texts', icon: MessageSquare },
    { key: 'total_meetings', label: 'Meetings', icon: Users },
    { key: 'total_demos', label: 'Demos', icon: Monitor },
    { key: 'total_other', label: 'Other', icon: MoreHorizontal },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-accent-yellow" />
        <h1 className="text-3xl font-heading text-bone-white">Interaction Reports</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-muted-gray">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-charcoal-black border-muted-gray w-[160px]"
          />
        </div>
        <div>
          <label className="text-xs text-muted-gray">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-charcoal-black border-muted-gray w-[160px]"
          />
        </div>
        <div>
          <label className="text-xs text-muted-gray">Rep</label>
          <Select value={repId} onValueChange={setRepId}>
            <SelectTrigger className="w-[200px] bg-charcoal-black border-muted-gray">
              <SelectValue placeholder="All reps" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reps</SelectItem>
              {reps.map((r: any) => (
                <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Team Totals */}
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-bone-white text-base">Team Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
            {STAT_ITEMS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="text-center p-3 rounded-lg bg-muted-gray/10">
                <Icon className="h-5 w-5 text-accent-yellow mx-auto mb-1" />
                <div className="text-2xl font-bold text-bone-white">{teamTotals[key] || 0}</div>
                <div className="text-xs text-muted-gray">{label}</div>
              </div>
            ))}
            <div className="text-center p-3 rounded-lg bg-accent-yellow/10 border border-accent-yellow/20">
              <BarChart3 className="h-5 w-5 text-accent-yellow mx-auto mb-1" />
              <div className="text-2xl font-bold text-accent-yellow">{teamTotals.grand_total || 0}</div>
              <div className="text-xs text-accent-yellow">Total</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Rep Breakdown */}
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-bone-white text-base">Per-Rep Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {byRep.length === 0 ? (
            <p className="text-muted-gray text-sm text-center py-4">No data for selected period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted-gray/20">
                    <th className="text-left py-2 text-muted-gray font-medium">Rep</th>
                    <th className="text-center py-2 text-muted-gray font-medium">Calls</th>
                    <th className="text-center py-2 text-muted-gray font-medium">Emails</th>
                    <th className="text-center py-2 text-muted-gray font-medium">Texts</th>
                    <th className="text-center py-2 text-muted-gray font-medium">Meetings</th>
                    <th className="text-center py-2 text-muted-gray font-medium">Demos</th>
                    <th className="text-center py-2 text-muted-gray font-medium">Other</th>
                    <th className="text-center py-2 text-accent-yellow font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byRep.map((row: any) => (
                    <tr key={row.rep_id} className="border-b border-muted-gray/10">
                      <td className="py-2 text-bone-white">{row.rep_name}</td>
                      <td className="py-2 text-center text-bone-white/80">{row.total_calls || 0}</td>
                      <td className="py-2 text-center text-bone-white/80">{row.total_emails || 0}</td>
                      <td className="py-2 text-center text-bone-white/80">{row.total_texts || 0}</td>
                      <td className="py-2 text-center text-bone-white/80">{row.total_meetings || 0}</td>
                      <td className="py-2 text-center text-bone-white/80">{row.total_demos || 0}</td>
                      <td className="py-2 text-center text-bone-white/80">{row.total_other || 0}</td>
                      <td className="py-2 text-center font-semibold text-accent-yellow">{row.grand_total || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
