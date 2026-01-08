/**
 * My Checkouts View
 * Shows the current user's active checkouts with quick return actions
 */
import React, { useState } from 'react';
import {
  Package,
  Clock,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useMyCheckoutsDetailed } from '@/hooks/gear/useGearCheckin';
import type { MyCheckoutTransaction } from '@/types/gear';

type FilterOption = 'all' | 'overdue' | 'due_soon';

interface MyCheckoutsViewProps {
  orgId: string;
  onStartCheckin: (transactionId: string) => void;
  onBack?: () => void;
}

export function MyCheckoutsView({
  orgId,
  onStartCheckin,
  onBack,
}: MyCheckoutsViewProps) {
  const [filter, setFilter] = useState<FilterOption>('all');
  const { checkouts, isLoading, error, refetch } = useMyCheckoutsDetailed(orgId);

  // Filter checkouts based on selection
  const filteredCheckouts = React.useMemo(() => {
    if (!checkouts) return [];

    switch (filter) {
      case 'overdue':
        return checkouts.filter((tx) => tx.is_overdue);
      case 'due_soon':
        // Due within the next 24 hours
        return checkouts.filter((tx) => {
          if (!tx.expected_return_date) return false;
          const dueDate = new Date(tx.expected_return_date);
          const now = new Date();
          const dayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          return dueDate <= dayFromNow && !tx.is_overdue;
        });
      default:
        return checkouts;
    }
  }, [checkouts, filter]);

  // Count overdue items
  const overdueCount = checkouts?.filter((tx) => tx.is_overdue).length ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-muted-foreground mb-4">Failed to load checkouts</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold">My Checkouts</h2>
            <p className="text-muted-foreground">
              {checkouts?.length ?? 0} active checkout{checkouts?.length !== 1 ? 's' : ''}
              {overdueCount > 0 && (
                <span className="text-destructive ml-2">
                  ({overdueCount} overdue)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterOption)}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Checkouts</SelectItem>
              <SelectItem value="overdue">Overdue Only</SelectItem>
              <SelectItem value="due_soon">Due Soon</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overdue Warning Banner */}
      {overdueCount > 0 && filter !== 'overdue' && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium text-destructive">
                {overdueCount} item{overdueCount !== 1 ? 's are' : ' is'} overdue
              </p>
              <p className="text-sm text-muted-foreground">
                Please return overdue items as soon as possible to avoid late fees.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilter('overdue')}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              View Overdue
            </Button>
          </div>
        </div>
      )}

      {/* Checkout Cards */}
      {filteredCheckouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No checkouts found</p>
          <p className="text-muted-foreground">
            {filter === 'all'
              ? "You don't have any items checked out"
              : `No ${filter === 'overdue' ? 'overdue' : 'due soon'} checkouts`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCheckouts.map((checkout) => (
            <CheckoutCard
              key={checkout.transaction_id}
              checkout={checkout}
              onReturn={() => onStartCheckin(checkout.transaction_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CheckoutCardProps {
  checkout: MyCheckoutTransaction;
  onReturn: () => void;
}

function CheckoutCard({ checkout, onReturn }: CheckoutCardProps) {
  const isOverdue = checkout.is_overdue;
  const dueDate = checkout.expected_return_date
    ? new Date(checkout.expected_return_date)
    : null;

  // Check if due soon (within 24 hours)
  const isDueSoon =
    dueDate &&
    !isOverdue &&
    dueDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <Card
      className={cn(
        'transition-colors',
        isOverdue && 'border-destructive bg-destructive/5',
        isDueSoon && !isOverdue && 'border-yellow-500 bg-yellow-500/5'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">
              {checkout.project_name || 'General Checkout'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {checkout.items.length} item{checkout.items.length !== 1 ? 's' : ''}
            </p>
          </div>
          {isOverdue && (
            <Badge variant="destructive" className="ml-2 shrink-0">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Overdue
            </Badge>
          )}
          {isDueSoon && !isOverdue && (
            <Badge variant="outline" className="ml-2 shrink-0 border-yellow-500 text-yellow-600">
              <Clock className="h-3 w-3 mr-1" />
              Due Soon
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Items Preview */}
        <div className="space-y-1">
          {checkout.items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Package className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.asset_name}</span>
            </div>
          ))}
          {checkout.items.length > 3 && (
            <p className="text-sm text-muted-foreground pl-5">
              +{checkout.items.length - 3} more
            </p>
          )}
        </div>

        {/* Due Date */}
        {dueDate && (
          <div
            className={cn(
              'flex items-center gap-2 text-sm',
              isOverdue
                ? 'text-destructive'
                : isDueSoon
                ? 'text-yellow-600'
                : 'text-muted-foreground'
            )}
          >
            <Clock className="h-4 w-4" />
            <span>
              {isOverdue
                ? `Overdue by ${checkout.days_overdue} day${
                    checkout.days_overdue !== 1 ? 's' : ''
                  }`
                : `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`}
            </span>
          </div>
        )}

        {/* Return Button */}
        <Button onClick={onReturn} className="w-full" size="sm">
          Return Items
        </Button>
      </CardContent>
    </Card>
  );
}

export default MyCheckoutsView;
