/**
 * ExpensesSummaryView - Expense reporting and analytics dashboard
 *
 * Features:
 * - Overview of all expense types
 * - Category breakdown
 * - Person breakdown for managers
 * - Export functionality
 * - Date range filtering
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  Receipt,
  Car,
  Briefcase,
  Utensils,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  TrendingUp,
  Loader2,
  FileSpreadsheet,
  CreditCard,
  Building2,
  Wallet,
  PieChart,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import {
  useExpenseSummary,
  useMileageEntries,
  useKitRentals,
  usePerDiemEntries,
  formatCurrency,
  EXPENSE_STATUS_CONFIG,
  useBudgetActualsSummary,
  useBudgetSummary,
} from '@/hooks/backlot';
import { useReceipts, useExportReceipts } from '@/hooks/backlot';

interface ExpensesSummaryViewProps {
  projectId: string;
  canEdit: boolean;
}

// Date range presets
const DATE_PRESETS = [
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'last-3-months', label: 'Last 3 Months' },
  { id: 'all-time', label: 'All Time' },
  { id: 'custom', label: 'Custom Range' },
] as const;

type DatePresetId = typeof DATE_PRESETS[number]['id'];

// Expense type configuration
const EXPENSE_TYPES = [
  {
    id: 'receipts',
    label: 'Receipts',
    icon: Receipt,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    id: 'mileage',
    label: 'Mileage',
    icon: Car,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    id: 'kit-rentals',
    label: 'Kit Rentals',
    icon: Briefcase,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    id: 'per-diem',
    label: 'Per Diem',
    icon: Utensils,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
];

export default function ExpensesSummaryView({ projectId, canEdit }: ExpensesSummaryViewProps) {
  const [datePreset, setDatePreset] = useState<DatePresetId>('all-time');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Calculate date range
  const dateRange = useMemo(() => {
    const now = new Date();

    switch (datePreset) {
      case 'this-month':
        return {
          start: format(startOfMonth(now), 'yyyy-MM-dd'),
          end: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        return {
          start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          end: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
        };
      case 'last-3-months':
        return {
          start: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'),
          end: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      case 'custom':
        return {
          start: customStartDate || undefined,
          end: customEndDate || undefined,
        };
      default:
        return { start: undefined, end: undefined };
    }
  }, [datePreset, customStartDate, customEndDate]);

  // Fetch summary data (API returns ExpenseSummary directly, not wrapped)
  const { data: summary, isLoading: summaryLoading } = useExpenseSummary(
    projectId,
    { start_date: dateRange.start, end_date: dateRange.end }
  );

  // Fetch budget actuals summary (company card expenses)
  const { data: budgetActualsData } = useBudgetActualsSummary(projectId);

  // Fetch budget summary for comparison
  const { data: budgetSummaryData } = useBudgetSummary(projectId);

  // Fetch individual expense data for detailed breakdowns
  const { data: receiptsData } = useReceipts(projectId, {
    start_date: dateRange.start,
    end_date: dateRange.end,
  });

  const { data: mileageData } = useMileageEntries(projectId, {
    start_date: dateRange.start,
    end_date: dateRange.end,
  });

  const { data: kitRentalsData } = useKitRentals(projectId, {
    start_date: dateRange.start,
    end_date: dateRange.end,
  });

  const { data: perDiemData } = usePerDiemEntries(projectId, {
    start_date: dateRange.start,
    end_date: dateRange.end,
  });

  const exportReceipts = useExportReceipts(projectId);

  // Calculate totals
  const totals = useMemo(() => {
    const receiptsTotal = summary?.total_receipts || 0;
    const mileageTotal = summary?.total_mileage || 0;
    const kitRentalsTotal = summary?.total_kit_rentals || 0;
    const perDiemTotal = summary?.total_per_diem || 0;

    const grandTotal = receiptsTotal + mileageTotal + kitRentalsTotal + perDiemTotal;

    // Company card vs personal breakdown (from summary endpoint)
    const companyCardTotal = summary?.company_card_total || 0;
    const companyCardCount = summary?.company_card_count || 0;
    const personalCardTotal = summary?.personal_card_total || 0;
    const personalCardCount = summary?.personal_card_count || 0;

    return {
      receipts: receiptsTotal,
      mileage: mileageTotal,
      kitRentals: kitRentalsTotal,
      perDiem: perDiemTotal,
      grandTotal,
      pending: summary?.pending_amount || summary?.total_pending || 0,
      approved: summary?.approved_amount || summary?.total_approved || 0,
      reimbursed: summary?.reimbursed_amount || summary?.reimbursed_total || 0,
      companyCard: companyCardTotal,
      companyCardCount,
      personalCard: personalCardTotal,
      personalCardCount,
    };
  }, [summary]);

  // Calculate percentages for chart
  const percentages = useMemo(() => {
    if (totals.grandTotal === 0) {
      return { receipts: 0, mileage: 0, kitRentals: 0, perDiem: 0 };
    }

    return {
      receipts: (totals.receipts / totals.grandTotal) * 100,
      mileage: (totals.mileage / totals.grandTotal) * 100,
      kitRentals: (totals.kitRentals / totals.grandTotal) * 100,
      perDiem: (totals.perDiem / totals.grandTotal) * 100,
    };
  }, [totals]);

  // Group expenses by person
  const byPerson = useMemo(() => {
    const personMap = new Map<string, {
      userId: string;
      name: string;
      receipts: number;
      mileage: number;
      kitRentals: number;
      perDiem: number;
      total: number;
      pending: number;
    }>();

    // Helper to add/update person
    const addToPerson = (userId: string, name: string, type: string, amount: number, isPending: boolean) => {
      const existing = personMap.get(userId) || {
        userId,
        name,
        receipts: 0,
        mileage: 0,
        kitRentals: 0,
        perDiem: 0,
        total: 0,
        pending: 0,
      };

      if (type === 'receipts') existing.receipts += amount;
      else if (type === 'mileage') existing.mileage += amount;
      else if (type === 'kitRentals') existing.kitRentals += amount;
      else if (type === 'perDiem') existing.perDiem += amount;

      existing.total += amount;
      if (isPending) existing.pending += amount;

      personMap.set(userId, existing);
    };

    // Process receipts
    receiptsData?.receipts?.forEach((r: any) => {
      if (r.user_id && r.amount) {
        const name = r.uploaded_by_name || r.user_name || 'Unknown';
        addToPerson(r.user_id, name, 'receipts', r.amount, r.reimbursement_status === 'pending');
      }
    });

    // Process mileage
    mileageData?.mileage_entries?.forEach((m: any) => {
      if (m.user_id && m.total_amount) {
        const name = m.user_name || 'Unknown';
        addToPerson(m.user_id, name, 'mileage', m.total_amount, m.status === 'pending');
      }
    });

    // Process kit rentals
    kitRentalsData?.kit_rentals?.forEach((k: any) => {
      if (k.user_id && k.total_amount) {
        const name = k.user_name || 'Unknown';
        addToPerson(k.user_id, name, 'kitRentals', k.total_amount, k.status === 'pending');
      }
    });

    // Process per diem
    perDiemData?.per_diem_entries?.forEach((p: any) => {
      if (p.user_id && p.amount) {
        const name = p.user_name || 'Unknown';
        addToPerson(p.user_id, name, 'perDiem', p.amount, p.status === 'pending');
      }
    });

    return Array.from(personMap.values()).sort((a, b) => b.total - a.total);
  }, [receiptsData, mileageData, kitRentalsData, perDiemData]);

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportReceipts.mutateAsync({
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (summaryLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="date-preset" className="text-sm text-muted-foreground">
              Period:
            </Label>
            <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePresetId)}>
              <SelectTrigger id="date-preset" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-36"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-36"
              />
            </div>
          )}
        </div>

        <Button
          variant="outline"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 mr-2" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Total Expenses</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totals.grandTotal)}</p>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totals.pending)}</p>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-green-500 mb-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Approved</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totals.approved)}</p>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-blue-500 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Reimbursed</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totals.reimbursed)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Company Card vs Personal Card Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-purple-500 mb-2">
              <Building2 className="h-4 w-4" />
              <span className="text-sm">Company Card Expenses</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totals.companyCard)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.companyCardCount} receipt{totals.companyCardCount !== 1 ? 's' : ''} (auto-recorded)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-orange-500 mb-2">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">Personal Card (Reimbursable)</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totals.personalCard)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.personalCardCount} receipt{totals.personalCardCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-cyan-500 mb-2">
              <PieChart className="h-4 w-4" />
              <span className="text-sm">Budget Actuals</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(budgetActualsData?.total || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {budgetActualsData?.categories?.length || 0} categor{(budgetActualsData?.categories?.length || 0) !== 1 ? 'ies' : 'y'} tracked
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Type Breakdown */}
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Expense Breakdown by Type
            </CardTitle>
            <CardDescription>Distribution across expense categories</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {EXPENSE_TYPES.map((type) => {
              const Icon = type.icon;
              let amount = 0;
              let percentage = 0;

              switch (type.id) {
                case 'receipts':
                  amount = totals.receipts;
                  percentage = percentages.receipts;
                  break;
                case 'mileage':
                  amount = totals.mileage;
                  percentage = percentages.mileage;
                  break;
                case 'kit-rentals':
                  amount = totals.kitRentals;
                  percentage = percentages.kitRentals;
                  break;
                case 'per-diem':
                  amount = totals.perDiem;
                  percentage = percentages.perDiem;
                  break;
              }

              return (
                <div key={type.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${type.bgColor}`}>
                        <Icon className={`h-4 w-4 ${type.color}`} />
                      </div>
                      <span className="font-medium">{type.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{formatCurrency(amount)}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}

            {totals.grandTotal === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No expenses recorded for this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Person Breakdown */}
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Expenses by Team Member
            </CardTitle>
            <CardDescription>Individual expense totals</CardDescription>
          </CardHeader>
          <CardContent>
            {byPerson.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {byPerson.map((person) => (
                  <div
                    key={person.userId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {person.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{person.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {person.receipts > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Receipt className="h-3 w-3" />
                              {formatCurrency(person.receipts)}
                            </span>
                          )}
                          {person.mileage > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Car className="h-3 w-3" />
                              {formatCurrency(person.mileage)}
                            </span>
                          )}
                          {person.kitRentals > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Briefcase className="h-3 w-3" />
                              {formatCurrency(person.kitRentals)}
                            </span>
                          )}
                          {person.perDiem > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Utensils className="h-3 w-3" />
                              {formatCurrency(person.perDiem)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(person.total)}</p>
                      {person.pending > 0 && (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600">
                          {formatCurrency(person.pending)} pending
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No expense data available for this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Actuals Comparison */}
      {(budgetActualsData?.categories?.length > 0 || budgetSummaryData?.categories?.length > 0) && (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Budget vs Actuals
            </CardTitle>
            <CardDescription>Compare budgeted amounts to actual spending (company card expenses)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Budgeted</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="w-32">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Combine budget categories with actuals
                  const categoryMap = new Map<string, {
                    name: string;
                    budgeted: number;
                    actual: number;
                  }>();

                  // Add budget categories
                  budgetSummaryData?.categories?.forEach((cat: any) => {
                    categoryMap.set(cat.id, {
                      name: cat.name,
                      budgeted: cat.total_amount || 0,
                      actual: 0,
                    });
                  });

                  // Add actuals
                  budgetActualsData?.categories?.forEach((cat: any) => {
                    if (cat.budget_category_id && categoryMap.has(cat.budget_category_id)) {
                      const existing = categoryMap.get(cat.budget_category_id)!;
                      existing.actual = cat.total || 0;
                    } else {
                      // Actuals without budget category
                      const key = cat.expense_category || 'Uncategorized';
                      if (categoryMap.has(key)) {
                        const existing = categoryMap.get(key)!;
                        existing.actual += cat.total || 0;
                      } else {
                        categoryMap.set(key, {
                          name: cat.expense_category || 'Uncategorized',
                          budgeted: 0,
                          actual: cat.total || 0,
                        });
                      }
                    }
                  });

                  const categories = Array.from(categoryMap.values())
                    .filter(cat => cat.budgeted > 0 || cat.actual > 0)
                    .sort((a, b) => (b.actual + b.budgeted) - (a.actual + a.budgeted));

                  if (categories.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No budget or actual data available
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return categories.map((cat, idx) => {
                    const variance = cat.budgeted - cat.actual;
                    const percentUsed = cat.budgeted > 0 ? (cat.actual / cat.budgeted) * 100 : 0;
                    const isOverBudget = cat.actual > cat.budgeted && cat.budgeted > 0;

                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cat.budgeted)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cat.actual)}</TableCell>
                        <TableCell className={`text-right ${isOverBudget ? 'text-red-500' : 'text-green-500'}`}>
                          {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={Math.min(percentUsed, 100)}
                              className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : ''}`}
                            />
                            <span className="text-xs text-muted-foreground w-10">
                              {percentUsed.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
          <CardDescription>Most recent expense entries across all types</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Combine and sort recent entries */}
              {[
                ...(receiptsData?.receipts?.slice(0, 5)?.map((r: any) => ({
                  id: r.id,
                  date: r.receipt_date || r.created_at,
                  type: 'receipt',
                  typeLabel: 'Receipt',
                  icon: Receipt,
                  description: r.description || r.vendor || 'Receipt',
                  person: r.uploaded_by_name || 'Unknown',
                  status: r.reimbursement_status || 'pending',
                  amount: r.amount || 0,
                })) || []),
                ...(mileageData?.mileage_entries?.slice(0, 5)?.map((m: any) => ({
                  id: m.id,
                  date: m.date,
                  type: 'mileage',
                  typeLabel: 'Mileage',
                  icon: Car,
                  description: m.description || `${m.miles} miles`,
                  person: m.user_name || 'Unknown',
                  status: m.status,
                  amount: m.total_amount || 0,
                })) || []),
                ...(kitRentalsData?.kit_rentals?.slice(0, 5)?.map((k: any) => ({
                  id: k.id,
                  date: k.start_date,
                  type: 'kit-rental',
                  typeLabel: 'Kit Rental',
                  icon: Briefcase,
                  description: k.kit_name,
                  person: k.user_name || 'Unknown',
                  status: k.status,
                  amount: k.total_amount || 0,
                })) || []),
                ...(perDiemData?.per_diem_entries?.slice(0, 5)?.map((p: any) => ({
                  id: p.id,
                  date: p.date,
                  type: 'per-diem',
                  typeLabel: 'Per Diem',
                  icon: Utensils,
                  description: p.meal_type?.replace('_', ' ') || 'Per Diem',
                  person: p.user_name || 'Unknown',
                  status: p.status,
                  amount: p.amount || 0,
                })) || []),
              ]
                .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
                .slice(0, 10)
                .map((entry) => {
                  const Icon = entry.icon;
                  const statusConfig = EXPENSE_STATUS_CONFIG[entry.status as keyof typeof EXPENSE_STATUS_CONFIG] || EXPENSE_STATUS_CONFIG.pending;

                  return (
                    <TableRow key={`${entry.type}-${entry.id}`}>
                      <TableCell className="font-medium">
                        {entry.date ? format(parseLocalDate(entry.date), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {entry.typeLabel}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {entry.description}
                      </TableCell>
                      <TableCell>{entry.person}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${statusConfig.color} ${statusConfig.bgColor} border-0`}
                        >
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(entry.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              {(!receiptsData?.receipts?.length &&
                !mileageData?.mileage_entries?.length &&
                !kitRentalsData?.kit_rentals?.length &&
                !perDiemData?.per_diem_entries?.length) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No expenses recorded for this period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
