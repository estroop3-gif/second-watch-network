/**
 * OrganizationsWidget
 * Shows organizations where the user has Backlot access
 */

import { Link } from 'react-router-dom';
import { useMyBacklotOrganizations } from '@/hooks/useOrganizations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Building2, Users, FolderKanban, ChevronRight, Crown, Shield, UserCheck } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; className: string }> = {
  owner: { label: 'Owner', icon: Crown, className: 'bg-accent-yellow/20 text-accent-yellow' },
  admin: { label: 'Admin', icon: Shield, className: 'bg-blue-500/20 text-blue-400' },
  collaborative: { label: 'Collaborative', icon: UserCheck, className: 'bg-purple-500/20 text-purple-400' },
};

export function OrganizationsWidget({ className = '' }: SectionProps) {
  const { data: organizations, isLoading, error } = useMyBacklotOrganizations();

  if (isLoading) {
    return <SectionSkeleton className={className} cardCount={1} />;
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl text-bone-white">Organizations</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/organizations">
            Manage
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="text-muted-gray text-sm">Could not load organizations</p>
      ) : !organizations || organizations.length === 0 ? (
        <div className="border border-dashed border-muted-gray/30 rounded-lg p-6 text-center">
          <Building2 className="w-10 h-10 mx-auto text-muted-gray mb-3" />
          <p className="text-muted-gray text-sm">
            Not a member of any organizations with Backlot access
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {organizations.slice(0, 3).map(org => {
            const roleConfig = ROLE_CONFIG[org.role] || ROLE_CONFIG.collaborative;
            const RoleIcon = roleConfig.icon;

            return (
              <Link
                key={org.id}
                to="/organizations"
                className="group block p-4 bg-charcoal-black border border-muted-gray/20 rounded-lg hover:border-accent-yellow/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {org.logo_url ? (
                    <img src={org.logo_url} alt={org.name} className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted-gray/20 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-muted-gray" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading text-bone-white group-hover:text-accent-yellow transition-colors truncate">
                      {org.name}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-gray">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {org.seats_used}/{org.backlot_seat_limit || '∞'} seats
                      </span>
                      <span className="flex items-center gap-1">
                        <FolderKanban className="w-3.5 h-3.5" />
                        {org.projects_count} projects
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className={roleConfig.className}>
                    <RoleIcon className="w-3 h-3 mr-1" />
                    {roleConfig.label}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {organizations && organizations.length > 3 && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/organizations">View All {organizations.length} Organizations</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default OrganizationsWidget;
