/**
 * QuickActionBar
 * Role-based quick action buttons for the dashboard
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Film,
  Search,
  Sparkles,
  Bookmark,
  MessageSquare,
  Plus,
  Upload,
  Users,
  Contact,
  Briefcase,
  Building,
  Shield,
} from 'lucide-react';
import type { QuickAction } from '@/components/dashboard/config/dashboardConfig';

// Icon mapping
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Film,
  Search,
  Sparkles,
  Bookmark,
  MessageSquare,
  Plus,
  Upload,
  Users,
  Contact,
  Briefcase,
  Building,
  Shield,
};

interface QuickActionBarProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActionBar({ actions, className = '' }: QuickActionBarProps) {
  if (actions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 mb-8 ${className}`}>
      {actions.map((action) => {
        const Icon = ICONS[action.icon];
        return (
          <Button
            key={action.id}
            variant={action.variant || 'outline'}
            size="sm"
            asChild
            className="gap-2"
          >
            <Link to={action.href}>
              {Icon && <Icon className="h-4 w-4" />}
              {action.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

export default QuickActionBar;
