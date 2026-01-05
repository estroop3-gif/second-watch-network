/**
 * CreatorProjectsSection
 * Shows the filmmaker's Backlot projects
 */

import { Link } from 'react-router-dom';
import { useProjects } from '@/hooks/backlot/useProjects';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Plus, Film, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pre_production: { label: 'Pre-Production', icon: Clock, className: 'bg-blue-500/20 text-blue-400' },
  production: { label: 'In Production', icon: Film, className: 'bg-accent-yellow/20 text-accent-yellow' },
  post_production: { label: 'Post-Production', icon: CheckCircle, className: 'bg-purple-500/20 text-purple-400' },
  completed: { label: 'Completed', icon: CheckCircle, className: 'bg-green-500/20 text-green-400' },
  on_hold: { label: 'On Hold', icon: AlertCircle, className: 'bg-muted-gray/20 text-muted-gray' },
};

export function CreatorProjectsSection({ className = '' }: SectionProps) {
  const { data: projects, isLoading, error } = useProjects({ ownership: 'mine', limit: 4 });

  if (isLoading) {
    return <SectionSkeleton className={className} cardCount={2} />;
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl text-bone-white">My Productions</h2>
        <Button variant="outline" size="sm" asChild>
          <Link to="/backlot/new">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="text-muted-gray text-sm">Could not load projects</p>
      ) : !projects || projects.length === 0 ? (
        <div className="border border-dashed border-muted-gray/30 rounded-lg p-8 text-center">
          <Film className="w-12 h-12 mx-auto text-muted-gray mb-4" />
          <p className="text-muted-gray mb-4">No projects yet</p>
          <Button asChild>
            <Link to="/backlot/new">
              <Plus className="w-4 h-4 mr-2" />
              Start Your First Project
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.slice(0, 4).map(project => {
            const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.pre_production;
            const StatusIcon = statusConfig.icon;

            return (
              <Link
                key={project.id}
                to={`/backlot/${project.slug || project.id}`}
                className="group block p-4 bg-charcoal-black border border-muted-gray/20 rounded-lg hover:border-accent-yellow/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-heading text-bone-white group-hover:text-accent-yellow transition-colors line-clamp-1">
                    {project.title}
                  </h3>
                  <Badge variant="outline" className={statusConfig.className}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusConfig.label}
                  </Badge>
                </div>
                {project.logline && (
                  <p className="text-muted-gray text-sm line-clamp-2">
                    {project.logline}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {projects && projects.length > 4 && (
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/backlot">View All Projects</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default CreatorProjectsSection;
