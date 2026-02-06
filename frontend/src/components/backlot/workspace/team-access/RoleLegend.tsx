import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { BACKLOT_ROLES } from '@/hooks/backlot/useProjectRoles';
import { BACKLOT_ROLE_COLORS } from './constants';
import { cn } from '@/lib/utils';

interface RoleLegendProps {
  onRoleClick?: (role: string) => void;
}

const RoleLegend: React.FC<RoleLegendProps> = ({ onRoleClick }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-medium text-bone-white">Role Legend</h3>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-gray" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-gray" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BACKLOT_ROLES.map((role) => (
              <div
                key={role.value}
                className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted-gray/10 rounded p-2 -m-1"
                onClick={() => onRoleClick?.(role.value)}
              >
                <Badge
                  variant="outline"
                  className={cn('shrink-0 text-xs', BACKLOT_ROLE_COLORS[role.value] || BACKLOT_ROLE_COLORS.crew)}
                >
                  {role.label}
                </Badge>
                <span className="text-muted-gray text-xs">{role.description}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-gray mt-3">
            Click a role to jump to its preset editor below.
          </p>
        </div>
      )}
    </div>
  );
};

export default RoleLegend;
