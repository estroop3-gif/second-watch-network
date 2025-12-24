/**
 * useBudget - Hooks for managing Backlot Budget system
 * Includes budgets, categories, line items, daily budgets, and receipts
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BacklotBudget,
  BacklotBudgetCategory,
  BacklotBudgetLineItem,
  BacklotDailyBudget,
  BacklotDailyBudgetItem,
  BacklotReceipt,
  BudgetInput,
  BudgetCategoryInput,
  BudgetLineItemInput,
  DailyBudgetInput,
  DailyBudgetItemInput,
  ReceiptInput,
  ReceiptMappingInput,
  BudgetSummary,
  DailyBudgetSummary,
  BudgetStats,
  SuggestedLineItemsForDay,
  ReceiptFilters,
  // Professional budget types
  BacklotBudgetAccount,
  BacklotBudgetProjectType,
  BacklotBudgetPhase,
  TopSheetData,
  BudgetTemplate,
  CreateBudgetFromTemplateInput,
  BudgetToDailySyncConfig,
  BudgetSyncSummary,
  DailyBudgetSyncResult,
  BudgetPdfExportOptions,
  // Bundle types for intentional budget creation
  DepartmentBundle,
  BundleListResponse,
  RecommendedBundlesResponse,
  CreateBudgetFromBundlesInput,
  BudgetCreationResult,
  AddBundleResult,
} from '@/types/backlot';

const RAW_API_URL = import.meta.env.VITE_API_URL || '';
const API_BASE = RAW_API_URL.endsWith('/api/v1') ? RAW_API_URL : `${RAW_API_URL}/api/v1`;

/**
 * Helper to get auth token (uses Cognito via api module)
 */
function getAuthToken(): string {
  const token = api.getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  return token;
}

// =====================================================
// BUDGET (Main)
// =====================================================

/**
 * Get the budget for a project
 */
export function useBudget(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-budget', projectId],
    queryFn: async (): Promise<BacklotBudget | null> => {
      if (!projectId) return null;

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch budget');
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Get budget summary with categories
 */
export function useBudgetSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-budget-summary', projectId],
    queryFn: async (): Promise<BudgetSummary | null> => {
      if (!projectId) return null;

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch budget summary');
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Get budget statistics
 */
export function useBudgetStats(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-budget-stats', projectId],
    queryFn: async (): Promise<BudgetStats | null> => {
      if (!projectId) return null;

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch budget stats');
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

// Budget Comparison Types
export interface BudgetComparisonExpense {
  type: 'receipt' | 'mileage' | 'kit_rental' | 'per_diem';
  amount: number;
  vendor?: string;
  miles?: number;
}

export interface BudgetComparisonLineItem {
  id: string;
  description: string;
  account_code: string | null;
  estimated_total: number;
  actual_total: number;
  variance: number;
  variance_percent: number;
  expenses: BudgetComparisonExpense[];
  category_id: string;
}

export interface BudgetComparisonCategory {
  id: string;
  name: string;
  code: string | null;
  account_code_prefix: string | null;
  category_type: string;
  estimated_subtotal: number;
  actual_subtotal: number;
  variance: number;
  variance_percent: number;
  line_items: BudgetComparisonLineItem[];
}

export interface BudgetComparisonCategoryType {
  type: string;
  label: string;
  estimated: number;
  actual: number;
  variance: number;
  variance_percent: number;
  categories: BudgetComparisonCategory[];
}

export interface BudgetComparisonData {
  budget: {
    id: string;
    name: string;
    status: string;
    project_type: string;
    contingency_percent: number | null;
    contingency_amount: number;
    fringes_total: number;
    grand_total: number;
  };
  summary: {
    estimated_total: number;
    actual_total: number;
    variance: number;
    variance_percent: number;
  };
  by_category_type: BudgetComparisonCategoryType[];
  categories: BudgetComparisonCategory[];
  expense_breakdown: {
    receipts: number;
    mileage: number;
    kit_rentals: number;
    per_diem: number;
    total: number;
  };
}

/**
 * Fetch budget comparison data for estimated vs actual analysis
 */
export function useBudgetComparison(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-budget-comparison', projectId],
    queryFn: async (): Promise<BudgetComparisonData | null> => {
      if (!projectId) return null;

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget/comparison`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch budget comparison');
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Create a new budget for a project
 */
export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      input,
    }: {
      projectId: string;
      input?: BudgetInput;
    }): Promise<BacklotBudget> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input || {}),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create budget' }));
        throw new Error(error.detail || 'Failed to create budget');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', variables.projectId] });
    },
  });
}

/**
 * Update budget
 */
export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      input,
    }: {
      projectId: string;
      input: BudgetInput;
    }): Promise<BacklotBudget> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update budget' }));
        throw new Error(error.detail || 'Failed to update budget');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', variables.projectId] });
    },
  });
}

/**
 * Lock budget
 */
export function useLockBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }): Promise<BacklotBudget> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget/lock`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to lock budget' }));
        throw new Error(error.detail || 'Failed to lock budget');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', variables.projectId] });
    },
  });
}

/**
 * Get ALL budgets for a project (supports multiple budgets per project)
 */
export function useProjectBudgets(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-project-budgets', projectId],
    queryFn: async (): Promise<BacklotBudget[]> => {
      if (!projectId) return [];

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budgets`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch budgets');
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Delete a budget (destructive - removes all associated data)
 */
export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      budgetId,
      projectId,
    }: {
      budgetId: string;
      projectId: string;
    }): Promise<{ success: boolean; message: string }> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/budgets/${budgetId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete budget' }));
        throw new Error(error.detail || 'Failed to delete budget');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate all budget-related queries
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-budgets', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', variables.projectId] });
    },
  });
}

// =====================================================
// BUDGET CATEGORIES
// =====================================================

/**
 * Get categories for a budget
 */
export function useBudgetCategories(budgetId: string | null) {
  return useQuery({
    queryKey: ['backlot-budget-categories', budgetId],
    queryFn: async (): Promise<BacklotBudgetCategory[]> => {
      if (!budgetId) return [];

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/budgets/${budgetId}/categories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }

      return response.json();
    },
    enabled: !!budgetId,
  });
}

/**
 * Create, update, delete budget categories
 */
export function useBudgetCategoryMutations(budgetId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();

  const createCategory = useMutation({
    mutationFn: async (input: BudgetCategoryInput): Promise<BacklotBudgetCategory> => {
      if (!budgetId) throw new Error('Budget ID required');

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/budgets/${budgetId}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create category' }));
        throw new Error(error.detail || 'Failed to create category');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-categories', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', projectId] });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({
      categoryId,
      input,
    }: {
      categoryId: string;
      input: Partial<BudgetCategoryInput>;
    }): Promise<BacklotBudgetCategory> => {
      if (!budgetId) throw new Error('Budget ID required');

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/budgets/${budgetId}/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update category' }));
        throw new Error(error.detail || 'Failed to update category');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-categories', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', projectId] });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (categoryId: string): Promise<void> => {
      if (!budgetId) throw new Error('Budget ID required');

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/budgets/${budgetId}/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete category' }));
        throw new Error(error.detail || 'Failed to delete category');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-categories', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', projectId] });
    },
  });

  return { createCategory, updateCategory, deleteCategory };
}

// =====================================================
// BUDGET LINE ITEMS
// =====================================================

/**
 * Get line items for a budget (optionally filtered by category)
 */
export function useBudgetLineItems(budgetId: string | null, categoryId?: string) {
  return useQuery({
    queryKey: ['backlot-budget-line-items', budgetId, categoryId],
    queryFn: async (): Promise<BacklotBudgetLineItem[]> => {
      if (!budgetId) return [];

      const token = getAuthToken();

      const params = new URLSearchParams();
      if (categoryId) {
        params.append('category_id', categoryId);
      }

      const url = `${API_BASE}/backlot/budgets/${budgetId}/line-items${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch line items');
      }

      return response.json();
    },
    enabled: !!budgetId,
  });
}

/**
 * Create, update, delete line items
 */
export function useLineItemMutations(budgetId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();

  const createLineItem = useMutation({
    mutationFn: async (input: BudgetLineItemInput): Promise<BacklotBudgetLineItem> => {
      if (!budgetId) throw new Error('Budget ID required');

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/budgets/${budgetId}/line-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create line item' }));
        throw new Error(error.detail || 'Failed to create line item');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-line-items', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', projectId] });
    },
  });

  const updateLineItem = useMutation({
    mutationFn: async ({
      lineItemId,
      input,
    }: {
      lineItemId: string;
      input: Partial<BudgetLineItemInput>;
    }): Promise<BacklotBudgetLineItem> => {
      if (!budgetId) throw new Error('Budget ID required');

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/budgets/${budgetId}/line-items/${lineItemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update line item' }));
        throw new Error(error.detail || 'Failed to update line item');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-line-items', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', projectId] });
    },
  });

  const deleteLineItem = useMutation({
    mutationFn: async (lineItemId: string): Promise<void> => {
      if (!budgetId) throw new Error('Budget ID required');

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/budgets/${budgetId}/line-items/${lineItemId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete line item' }));
        throw new Error(error.detail || 'Failed to delete line item');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-line-items', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', projectId] });
    },
  });

  return { createLineItem, updateLineItem, deleteLineItem };
}

// =====================================================
// DAILY BUDGETS
// =====================================================

/**
 * Get all daily budget summaries for a project
 */
export function useDailyBudgets(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-daily-budgets', projectId],
    queryFn: async (): Promise<DailyBudgetSummary[]> => {
      if (!projectId) return [];

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/daily-budgets`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch daily budgets');
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Get a single daily budget by ID
 */
export function useDailyBudget(dailyBudgetId: string | null) {
  return useQuery({
    queryKey: ['backlot-daily-budget', dailyBudgetId],
    queryFn: async (): Promise<BacklotDailyBudget | null> => {
      if (!dailyBudgetId) return null;

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/daily-budgets/${dailyBudgetId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch daily budget');
      }

      return response.json();
    },
    enabled: !!dailyBudgetId,
  });
}

/**
 * Get or create daily budget for a production day
 */
export function useDailyBudgetForDay(productionDayId: string | null) {
  return useQuery({
    queryKey: ['backlot-daily-budget-for-day', productionDayId],
    queryFn: async (): Promise<BacklotDailyBudget | null> => {
      if (!productionDayId) return null;

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/production-days/${productionDayId}/daily-budget`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch daily budget');
      }

      return response.json();
    },
    enabled: !!productionDayId,
  });
}

/**
 * Update daily budget
 */
export function useUpdateDailyBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dailyBudgetId,
      input,
    }: {
      dailyBudgetId: string;
      input: DailyBudgetInput;
    }): Promise<BacklotDailyBudget> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/daily-budgets/${dailyBudgetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update daily budget' }));
        throw new Error(error.detail || 'Failed to update daily budget');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget', data.id] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budgets', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', data.project_id] });
    },
  });
}

/**
 * Get suggested line items for a production day
 */
export function useSuggestedLineItems(productionDayId: string | null) {
  return useQuery({
    queryKey: ['backlot-suggested-line-items', productionDayId],
    queryFn: async (): Promise<SuggestedLineItemsForDay | null> => {
      if (!productionDayId) return null;

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/production-days/${productionDayId}/suggested-line-items`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch suggested line items');
      }

      return response.json();
    },
    enabled: !!productionDayId,
  });
}

/**
 * Auto-populate daily budget from suggestions
 */
export function useAutoPopulateDailyBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dailyBudgetId,
      lineItemIds,
    }: {
      dailyBudgetId: string;
      lineItemIds: string[];
    }): Promise<BacklotDailyBudgetItem[]> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/daily-budgets/${dailyBudgetId}/auto-populate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ line_item_ids: lineItemIds }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to auto-populate' }));
        throw new Error(error.detail || 'Failed to auto-populate');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget', variables.dailyBudgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget-items', variables.dailyBudgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budgets'] });
    },
  });
}

// =====================================================
// DAILY BUDGET ITEMS
// =====================================================

/**
 * Get items for a daily budget
 */
export function useDailyBudgetItems(dailyBudgetId: string | null) {
  return useQuery({
    queryKey: ['backlot-daily-budget-items', dailyBudgetId],
    queryFn: async (): Promise<BacklotDailyBudgetItem[]> => {
      if (!dailyBudgetId) return [];

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/daily-budgets/${dailyBudgetId}/items`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch daily budget items');
      }

      return response.json();
    },
    enabled: !!dailyBudgetId,
  });
}

/**
 * Daily budget item mutations
 */
export function useDailyBudgetItemMutations(dailyBudgetId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();

  const createItem = useMutation({
    mutationFn: async (input: DailyBudgetItemInput): Promise<BacklotDailyBudgetItem> => {
      if (!dailyBudgetId) throw new Error('Daily budget ID required');

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/daily-budgets/${dailyBudgetId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create item' }));
        throw new Error(error.detail || 'Failed to create item');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget-items', dailyBudgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget', dailyBudgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budgets', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', projectId] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({
      itemId,
      input,
    }: {
      itemId: string;
      input: Partial<DailyBudgetItemInput>;
    }): Promise<BacklotDailyBudgetItem> => {
      if (!dailyBudgetId) throw new Error('Daily budget ID required');

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/daily-budgets/${dailyBudgetId}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update item' }));
        throw new Error(error.detail || 'Failed to update item');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget-items', dailyBudgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget', dailyBudgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budgets', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', projectId] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string): Promise<void> => {
      if (!dailyBudgetId) throw new Error('Daily budget ID required');

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/daily-budgets/${dailyBudgetId}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete item' }));
        throw new Error(error.detail || 'Failed to delete item');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget-items', dailyBudgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget', dailyBudgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budgets', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', projectId] });
    },
  });

  return { createItem, updateItem, deleteItem };
}

// =====================================================
// RECEIPTS
// =====================================================

/**
 * Get receipts for a project with optional filters
 */
export function useReceipts(projectId: string | null, filters?: ReceiptFilters) {
  return useQuery({
    queryKey: ['backlot-receipts', projectId, filters],
    queryFn: async (): Promise<BacklotReceipt[]> => {
      if (!projectId) return [];

      const token = getAuthToken();

      const params = new URLSearchParams();
      if (filters?.is_mapped !== undefined) {
        params.append('is_mapped', String(filters.is_mapped));
      }
      if (filters?.is_verified !== undefined) {
        params.append('is_verified', String(filters.is_verified));
      }
      if (filters?.date_from) {
        params.append('date_from', filters.date_from);
      }
      if (filters?.date_to) {
        params.append('date_to', filters.date_to);
      }
      if (filters?.budget_line_item_id) {
        params.append('budget_line_item_id', filters.budget_line_item_id);
      }
      if (filters?.daily_budget_id) {
        params.append('daily_budget_id', filters.daily_budget_id);
      }
      if (filters?.search) {
        params.append('search', filters.search);
      }

      const url = `${API_BASE}/backlot/projects/${projectId}/receipts${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch receipts');
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Get a single receipt
 */
export function useReceipt(receiptId: string | null) {
  return useQuery({
    queryKey: ['backlot-receipt', receiptId],
    queryFn: async (): Promise<BacklotReceipt | null> => {
      if (!receiptId) return null;

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/receipts/${receiptId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch receipt');
      }

      return response.json();
    },
    enabled: !!receiptId,
  });
}

/**
 * Register a receipt (after file upload) and trigger OCR
 */
export function useRegisterReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      fileUrl,
      originalFilename,
      fileType,
      fileSizeBytes,
    }: {
      projectId: string;
      fileUrl: string;
      originalFilename?: string;
      fileType?: string;
      fileSizeBytes?: number;
    }): Promise<BacklotReceipt> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/receipts/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          file_url: fileUrl,
          original_filename: originalFilename,
          file_type: fileType,
          file_size_bytes: fileSizeBytes,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to register receipt' }));
        throw new Error(error.detail || 'Failed to register receipt');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', variables.projectId] });
    },
  });
}

/**
 * Reprocess OCR for a receipt
 */
export function useReprocessReceiptOcr() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      projectId,
    }: {
      receiptId: string;
      projectId: string;
    }): Promise<BacklotReceipt> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/receipts/${receiptId}/reprocess-ocr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to reprocess OCR' }));
        throw new Error(error.detail || 'Failed to reprocess OCR');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipt', variables.receiptId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', variables.projectId] });
    },
  });
}

/**
 * Update receipt details
 */
export function useUpdateReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      projectId,
      input,
    }: {
      receiptId: string;
      projectId: string;
      input: ReceiptInput;
    }): Promise<BacklotReceipt> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/receipts/${receiptId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update receipt' }));
        throw new Error(error.detail || 'Failed to update receipt');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipt', variables.receiptId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', variables.projectId] });
    },
  });
}

/**
 * Map a receipt to a budget line item or daily budget
 */
export function useMapReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      projectId,
      mapping,
    }: {
      receiptId: string;
      projectId: string;
      mapping: ReceiptMappingInput;
    }): Promise<BacklotReceipt> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/receipts/${receiptId}/map`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(mapping),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to map receipt' }));
        throw new Error(error.detail || 'Failed to map receipt');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipt', variables.receiptId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-line-items'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budgets', variables.projectId] });
    },
  });
}

/**
 * Verify a receipt
 */
export function useVerifyReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      projectId,
    }: {
      receiptId: string;
      projectId: string;
    }): Promise<BacklotReceipt> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/receipts/${receiptId}/verify`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to verify receipt' }));
        throw new Error(error.detail || 'Failed to verify receipt');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipt', variables.receiptId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', variables.projectId] });
    },
  });
}

/**
 * Delete a receipt
 */
export function useDeleteReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      projectId,
    }: {
      receiptId: string;
      projectId: string;
    }): Promise<void> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/receipts/${receiptId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete receipt' }));
        throw new Error(error.detail || 'Failed to delete receipt');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', variables.projectId] });
    },
  });
}

/**
 * Export receipts to CSV
 */
export function useExportReceipts() {
  return useMutation({
    mutationFn: async ({
      projectId,
      filters,
    }: {
      projectId: string;
      filters?: ReceiptFilters;
    }): Promise<void> => {
      const token = getAuthToken();

      const params = new URLSearchParams();
      if (filters?.date_from) {
        params.append('date_from', filters.date_from);
      }
      if (filters?.date_to) {
        params.append('date_to', filters.date_to);
      }

      const url = `${API_BASE}/backlot/projects/${projectId}/receipts/export${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export receipts');
      }

      // Download the CSV
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      // Get filename from header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'receipts-export.csv';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+?)"/);
        if (match) {
          filename = match[1];
        }
      }

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    },
  });
}

// =====================================================
// PROFESSIONAL BUDGET - Templates & Top Sheet
// =====================================================

/**
 * Get available budget template types
 */
export function useBudgetTemplateTypes() {
  return useQuery({
    queryKey: ['backlot-budget-template-types'],
    queryFn: async (): Promise<BacklotBudgetProjectType[]> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/budget-templates`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch template types');
      }

      return response.json();
    },
  });
}

/**
 * Get template accounts for a specific project type
 */
export function useBudgetTemplateAccounts(projectType: BacklotBudgetProjectType | null, includeAll: boolean = false) {
  return useQuery({
    queryKey: ['backlot-budget-template-accounts', projectType, includeAll],
    queryFn: async (): Promise<BacklotBudgetAccount[]> => {
      if (!projectType) return [];

      const token = getAuthToken();

      const params = new URLSearchParams();
      if (includeAll) {
        params.append('include_all', 'true');
      }

      const url = `${API_BASE}/backlot/budget-templates/${projectType}${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch template accounts');
      }

      return response.json();
    },
    enabled: !!projectType,
  });
}

/**
 * Preview what a budget template will create
 */
export function useBudgetTemplatePreview(projectType: BacklotBudgetProjectType | null, includeCommonOnly: boolean = true) {
  return useQuery({
    queryKey: ['backlot-budget-template-preview', projectType, includeCommonOnly],
    queryFn: async (): Promise<BudgetTemplate | null> => {
      if (!projectType) return null;

      const token = getAuthToken();

      const params = new URLSearchParams();
      params.append('include_common_only', String(includeCommonOnly));

      const response = await fetch(`${API_BASE}/backlot/budget-templates/${projectType}/preview?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch template preview');
      }

      return response.json();
    },
    enabled: !!projectType,
  });
}

/**
 * Create a budget from a template
 */
export function useCreateBudgetFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      input,
    }: {
      projectId: string;
      input: CreateBudgetFromTemplateInput;
    }): Promise<BacklotBudget> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget/from-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create budget from template' }));
        throw new Error(error.detail || 'Failed to create budget from template');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', variables.projectId] });
    },
  });
}

/**
 * Get Top Sheet data for a project budget
 */
export function useTopSheet(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-budget-top-sheet', projectId],
    queryFn: async (): Promise<TopSheetData | null> => {
      if (!projectId) return null;

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget/top-sheet`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch top sheet');
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Force recomputation of Top Sheet
 */
export function useComputeTopSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }): Promise<TopSheetData> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget/compute-top-sheet`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to compute top sheet' }));
        throw new Error(error.detail || 'Failed to compute top sheet');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-top-sheet', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', variables.projectId] });
    },
  });
}

// =====================================================
// BUDGET-TO-DAILY SYNC
// =====================================================

/**
 * Sync main budget to all daily budgets
 */
export function useSyncBudgetToDaily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      config,
    }: {
      projectId: string;
      config?: Partial<BudgetToDailySyncConfig>;
    }): Promise<BudgetSyncSummary> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget/sync-to-daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config || {}),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to sync budget to daily' }));
        throw new Error(error.detail || 'Failed to sync budget to daily');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budgets', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget-items'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', variables.projectId] });
    },
  });
}

/**
 * Sync budget to a specific production day
 */
export function useSyncBudgetToDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      productionDayId,
      phases,
      departments,
    }: {
      projectId: string;
      productionDayId: string;
      phases?: BacklotBudgetPhase[];
      departments?: string[];
    }): Promise<DailyBudgetSyncResult> => {
      const token = getAuthToken();

      const params = new URLSearchParams();
      if (phases && phases.length > 0) {
        phases.forEach(p => params.append('phases', p));
      }
      if (departments && departments.length > 0) {
        departments.forEach(d => params.append('departments', d));
      }

      const url = `${API_BASE}/backlot/projects/${projectId}/budget/sync-day/${productionDayId}${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to sync day' }));
        throw new Error(error.detail || 'Failed to sync day');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget', data.daily_budget_id] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget-items', data.daily_budget_id] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget-for-day', variables.productionDayId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-daily-budgets', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', variables.projectId] });
    },
  });
}

// =====================================================
// BUDGET PDF EXPORT
// =====================================================

/**
 * Generate and download budget PDF
 */
export function useExportBudgetPdf() {
  return useMutation({
    mutationFn: async ({
      projectId,
      options,
    }: {
      projectId: string;
      options?: Partial<BudgetPdfExportOptions>;
    }): Promise<void> => {
      const token = getAuthToken();

      const params = new URLSearchParams();
      if (options?.include_top_sheet !== undefined) {
        params.append('include_top_sheet', String(options.include_top_sheet));
      }
      if (options?.include_detail !== undefined) {
        params.append('include_detail', String(options.include_detail));
      }
      if (options?.include_daily_budgets !== undefined) {
        params.append('include_daily_budgets', String(options.include_daily_budgets));
      }
      if (options?.include_receipts_summary !== undefined) {
        params.append('include_receipts_summary', String(options.include_receipts_summary));
      }
      if (options?.show_actuals !== undefined) {
        params.append('show_actuals', String(options.show_actuals));
      }
      if (options?.show_variance !== undefined) {
        params.append('show_variance', String(options.show_variance));
      }
      if (options?.category_types && options.category_types.length > 0) {
        options.category_types.forEach(ct => params.append('category_types', ct));
      }

      const url = `${API_BASE}/backlot/projects/${projectId}/budget/export-pdf${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to generate PDF' }));
        throw new Error(error.detail || 'Failed to generate PDF');
      }

      // Download the PDF
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      // Get filename from header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'budget-export.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+?)"/);
        if (match) {
          filename = match[1];
        }
      }

      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(downloadUrl);
    },
  });
}

// =====================================================
// BUDGET BUNDLES - Intentional Budget Creation
// =====================================================

/**
 * Get all available department bundles
 */
export function useBudgetBundles() {
  return useQuery({
    queryKey: ['budget-bundles'],
    queryFn: async (): Promise<BundleListResponse> => {
      const response = await fetch(`${API_BASE}/backlot/budget-bundles`);

      if (!response.ok) {
        throw new Error('Failed to fetch budget bundles');
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour - bundles are static
  });
}

/**
 * Get recommended bundles for a project type
 */
export function useRecommendedBundles(projectType: BacklotBudgetProjectType | null) {
  return useQuery({
    queryKey: ['budget-bundles-recommended', projectType],
    queryFn: async (): Promise<RecommendedBundlesResponse> => {
      if (!projectType) throw new Error('Project type required');

      const response = await fetch(`${API_BASE}/backlot/budget-bundles/recommended/${projectType}`);

      if (!response.ok) {
        throw new Error('Failed to fetch recommended bundles');
      }

      return response.json();
    },
    enabled: !!projectType,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
}

/**
 * Get a single bundle by ID
 */
export function useBundleById(bundleId: string | null) {
  return useQuery({
    queryKey: ['budget-bundle', bundleId],
    queryFn: async (): Promise<DepartmentBundle> => {
      if (!bundleId) throw new Error('Bundle ID required');

      const response = await fetch(`${API_BASE}/backlot/budget-bundles/${bundleId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch bundle');
      }

      return response.json();
    },
    enabled: !!bundleId,
    staleTime: 1000 * 60 * 60,
  });
}

/**
 * Create a budget from selected bundles
 * This is the PRIMARY budget creation method that respects intentional seeding
 */
export function useCreateBudgetFromBundles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      options,
    }: {
      projectId: string;
      options: CreateBudgetFromBundlesInput;
    }): Promise<BudgetCreationResult> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/budget/from-bundles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create budget' }));
        throw new Error(error.detail || 'Failed to create budget');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate all budget queries for this project
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-budgets', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-stats', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-categories'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-line-items'] });
    },
  });
}

/**
 * Add a bundle to an existing budget
 * Use this to incrementally add departments after initial creation
 */
export function useAddBundleToBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      budgetId,
      bundleId,
      essentialsOnly = false,
    }: {
      budgetId: string;
      bundleId: string;
      essentialsOnly?: boolean;
    }): Promise<AddBundleResult> => {
      const token = getAuthToken();

      const params = new URLSearchParams({
        bundle_id: bundleId,
        essentials_only: String(essentialsOnly),
      });

      const response = await fetch(`${API_BASE}/backlot/budgets/${budgetId}/add-bundle?${params}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to add bundle' }));
        throw new Error(error.detail || 'Failed to add bundle');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate budget queries
      queryClient.invalidateQueries({ queryKey: ['backlot-budget'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-categories', variables.budgetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-line-items', variables.budgetId] });
    },
  });
}


// ============================================================================
// RECEIPT REIMBURSEMENT HOOKS
// ============================================================================

/**
 * Submit a receipt for reimbursement
 */
export function useSubmitForReimbursement(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      reimbursementTo,
      notes,
    }: {
      receiptId: string;
      reimbursementTo?: string;
      notes?: string;
    }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/receipts/${receiptId}/submit-reimbursement`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reimbursement_to: reimbursementTo,
            notes,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to submit for reimbursement' }));
        throw new Error(error.detail || 'Failed to submit for reimbursement');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-expense-summary', projectId] });
    },
  });
}

/**
 * Approve a receipt for reimbursement with optional notes (manager only)
 */
export function useApproveReimbursement(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ receiptId, notes }: { receiptId: string; notes?: string }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/receipts/${receiptId}/approve-reimbursement`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(notes ? { notes } : {}),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to approve reimbursement' }));
        throw new Error(error.detail || 'Failed to approve reimbursement');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-expense-summary', projectId] });
    },
  });
}

/**
 * Reject a receipt reimbursement request (manager only)
 */
export function useRejectReimbursement(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ receiptId, reason }: { receiptId: string; reason?: string }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/receipts/${receiptId}/reject-reimbursement`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to reject reimbursement' }));
        throw new Error(error.detail || 'Failed to reject reimbursement');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-expense-summary', projectId] });
    },
  });
}

/**
 * Permanently deny a receipt reimbursement (manager only)
 */
export function useDenyReimbursement(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ receiptId, reason }: { receiptId: string; reason: string }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/receipts/${receiptId}/deny-reimbursement`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to deny reimbursement' }));
        throw new Error(error.detail || 'Failed to deny reimbursement');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-expense-summary', projectId] });
    },
  });
}

/**
 * Resubmit a rejected or denied receipt reimbursement
 */
export function useResubmitReimbursement(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (receiptId: string) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/receipts/${receiptId}/resubmit-reimbursement`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to resubmit reimbursement' }));
        throw new Error(error.detail || 'Failed to resubmit reimbursement');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-expense-summary', projectId] });
    },
  });
}

/**
 * Mark a receipt as reimbursed/paid (manager only)
 */
export function useMarkReimbursed(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (receiptId: string) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/receipts/${receiptId}/mark-reimbursed`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to mark as reimbursed' }));
        throw new Error(error.detail || 'Failed to mark as reimbursed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-expense-summary', projectId] });
    },
  });
}

/**
 * Submit a receipt as a company card expense (goes to budget, not invoice)
 */
export function useSubmitCompanyCard(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      budgetCategoryId,
      budgetLineItemId,
      expenseCategory,
    }: {
      receiptId: string;
      budgetCategoryId?: string;
      budgetLineItemId?: string;
      expenseCategory?: string;
    }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/receipts/${receiptId}/submit-company-card`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            budget_category_id: budgetCategoryId,
            budget_line_item_id: budgetLineItemId,
            expense_category: expenseCategory,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to submit company card expense' }));
        throw new Error(error.detail || 'Failed to submit company card expense');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-receipts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-expense-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-actuals', projectId] });
    },
  });
}

/**
 * Get budget actuals for a project
 */
export function useBudgetActuals(
  projectId: string | null,
  options?: {
    budgetCategoryId?: string;
    budgetLineItemId?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  return useQuery({
    queryKey: ['backlot-budget-actuals', projectId, options],
    queryFn: async () => {
      if (!projectId) return { actuals: [] };

      const token = getAuthToken();
      const params = new URLSearchParams();
      if (options?.budgetCategoryId) params.append('budget_category_id', options.budgetCategoryId);
      if (options?.budgetLineItemId) params.append('budget_line_item_id', options.budgetLineItemId);
      if (options?.startDate) params.append('start_date', options.startDate);
      if (options?.endDate) params.append('end_date', options.endDate);

      const url = `${API_BASE}/backlot/projects/${projectId}/budget-actuals${params.toString() ? `?${params}` : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch budget actuals');
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Get budget actuals summary by category
 */
export function useBudgetActualsSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-budget-actuals-summary', projectId],
    queryFn: async () => {
      if (!projectId) return { categories: [], total: 0 };

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/budget-actuals/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch budget actuals summary');
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// DAILY BUDGET LABOR COSTS
// =============================================================================

import type { DailyLaborCosts, DailySceneCosts, DailyInvoices } from '@/types/backlot';

/**
 * Get labor costs for a daily budget
 * Aggregates approved timecard entries with crew rates
 */
export function useDailyLaborCosts(
  dailyBudgetId: string | null,
  options?: { includePending?: boolean }
) {
  return useQuery({
    queryKey: ['backlot-daily-labor-costs', dailyBudgetId, options],
    queryFn: async (): Promise<DailyLaborCosts> => {
      const token = getAuthToken();
      const params = new URLSearchParams();
      if (options?.includePending !== undefined) {
        params.append('include_pending', String(options.includePending));
      }

      const response = await fetch(
        `${API_BASE}/backlot/daily-budgets/${dailyBudgetId}/labor-costs?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch labor costs');
      }

      return response.json();
    },
    enabled: !!dailyBudgetId,
  });
}

// =============================================================================
// DAILY BUDGET SCENE COSTS
// =============================================================================

/**
 * Get scene costs for a daily budget
 * Aggregates scene breakdown items and linked expenses for scenes shot that day
 */
export function useDailySceneCosts(dailyBudgetId: string | null) {
  return useQuery({
    queryKey: ['backlot-daily-scene-costs', dailyBudgetId],
    queryFn: async (): Promise<DailySceneCosts> => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/backlot/daily-budgets/${dailyBudgetId}/scene-costs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch scene costs');
      }

      return response.json();
    },
    enabled: !!dailyBudgetId,
  });
}

// =============================================================================
// DAILY BUDGET INVOICES
// =============================================================================

/**
 * Get invoices for a daily budget
 * Includes invoices linked by production_day_id or by line item service_date
 */
export function useDailyInvoices(
  dailyBudgetId: string | null,
  options?: { includePending?: boolean }
) {
  return useQuery({
    queryKey: ['backlot-daily-invoices', dailyBudgetId, options],
    queryFn: async (): Promise<DailyInvoices> => {
      const token = getAuthToken();
      const params = new URLSearchParams();
      if (options?.includePending !== undefined) {
        params.append('include_pending', String(options.includePending));
      }

      const response = await fetch(
        `${API_BASE}/backlot/daily-budgets/${dailyBudgetId}/invoices?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      return response.json();
    },
    enabled: !!dailyBudgetId,
  });
}
