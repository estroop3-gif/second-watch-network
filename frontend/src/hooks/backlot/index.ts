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

// Optimized Project Dashboard (single API call for overview)
export { useProjectDashboard } from './useProjectDashboard';
export type {
  TaskStats,
  ProductionDay,
  ProjectMember,
  ProjectUpdate,
  ProjectDashboardData,
} from './useProjectDashboard';

// Schedule (Production Days & Call Sheets)
export {
  useProductionDays,
  useProductionDay,
  useTodayShootDay,
  // Production Day Scenes (Schedule Scene Assignment)
  useProductionDayScenes,
  useUnassignedScenes,
  // Schedule <-> Call Sheet Integration
  useLinkedCallSheet,
  useCreateCallSheetFromDay,
  useSyncDayToCallSheet,
  // Bidirectional Sync
  useSyncStatus,
  useBidirectionalSync,
  // Auto-Scheduler
  useAutoGenerateSchedule,
  useApplyScheduleSuggestion,
  // Call Sheets
  useCallSheets,
  useCallSheet,
  useCallSheetPeople,
  useCrewPresets,
  useSendCallSheet,
  useCallSheetSendHistory,
  useProjectMembersForSend,
  // Scenes & Locations
  useCallSheetScenes,
  useCallSheetLocations,
  // PDF, Excel & Sync
  useGenerateCallSheetPdf,
  useDownloadCallSheetPdf,
  useDownloadCallSheetExcel,
  useSetProjectLogo,
  useSyncCallSheet,
  // Templates (account-level)
  useCallSheetTemplates,
  useCallSheetFullData,
  // Comments
  useCallSheetComments,
  // Version History
  useCallSheetVersions,
  // Share Links
  useCallSheetShares,
  usePublicCallSheet,
} from './useSchedule';
export type {
  BacklotSavedCallSheetTemplate,
  CallSheetFullData,
  CallSheetShare,
  CreateShareInput,
  // Schedule <-> Call Sheet Integration types
  LinkedCallSheet,
  CreateCallSheetFromDayInput,
  SyncToCallSheetInput,
  // Auto-Scheduler types
  AutoSchedulerConstraints,
  AutoSchedulerScene,
  SuggestedDay,
  AutoSchedulerResult,
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
  useProjectLocationsWithClearances,
  useLocationById,
  useUpdateGlobalLocation,
  useDeleteGlobalLocation,
} from './useLocations';

// Gear
export {
  useGear,
  useGearItem,
  useGearCategories,
  useGearCosts,
  useSyncGearToBudget,
  useDailyGearCosts,
  GEAR_CATEGORIES,
} from './useGear';

export type {
  GearCostItem,
  GearCostsByCategory,
  GearCostsByDay,
  GearCostsResponse,
  SyncGearToBudgetOptions,
  SyncGearToBudgetResponse,
  DailyGearItem,
  DailyGearCostsResponse,
} from './useGear';

// Rental Gear Integration
export {
  useProjectRentalOrders,
  useRentalOrderSummary,
  useMessageGearHouse,
  useOrgConversations,
  useOrgConversation,
  useSendOrgMessage,
  useMarkConversationRead,
} from './useBacklotRentalGear';

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
  useCreditPreferences,
  useCreditSettings,
  useUpdateCreditSettings,
  useSyncCredits,
  CREDIT_DEPARTMENTS,
  CREDIT_ROLES,
} from './useCredits';
export type { CreditSettings, SyncCreditsResult } from './useCredits';

// Budget System
export {
  // Main Budget
  useBudget,
  useBudgetSummary,
  useBudgetStats,
  useBudgetComparison,
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
  useCreateManualReceipt,
  useReprocessReceiptOcr,
  useUpdateReceipt,
  useMapReceipt,
  useVerifyReceipt,
  useDeleteReceipt,
  useExportReceipts,
  // Receipt Reimbursements
  useSubmitForReimbursement,
  useBulkSubmitReceiptsForApproval,
  useApproveReimbursement,
  useRejectReimbursement,
  useDenyReimbursement,
  useResubmitReimbursement,
  useMarkReimbursed,
  // Company Card Expenses
  useSubmitCompanyCard,
  useBudgetActuals,
  useBudgetActualsSummary,
  // Sync budget actuals from historical data
  useSyncBudgetActuals,
  // Daily Budget Labor Costs
  useDailyLaborCosts,
  // Daily Budget Scene Costs
  useDailySceneCosts,
  // Daily Budget Invoices
  useDailyInvoices,
  // Budget Actual Detail (Source Item Linking)
  useBudgetActualDetail,
  useUpdateBudgetActual,
  useBudgetActualAuditLog,
  useKitRentalGearDetails,
  useActualReceipts,
  useAttachReceipt,
  useDetachReceipt,
  useReorderReceipts,
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

export type {
  BudgetComparisonData,
  BudgetComparisonCategory,
  BudgetComparisonCategoryType,
  BudgetComparisonLineItem,
  BudgetComparisonExpense,
  // Budget Actuals types
  BudgetActual,
  BudgetActualSourceDetails,
  BudgetActualsResponse,
  // Budget Actual Detail types (Source Item Linking)
  GearAssetDetails,
  GearKitDetails,
  KitRentalGearDetailsResponse,
  BudgetActualDetailResponse,
  ExpenseAuditLogEntry,
  ActualReceiptAttachment,
} from './useBudget';

export type {
  DailyLaborCosts,
  LaborCostEntry,
} from '@/types/backlot';

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
  // Script Title Page
  useScriptTitlePage,
  useUpdateScriptTitlePage,
  // Script Highlight Breakdowns
  useScriptHighlights,
  useScriptHighlightSummary,
  useScriptHighlightMutations,
  // Highlight Notes
  useHighlightNotes,
  useHighlightNoteMutations,
  // Scene Page Mappings
  useScenePageMappings,
  useScenePageMappingMutations,
  // Script PDF Export
  useExportScriptWithHighlights,
} from './useScripts';

// Casting & Crew Pipeline
export {
  // Project Roles
  useProjectRoles,
  useRole,
  useProjectRoleMutations,
  useOpenRoles,
  // Applications
  useRoleApplications,
  useMyApplications,
  useApplyToRole,
  useUpdateApplicationStatus,
  // Availability
  useMyAvailability,
  useUserAvailability,
  useSetAvailability,
  // Booked People & Conflicts
  useBookedPeople,
  useCheckAvailabilityConflicts,
  // Deal Memos
  useDealMemos,
  useDealMemo,
  useDealMemoMutations,
  useDealMemoHistory,
  // Community Posting
  usePostRoleToCommunity,
  useRemoveRoleFromCommunity,
} from './useCastingCrew';
export type { DealMemoStatusHistory } from './useCastingCrew';

// Crew Rates (Day Rate Schedules)
export {
  useCrewRates,
  useCrewRate,
  useCrewRatesByUser,
  useCrewRatesByRole,
  useCrewRateMutations,
  useEffectiveCrewRate,
  calculateDailyCompensation,
} from './useCrewRates';
export type {
  CrewRate,
  CrewRateInput,
  CrewRatesResponse,
  CrewRateResponse,
  CrewRateType,
} from '@/types/backlot';

// Clearances & Releases
export {
  useClearances,
  useClearanceItem,
  useClearanceSummary,
  useClearanceTemplates,
  useLocationClearances,
  usePersonClearances,
  usePersonClearancesDetailed,
  useBulkClearanceStatus,
  locationHasSignedRelease,
  personHasSignedRelease,
  getClearanceStatusColor,
  // Document versions
  useClearanceDocumentUpload,
  useClearanceDocumentRemove,
  useClearanceDocumentVersions,
  useRestoreClearanceVersion,
  // E&O Requirements
  useEORequirements,
  useInitializeEORequirements,
  useUpdateEORequirement,
  useEOSummary,
} from './useClearances';

// Clearance Recipients
export {
  useClearanceRecipients,
  useSendClearance,
} from './useClearanceRecipients';

// Shot Lists & Coverage
export {
  useShots,
  useShot,
  useShotImages,
  useCoverageSummary,
  useCoverageByScene,
  useSceneCoverageSummary,
  useCallSheetShots,
} from './useShots';

// Assets & Deliverables
export {
  // Assets
  useAssets,
  useAsset,
  useAssetsSummary,
  useAssetMutations,
  // Deliverable Templates
  useDeliverableTemplates,
  useDeliverableTemplate,
  useDeliverablePlatforms,
  useDeliverableTemplateMutations,
  // Project Deliverables
  useProjectDeliverables,
  useProjectDeliverable,
  useDeliverablesSummary,
  useDeliverableMutations,
} from './useAssets';

// Producer Analytics (READ-ONLY)
export {
  useCostByDepartmentAnalytics,
  useTimeScheduleAnalytics,
  useUtilizationAnalytics,
  useAnalyticsOverview,
} from './useAnalytics';

// Professional Shot Lists (DP/Producer Tool)
export {
  useShotLists,
  useShotList,
  useShotListShots,
} from './useShotLists';

// Shot Templates
export {
  useShotTemplates,
} from './useShotTemplates';
export type {
  ShotTemplate,
  ShotTemplateData,
  DefaultTemplate,
  ShotTemplatesResponse,
} from './useShotTemplates';

// Task Lists (Notion-style Task Database)
export {
  // Labels
  useTaskLabels,
  // Task Lists
  useTaskLists,
  useTaskList,
  // Task List Members
  useTaskListMembers,
  // Tasks
  useTaskListTasks,
  useTaskDetail,
  // Comments
  useTaskComments,
  // Views
  useTaskViews,
} from './useTaskLists';

// Script Breakdown Panel (Project-level breakdown tab)
export {
  useProjectBreakdown,
  useBreakdownSummary,
  useSceneBreakdown,
  useBreakdownMutations,
  useBreakdownPdfExport,
} from './useScriptBreakdown';

// Project Script Notes (Notes tab)
export {
  useProjectScriptNotes,
  useProjectNotesSummary,
  useProjectNotesPdfExport,
} from './useProjectScriptNotes';
export type {
  NotesGroupBy,
  ProjectNotesFilters,
  ProjectNotesResponse,
  ProjectNotesSummary,
} from './useProjectScriptNotes';

// Dailies System
export {
  // Days
  useDailiesDays,
  useDailiesDay,
  // Cards
  useDailiesCards,
  // Clips
  useDailiesClips,
  useDailiesClip,
  // Notes
  useDailiesClipNotes,
  // Summary
  useDailiesSummary,
  // Local Ingest
  useLocalIngest,
  // Helpers
  useDailiesClipsByScene,
  useDailiesCircleTakes,
  // Production Day Sync
  useUnlinkedProductionDays,
  useImportProductionDays,
  useLinkedProductionDay,
  // Media Library
  useMediaLibrary,
  useProjectCameras,
  useProjectScenes,
  // Types
  type MediaLibraryFilters,
  type MediaLibrarySortBy,
  type MediaLibrarySortOrder,
  type MediaLibraryClipWithContext,
} from './useDailies';

// Backlot Project Roles & View Config
export {
  useProjectRoles as useBacklotRoles,
  useMyProjectRoles,
  useViewConfig,
  useViewProfiles,
  useCanManageRoles,
  useCanViewAsRole,
  useCanApprove,
  BACKLOT_ROLES,
  APPROVER_ROLES,
  DEFAULT_VIEW_CONFIGS,
} from './useProjectRoles';
export type {
  BacklotRoleValue,
  BacklotProjectRole,
  BacklotViewProfile,
  ViewConfig,
  EffectiveViewConfig,
} from './useProjectRoles';

// Scene View (Glue View)
export {
  useScenesList,
  useSceneOverview,
  BREAKDOWN_TYPES,
  getBreakdownTypeInfo,
} from './useSceneView';
export type {
  SceneListItem,
  SceneOverview,
  SceneMetadata,
  BreakdownItem,
  ShotSummary,
  LocationSummary,
  DailiesClipSummary,
  ReviewNoteSummary,
  CoverageSummary,
} from './useSceneView';

// Scene Hub (Scene Detail Page)
export {
  useSceneHub,
  useSceneLinkMutations,
  CLEARANCE_TYPES,
  CLEARANCE_STATUSES,
  getClearanceTypeLabel,
  getClearanceStatusInfo,
} from './useSceneHub';
export type {
  SceneHubData,
  CallSheetLink,
  BudgetItemSummary,
  ReceiptSummary,
  ClearanceSummary,
  BudgetSummary,
  ClearanceSummaryStats,
  TaskSummary,
} from './useSceneHub';

// Day View (Glue View)
export {
  useDaysList,
  useDayOverview,
  formatCallTime,
  formatDate,
  getDayStatus,
} from './useDayView';
export type {
  DayListItem,
  DayOverview,
  DayMetadata,
  CallSheetSummary,
  DailyBudgetSummary,
  DailiesDaySummary,
  TravelItemSummary,
  UpdateSummary,
  TimecardEntrySummary,
  SceneScheduled,
  CrewSummary,
} from './useDayView';

// Person View (Glue View)
export {
  usePeopleList,
  usePersonOverview,
  useMyPersonOverview,
  getRoleLabel,
  getTimecardStatusColor,
  getTimecardStatusLabel,
  BACKLOT_ROLE_LABELS,
} from './usePersonView';
export type {
  PersonListItem,
  PersonOverview,
  PersonIdentity,
  PersonRole,
  ScheduledDay,
  CreditInfo,
  PersonStats,
} from './usePersonView';

// Timecards
export {
  useMyTimecards,
  useTimecardsForReview,
  useTimecard,
  useTimecardSummary,
  useCreateTimecard,
  useUpsertTimecardEntry,
  useDeleteTimecardEntry,
  useImportCheckinsToTimecard,
  useTimecardPreview,
  useSubmitTimecard,
  useApproveTimecard,
  useRejectTimecard,
  useDenyTimecard,
  // Live Clock Tracking
  useTodayClockStatus,
  useClockIn,
  useClockOut,
  useResetClock,
  useUnwrap,
  useLunchStart,
  useLunchEnd,
  calculateRunningDuration,
  // Helpers
  getWeekStartDate,
  getWeekDates,
  formatWeekRange,
  calculateHoursFromTimes,
  formatRunningTime,
  TIMECARD_STATUS_CONFIG,
  RATE_TYPES,
} from './useTimecards';
export type {
  Timecard,
  TimecardEntry,
  TimecardWithEntries,
  TimecardListItem,
  TimecardSummary as TimecardSummaryStats,
  CreateEntryData,
  ImportCheckinsResponse,
  TimecardWarning,
  TimecardPreviewEntry,
  TimecardPreview,
  // Live Clock Types
  ClockStatus,
  ClockActionResponse,
  OvertimeBreakdown,
  PayBreakdown,
} from './useTimecards';

// Camera & Continuity Tools
export {
  // Shot List (aliased to avoid conflict with useShotLists.ts)
  useShotList as useCameraShotList,
  useCreateShot,
  useUpdateShot,
  useDeleteShot,
  // Slate Logger
  useSlateLogs,
  useNextTakeNumber,
  useCreateSlateLog,
  useUpdateSlateLog,
  useDeleteSlateLog,
  // Camera Media
  useCameraMedia,
  useCreateCameraMedia,
  useUpdateCameraMedia,
  useDeleteCameraMedia,
  // Continuity Notes
  useContinuityNotes,
  useCreateContinuityNote,
  useUpdateContinuityNote,
  useDeleteContinuityNote,
  // Constants
  SHOT_STATUSES,
  FRAMING_OPTIONS,
  MEDIA_TYPES,
  MEDIA_STATUSES,
  CONTINUITY_DEPARTMENTS,
} from './useCameraContinuity';
export type {
  ShotListItem,
  SlateLogItem,
  CameraMediaItem,
  ContinuityNoteItem,
} from './useCameraContinuity';

// Camera Log (Quick take logging for 1st AC / 2nd AC)
export {
  useCameraLogs,
  useCreateCameraLog,
  useUpdateCameraLog,
  useDeleteCameraLog,
  useToggleCircleTake,
  useCameraSettings,
  useUpdateCameraSettings,
  useNextTakeNumber as useCameraNextTake,
  SHOT_TYPES as CAMERA_SHOT_TYPES,
  DEFAULT_LENS_PRESETS,
  DEFAULT_FILTER_PRESETS,
  DEFAULT_IRIS_PRESETS,
  DEFAULT_CAMERA_IDS,
  CAMERA_LOG_KEYS,
  CAMERA_LOG_STORAGE_KEYS,
  getLastUsedSettings,
  saveLastUsedSettings,
} from './useCameraLog';
export type {
  CameraLogItem,
  CreateCameraLogInput,
  UpdateCameraLogInput,
  CameraSettings,
  UpdateCameraSettingsInput,
  NextTakeInfo,
} from './useCameraLog';

// Utilities (Sun/Weather, Check-in, Notes, Bookmarks)
export {
  // Day Settings & Weather
  useDaySettings,
  useDaySettingsForDate,
  useSunWeather,
  useCreateDaySettings,
  useUpdateDaySettings,
  // Check-in Sessions (Admin)
  useCheckinSessions,
  useCheckinSession,
  useCreateCheckinSession,
  useActivateCheckinSession,
  useDeactivateCheckinSession,
  useSessionCheckins,
  // Crew Check-in
  useSessionByToken,
  usePerformCheckin,
  usePerformCheckout,
  useMyCheckins,
  // Personal Notes
  useMyNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  // Bookmarks
  useMyBookmarks,
  useCreateBookmark,
  useDeleteBookmark,
  useDeleteBookmarkByEntity,
  useCheckBookmark,
  // Constants
  BOOKMARK_ENTITY_TYPES,
  NOTE_COLORS,
} from './useUtilities';
export type {
  DaySettings,
  SunWeatherData,
  CheckinSession,
  CheckinRecord,
  PerformCheckoutInput,
  MyCheckinRecord,
  UserNote,
  UserBookmark,
} from './useUtilities';

// Expenses (Mileage, Kit Rentals, Per Diem)
export {
  // Mileage
  useMileageEntries,
  useMileageEntry,
  useCreateMileage,
  useUpdateMileage,
  useDeleteMileage,
  useApproveMileage,
  useRejectMileage,
  useDenyMileage,
  useResubmitMileage,
  useMarkMileageReimbursed,
  useSubmitMileageForApproval,
  useBulkSubmitMileageForApproval,
  // Kit Rentals
  useKitRentals,
  useKitRental,
  useCreateKitRental,
  useUpdateKitRental,
  useDeleteKitRental,
  useSubmitKitRentalForApproval,
  useBulkSubmitKitRentalsForApproval,
  useApproveKitRental,
  useRejectKitRental,
  useDenyKitRental,
  useResubmitKitRental,
  useCompleteKitRental,
  useMarkKitRentalReimbursed,
  useKitRentalGearOptions,
  // Kit Rental Types
  type KitRental,
  type KitRentalGearSourceType,
  type GearAssetOption,
  type GearKitOption,
  type GearOrganizationOption,
  type GearOptionsResponse,
  type GearOptionsFilters,
  // Per Diem
  usePerDiemEntries,
  usePerDiemEntry,
  useClaimPerDiem,
  useBulkClaimPerDiem,
  useUpdatePerDiem,
  useDeletePerDiem,
  useSubmitPerDiemForApproval,
  useBulkSubmitPerDiemForApproval,
  useApprovePerDiem,
  useRejectPerDiem,
  useDenyPerDiem,
  useResubmitPerDiem,
  useMarkPerDiemReimbursed,
  useBulkApprovePerDiem,
  useBulkRejectPerDiem,
  // Settings
  useExpenseSettings,
  useUpdateExpenseSettings,
  // Summary
  useExpenseSummary,
  // Geocoding / Place Search
  useSearchPlaces,
  useCalculateRoute,
  // Constants
  MILEAGE_PURPOSE_OPTIONS,
  MEAL_TYPE_OPTIONS,
  RENTAL_TYPE_OPTIONS,
  EXPENSE_STATUS_CONFIG,
  formatCurrency,
  calculateMileageTotal,
} from './useExpenses';
export type {
  MileageEntry,
  CreateMileageData,
  UpdateMileageData,
  MileageFilters,
  KitRental,
  CreateKitRentalData,
  UpdateKitRentalData,
  KitRentalFilters,
  PerDiemEntry,
  CreatePerDiemData,
  BulkPerDiemData,
  UpdatePerDiemData,
  PerDiemFilters,
  ExpenseSettings,
  UpdateExpenseSettingsData,
  ExpenseSummary,
  ExpenseSummaryFilters,
  PlaceSuggestion,
  RouteCalculationResult,
} from './useExpenses';

// Scripty Workspace (Script Supervisor Continuity)
export {
  // Lining Marks
  useLiningMarks,
  useCreateLiningMark,
  useUpdateLiningMark,
  useDeleteLiningMark,
  // Takes (enhanced for Scripty)
  useTakes as useScriptyTakes,
  useCreateTake as useCreateScriptyTake,
  useUpdateTake as useUpdateScriptyTake,
  useDeleteTake as useDeleteScriptyTake,
  // Take Notes
  useTakeNotes,
  useCreateTakeNote,
  // Continuity Photos
  useContinuityPhotos,
  useUploadContinuityPhoto,
  useUpdateContinuityPhoto,
  useDeleteContinuityPhoto,
  // Scene-level Continuity Notes (Scripty workspace)
  useContinuityNotes as useSceneContinuityNotes,
  useCreateContinuityNote as useCreateSceneContinuityNote,
  useUpdateContinuityNote as useUpdateSceneContinuityNote,
  useDeleteContinuityNote as useDeleteSceneContinuityNote,
} from './useContinuity';
export type {
  LiningMark,
  TakeNote,
  ContinuityPhoto,
  ContinuityPhotoTag,
  Take as ScriptyTake,
  ContinuityNote as SceneContinuityNote,
} from './useContinuity';

// Church Production Tools
export {
  // Section A: Service Planning
  useServicePlans,
  useServicePlan,
  useCreateServicePlan,
  useUpdateServicePlan,
  useCloneServicePlan,
  useRehearsals,
  useCreateRehearsal,
  useTechAssignments,
  useCreateTechAssignment,
  // Section B: Volunteers & Training
  useVolunteerShifts,
  useCreateVolunteerShift,
  useTrainingModules,
  useMyTrainingProgress,
  useSkillsDirectory,
  usePositionCards,
  // Section C: Content & Requests
  useClipRequests,
  useMyClipRequests,
  useCreateClipRequest,
  useStoryLeads,
  useContentShoots,
  useAnnouncements,
  // Section D: Calendar & Briefs
  useChurchEvents,
  useChurchEvent,
  useCreateChurchEvent,
  useCreativeBriefs,
  useLicenses,
  useExpiringLicenses,
  // Section E: Gear & Routing
  useRooms,
  useGearInventory,
  useGearCategories as useChurchGearCategories,
  useReservations,
  useMyReservations,
  useCreateReservation,
  usePatchMatrices,
  useCameraPlots as useChurchCameraPlots,
  // Section F: Sunday Readiness
  usePreflightChecklists,
  useChecklistTemplates,
  useInstantiateChecklist,
  useCompleteChecklist,
  useStreamQCSessions,
  useCreateStreamQCSession,
  useMacroLibrary,
  useMacroCategories,
  useCreateMacro,
  useDuplicateMacro,
} from './useChurchTools';
export type {
  // Service Planning
  ServicePlan,
  CreateServicePlanInput,
  RehearsalPlan,
  TechAssignment,
  // Volunteers & Training
  VolunteerShift,
  TrainingModule,
  TrainingProgress,
  SkillEntry,
  PositionCard,
  // Content & Requests
  ClipRequest,
  StoryLead,
  ContentShoot,
  Announcement,
  // Calendar & Briefs
  ChurchEvent,
  CreativeBrief,
  License,
  // Gear & Routing
  Room,
  GearItem as ChurchGearItem,
  Reservation,
  PatchMatrix,
  CameraPlot as ChurchCameraPlot,
  // Sunday Readiness
  PreflightChecklist,
  StreamQCSession,
  MacroCommand,
} from './useChurchTools';

// Desktop Helper & Clip-Asset Links
export {
  useDesktopHelper,
  useDesktopApiKeys,
} from './useDesktopHelper';

export type {
  HelperStatus,
  LocalDrive,
  LocalFile,
  LinkedDrive,
  DesktopApiKey,
  CreateApiKeyResponse,
} from './useDesktopHelper';

export {
  useClipLinkedAssets,
  useAssetSourceClips,
  useLinkClipToAsset,
  useBulkLinkClipsToAsset,
  useRemoveClipAssetLink,
} from './useClipAssetLinks';

export type {
  ClipAssetLink,
  LinkedClip,
  LinkedAsset,
} from './useClipAssetLinks';

// Hot Set (Production Day)
export {
  HOT_SET_KEYS,
  useHotSetSessions,
  useHotSetSession,
  useCreateHotSetSession,
  useUpdateHotSetSession,
  useDeleteHotSetSession,
  useStartHotSetSession,
  useWrapHotSetSession,
  useImportFromCallSheet,
  useHotSetScenes,
  useStartScene,
  useCompleteScene,
  useSkipScene,
  useReorderScenes,
  useHotSetMarkers,
  useAddMarker,
  useHotSetDashboard,
  useHotSetCostProjection,
  useHotSetCrew,
  formatElapsedTime,
  formatTime,
  calculateElapsedSeconds,
  formatSeconds,
  getScheduleStatusColor,
  getScheduleStatusBgColor,
  formatCurrency as formatHotSetCurrency,
} from './useHotSet';

// Invoices
export {
  useMyInvoices,
  useInvoicesForReview,
  useInvoice,
  useInvoiceSummary,
  useNextInvoiceNumber,
  useImportableInvoiceData,
  useInvoicePrefillData,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useAddLineItem,
  useUpdateLineItem,
  useDeleteLineItem,
  useSendInvoice,
  useMarkInvoicePaid,
  useCancelInvoice,
  useSubmitForApproval,
  useApproveInvoice,
  useDenyInvoice,
  useRequestChanges,
  useRequestChanges as useRequestInvoiceChanges,
  useMarkInvoiceSent,
  useImportTimecards,
  useImportExpenses,
  usePendingImportCount,
  useUnlinkLineItem,
  useReorderLineItem,
  formatCurrency as formatInvoiceCurrency,
  formatInvoiceDate,
  calculateDueDate,
  getDefaultUnit,
  isInvoiceOverdue,
} from './useInvoices';
export type { PendingImportCount } from './useInvoices';

// Purchase Orders
export {
  usePurchaseOrders,
  useMyPurchaseOrders,
  usePurchaseOrder,
  usePurchaseOrderSummary,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useApprovePurchaseOrder,
  useRejectPurchaseOrder,
  useDenyPurchaseOrder,
  useResubmitPurchaseOrder,
  useCompletePurchaseOrder,
  useCancelPurchaseOrder,
  useSubmitPurchaseOrderForApproval,
  useBulkSubmitPurchaseOrdersForApproval,
  PO_STATUS_CONFIG,
  formatCurrency as formatPOCurrency,
} from './usePurchaseOrders';
export type {
  PurchaseOrder,
  PurchaseOrderStatus,
  CreatePurchaseOrderData,
  UpdatePurchaseOrderData,
  PurchaseOrderFilters,
  PurchaseOrderSummary,
} from './usePurchaseOrders';

// Document Packages (Crew Onboarding)
export {
  useDocumentPackages,
  useDocumentPackage,
  usePackageAssignments,
  useUserPackageAssignments,
  useSendPackage,
  useCancelPackageAssignment,
} from './useDocumentPackages';

// Pending Documents (Signing Portal)
export {
  usePendingDocuments,
  useDocumentHistory,
  useBatchSign,
} from './usePendingDocuments';

// Clearance Approvals
export {
  useClearanceApproval,
  usePendingApprovals,
  useConfigureApproval,
  useApproveClearance,
  useRequestClearanceChanges,
  useRejectClearance,
} from './useClearanceApproval';

// Crew Document Summary (Cast/Crew tracking)
export {
  useCrewDocumentSummary,
  usePersonDocumentChecklist,
} from './useCrewDocuments';

// Dashboard Summary Widgets (Cross-project aggregation)
export {
  useScheduleSummary,
  useDailiesSummaryWidget,
  useCastingSummary,
  useBudgetSummaryWidget,
} from './useDashboardSummaries';
export type {
  ScheduleConflict,
  ScheduleShootDay,
  ScheduleSummary,
  DailiesRecentUpload,
  DailiesSummaryWidget,
  CastingApplication,
  ScheduledAudition,
  CastingSummary,
  BudgetAlert,
  BudgetSummaryWidget,
} from './useDashboardSummaries';

// Day Out of Days (DOOD)
export {
  useDoodRange,
  useGenerateDoodDays,
  useSyncDoodDaysFromSchedule,
  useCreateDoodSubject,
  useUpdateDoodSubject,
  useDeleteDoodSubject,
  useUpsertDoodAssignment,
  usePublishDood,
  useDoodVersions,
  useAvailableDoodSubjects,
  getDoodExportUrl,
  getDoodPdfExportUrl,
  calculateSubjectTotals,
  getCodeInfo,
  DOOD_CODES,
  SUBJECT_TYPES,
} from './useDood';
export type {
  DoodDay,
  DoodSubject,
  DoodAssignment,
  DoodVersion,
  DoodRangeData,
  AvailableCastMember,
  AvailableCrewMember,
  AvailableContact,
  AvailableTeamMember,
  AvailableSubjectsData,
} from './useDood';

// Storyboard
export {
  useStoryboards,
  useStoryboard,
  useCreateStoryboard,
  useUpdateStoryboard,
  useDeleteStoryboard,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useCreatePanel,
  useUpdatePanel,
  useDeletePanel,
  useReorderSections,
  useReorderPanels,
  useStoryboardPrint,
  getStoryboardExportUrl,
  calculateTotalDuration,
  formatDuration,
  getShotSizeInfo,
  getCameraMoveInfo,
  // Panel image upload
  usePanelImageUpload,
  // Call sheet storyboard links
  useCallSheetStoryboards,
  useCallSheetStoryboardLink,
  // Query by entity
  useStoryboardsByScene,
  useStoryboardsByEpisode,
  useStoryboardsByShotList,
  // Constants
  SHOT_SIZES,
  CAMERA_MOVES,
  ASPECT_RATIOS,
} from './useStoryboard';
export type {
  Storyboard,
  StoryboardSection,
  StoryboardPanel,
  StoryboardPrintData,
  StoryboardViewMode,
} from './useStoryboard';

// Episodes
export {
  // Seasons
  useSeasons,
  useCreateSeason,
  useUpdateSeason,
  useDeleteSeason,
  // Episodes
  useEpisodes,
  useEpisode,
  useCreateEpisode,
  useUpdateEpisode,
  useDeleteEpisode,
  // Subjects
  useCreateSubject,
  useUpdateSubject,
  useDeleteSubject,
  useLinkContact,
  // Locations
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  useLinkProjectLocation,
  // List Items
  useCreateListItem,
  useUpdateListItem,
  useDeleteListItem,
  useReorderListItem,
  // Milestones
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  // Deliverables
  useEpisodeDeliverableTemplates,
  useCreateDeliverableTemplate,
  useCreateDeliverable,
  useUpdateDeliverable,
  useDeleteDeliverable,
  useApplyDeliverableTemplate,
  useLinkProjectDeliverable,
  // Asset Links
  useCreateAssetLink,
  useDeleteAssetLink,
  useLinkAsset,
  // Shoot Days
  useProjectDays,
  useTagShootDay,
  useUntagShootDay,
  // Storyboard Linking
  useProjectStoryboards,
  useLinkStoryboard,
  useUnlinkStoryboard,
  // Approvals
  useRequestApproval,
  useDecideApproval,
  useUnlockEpisode,
  // Settings
  useEpisodeSettings,
  useUpdateEpisodeSettings,
  // Milestone Import
  useAllMilestones,
  useImportMilestones,
  // Import/Export
  useImportEpisodes,
  usePrintData,
  // Helpers
  getEpisodeExportUrl,
  getImportTemplateUrl,
  getPipelineStageInfo,
  getEditStatusInfo,
  getDeliveryStatusInfo,
  getDeliverableStatusInfo,
  getApprovalTypeInfo,
  formatEpisodeCode,
  // Constants
  PIPELINE_STAGES,
  EDIT_STATUSES,
  DELIVERY_STATUSES,
  SUBJECT_TYPES as EPISODE_SUBJECT_TYPES,
  LIST_ITEM_KINDS,
  DELIVERABLE_STATUSES_CONFIG,
  APPROVAL_TYPES,
} from './useEpisodes';
export type {
  Season,
  Episode,
  EpisodeDetail,
  EpisodeSubject,
  EpisodeLocation,
  EpisodeListItem,
  EpisodeMilestone,
  EpisodeDeliverable,
  EpisodeAssetLink,
  EpisodeShootDay,
  EpisodeApproval,
  EpisodeStoryboard,
  DeliverableTemplate,
  ProjectDay,
  EpisodeSettings,
  PrintData as EpisodePrintData,
  EpisodePipelineStage,
  EpisodeEditStatus,
  EpisodeDeliveryStatus,
  EpisodeSubjectType,
  EpisodeListItemKind,
  DeliverableStatus,
  ApprovalType,
  ApprovalStatus,
  MilestoneWithEpisode,
  SubjectWithContactData,
} from './useEpisodes';

// Moodboard
export {
  useMoodboards,
  useMoodboard,
  useCreateMoodboard,
  useUpdateMoodboard,
  useDeleteMoodboard,
  useCreateSection as useCreateMoodboardSection,
  useUpdateSection as useUpdateMoodboardSection,
  useDeleteSection as useDeleteMoodboardSection,
  useReorderSections as useReorderMoodboardSections,
  useCreateItem as useCreateMoodboardItem,
  useUpdateItem as useUpdateMoodboardItem,
  useDeleteItem as useDeleteMoodboardItem,
  useReorderItems as useReorderMoodboardItems,
  useItemImageUpload as useMoodboardItemImageUpload,
  useMoodboardPrintData,
  getMoodboardExportUrl,
  MOODBOARD_CATEGORIES,
} from './useMoodboard';
export type {
  Moodboard,
  MoodboardSection,
  MoodboardItem,
  MoodboardPrintData,
  MoodboardCategory,
  AspectRatio,
} from './useMoodboard';

// Story Management (Beat Sheet)
export {
  useStories,
  useStory,
  useCreateStory,
  useUpdateStory,
  useDeleteStory,
  useCreateBeat,
  useUpdateBeat,
  useDeleteBeat,
  useReorderBeats,
  useCharacters,
  useCreateCharacter,
  useCreateCharacterFromContact,
  useUpdateCharacter,
  useDeleteCharacter,
  useCreateCharacterArc,
  useUpdateCharacterArc,
  useDeleteCharacterArc,
  useStoryPrintData,
  getStoryExportUrl,
  // Story connections
  useBeatSceneLinks,
  useLinkBeatToScene,
  useUnlinkBeatFromScene,
  useStoryEpisodeLinks,
  useLinkStoryToEpisode,
  useUnlinkStoryFromEpisode,
  useCharacterCastLinks,
  useLinkCharacterToCast,
  useUnlinkCharacterFromCast,
  // Beat Sheet Templates & PDF Export
  useBeatTemplates,
  useApplyTemplate,
  getBeatSheetPdfUrl,
} from './useStoryManagement';
export type {
  Story,
  StoryBeat,
  StoryCharacter,
  CharacterArc,
  StoryPrintData,
  BeatSceneLink,
  StoryEpisodeLink,
  CharacterCastLink,
  BeatTemplate,
} from './useStoryManagement';

// Script Sides
export {
  useActiveScript,
  useCreateScript,
  useUpdateScript,
  useScriptScenes,
  useProductionDaysForSides,
  useSidesPackets,
  useSidesPacket,
  useCreateSidesPacket,
  useUpdateSidesPacket,
  useDeleteSidesPacket,
  useAddSceneToPacket,
  useUpdatePacketScene,
  useRemoveSceneFromPacket,
  useReorderPacketScene,
  useSyncPacketFromSchedule,
  useSidesPrintData,
  useScheduleDayScenes,
  useAddSceneToSchedule,
  useRemoveSceneFromSchedule,
} from './useScriptSides';
export type {
  ScriptDocument,
  ScriptScene,
  ProductionDay as SidesProductionDay,
  SidesPacket,
  PacketScene,
  SidesPacketDetail,
  SidesPrintData,
} from './useScriptSides';

// Stripboard
export {
  useActiveStripboard,
  useCreateStripboard,
  useUpdateStripboard,
  useStripboardView,
  useStripboardPrintData,
  useGenerateStripsFromScript,
  useGenerateStripsFromScenes,
  useGenerateStripsFromCallSheet,
  useCallSheetsForStripboard,
  useCreateStrip,
  useUpdateStrip,
  useDeleteStrip,
  useReorderStrip,
  useSyncStripboardWithSchedule,
  getStripboardExportUrl,
  getStripboardPdfExportUrl,
  STRIP_UNITS,
  STRIP_STATUSES,
} from './useStripboard';
export type {
  Stripboard,
  Strip,
  ProductionDay as StripboardProductionDay,
  CastMismatch,
  DayColumn,
  StripboardViewData,
  StripboardSummary,
  StripboardPrintData,
  CallSheetOption,
  GenerateResult,
  SyncDirection,
  SyncResult,
} from './useStripboard';

// Project Files
export {
  // Folders
  useProjectFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  // Files
  useProjectFiles as useProjectFilesList,
  useUpdateFile,
  useDeleteFile,
  useFileDownloadUrl,
  // File Links
  useFilesByTarget,
  useFileLinks,
  useCreateFileLink,
  useDeleteFileLink,
  // Upload
  useInitiateUpload,
  useGetPartUrl,
  useCompleteUpload,
  useAbortUpload,
  useFinalizeUpload,
  useProjectFileTags as useFileTags,
  // Upload Manager
  FileUploadManager,
  // Utilities
  getFileIcon,
  formatFileSize,
  getFileTypeFilter,
  FILE_TYPE_FILTERS,
  LINK_TARGET_TYPES,
} from './useProjectFiles';
export type {
  ProjectFolder,
  ProjectFile,
  FileLink,
  InitiateUploadResponse,
  UploadProgress,
  FileTypeFilter,
  LinkTargetType,
} from './useProjectFiles';

// Continuity Exports (PDF version history)
export {
  useContinuityExports,
  useContinuityExport,
  useSaveContinuityExport,
  useUpdateContinuityExport,
  useDeleteContinuityExport,
} from './useContinuityExports';
export type {
  ContinuityExport,
  ContinuityExportSceneMapping,
  ContinuityExportSceneMappings,
  SaveContinuityExportInput,
} from './useContinuityExports';

// Continuity Export Annotations (Version-Specific PDF Annotations)
export {
  // Highlights
  useExportHighlights,
  useCreateExportHighlight,
  useUpdateExportHighlight,
  useDeleteExportHighlight,
  // Notes
  useExportNotes,
  useCreateExportNote,
  useUpdateExportNote,
  useDeleteExportNote,
  // Drawings
  useExportDrawings,
  useCreateExportDrawing,
  useUpdateExportDrawing,
  useDeleteExportDrawing,
  // Combined
  useExportAnnotations,
} from './useContinuityExportAnnotations';
export type {
  ExportHighlight,
  ExportNote,
  ExportDrawing,
  DrawingToolType,
  PathData,
  PathPoint,
  PenPathData,
  LinePathData,
  ArrowPathData,
  RectanglePathData,
  CirclePathData,
  TextPathData,
  CreateHighlightInput,
  UpdateHighlightInput,
  CreateNoteInput,
  UpdateNoteInput,
  CreateDrawingInput,
  UpdateDrawingInput,
} from './useContinuityExportAnnotations';

// Script Sides Exports (PDF-based extraction from master script)
export {
  // List & Get
  useScriptSidesExports,
  useScriptSidesExport,
  useScriptSidesForDay,
  useScriptSidesForCallSheet,
  // Generate & Regenerate
  useGenerateScriptSides,
  useRegenerateScriptSides,
  // Update & Delete
  useUpdateScriptSidesExport,
  useDeleteScriptSidesExport,
  // Outdated Detection
  useCheckOutdatedSides,
  useIsSidesOutdated,
  // Helpers
  getSidesDisplayName,
  getSidesStatusColor,
  formatSceneCount,
} from './useScriptSidesExports';
export type {
  ScriptSidesExport,
  ScriptSidesListItem,
  GenerateScriptSidesInput,
  OutdatedSidesInfo,
} from './useScriptSidesExports';
