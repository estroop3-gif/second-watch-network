/**
 * FolderSettingsPanel
 * Settings panel for managing custom message folders
 * Combines folder list management with rules management
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useCustomFolders, CustomFolder } from '@/hooks/useCustomFolders';
import { FolderManagementModal } from './FolderManagementModal';
import { FolderRulesManager } from './FolderRulesManager';
import { PrivacySettingsTab } from './PrivacySettingsTab';
import { BlockedUsersTab } from './BlockedUsersTab';
import { NotificationSettingsTab } from './NotificationSettingsTab';
import {
  Plus,
  Edit2,
  GripVertical,
  Folder,
  Zap,
  Loader2,
  Star,
  Heart,
  Briefcase,
  Home,
  Users,
  Tag,
  Flag,
  Bookmark,
  Bell,
  Coffee,
  Gift,
  Music,
  Camera,
  Shield,
  ShieldCheck,
  Lock,
  UserX,
  BellOff,
} from 'lucide-react';

// Icon component map
const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star,
  heart: Heart,
  briefcase: Briefcase,
  home: Home,
  users: Users,
  tag: Tag,
  flag: Flag,
  bookmark: Bookmark,
  bell: Bell,
  zap: Zap,
  coffee: Coffee,
  gift: Gift,
  music: Music,
  camera: Camera,
  folder: Folder,
};

interface FolderSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  e2eeEnabled?: boolean;
  onEnableE2EE?: () => void;
}

type TabType = 'folders' | 'rules' | 'security' | 'privacy' | 'blocked' | 'notifications';

export function FolderSettingsPanel({ isOpen, onClose, e2eeEnabled, onEnableE2EE }: FolderSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('folders');
  const [editingFolder, setEditingFolder] = useState<CustomFolder | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [showRulesManager, setShowRulesManager] = useState(false);

  const { data: folders, isLoading } = useCustomFolders();

  const handleEditFolder = (folder: CustomFolder) => {
    setEditingFolder(folder);
  };

  const handleCreateFolder = () => {
    setIsCreatingFolder(true);
  };

  const handleCloseFolderModal = () => {
    setEditingFolder(null);
    setIsCreatingFolder(false);
  };

  if (showRulesManager) {
    return (
      <FolderRulesManager
        isOpen={isOpen}
        onClose={() => {
          setShowRulesManager(false);
          onClose();
        }}
      />
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] bg-charcoal-black border-muted-gray text-bone-white">
          <DialogHeader>
            <DialogTitle>Message Settings</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
            <TabsList className="grid w-full grid-cols-6 bg-muted-gray/20">
              <TabsTrigger value="folders" className="data-[state=active]:bg-accent-yellow/20 text-xs px-2">
                <Folder className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Folders</span>
              </TabsTrigger>
              <TabsTrigger value="rules" className="data-[state=active]:bg-accent-yellow/20 text-xs px-2">
                <Zap className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Rules</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="data-[state=active]:bg-accent-yellow/20 text-xs px-2">
                <Lock className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Privacy</span>
              </TabsTrigger>
              <TabsTrigger value="blocked" className="data-[state=active]:bg-accent-yellow/20 text-xs px-2">
                <UserX className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Blocked</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="data-[state=active]:bg-accent-yellow/20 text-xs px-2">
                <BellOff className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Muted</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="data-[state=active]:bg-accent-yellow/20 text-xs px-2">
                <Shield className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="folders" className="mt-4">
              <FoldersTab
                folders={folders || []}
                isLoading={isLoading}
                onEdit={handleEditFolder}
                onCreate={handleCreateFolder}
              />
            </TabsContent>

            <TabsContent value="rules" className="mt-4">
              <RulesTab onManageRules={() => setShowRulesManager(true)} />
            </TabsContent>

            <TabsContent value="privacy" className="mt-4">
              <PrivacySettingsTab />
            </TabsContent>

            <TabsContent value="blocked" className="mt-4">
              <BlockedUsersTab />
            </TabsContent>

            <TabsContent value="notifications" className="mt-4">
              <NotificationSettingsTab />
            </TabsContent>

            <TabsContent value="security" className="mt-4">
              <SecurityTab e2eeEnabled={e2eeEnabled} onEnableE2EE={onEnableE2EE} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Folder management modal */}
      <FolderManagementModal
        isOpen={isCreatingFolder || !!editingFolder}
        onClose={handleCloseFolderModal}
        folder={editingFolder}
      />
    </>
  );
}

interface FoldersTabProps {
  folders: CustomFolder[];
  isLoading: boolean;
  onEdit: (folder: CustomFolder) => void;
  onCreate: () => void;
}

function FoldersTab({ folders, isLoading, onEdit, onCreate }: FoldersTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {folders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No custom folders yet</p>
          <p className="text-sm mt-1">Create folders to organize your conversations</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {folders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                onEdit={() => onEdit(folder)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <Button onClick={onCreate} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Create New Folder
      </Button>
    </div>
  );
}

interface FolderItemProps {
  folder: CustomFolder;
  onEdit: () => void;
}

function FolderItem({ folder, onEdit }: FolderItemProps) {
  const Icon = ICON_COMPONENTS[folder.icon || 'folder'] || Folder;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
      <Icon
        className="h-5 w-5"
        style={{ color: folder.color || undefined }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{folder.name}</p>
        <p className="text-xs text-muted-foreground">
          {folder.conversation_count} conversation{folder.conversation_count !== 1 ? 's' : ''}
          {folder.unread_count > 0 && ` • ${folder.unread_count} unread`}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        className="h-8 w-8"
      >
        <Edit2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface RulesTabProps {
  onManageRules: () => void;
}

function RulesTab({ onManageRules }: RulesTabProps) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <p>
          Create rules to automatically sort incoming messages into folders based on:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Who sent the message</li>
          <li>Keywords in the message</li>
          <li>Message context (application, project, etc.)</li>
        </ul>
      </div>

      <Button onClick={onManageRules} className="w-full">
        <Zap className="h-4 w-4 mr-2" />
        Manage Rules
      </Button>
    </div>
  );
}

interface SecurityTabProps {
  e2eeEnabled?: boolean;
  onEnableE2EE?: () => void;
}

function SecurityTab({ e2eeEnabled, onEnableE2EE }: SecurityTabProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
        <div className="flex items-start gap-3">
          {e2eeEnabled ? (
            <ShieldCheck className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <Shield className="h-6 w-6 text-muted-foreground flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className="font-medium">
              {e2eeEnabled ? 'End-to-End Encryption Enabled' : 'End-to-End Encryption'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {e2eeEnabled
                ? 'Your messages are encrypted and can only be read by you and your recipients.'
                : 'Enable E2EE to encrypt your messages so only you and your recipients can read them.'}
            </p>
          </div>
        </div>
      </div>

      {!e2eeEnabled && onEnableE2EE && (
        <Button onClick={onEnableE2EE} className="w-full">
          <Shield className="h-4 w-4 mr-2" />
          Enable End-to-End Encryption
        </Button>
      )}

      <div className="text-xs text-muted-foreground">
        <p>
          E2EE uses cryptographic keys stored on your device. Messages are encrypted before
          being sent and can only be decrypted by intended recipients.
        </p>
      </div>
    </div>
  );
}
