/**
 * RentalSummaryCard Component
 *
 * Displays a 4-card grid summarizing rental gear for a backlot project:
 * - Active Rentals count
 * - Total Costs (daily/weekly/monthly)
 * - Upcoming Pickups
 * - Pending Returns
 */
import { Card } from '@/components/ui/card';
import { DollarSign, Package, Calendar, AlertTriangle } from 'lucide-react';
import { BacklotRentalSummary } from '@/types/backlot';

interface RentalSummaryCardProps {
  summary: BacklotRentalSummary;
}

export function RentalSummaryCard({ summary }: RentalSummaryCardProps) {
  const hasOverdueReturns = summary.pending_returns.some(r => r.is_overdue);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Active Rentals */}
      <Card className="p-4 bg-charcoal-black border-muted-gray hover:border-primary-red/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-500/10">
            <Package className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-sm text-muted-gray">Active Rentals</p>
            <p className="text-2xl font-bold text-bone-white">
              {summary.active_rentals_count}
            </p>
          </div>
        </div>
      </Card>

      {/* Total Cost */}
      <Card className="p-4 bg-charcoal-black border-muted-gray hover:border-primary-red/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-accent-yellow/10">
            <DollarSign className="w-6 h-6 text-accent-yellow" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-gray">Total Cost</p>
            <p className="text-2xl font-bold text-bone-white">
              ${summary.total_daily_cost.toLocaleString()}<span className="text-sm text-muted-gray">/day</span>
            </p>
            <p className="text-xs text-muted-gray mt-1">
              ${summary.total_weekly_cost.toLocaleString()}/wk · ${summary.total_monthly_cost.toLocaleString()}/mo
            </p>
          </div>
        </div>
      </Card>

      {/* Upcoming Pickups */}
      <Card className="p-4 bg-charcoal-black border-muted-gray hover:border-primary-red/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-green-500/10">
            <Calendar className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-sm text-muted-gray">Upcoming Pickups</p>
            <p className="text-2xl font-bold text-bone-white">
              {summary.upcoming_pickups.length}
            </p>
            {summary.upcoming_pickups[0] && (
              <p className="text-xs text-muted-gray mt-1">
                Next in {summary.upcoming_pickups[0].days_until} day{summary.upcoming_pickups[0].days_until !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Pending Returns */}
      <Card className={`p-4 bg-charcoal-black border-muted-gray hover:border-primary-red/50 transition-colors ${hasOverdueReturns ? 'border-red-500' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${hasOverdueReturns ? 'bg-red-500/10' : 'bg-orange-500/10'}`}>
            <AlertTriangle className={`w-6 h-6 ${hasOverdueReturns ? 'text-red-500' : 'text-orange-500'}`} />
          </div>
          <div>
            <p className="text-sm text-muted-gray">Pending Returns</p>
            <p className="text-2xl font-bold text-bone-white">
              {summary.pending_returns.length}
            </p>
            {hasOverdueReturns && (
              <p className="text-xs text-red-500 mt-1 font-semibold">
                {summary.pending_returns.filter(r => r.is_overdue).length} overdue
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
