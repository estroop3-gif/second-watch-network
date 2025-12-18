/**
 * SceneBudgetTab - Budget line items for the scene
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SceneHubData } from '@/hooks/backlot';
import { DollarSign, Plus, MapPin, Building, TrendingUp } from 'lucide-react';

interface SceneBudgetTabProps {
  hub: SceneHubData;
  canEdit: boolean;
  projectId: string;
  sceneId: string;
}

export default function SceneBudgetTab({
  hub,
  canEdit,
  projectId,
  sceneId,
}: SceneBudgetTabProps) {
  const { budget_items, budget_items_from_location, budget_summary } = hub;
  const hasItems = budget_items.length > 0 || budget_items_from_location.length > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          label="Estimated Total"
          value={`$${budget_summary.total_estimated.toLocaleString()}`}
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
        />
        <SummaryCard
          label="Actual Spent"
          value={`$${budget_summary.total_actual.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5 text-green-400" />}
        />
        <SummaryCard
          label="From Receipts"
          value={`$${budget_summary.total_receipts.toLocaleString()}`}
          subtext={`${budget_summary.receipts_count} receipts`}
          icon={<DollarSign className="w-5 h-5 text-yellow-400" />}
        />
      </div>

      {/* Direct Budget Items */}
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-bone-white flex items-center gap-2">
              <Building className="w-5 h-5 text-green-400" />
              Scene Budget Items ({budget_items.length})
            </CardTitle>
            {canEdit && (
              <Button size="sm" className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90">
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {budget_items.length === 0 ? (
            <p className="text-center text-muted-gray py-6">
              No budget items directly linked to this scene
            </p>
          ) : (
            <div className="space-y-3">
              {budget_items.map((item) => (
                <BudgetItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inherited from Location */}
      {budget_items_from_location.length > 0 && (
        <Card className="bg-charcoal-black border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-bone-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Inherited from Location ({budget_items_from_location.length})
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 ml-2">
                Read-only
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {budget_items_from_location.map((item) => (
                <BudgetItemRow key={item.id} item={item} isInherited />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!hasItems && (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-gray opacity-50" />
            <p className="text-muted-gray">No budget items for this scene</p>
            {canEdit && (
              <Button variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add Budget Item
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  icon,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="bg-charcoal-black border-muted-gray/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted-gray/10">{icon}</div>
          <div>
            <p className="text-xl font-bold text-bone-white">{value}</p>
            <p className="text-xs text-muted-gray">{label}</p>
            {subtext && <p className="text-xs text-muted-gray/60">{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetItemRow({
  item,
  isInherited = false,
}: {
  item: {
    id: string;
    description: string;
    category_name: string | null;
    rate_amount: number;
    quantity: number;
    actual_total: number;
    vendor_name: string | null;
  };
  isInherited?: boolean;
}) {
  const estimated = item.rate_amount * item.quantity;

  return (
    <div
      className={`p-3 rounded-lg border ${
        isInherited
          ? 'bg-cyan-500/5 border-cyan-500/20'
          : 'bg-muted-gray/5 border-muted-gray/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-bone-white">{item.description}</p>
          <div className="flex items-center gap-2 mt-1">
            {item.category_name && (
              <Badge variant="outline" className="text-xs">
                {item.category_name}
              </Badge>
            )}
            {item.vendor_name && (
              <span className="text-xs text-muted-gray">{item.vendor_name}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-medium text-bone-white">
            ${estimated.toLocaleString()}
          </p>
          {item.actual_total > 0 && (
            <p className="text-xs text-muted-gray">
              Actual: ${item.actual_total.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
