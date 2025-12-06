/**
 * Backlot Hooks - Export all Backlot-related hooks
 */

// Projects
export {
  useProjects,
  useProject,
  useProjectBySlug,
  useProjectMembers,
  useProjectPermission,
} from './useProjects';

// Schedule (Production Days & Call Sheets)
export {
  useProductionDays,
  useProductionDay,
  useCallSheets,
  useCallSheet,
  useCallSheetPeople,
  useSendCallSheet,
  useCallSheetSendHistory,
  useProjectMembersForSend,
  // Scenes & Locations
  useCallSheetScenes,
  useCallSheetLocations,
  // PDF & Sync
  useGenerateCallSheetPdf,
  useDownloadCallSheetPdf,
  useSetProjectLogo,
  useSyncCallSheet,
} from './useSchedule';

// Tasks
export {
  useTasks,
  useTask,
  useTaskStats,
} from './useTasks';

// Locations
export {
  useLocations,
  useLocation,
} from './useLocations';

// Gear
export {
  useGear,
  useGearItem,
  useGearCategories,
  GEAR_CATEGORIES,
} from './useGear';

// Updates
export {
  useUpdates,
  useUpdate,
  usePublicUpdates,
} from './useUpdates';

// Contacts
export {
  useContacts,
  useContact,
  useContactStats,
} from './useContacts';

// Credits
export {
  useCredits,
  usePublicCredits,
  useCreditsByDepartment,
  CREDIT_DEPARTMENTS,
  CREDIT_ROLES,
} from './useCredits';

// Budget System
export {
  // Main Budget
  useBudget,
  useBudgetSummary,
  useBudgetStats,
  useCreateBudget,
  useUpdateBudget,
  useLockBudget,
  // Categories
  useBudgetCategories,
  useBudgetCategoryMutations,
  // Line Items
  useBudgetLineItems,
  useLineItemMutations,
  // Daily Budgets
  useDailyBudgets,
  useDailyBudget,
  useDailyBudgetForDay,
  useUpdateDailyBudget,
  useSuggestedLineItems,
  useAutoPopulateDailyBudget,
  // Daily Budget Items
  useDailyBudgetItems,
  useDailyBudgetItemMutations,
  // Receipts
  useReceipts,
  useReceipt,
  useRegisterReceipt,
  useReprocessReceiptOcr,
  useUpdateReceipt,
  useMapReceipt,
  useVerifyReceipt,
  useDeleteReceipt,
  useExportReceipts,
  // Professional Budget Templates & Top Sheet
  useBudgetTemplateTypes,
  useBudgetTemplateAccounts,
  useBudgetTemplatePreview,
  useCreateBudgetFromTemplate,
  useTopSheet,
  useComputeTopSheet,
  // Budget-to-Daily Sync
  useSyncBudgetToDaily,
  useSyncBudgetToDay,
  // PDF Export
  useExportBudgetPdf,
} from './useBudget';
