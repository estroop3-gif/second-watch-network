/**
 * Organization Usage Dashboard
 *
 * Visual dashboard for organization owners to view their usage vs limits.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Users,
  FolderOpen,
  HardDrive,
  Activity,
  Crown,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import {
  useOrganizationUsage,
  formatBytes,
  formatCents,
  getUsageStatus,
  getUsageColorClass,
  getProgressColorClass,
} from '@/hooks/useOrganizationUsage';

interface UsageDashboardProps {
  organizationId: string;
  onUpgradeClick?: () => void;
}

interface UsageCardProps {
  title: string;
  icon: React.ReactNode;
  used: number;
  limit: number;
  percent: number;
  formatValue?: (val: number) => string;
  isUnlimited?: boolean;
}

function UsageCard({
  title,
  icon,
  used,
  limit,
  percent,
  formatValue = (val) => val.toString(),
  isUnlimited = false,
}: UsageCardProps) {
  const status = getUsageStatus(percent);
  const colorClass = getUsageColorClass(status);
  const progressClass = getProgressColorClass(status);

  return (
    <Card className="bg-charcoal-black border-muted-gray">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-muted-gray/20">{icon}</div>
            <span className="font-medium text-sm">{title}</span>
          </div>
          {isUnlimited ? (
            <Badge variant="outline" className="text-xs">Unlimited</Badge>
          ) : status !== 'ok' && (
            <Badge
              variant={status === 'critical' ? 'destructive' : 'outline'}
              className={status === 'warning' ? 'border-yellow-500 text-yellow-500' : ''}
            >
              {percent}%
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className={colorClass}>{formatValue(used)}</span>
            <span className="text-muted-gray">
              {isUnlimited ? 'No limit' : `of ${formatValue(limit)}`}
            </span>
          </div>
          {!isUnlimited && (
            <Progress
              value={percent}
              className={`h-2 ${status !== 'ok' ? progressClass : ''}`}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function UsageDashboard({ organizationId, onUpgradeClick }: UsageDashboardProps) {
  const { data: usage, isLoading, error, refetch } = useOrganizationUsage(organizationId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load usage data. Please try again.</AlertDescription>
      </Alert>
    );
  }

  const hasWarnings = usage.near_limit_warnings.length > 0;

  return (
    <div className="space-y-6">
      {/* Tier Badge and Subscription Status */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {usage.tier ? (
            <>
              <Badge className="bg-accent-yellow text-charcoal-black text-sm px-3 py-1">
                {usage.tier.enterprise_support && <Crown className="h-3 w-3 mr-1" />}
                {usage.tier.display_name}
              </Badge>
              <span className="text-sm text-muted-gray">
                {formatCents(usage.tier.price_cents)}/month
              </span>
            </>
          ) : (
            <Badge variant="outline">No Plan</Badge>
          )}
          {usage.subscription_status && (
            <Badge
              variant={usage.subscription_status === 'active' ? 'default' : 'secondary'}
              className={
                usage.subscription_status === 'active'
                  ? 'bg-green-600'
                  : usage.subscription_status === 'past_due'
                  ? 'bg-yellow-600'
                  : ''
              }
            >
              {usage.subscription_status}
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          {onUpgradeClick && (
            <Button size="sm" onClick={onUpgradeClick}>
              <ArrowUpRight className="h-4 w-4 mr-1" />
              Upgrade Plan
            </Button>
          )}
        </div>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <Alert variant="default" className="border-yellow-500 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-500">Approaching Limits</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {usage.near_limit_warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
            {onUpgradeClick && (
              <Button variant="outline" size="sm" className="mt-3" onClick={onUpgradeClick}>
                Upgrade to increase limits
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Usage Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UsageCard
          title="Owner Seats"
          icon={<Crown className="h-4 w-4 text-accent-yellow" />}
          used={usage.owner_seats_used}
          limit={usage.owner_seats_limit}
          percent={usage.owner_seats_percent}
        />

        <UsageCard
          title="Team Seats"
          icon={<Users className="h-4 w-4 text-blue-500" />}
          used={usage.collaborative_seats_used}
          limit={usage.collaborative_seats_limit}
          percent={usage.collaborative_seats_percent}
        />

        <UsageCard
          title="Active Projects"
          icon={<FolderOpen className="h-4 w-4 text-purple-500" />}
          used={usage.active_projects_used}
          limit={usage.active_projects_limit}
          percent={usage.active_projects_percent}
          isUnlimited={usage.active_projects_limit === -1}
        />

        <UsageCard
          title="Active Storage"
          icon={<HardDrive className="h-4 w-4 text-green-500" />}
          used={usage.active_storage_used}
          limit={usage.active_storage_limit}
          percent={usage.active_storage_percent}
          formatValue={formatBytes}
        />

        <UsageCard
          title="Archive Storage"
          icon={<HardDrive className="h-4 w-4 text-gray-500" />}
          used={usage.archive_storage_used}
          limit={usage.archive_storage_limit}
          percent={usage.archive_storage_percent}
          formatValue={formatBytes}
        />

        <UsageCard
          title="Monthly Bandwidth"
          icon={<Activity className="h-4 w-4 text-orange-500" />}
          used={usage.bandwidth_used}
          limit={usage.bandwidth_limit}
          percent={usage.bandwidth_percent}
          formatValue={formatBytes}
        />
      </div>

      {/* Bandwidth Reset Info */}
      <div className="text-center text-sm text-muted-gray">
        Bandwidth resets on {new Date(usage.bandwidth_reset_date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })}
      </div>

      {/* Enterprise Features */}
      {usage.tier?.enterprise_support && (
        <Card className="bg-gradient-to-r from-purple-900/20 to-accent-yellow/10 border-accent-yellow/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-accent-yellow" />
              Enterprise Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-purple-600">Priority Support</Badge>
              <Badge className="bg-purple-600">1-Hour Email Response</Badge>
              {usage.tier.public_call_sheet_links && (
                <Badge className="bg-purple-600">Public Call Sheet Links</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default UsageDashboard;
