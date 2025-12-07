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

// Locations (legacy project-specific)
export {
  useLocations,
  useLocation,
} from './useLocations';

// Global Location Library
export {
  useGlobalLocationSearch,
  useLocationRegions,
  useLocationTypes,
  useProjectLocations,
  useLocationById,
  useUpdateGlobalLocation,
  useDeleteGlobalLocation,
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
  useProjectBudgets,
  useDeleteBudget,
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
  // Department Bundles (intentional budget creation flow)
  useBudgetBundles,
  useRecommendedBundles,
  useBundleById,
  useCreateBudgetFromBundles,
  useAddBundleToBudget,
} from './useBudget';

// Scout Photos
export {
  useScoutPhotos,
  useScoutPhoto,
  useScoutSummary,
  useScoutPhotoMutations,
  VANTAGE_TYPES,
  TIME_OF_DAY_OPTIONS,
  WEATHER_OPTIONS,
  INTERIOR_EXTERIOR_OPTIONS,
  CAMERA_FACING_OPTIONS,
  ANGLE_LABEL_SUGGESTIONS,
} from './useScoutPhotos';

// Script Breakdown System
export {
  // Scripts
  useScripts,
  useScript,
  useScriptMutations,
  useImportScript,
  // Scenes
  useScenes,
  useScene,
  useSceneMutations,
  // Breakdown Items
  useBreakdownItems,
  useBreakdownItemMutations,
  // Coverage & Analytics
  useCoverageStats,
  useLocationNeeds,
  // Task & Budget Generation
  useGenerateTasks,
  useGenerateBudgetSuggestions,
  useBudgetSuggestions,
  useBudgetSuggestionMutations,
  // Call Sheet Scene Links
  useCallSheetSceneLinks,
  useCallSheetSceneLinkMutations,
  // Script Page Notes
  useScriptPageNotes,
  useScriptPageNotesSummary,
  useScriptPageNoteMutations,
  // Script Versioning
  useScriptVersionHistory,
  useCreateScriptVersion,
  useLockScriptVersion,
  useSetCurrentScriptVersion,
  useUpdateScriptText,
  useExtractScriptText,
  // Script Highlight Breakdowns
  useScriptHighlights,
  useScriptHighlightSummary,
  useScriptHighlightMutations,
  // Scene Page Mappings
  useScenePageMappings,
  useScenePageMappingMutations,
} from './useScripts';
