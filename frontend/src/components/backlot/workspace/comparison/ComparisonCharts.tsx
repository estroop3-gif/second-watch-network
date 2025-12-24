/**
 * ComparisonCharts - Visual charts for budget estimated vs actual
 */
import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BudgetComparisonData } from '@/hooks/backlot';

interface ComparisonChartsProps {
  data: BudgetComparisonData;
}

type ChartType = 'bar' | 'variance' | 'pie';

// Color palette
const COLORS = {
  estimated: '#60a5fa', // blue-400
  actual: '#f97316', // orange-500
  underBudget: '#4ade80', // green-400
  overBudget: '#f87171', // red-400
  neutral: '#9ca3af', // gray-400
};

const PIE_COLORS = [
  '#f59e0b', // amber-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
];

export default function ComparisonCharts({ data }: ComparisonChartsProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  const formatFullCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Prepare data for category bar chart
  const categoryBarData = data.by_category_type.map((group) => ({
    name: group.label,
    estimated: group.estimated,
    actual: group.actual,
    variance: group.variance,
    variancePercent: group.variance_percent,
  }));

  // Prepare data for variance chart
  const varianceData = data.by_category_type.map((group) => ({
    name: group.label,
    variance: group.variance,
    fill: group.variance > 0 ? COLORS.overBudget : group.variance < 0 ? COLORS.underBudget : COLORS.neutral,
  }));

  // Prepare data for pie charts
  const estimatedPieData = data.by_category_type.map((group, index) => ({
    name: group.label,
    value: group.estimated,
    fill: PIE_COLORS[index % PIE_COLORS.length],
  }));

  const actualPieData = data.by_category_type.map((group, index) => ({
    name: group.label,
    value: group.actual,
    fill: PIE_COLORS[index % PIE_COLORS.length],
  }));

  // Expense breakdown for pie chart
  const expenseBreakdownData = [
    { name: 'Receipts', value: data.expense_breakdown.receipts, fill: PIE_COLORS[0] },
    { name: 'Mileage', value: data.expense_breakdown.mileage, fill: PIE_COLORS[1] },
    { name: 'Kit Rentals', value: data.expense_breakdown.kit_rentals, fill: PIE_COLORS[2] },
    { name: 'Per Diem', value: data.expense_breakdown.per_diem, fill: PIE_COLORS[3] },
  ].filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-rich-black border border-muted-gray/20 rounded-lg p-3 shadow-lg">
          <p className="text-bone-white font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatFullCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-rich-black border border-muted-gray/20 rounded-lg p-3 shadow-lg">
          <p className="text-bone-white font-medium">{data.name}</p>
          <p className="text-sm text-muted-gray">{formatFullCurrency(data.value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Chart Type Toggle */}
      <Tabs value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/10">
          <TabsTrigger value="bar" className="data-[state=active]:bg-rich-black">
            Estimated vs Actual
          </TabsTrigger>
          <TabsTrigger value="variance" className="data-[state=active]:bg-rich-black">
            Variance
          </TabsTrigger>
          <TabsTrigger value="pie" className="data-[state=active]:bg-rich-black">
            Distribution
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Bar Chart - Estimated vs Actual */}
      {chartType === 'bar' && (
        <div className="bg-charcoal-black/30 rounded-lg border border-muted-gray/10 p-6">
          <h3 className="text-lg font-medium text-bone-white mb-4">Estimated vs Actual by Category</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={formatCurrency}
                  stroke="#9ca3af"
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#9ca3af"
                  fontSize={12}
                  width={120}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(value) => <span className="text-muted-gray">{value}</span>}
                />
                <Bar dataKey="estimated" name="Estimated" fill={COLORS.estimated} radius={[0, 4, 4, 0]} />
                <Bar dataKey="actual" name="Actual" fill={COLORS.actual} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Variance Chart */}
      {chartType === 'variance' && (
        <div className="bg-charcoal-black/30 rounded-lg border border-muted-gray/10 p-6">
          <h3 className="text-lg font-medium text-bone-white mb-4">Budget Variance by Category</h3>
          <p className="text-sm text-muted-gray mb-4">
            Positive values indicate over budget, negative values indicate under budget
          </p>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={varianceData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={formatCurrency}
                  stroke="#9ca3af"
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#9ca3af"
                  fontSize={12}
                  width={120}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="variance" name="Variance" radius={[0, 4, 4, 0]}>
                  {varianceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-gray">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.underBudget }} />
              <span>Under Budget</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.overBudget }} />
              <span>Over Budget</span>
            </div>
          </div>
        </div>
      )}

      {/* Pie Charts */}
      {chartType === 'pie' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Estimated Distribution */}
          <div className="bg-charcoal-black/30 rounded-lg border border-muted-gray/10 p-6">
            <h3 className="text-lg font-medium text-bone-white mb-4">Estimated Budget Distribution</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={estimatedPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {estimatedPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    formatter={(value) => <span className="text-muted-gray text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-sm text-muted-gray mt-2">
              Total: {formatFullCurrency(data.summary.estimated_total)}
            </p>
          </div>

          {/* Actual Distribution */}
          <div className="bg-charcoal-black/30 rounded-lg border border-muted-gray/10 p-6">
            <h3 className="text-lg font-medium text-bone-white mb-4">Actual Spend Distribution</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={actualPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {actualPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    formatter={(value) => <span className="text-muted-gray text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-sm text-muted-gray mt-2">
              Total: {formatFullCurrency(data.summary.actual_total)}
            </p>
          </div>

          {/* Expense Source Breakdown */}
          {expenseBreakdownData.length > 0 && (
            <div className="bg-charcoal-black/30 rounded-lg border border-muted-gray/10 p-6 lg:col-span-2">
              <h3 className="text-lg font-medium text-bone-white mb-4">Actual Spend by Expense Type</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {expenseBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      formatter={(value) => <span className="text-muted-gray text-sm">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
