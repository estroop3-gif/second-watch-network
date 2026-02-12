export {
  useContacts,
  useContact,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useLinkProfile,
  useContactNotes,
  useCreateContactNote,
  useDeleteContactNote,
} from './useContacts';

export {
  useActivities,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
  useActivityCalendar,
  useFollowUps,
} from './useActivities';

export {
  useMyInteractionsToday,
  useIncrementInteraction,
  useDecrementInteraction,
  useCRMReps,
  useCRMAdminInteractions,
  useAssignContact,
  useBulkAssignContacts,
  useAddCRMTeamMember,
  useRemoveCRMTeamMember,
  useUpdateCRMTeamMemberRole,
} from './useInteractions';

export {
  useDeals,
  useDeal,
  usePipeline,
  usePipelineStats,
  useCreateDeal,
  useUpdateDeal,
  useChangeDealStage,
  useDeleteDeal,
  useCRMLeads,
  useAssignDeal,
  usePipelineForecast,
} from './useDeals';

export {
  useMyGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useSetGoalOverride,
} from './useGoals';

export {
  useKPIOverview,
  useRepPerformance,
  useKPITrends,
  useLeaderboard,
} from './useKPI';

export {
  useContactLog,
  useCreateLogEntry,
  useUpdateLogEntry,
  useOpenLogEntries,
  useEscalateLogEntry,
} from './useCustomerLog';

export {
  useMyReviews,
  useAdminReviews,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
} from './useReviews';

export {
  useCampaigns,
  useCampaign,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useScheduleCampaign,
  useCancelCampaign,
  useUpdateContactDNC,
  useDNCList,
  useRepDNCList,
} from './useCampaigns';

export {
  useEmailAccount,
  useUpdateEmailSignature,
  useEmailSuggestions,
  useEmailInbox,
  useEmailThread,
  useContactThreads,
  useUnreadCount,
  useSendEmail,
  useMarkRead,
  useArchiveThread,
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  useEmailAccounts,
  useCreateEmailAccount,
  useDeactivateEmailAccount,
  // New feature hooks
  useStarThread,
  useSnoozeThread,
  useBulkThreadAction,
  useLinkContact,
  useUnlinkContact,
  useAssignThread,
  useThreadNotes,
  useCreateThreadNote,
  useDeleteThreadNote,
  useEmailLabels,
  useCreateEmailLabel,
  useUpdateEmailLabel,
  useDeleteEmailLabel,
  useAddThreadLabel,
  useRemoveThreadLabel,
  useQuickReplies,
  useCreateQuickReply,
  useUpdateQuickReply,
  useDeleteQuickReply,
  useUploadEmailAttachment,
  useDownloadEmailAttachment,
  useScheduledEmails,
  useCancelScheduledEmail,
  useAICompose,
  useAISummarize,
  useAISentiment,
  useEmailAnalytics,
} from './useEmail';

export {
  useSequences,
  useEnrollSequence,
  useUnenrollSequence,
  useContactSequences,
  useAdminSequences,
  useAdminSequence,
  useCreateSequence,
  useUpdateSequence,
  useDeleteSequence,
  useCreateSequenceStep,
  useUpdateSequenceStep,
  useDeleteSequenceStep,
} from './useSequences';

export {
  useEmailKeyboardShortcuts,
  KEYBOARD_SHORTCUTS,
} from './useEmailKeyboardShortcuts';

export { useSidebarBadges } from './useSidebarBadges';
