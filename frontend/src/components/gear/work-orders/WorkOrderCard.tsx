/**
 * Work Order Card Component
 * Displays a work order in a card format for the list view
 */
import React from 'react';
import {
  User,
  Building2,
  Calendar,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { GearWorkOrder, WorkOrderStatus } from '@/types/gear';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isPast } from 'date-fns';

const STATUS_CONFIG: Record<WorkOrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: {
    label: 'Draft',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <ClipboardList className="w-4 h-4" />,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Clock className="w-4 h-4" />,
  },
  ready: {
    label: 'Ready',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  checked_out: {
    label: 'Checked Out',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: <Package className="w-4 h-4" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

interface WorkOrderCardProps {
  workOrder: GearWorkOrder;
  onClick?: () => void;
}

export function WorkOrderCard({ workOrder, onClick }: WorkOrderCardProps) {
  const statusConfig = STATUS_CONFIG[workOrder.status];
  const itemCount = workOrder.item_count || 0;
  const stagedCount = workOrder.staged_count || 0;
  const progressPercent = itemCount > 0 ? (stagedCount / itemCount) * 100 : 0;

  const isDueSoon = workOrder.due_date && !isPast(new Date(workOrder.due_date)) &&
    new Date(workOrder.due_date).getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const isOverdue = workOrder.due_date && isPast(new Date(workOrder.due_date)) &&
    workOrder.status !== 'checked_out' && workOrder.status !== 'cancelled';

  return (
    <Card
      className={cn(
        "bg-charcoal-black/50 border-muted-gray/30 hover:bg-charcoal-black/70 transition-colors cursor-pointer",
        isOverdue && "border-red-500/50"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center",
              statusConfig.color.replace('text-', 'bg-').replace(/\/20|\/30/g, '/20')
            )}>
              {statusConfig.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-bone-white truncate">{workOrder.title}</p>
                {workOrder.reference_number && (
                  <code className="text-xs text-muted-gray bg-charcoal-black/50 px-1.5 py-0.5 rounded">
                    {workOrder.reference_number}
                  </code>
                )}
              </div>

              <div className="flex items-center gap-4 mt-1 text-sm text-muted-gray">
                {/* Custodian */}
                {(workOrder.custodian_user_name || workOrder.custodian_contact_name || workOrder.project_name) && (
                  <div className="flex items-center gap-1">
                    {workOrder.project_name ? (
                      <>
                        <Building2 className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{workOrder.project_name}</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">
                          {workOrder.custodian_user_name || workOrder.custodian_contact_name}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Item count */}
                <div className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                </div>

                {/* Due date */}
                {workOrder.due_date && (
                  <div className={cn(
                    "flex items-center gap-1",
                    isOverdue && "text-red-400",
                    isDueSoon && !isOverdue && "text-yellow-400"
                  )}>
                    <Calendar className="w-3 h-3" />
                    <span>
                      {isOverdue ? 'Overdue' : format(new Date(workOrder.due_date), 'MMM d')}
                    </span>
                  </div>
                )}
              </div>

              {/* Progress bar for in_progress status */}
              {workOrder.status === 'in_progress' && itemCount > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={progressPercent} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-gray">
                    {stagedCount}/{itemCount} staged
                  </span>
                </div>
              )}

              {/* Assigned to */}
              {workOrder.assigned_to_name && (
                <p className="text-xs text-muted-gray mt-1">
                  Assigned to: {workOrder.assigned_to_name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 ml-4">
            <Badge className={cn('border', statusConfig.color)}>
              {statusConfig.label}
            </Badge>
            <ChevronRight className="w-4 h-4 text-muted-gray" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default WorkOrderCard;
