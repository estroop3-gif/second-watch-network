/**
 * Messages Components
 * Export all messaging-related components
 */

// Core message views
export { MessageView } from './MessageView';
export { ChannelView } from './ChannelView';
export { ConversationList } from './ConversationList';

// Embedded panel for workspaces
export { MessagesPanel } from './MessagesPanel';
export type { MessagesPanelContext } from './MessagesPanel';

// Modals and dialogs
export { NewMessageModal } from './NewMessageModal';

// E2EE setup
export { E2EESetup } from './E2EESetup';

// Templates
export { ApplicantQuickTemplates } from './ApplicantQuickTemplates';

// Attachments
export { AttachmentUploader } from './AttachmentUploader';
export { MessageAttachments } from './MessageAttachment';

// Specialized views
export { ProjectUpdateView } from './ProjectUpdateView';

// Custom Folders
export { CustomFolderList, FOLDER_ICON_OPTIONS, FOLDER_COLOR_OPTIONS } from './CustomFolderList';
export { FolderManagementModal } from './FolderManagementModal';
export { MoveToFolderMenu, FolderBadge } from './MoveToFolderMenu';
export { FolderRulesManager } from './FolderRulesManager';
export { RuleConditionBuilder } from './RuleConditionBuilder';
export { FolderSettingsPanel } from './FolderSettingsPanel';
