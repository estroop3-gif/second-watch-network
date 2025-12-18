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
} from './useCastingCrew';

// Clearances & Releases
export {
  useClearances,
  useClearanceItem,
  useClearanceSummary,
  useClearanceTemplates,
  useLocationClearances,
  usePersonClearances,
  useBulkClearanceStatus,
  locationHasSignedRelease,
  personHasSignedRelease,
  getClearanceStatusColor,
} from './useClearances';

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
} from './useDailies';

// Backlot Project Roles & View Config
export {
  useProjectRoles as useBacklotRoles,
  useMyProjectRoles,
  useViewConfig,
  useViewProfiles,
  useCanManageRoles,
  useCanViewAsRole,
  BACKLOT_ROLES,
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
  useSubmitTimecard,
  useApproveTimecard,
  useRejectTimecard,
  getWeekStartDate,
  getWeekDates,
  formatWeekRange,
  calculateHoursFromTimes,
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
  UserNote,
  UserBookmark,
} from './useUtilities';

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
