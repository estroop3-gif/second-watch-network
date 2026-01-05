/**
 * OrderDashboardSection
 * Overview for Order members
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Shield, Users, Briefcase, Building, ChevronRight } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

export function OrderDashboardSection({ className = '' }: SectionProps) {
  // In a real implementation, this would fetch Order-specific data
  // For now, we'll show a static quick access panel

  return (
    <div className={`p-4 bg-charcoal-black border border-accent-yellow/30 rounded-lg ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-accent-yellow" />
        <h3 className="font-heading text-bone-white">The Order</h3>
        <Badge variant="outline" className="bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30 text-xs">
          Member
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/order/directory"
          className="flex items-center gap-3 p-3 bg-muted-gray/10 rounded-lg hover:bg-muted-gray/20 transition-colors group"
        >
          <Users className="w-5 h-5 text-muted-gray group-hover:text-accent-yellow transition-colors" />
          <div>
            <span className="text-bone-white text-sm font-medium block">Directory</span>
            <span className="text-muted-gray text-xs">Find members</span>
          </div>
        </Link>

        <Link
          to="/order/jobs"
          className="flex items-center gap-3 p-3 bg-muted-gray/10 rounded-lg hover:bg-muted-gray/20 transition-colors group"
        >
          <Briefcase className="w-5 h-5 text-muted-gray group-hover:text-accent-yellow transition-colors" />
          <div>
            <span className="text-bone-white text-sm font-medium block">Jobs</span>
            <span className="text-muted-gray text-xs">Open positions</span>
          </div>
        </Link>

        <Link
          to="/order/lodge"
          className="flex items-center gap-3 p-3 bg-muted-gray/10 rounded-lg hover:bg-muted-gray/20 transition-colors group"
        >
          <Building className="w-5 h-5 text-muted-gray group-hover:text-accent-yellow transition-colors" />
          <div>
            <span className="text-bone-white text-sm font-medium block">Lodge</span>
            <span className="text-muted-gray text-xs">Your chapter</span>
          </div>
        </Link>

        <Link
          to="/order"
          className="flex items-center gap-3 p-3 bg-muted-gray/10 rounded-lg hover:bg-muted-gray/20 transition-colors group"
        >
          <ChevronRight className="w-5 h-5 text-muted-gray group-hover:text-accent-yellow transition-colors" />
          <div>
            <span className="text-bone-white text-sm font-medium block">More</span>
            <span className="text-muted-gray text-xs">Full portal</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default OrderDashboardSection;
