/**
 * CastingCrewTab - Main tab for managing project roles (cast & crew)
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useProjectRoles,
  useProjectRoleMutations,
  useBookedPeople,
  useDealMemos,
  useDealMemoMutations,
  useProject,
  useProjectCollabs,
  useCollabApplications,
  useProjectCollabMutations,
  useUpdateCollabApplicationStatus,
} from '@/hooks/backlot';
import { CommunityCollab, CollabApprovalStatus } from '@/types/community';
import { PRODUCTION_TYPE_LABELS, UNION_OPTIONS } from '@/types/productions';
import {
  BacklotProjectRole,
  BacklotProjectRoleType,
  BacklotProjectRoleStatus,
  PROJECT_ROLE_TYPE_LABELS,
  PROJECT_ROLE_STATUS_LABELS,
  PROJECT_ROLE_STATUS_COLORS,
  DealMemo,
  ProjectRoleInput,
  BacklotBookedPerson,
} from '@/types/backlot';
import CollabForm from '@/components/community/CollabForm';
import { ApplicationsBoard } from './ApplicationsBoard';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { CrewRatesTab } from './CrewRatesTab';
import { DealMemoSummary, DealMemoStatusBadge, DealMemoStatus, DealMemoWorkflow, DealMemoHistory } from './DealMemoStatus';
import { DealMemoDialog } from './DealMemoDialog';
import { useDealMemoHistory } from '@/hooks/backlot';
import { ClearanceStatusBadge } from './casting/ClearanceStatusBadge';
import { PersonClearancesSection } from './casting/PersonClearancesSection';
import { CrewDocumentDashboard, OnboardingProgressBadge } from './casting';
import { useCrewDocumentSummary } from '@/hooks/backlot';
import {
  Plus,
  Users,
  Video,
  Search,
  MoreVertical,
  Edit,
  Trash,
  Eye,
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle,
  UserCheck,
  Shield,
  Loader2,
  FileText,
  MessageSquare,
  Send,
  Megaphone,
  PenTool,
  Mail,
  FileSignature,
  Hash,
  Bell,
  Globe,
  AlertCircle,
  ExternalLink,
  Film,
  Tv,
  Briefcase,
  Building2,
  HelpCircle,
  Star,
  Camera,
  Image,
  VideoIcon,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { POSITIONS } from '@/components/shared/PositionSelector';
import { saveDraft, loadDraft, clearDraft as clearDraftStorage, buildDraftKey } from '@/lib/formDraftStorage';
import SearchableCombobox from '@/components/shared/SearchableCombobox';

interface CastingCrewTabProps {
  projectId: string;
  onNavigateToClearances?: (personId?: string, personName?: string) => void;
}

type TabType = 'roles' | 'booked' | 'availability' | 'documents' | 'rates';

export function CastingCrewTab({ projectId, onNavigateToClearances }: CastingCrewTabProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('roles');
  const [typeFilter, setTypeFilter] = useState<BacklotProjectRoleType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<BacklotProjectRoleStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [viewingApplications, setViewingApplications] = useState<BacklotProjectRole | null>(null);
  const [showSendDocumentDialog, setShowSendDocumentDialog] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [viewingBookedPerson, setViewingBookedPerson] = useState<BacklotBookedPerson | null>(null);
  const [bookedPersonDialogOpen, setBookedPersonDialogOpen] = useState(false);
  const [editingBookedPerson, setEditingBookedPerson] = useState<BacklotBookedPerson | null>(null);

  // Debug: Log when editingBookedPerson changes
  useEffect(() => {
    console.log('editingBookedPerson state changed to:', editingBookedPerson);
    if (editingBookedPerson) {
      console.log('EditBookingDialog should be rendering via portal for:', editingBookedPerson.name);
      console.log('Portal target exists?', !!document.body);

      // WORKAROUND: Force render by directly opening the dialog
      // This is a temporary hack to debug why the portal isn't rendering
      setTimeout(() => {
        const editContainer = document.getElementById('edit-booking-container');
        if (editContainer) {
          console.log('Edit container found, trying to make visible');
          editContainer.style.display = 'flex';
        } else {
          console.log('Edit container NOT found in DOM');
        }
      }, 100);
    }
  }, [editingBookedPerson]);

  // Collab states
  const [viewingCollab, setViewingCollab] = useState<CommunityCollab | null>(null);
  const [editingCollab, setEditingCollab] = useState<CommunityCollab | null>(null);
  const [viewingCollabApplications, setViewingCollabApplications] = useState<CommunityCollab | null>(null);

  // Get project data for CollabForm
  const { data: project } = useProject(projectId);

  // Deal memo dialog state
  const [showDealMemoDialog, setShowDealMemoDialog] = useState(false);
  const [selectedDealMemo, setSelectedDealMemo] = useState<DealMemo | null>(null);
  const [showDealMemoDetails, setShowDealMemoDetails] = useState<DealMemo | null>(null);

  // Send documents dialog state
  const [selectedPeopleForDocs, setSelectedPeopleForDocs] = useState<BacklotBookedPerson[]>([]);
  const [showSendDialog, setShowSendDialog] = useState(false);

  // Announcement state
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementPriority, setAnnouncementPriority] = useState<'normal' | 'high' | 'urgent'>('normal');

  // Queries - MOVED UP BEFORE useEffect hooks
  const { data: roles, isLoading } = useProjectRoles(projectId, {
    type: typeFilter === 'all' ? undefined : typeFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    includeApplications: true,
  });

  const { data: bookedPeople } = useBookedPeople(projectId);
  const { data: crewDocSummaries } = useCrewDocumentSummary(projectId);
  const { deleteRole, updateRole } = useProjectRoleMutations(projectId);

  // Project collabs (roles posted to the community)
  const { data: projectCollabs, isLoading: collabsLoading } = useProjectCollabs(projectId);
  const { deactivateCollab } = useProjectCollabMutations(projectId);

  // Collab applications
  const { data: collabApplications } = useCollabApplications(
    viewingCollabApplications?.id || '',
    { enabled: !!viewingCollabApplications }
  );

  // Deal memos
  const { data: dealMemos } = useDealMemos(projectId);
  const { updateDealMemoStatus } = useDealMemoMutations(projectId);

  // Deal memo history
  const { data: dealMemoHistory } = useDealMemoHistory(
    showDealMemoDetails?.id || '',
    { enabled: !!showDealMemoDetails }
  );

  // Mutations
  const updateApplicationStatus = useUpdateCollabApplicationStatus();

  // Announcement mutation
  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; priority: 'normal' | 'high' | 'urgent' }) => {
      const response = await api.post(`/backlot/projects/${projectId}/announcements`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-announcements', projectId] });
      toast({
        title: 'Announcement posted',
        description: 'Your announcement has been sent to all booked cast and crew.',
      });
      setShowAnnouncementDialog(false);
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementPriority('normal');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to post announcement',
        variant: 'destructive',
      });
    },
  });

  // Render booking detail modal via DOM manipulation (workaround for Dialog component issue)
  useEffect(() => {
    if (bookedPersonDialogOpen && viewingBookedPerson) {
      // Remove existing overlay if any
      const existing = document.getElementById('booking-detail-overlay');
      if (existing) existing.remove();

      // Create overlay
      const overlay = document.createElement('div');
      overlay.id = 'booking-detail-overlay';
      overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 50; display: flex; align-items: center; justify-content: center; font-family: sans-serif;';

      const dates = viewingBookedPerson.start_date && viewingBookedPerson.end_date
        ? `${viewingBookedPerson.start_date} to ${viewingBookedPerson.end_date}`
        : 'Not specified';

      overlay.innerHTML = `
        <div style="background: #121212; padding: 2rem; border-radius: 12px; border: 1px solid rgba(76,76,76,0.3); max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto;">
          <div style="margin-bottom: 1.5rem;">
            <h2 style="color: #F9F5EF; font-size: 24px; font-weight: bold; margin-bottom: 0.5rem;">Booking Details</h2>
            <p style="color: #4C4C4C; font-size: 14px;">View information about this booked person</p>
          </div>

          <div style="display: flex; gap: 1rem; margin-bottom: 2rem; align-items: start;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: #4C4C4C; display: flex; align-items: center; justify-content: center; color: white; font-size: 28px; font-weight: bold;">
              ${viewingBookedPerson.name?.charAt(0) || '?'}
            </div>
            <div style="flex: 1;">
              <h3 style="color: #F9F5EF; font-size: 20px; font-weight: 600; margin-bottom: 0.25rem;">${viewingBookedPerson.name}</h3>
              <p style="color: #4C4C4C; margin-bottom: 0.5rem;">${viewingBookedPerson.email || 'No email'}</p>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <span style="padding: 0.25rem 0.75rem; border: 1px solid rgba(76,76,76,0.5); border-radius: 6px; font-size: 12px; color: #4C4C4C;">${viewingBookedPerson.role_type.toUpperCase()}</span>
                ${viewingBookedPerson.department ? `<span style="padding: 0.25rem 0.75rem; background: rgba(76,76,76,0.2); border-radius: 6px; font-size: 12px; color: #4C4C4C;">${viewingBookedPerson.department}</span>` : ''}
              </div>
            </div>
          </div>

          <div style="margin-bottom: 2rem;">
            <h4 style="color: #F9F5EF; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Role Information</h4>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
              <div>
                <label style="color: #4C4C4C; font-size: 12px;">Position</label>
                <p style="color: #F9F5EF; font-size: 14px; margin-top: 0.25rem;">${viewingBookedPerson.role_title}</p>
              </div>
              ${viewingBookedPerson.character_name ? `
              <div>
                <label style="color: #4C4C4C; font-size: 12px;">Character</label>
                <p style="color: #F9F5EF; font-size: 14px; margin-top: 0.25rem;">"${viewingBookedPerson.character_name}"</p>
              </div>
              ` : ''}
            </div>
          </div>

          ${viewingBookedPerson.start_date || viewingBookedPerson.end_date ? `
          <div style="margin-bottom: 2rem;">
            <h4 style="color: #F9F5EF; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Booking Period</h4>
            <p style="color: #F9F5EF; font-size: 14px;">${dates}</p>
          </div>
          ` : ''}

          ${viewingBookedPerson.booking_rate ? `
          <div style="margin-bottom: 2rem;">
            <h4 style="color: #F9F5EF; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Compensation</h4>
            <p style="color: #22c55e; font-size: 18px; font-weight: 600;">${viewingBookedPerson.booking_rate}</p>
          </div>
          ` : ''}

          <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(76,76,76,0.3);">
            <button id="close-booking-detail" style="padding: 0.5rem 1.5rem; background: transparent; color: #F9F5EF; border: 1px solid rgba(76,76,76,0.5); border-radius: 6px; cursor: pointer; font-size: 14px;">
              Close
            </button>
            <button id="edit-booking-detail" style="padding: 0.5rem 1.5rem; background: #FF3C3C; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
              Edit Booking
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Close button handler
      document.getElementById('close-booking-detail')?.addEventListener('click', () => {
        overlay.remove();
        setBookedPersonDialogOpen(false);
        setViewingBookedPerson(null);
      });

      // Edit button handler
      document.getElementById('edit-booking-detail')?.addEventListener('click', () => {
        console.log('Edit Booking clicked, viewingBookedPerson:', viewingBookedPerson);
        overlay.remove();
        setBookedPersonDialogOpen(false);
        console.log('Setting editingBookedPerson to:', viewingBookedPerson);
        setEditingBookedPerson(viewingBookedPerson);
        setViewingBookedPerson(null);
        console.log('editingBookedPerson state should be set now');
      });

      // Click outside to close
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          setBookedPersonDialogOpen(false);
          setViewingBookedPerson(null);
        }
      });
    } else {
      // Remove overlay when closing
      const existing = document.getElementById('booking-detail-overlay');
      if (existing) existing.remove();
    }

    // Cleanup on unmount
    return () => {
      const existing = document.getElementById('booking-detail-overlay');
      if (existing) existing.remove();
    };
  }, [bookedPersonDialogOpen, viewingBookedPerson]);

  // Render edit booking modal via DOM manipulation (workaround for Dialog component issue)
  useEffect(() => {
    if (editingBookedPerson) {
      console.log('Creating edit booking modal for:', editingBookedPerson.name);

      // Remove existing overlay if any
      const existing = document.getElementById('edit-booking-overlay');
      if (existing) existing.remove();

      // Create overlay
      const overlay = document.createElement('div');
      overlay.id = 'edit-booking-overlay';
      overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 50; display: flex; align-items: center; justify-content: center; font-family: sans-serif;';

      // Create content container
      const content = document.createElement('div');
      content.style.cssText = 'background: #121212; padding: 2rem; border-radius: 12px; border: 1px solid rgba(76,76,76,0.3); max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto;';

      content.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <h2 style="color: #F9F5EF; font-size: 24px; font-weight: bold; margin-bottom: 0.5rem;">Edit Booking</h2>
          <p style="color: #4C4C4C; font-size: 14px;">Update booking details for ${editingBookedPerson.name}</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <label style="color: #F9F5EF; font-size: 14px; display: block; margin-bottom: 0.5rem;">Position / Role Title</label>
            <input id="edit-role-title" type="text" value="${editingBookedPerson.role_title || ''}"
              style="width: 100%; padding: 0.5rem; background: #121212; border: 1px solid rgba(76,76,76,0.3); border-radius: 6px; color: #F9F5EF; font-size: 14px;" />
          </div>

          <div>
            <label style="color: #F9F5EF; font-size: 14px; display: block; margin-bottom: 0.5rem;">Department</label>
            <input id="edit-department" type="text" value="${editingBookedPerson.department || ''}"
              style="width: 100%; padding: 0.5rem; background: #121212; border: 1px solid rgba(76,76,76,0.3); border-radius: 6px; color: #F9F5EF; font-size: 14px;" />
          </div>

          ${editingBookedPerson.role_type === 'cast' ? `
          <div>
            <label style="color: #F9F5EF; font-size: 14px; display: block; margin-bottom: 0.5rem;">Character Name</label>
            <input id="edit-character-name" type="text" value="${editingBookedPerson.character_name || ''}"
              style="width: 100%; padding: 0.5rem; background: #121212; border: 1px solid rgba(76,76,76,0.3); border-radius: 6px; color: #F9F5EF; font-size: 14px;" />
          </div>
          ` : ''}

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="color: #F9F5EF; font-size: 14px; display: block; margin-bottom: 0.5rem;">Start Date</label>
              <input id="edit-start-date" type="date" value="${editingBookedPerson.start_date || ''}"
                style="width: 100%; padding: 0.5rem; background: #121212; border: 1px solid rgba(76,76,76,0.3); border-radius: 6px; color: #F9F5EF; font-size: 14px;" />
            </div>
            <div>
              <label style="color: #F9F5EF; font-size: 14px; display: block; margin-bottom: 0.5rem;">End Date</label>
              <input id="edit-end-date" type="date" value="${editingBookedPerson.end_date || ''}"
                style="width: 100%; padding: 0.5rem; background: #121212; border: 1px solid rgba(76,76,76,0.3); border-radius: 6px; color: #F9F5EF; font-size: 14px;" />
            </div>
          </div>

          <div>
            <label style="color: #F9F5EF; font-size: 14px; display: block; margin-bottom: 0.5rem;">Booking Rate</label>
            <input id="edit-booking-rate" type="text" value="${editingBookedPerson.booking_rate || ''}" placeholder="e.g., $500/daily, $2000/weekly"
              style="width: 100%; padding: 0.5rem; background: #121212; border: 1px solid rgba(76,76,76,0.3); border-radius: 6px; color: #F9F5EF; font-size: 14px;" />
            <p style="color: #4C4C4C; font-size: 12px; margin-top: 0.25rem;">Enter rate in format: $amount/period</p>
          </div>
        </div>

        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(76,76,76,0.3);">
          <button id="cancel-edit-booking" style="padding: 0.5rem 1.5rem; background: transparent; color: #F9F5EF; border: 1px solid rgba(76,76,76,0.5); border-radius: 6px; cursor: pointer; font-size: 14px;">
            Cancel
          </button>
          <button id="save-edit-booking" style="padding: 0.5rem 1.5rem; background: #FF3C3C; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
            Save Changes
          </button>
        </div>
      `;

      overlay.appendChild(content);
      document.body.appendChild(overlay);

      // Cancel button handler
      document.getElementById('cancel-edit-booking')?.addEventListener('click', () => {
        overlay.remove();
        setEditingBookedPerson(null);
      });

      // Save button handler
      document.getElementById('save-edit-booking')?.addEventListener('click', async () => {
        const roleTitle = (document.getElementById('edit-role-title') as HTMLInputElement)?.value;
        const department = (document.getElementById('edit-department') as HTMLInputElement)?.value;
        const characterName = (document.getElementById('edit-character-name') as HTMLInputElement)?.value;
        const startDate = (document.getElementById('edit-start-date') as HTMLInputElement)?.value;
        const endDate = (document.getElementById('edit-end-date') as HTMLInputElement)?.value;
        const bookingRate = (document.getElementById('edit-booking-rate') as HTMLInputElement)?.value;

        if (!roleTitle) {
          alert('Please enter a role title');
          return;
        }

        try {
          const input: ProjectRoleInput = {
            type: editingBookedPerson.role_type,
            title: roleTitle,
            department: department || null,
            character_name: characterName || null,
            start_date: startDate || null,
            end_date: endDate || null,
            rate_description: bookingRate || null,
            status: 'booked',
          };

          await updateRole.mutateAsync({ roleId: editingBookedPerson.role_id, input });

          overlay.remove();
          setEditingBookedPerson(null);

          toast({
            title: 'Booking updated',
            description: 'The booking details have been updated successfully.',
          });
        } catch (error: any) {
          alert('Error updating booking: ' + (error.message || 'Unknown error'));
        }
      });

      // Click outside to close
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          setEditingBookedPerson(null);
        }
      });
    } else {
      // Remove overlay when closing
      const existing = document.getElementById('edit-booking-overlay');
      if (existing) existing.remove();
    }

    // Cleanup on unmount
    return () => {
      const existing = document.getElementById('edit-booking-overlay');
      if (existing) existing.remove();
    };
  }, [editingBookedPerson, updateRole, toast]);

  // Filtered roles
  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter((role) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          role.title.toLowerCase().includes(query) ||
          role.description?.toLowerCase().includes(query) ||
          role.character_name?.toLowerCase().includes(query) ||
          role.department?.toLowerCase().includes(query) ||
          role.location?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [roles, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const roleStats = {
      total: roles?.length || 0,
      open: roles?.filter((r) => r.status === 'open').length || 0,
      booked: roles?.filter((r) => r.status === 'booked').length || 0,
      cast: roles?.filter((r) => r.type === 'cast').length || 0,
      crew: roles?.filter((r) => r.type === 'crew').length || 0,
    };
    const collabStats = {
      total: projectCollabs?.length || 0,
      pending: projectCollabs?.filter((c) => c.approval_status === 'pending').length || 0,
      approved: projectCollabs?.filter((c) => c.approval_status === 'approved').length || 0,
      applications: projectCollabs?.reduce((sum, c) => sum + (c.application_count || 0), 0) || 0,
    };
    return { roles: roleStats, collabs: collabStats };
  }, [roles, projectCollabs]);

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      await deleteRole.mutateAsync(roleId);
      toast({
        title: 'Role deleted',
        description: 'The role has been removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete role',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: BacklotProjectRoleStatus) => {
    const colors: Record<string, string> = {
      draft: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
      open: 'bg-green-500/20 text-green-400 border-green-500/30',
      closed: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      booked: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[status] || 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Casting & Crew</h2>
          <p className="text-muted-foreground">
            Post roles and manage applications from the community
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Post Role
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-gray" />
              <div>
                <p className="text-2xl font-bold text-bone-white">{stats.roles.total}</p>
                <p className="text-xs text-muted-gray">Total Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-accent-yellow" />
              <div>
                <p className="text-2xl font-bold text-bone-white">{stats.collabs.total}</p>
                <p className="text-xs text-muted-gray">Community Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-bone-white">{stats.roles.open}</p>
                <p className="text-xs text-muted-gray">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-bone-white">{stats.roles.booked + stats.collabs.applications}</p>
                <p className="text-xs text-muted-gray">Applications</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-bone-white">{stats.roles.cast}</p>
                <p className="text-xs text-muted-gray">Cast Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-bone-white">{stats.roles.crew}</p>
                <p className="text-xs text-muted-gray">Crew Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="roles">Role Postings</TabsTrigger>
          <TabsTrigger value="booked">Booked ({bookedPeople?.length || 0})</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="rates">
            <DollarSign className="w-4 h-4 mr-1" />
            Rates
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileSignature className="w-4 h-4 mr-1" />
            Documents
          </TabsTrigger>
        </TabsList>

        {/* Role Postings Tab */}
        <TabsContent value="roles" className="space-y-4">
          {/* Community Postings */}
          <div className="space-y-3">
            {collabsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : projectCollabs && projectCollabs.length > 0 ? (
              <div className="grid gap-3">
                {projectCollabs.map((collab) => (
                  <CollabCard
                    key={collab.id}
                    collab={collab}
                    projectId={projectId}
                    onView={() => setViewingCollab(collab)}
                    onEdit={() => setEditingCollab(collab)}
                    onDeactivate={async () => {
                      if (confirm('Deactivate this posting?')) {
                        await deactivateCollab.mutateAsync(collab.id);
                        toast({
                          title: 'Posting deactivated',
                          description: 'The community posting has been deactivated.',
                        });
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <Card className="bg-charcoal-black border-muted-gray/30 border-dashed">
                <CardContent className="py-6 text-center">
                  <Globe className="w-8 h-8 mx-auto mb-2 text-muted-gray" />
                  <p className="text-sm text-muted-gray">
                    No community postings yet. Click "Post Role" to advertise positions to the community.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

        </TabsContent>

        {/* Booked Tab */}
        <TabsContent value="booked" className="space-y-4">
          {bookedPeople && bookedPeople.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {bookedPeople.map((person) => (
                <Card
                  key={person.role_id}
                  className="bg-charcoal-black border-muted-gray/30 cursor-pointer hover:border-muted-gray/50 transition-colors group"
                  onClick={() => {
                    console.log('Clicked on person:', person.name);
                    setViewingBookedPerson(person);
                    setBookedPersonDialogOpen(true);
                  }}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={person.avatar_url || undefined} />
                        <AvatarFallback>
                          {person.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-bone-white">{person.name}</p>
                            <p className="text-sm text-muted-gray">
                              {person.role_title}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setViewingBookedPerson(person);
                                setBookedPersonDialogOpen(true);
                              }}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setEditingBookedPerson(person);
                              }}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Booking
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`Remove ${person.name} from this project?`)) {
                                    try {
                                      await deleteRole.mutateAsync(person.role_id);
                                      toast({
                                        title: 'Booking removed',
                                        description: `${person.name} has been removed from the project.`,
                                      });
                                    } catch (error: any) {
                                      toast({
                                        title: 'Error',
                                        description: error.message || 'Failed to remove booking',
                                        variant: 'destructive',
                                      });
                                    }
                                  }
                                }}
                              >
                                <Trash className="w-4 h-4 mr-2" />
                                Remove Booking
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs border-muted-gray/50 text-muted-gray">
                            {PROJECT_ROLE_TYPE_LABELS[person.role_type]}
                          </Badge>
                          {person.department && (
                            <Badge variant="secondary" className="text-xs bg-muted-gray/20 text-muted-gray">
                              {person.department}
                            </Badge>
                          )}
                        </div>
                        {person.character_name && (
                          <p className="text-xs text-muted-gray mt-1">
                            as "{person.character_name}"
                          </p>
                        )}
                        {person.start_date && (
                          <p className="text-xs text-muted-gray mt-1">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {format(parseLocalDate(person.start_date), 'MMM d')}
                            {person.end_date && ` - ${format(parseLocalDate(person.end_date), 'MMM d')}`}
                          </p>
                        )}
                        {person.booking_rate && (
                          <p className="text-xs text-green-600 mt-1">
                            <DollarSign className="w-3 h-3 inline mr-1" />
                            {person.booking_rate}
                          </p>
                        )}
                        {/* Document Status Badges */}
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <ClearanceStatusBadge
                            projectId={projectId}
                            personId={person.user_id}
                            personName={person.name}
                            onClick={(e) => {
                              e?.stopPropagation();
                              onNavigateToClearances?.(person.user_id, person.name);
                            }}
                          />
                          {/* Onboarding Progress */}
                          {crewDocSummaries && (() => {
                            const summary = crewDocSummaries.find(s => s.person_id === person.user_id);
                            return summary && <OnboardingProgressBadge summary={summary} />;
                          })()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/30">
              <CardContent className="py-12 text-center">
                <UserCheck className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
                <h3 className="text-lg font-semibold mb-2 text-bone-white">No booked crew yet</h3>
                <p className="text-muted-gray">
                  Book applicants from your role postings to see them here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability">
          <AvailabilityCalendar projectId={projectId} bookedPeople={bookedPeople || []} />
        </TabsContent>

        {/* Rates Tab */}
        <TabsContent value="rates">
          <CrewRatesTab projectId={projectId} />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          {/* Crew Document Status Dashboard */}
          <CrewDocumentDashboard
            projectId={projectId}
            canEdit={true}
            onViewPerson={(personId) => onNavigateToClearances?.(personId)}
            onSendPackage={(personId, personName) => {
              // Navigate to send package flow
              onNavigateToClearances?.(personId, personName);
            }}
          />

          {/* Clearances per person */}
          <PersonClearancesSection
            projectId={projectId}
            bookedPeople={bookedPeople || []}
            onNavigateToClearances={onNavigateToClearances}
          />
          {/* Deal Memos and other documents */}
          <DocumentsSection projectId={projectId} />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Role Dialog - Uses CollabForm to post to Collab Board */}
      {showCreateDialog && (
        <CollabForm
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            queryClient.invalidateQueries({ queryKey: ['project-roles', projectId] });
            toast({
              title: 'Role posted',
              description: 'Your role is now live on the Collab Board.',
            });
          }}
          backlotProjectId={projectId}
          backlotProjectData={project ? {
            id: project.id,
            title: project.title,
            production_type: project.production_type,
            company: project.company,
            company_id: project.company_id,
            network_id: project.network_id,
            location: project.location,
          } : undefined}
        />
      )}

      {/* Applications Board Dialog */}
      <Dialog
        open={!!viewingApplications}
        onOpenChange={(open) => {
          if (!open) setViewingApplications(null);
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Applications for {viewingApplications?.title}
            </DialogTitle>
            <DialogDescription>
              Review and manage applications for this role.
            </DialogDescription>
          </DialogHeader>
          {viewingApplications && (
            <ApplicationsBoard
              projectId={projectId}
              role={viewingApplications}
              onClose={() => setViewingApplications(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Collab View Dialog - Full-Featured */}
      <Dialog
        open={!!viewingCollab}
        onOpenChange={(open) => !open && setViewingCollab(null)}
      >
        <DialogContent className="bg-deep-black border-muted-gray/30 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Type Badge with Icon */}
                {(() => {
                  const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
                    looking_for_crew: { label: 'Looking for Crew', icon: Users, color: 'bg-blue-600' },
                    looking_for_cast: { label: 'Looking for Cast', icon: Users, color: 'bg-amber-600' },
                    available_for_hire: { label: 'Available for Hire', icon: Briefcase, color: 'bg-green-600' },
                    partner_opportunity: { label: 'Partner Opportunity', icon: Building2, color: 'bg-purple-600' },
                    crew: { label: 'Looking for Crew', icon: Users, color: 'bg-blue-600' },
                    cast: { label: 'Looking for Cast', icon: Users, color: 'bg-amber-600' },
                  };
                  const config = typeConfig[viewingCollab?.type || ''] || { label: 'Opportunity', icon: Briefcase, color: 'bg-gray-600' };
                  const TypeIcon = config.icon;
                  return (
                    <Badge className={`${config.color} text-white flex items-center gap-1`}>
                      <TypeIcon className="w-3 h-3" />
                      {config.label}
                    </Badge>
                  );
                })()}
                {/* Production Type Badge */}
                {viewingCollab?.production_type && (
                  <Badge variant="outline" className="border-blue-400/30 text-blue-300 text-xs">
                    <Film className="w-3 h-3 mr-1" />
                    {PRODUCTION_TYPE_LABELS[viewingCollab.production_type] || viewingCollab.production_type}
                  </Badge>
                )}
                {/* Job Type Badge */}
                {viewingCollab?.job_type && (
                  <Badge variant="outline" className="border-muted-gray/50 text-muted-gray text-xs">
                    {viewingCollab.job_type === 'full_time' ? 'Full-Time' : 'Freelance'}
                  </Badge>
                )}
                {/* Featured Badge */}
                {viewingCollab?.is_featured && (
                  <Badge className="bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/40">
                    <Star className="w-3 h-3 mr-1" />
                    Featured
                  </Badge>
                )}
              </div>
            </div>
            <DialogTitle className="text-xl font-heading text-bone-white mt-2">
              {viewingCollab?.title}
            </DialogTitle>
            {/* Status Badges Row */}
            <div className="flex flex-wrap gap-2 mt-2">
              {viewingCollab?.approval_status && (
                <Badge
                  className={
                    viewingCollab.approval_status === 'approved'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : viewingCollab.approval_status === 'pending'
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }
                >
                  {viewingCollab.approval_status === 'pending' && <AlertCircle className="w-3 h-3 mr-1" />}
                  {viewingCollab.approval_status.charAt(0).toUpperCase() + viewingCollab.approval_status.slice(1)}
                </Badge>
              )}
              {viewingCollab?.is_order_only && (
                <Badge className="bg-emerald-600/20 text-emerald-300 border border-emerald-500/40">
                  <Shield className="w-3 h-3 mr-1" />
                  Order Only
                </Badge>
              )}
              {viewingCollab?.application_count !== undefined && viewingCollab.application_count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {viewingCollab.application_count} application{viewingCollab.application_count !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {viewingCollab && (
            <div className="space-y-6">
              {/* Author Section */}
              {viewingCollab.profile && (
                <div className="flex items-center justify-between pt-2 border-t border-muted-gray/20">
                  <Link
                    to={`/profile/${viewingCollab.profile.username || 'member'}`}
                    className="flex items-center gap-3 hover:text-accent-yellow transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={viewingCollab.profile.avatar_url || ''} />
                      <AvatarFallback>
                        {(viewingCollab.profile.display_name || viewingCollab.profile.full_name || 'M').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="text-bone-white font-medium">
                        {viewingCollab.profile.display_name || viewingCollab.profile.full_name || viewingCollab.profile.username || 'Member'}
                      </span>
                      {viewingCollab.profile.is_order_member && (
                        <Shield className="w-3 h-3 text-emerald-400 inline ml-1" />
                      )}
                      <div className="text-xs text-muted-gray">
                        Posted {formatDistanceToNow(new Date(viewingCollab.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </Link>
                  <Link
                    to={`/profile/${viewingCollab.profile.username || 'member'}`}
                    className="text-xs text-muted-gray hover:text-accent-yellow flex items-center gap-1"
                  >
                    View Profile <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Company & Network */}
              {(viewingCollab.company || viewingCollab.network || viewingCollab.company_data) && (
                <div className="flex flex-wrap gap-4 text-sm">
                  {(viewingCollab.company || viewingCollab.company_data) && (
                    <div className="flex items-center gap-2 text-muted-gray">
                      {viewingCollab.company_data?.logo_url ? (
                        <img
                          src={viewingCollab.company_data.logo_url}
                          alt={viewingCollab.company_data.name}
                          className="h-5 max-w-[80px] object-contain"
                        />
                      ) : (
                        <>
                          <Building2 className="w-4 h-4" />
                          <span>{viewingCollab.company_data?.name || viewingCollab.company}</span>
                        </>
                      )}
                    </div>
                  )}
                  {viewingCollab.network && (
                    <div className="flex items-center gap-2">
                      {viewingCollab.network.logo_url ? (
                        <img
                          src={viewingCollab.network.logo_url}
                          alt={viewingCollab.network.name}
                          className="h-6 max-w-[100px] object-contain"
                        />
                      ) : (
                        <div className="flex items-center gap-1 text-muted-gray">
                          <Tv className="w-4 h-4" />
                          <span>{viewingCollab.network.name}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Meta Info Grid */}
              <div className="flex flex-wrap gap-4 text-sm">
                {/* Location / Remote */}
                {(viewingCollab.location || viewingCollab.is_remote) && (
                  <div className="flex items-center gap-1 text-muted-gray">
                    {viewingCollab.is_remote ? (
                      <>
                        <Globe className="w-4 h-4" />
                        <span>Remote</span>
                        {viewingCollab.location && <span className="text-bone-white ml-1">({viewingCollab.location})</span>}
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        <span>{viewingCollab.location}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Compensation */}
                {viewingCollab.compensation_type && (
                  <div className="flex items-center gap-1 text-muted-gray">
                    <DollarSign className="w-4 h-4" />
                    <span>
                      {viewingCollab.compensation_type === 'paid' ? 'Paid' :
                       viewingCollab.compensation_type === 'unpaid' ? 'Unpaid' :
                       viewingCollab.compensation_type === 'deferred' ? 'Deferred Pay' :
                       viewingCollab.compensation_type === 'negotiable' ? 'Negotiable' :
                       viewingCollab.compensation_type}
                    </span>
                  </div>
                )}

                {/* Day Rate Range (Freelance) */}
                {viewingCollab.job_type === 'freelance' && (viewingCollab.day_rate_min || viewingCollab.day_rate_max) && (
                  <div className="flex items-center gap-1 text-green-400">
                    <DollarSign className="w-4 h-4" />
                    <span>
                      {viewingCollab.day_rate_min && viewingCollab.day_rate_max
                        ? `$${viewingCollab.day_rate_min.toLocaleString()} - $${viewingCollab.day_rate_max.toLocaleString()}/day`
                        : viewingCollab.day_rate_min
                        ? `$${viewingCollab.day_rate_min.toLocaleString()}/day`
                        : `Up to $${viewingCollab.day_rate_max?.toLocaleString()}/day`}
                    </span>
                  </div>
                )}

                {/* Salary Range (Full-Time) */}
                {viewingCollab.job_type === 'full_time' && (viewingCollab.salary_min || viewingCollab.salary_max) && (
                  <div className="flex items-center gap-1 text-green-400">
                    <DollarSign className="w-4 h-4" />
                    <span>
                      {viewingCollab.salary_min && viewingCollab.salary_max
                        ? `$${viewingCollab.salary_min.toLocaleString()} - $${viewingCollab.salary_max.toLocaleString()}/yr`
                        : viewingCollab.salary_min
                        ? `$${viewingCollab.salary_min.toLocaleString()}/yr+`
                        : `Up to $${viewingCollab.salary_max?.toLocaleString()}/yr`}
                    </span>
                  </div>
                )}

                {/* Start Date */}
                {viewingCollab.start_date && (
                  <div className="flex items-center gap-1 text-muted-gray">
                    <Calendar className="w-4 h-4" />
                    <span>Starts {format(parseLocalDate(viewingCollab.start_date), 'MMM d, yyyy')}</span>
                  </div>
                )}

                {/* End Date */}
                {viewingCollab.end_date && (
                  <div className="flex items-center gap-1 text-muted-gray">
                    <Calendar className="w-4 h-4" />
                    <span>Ends {format(parseLocalDate(viewingCollab.end_date), 'MMM d, yyyy')}</span>
                  </div>
                )}

                {/* Application Deadline */}
                {viewingCollab.application_deadline && (
                  <div className="flex items-center gap-1 text-amber-400">
                    <Clock className="w-4 h-4" />
                    <span>Apply by {format(parseLocalDate(viewingCollab.application_deadline), 'MMM d, yyyy')}</span>
                  </div>
                )}

                {/* Max Applications */}
                {viewingCollab.max_applications && (
                  <div className="flex items-center gap-1 text-muted-gray">
                    <Users className="w-4 h-4" />
                    <span>Max {viewingCollab.max_applications} applicants</span>
                  </div>
                )}
              </div>

              {/* Benefits Info (Full-Time) */}
              {viewingCollab.job_type === 'full_time' && viewingCollab.benefits_info && (
                <div className="text-sm">
                  <span className="text-muted-gray">Benefits:</span>{' '}
                  <span className="text-bone-white">{viewingCollab.benefits_info}</span>
                </div>
              )}

              {/* Description */}
              <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
                <p className="text-bone-white whitespace-pre-wrap">{viewingCollab.description}</p>
              </div>

              {/* General Requirements */}
              {(viewingCollab.requires_resume || viewingCollab.requires_local_hire || viewingCollab.requires_order_membership || (viewingCollab.union_requirements && viewingCollab.union_requirements.length > 0)) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-bone-white">Requirements</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingCollab.requires_resume && (
                      <Badge variant="outline" className="border-amber-400/30 text-amber-400">
                        <FileText className="w-3 h-3 mr-1" />
                        Resume Required
                      </Badge>
                    )}
                    {viewingCollab.requires_local_hire && (
                      <Badge variant="outline" className="border-amber-400/30 text-amber-400">
                        <MapPin className="w-3 h-3 mr-1" />
                        Local Hire Only
                      </Badge>
                    )}
                    {viewingCollab.requires_order_membership && (
                      <Badge className="bg-emerald-600/20 text-emerald-300 border border-emerald-500/40">
                        <Shield className="w-3 h-3 mr-1" />
                        Order Members Only
                      </Badge>
                    )}
                    {viewingCollab.union_requirements?.map((union) => {
                      const unionOption = UNION_OPTIONS.find(u => u.value === union);
                      return (
                        <Badge key={union} variant="outline" className="border-accent-yellow/40 text-accent-yellow">
                          {unionOption?.label || union}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cast-Specific Requirements */}
              {(viewingCollab.type === 'looking_for_cast' || viewingCollab.type === 'cast') &&
               (viewingCollab.requires_reel || viewingCollab.requires_headshot || viewingCollab.requires_self_tape) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-bone-white">Cast Requirements</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingCollab.requires_reel && (
                      <Badge variant="outline" className="border-purple-400/30 text-purple-400">
                        <VideoIcon className="w-3 h-3 mr-1" />
                        Demo Reel Required
                      </Badge>
                    )}
                    {viewingCollab.requires_headshot && (
                      <Badge variant="outline" className="border-purple-400/30 text-purple-400">
                        <Image className="w-3 h-3 mr-1" />
                        Headshot Required
                      </Badge>
                    )}
                    {viewingCollab.requires_self_tape && (
                      <Badge variant="outline" className="border-purple-400/30 text-purple-400">
                        <Camera className="w-3 h-3 mr-1" />
                        Self-Tape Required
                        {viewingCollab.tape_workflow && (
                          <span className="ml-1 text-xs opacity-75">
                            ({viewingCollab.tape_workflow === 'upfront' ? 'Upfront' : 'After Shortlist'})
                          </span>
                        )}
                      </Badge>
                    )}
                  </div>
                  {/* Tape Instructions */}
                  {viewingCollab.tape_instructions && (
                    <div className="mt-2 text-sm">
                      <span className="text-muted-gray">Tape Instructions:</span>
                      <p className="text-bone-white mt-1 whitespace-pre-wrap">{viewingCollab.tape_instructions}</p>
                    </div>
                  )}
                  {/* Tape Format Preferences */}
                  {viewingCollab.tape_format_preferences && (
                    <div className="mt-2 text-sm">
                      <span className="text-muted-gray">Format Preferences:</span>
                      <p className="text-bone-white mt-1">{viewingCollab.tape_format_preferences}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Custom Questions */}
              {viewingCollab.custom_questions && viewingCollab.custom_questions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-bone-white flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    Screening Questions ({viewingCollab.custom_questions.length})
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-gray">
                    {viewingCollab.custom_questions.map((q, i) => (
                      <li key={q.id || i} className="flex items-start gap-2">
                        <span className="text-accent-yellow">{i + 1}.</span>
                        <span>{q.question}</span>
                        {q.required && (
                          <Badge variant="outline" className="text-xs border-red-400/30 text-red-400 ml-1">
                            Required
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tags */}
              {viewingCollab.tags && viewingCollab.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {viewingCollab.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="border-muted-gray/30 text-muted-gray">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Pending/Rejected Status Messages */}
              {viewingCollab.approval_status === 'pending' && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-sm text-yellow-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Awaiting admin approval. Not visible to community yet.
                  </p>
                </div>
              )}
              {viewingCollab.approval_status === 'rejected' && viewingCollab.rejection_reason && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">
                    <strong>Rejected:</strong> {viewingCollab.rejection_reason}
                  </p>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex gap-3 pt-4 border-t border-muted-gray/20">
                <Button
                  variant="outline"
                  className="border-muted-gray/30"
                  onClick={() => setViewingCollab(null)}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  className="border-muted-gray/30"
                  onClick={() => {
                    const collabIdToNavigate = viewingCollab?.id;
                    setViewingCollab(null);
                    if (collabIdToNavigate) {
                      navigate(`/backlot/projects/${projectId}/postings/${collabIdToNavigate}/applicants`);
                    }
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  View Applicants {viewingCollab?.application_count ? `(${viewingCollab.application_count})` : ''}
                </Button>
                <Button
                  className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  onClick={() => {
                    setEditingCollab(viewingCollab);
                    setViewingCollab(null);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Collab Edit Dialog */}
      {editingCollab && (
        <CollabForm
          onClose={() => setEditingCollab(null)}
          onSuccess={() => {
            setEditingCollab(null);
            queryClient.invalidateQueries({ queryKey: ['project-collabs', projectId] });
            toast({
              title: 'Posting updated',
              description: 'Your community posting has been updated.',
            });
          }}
          editCollab={editingCollab}
          backlotProjectId={projectId}
          backlotProjectData={project ? {
            id: project.id,
            title: project.title,
            production_type: project.production_type,
            company: project.company,
            company_id: project.company_id,
            network_id: project.network_id,
            location: project.location,
          } : undefined}
        />
      )}

      {/* Collab Applications Dialog */}
      <Dialog
        open={!!viewingCollabApplications}
        onOpenChange={(open) => !open && setViewingCollabApplications(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Applications for {viewingCollabApplications?.title}
            </DialogTitle>
            <DialogDescription>
              Review applications from the community
            </DialogDescription>
          </DialogHeader>
          {viewingCollabApplications && (
            <CollabApplicationsBoard
              collabId={viewingCollabApplications.id}
              collabTitle={viewingCollabApplications.title}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Role Card Component
// =============================================================================

interface RoleCardProps {
  role: BacklotProjectRole;
  onDelete: () => void;
  onViewApplications: () => void;
}

function RoleCard({ role, onDelete, onViewApplications }: RoleCardProps) {
  const getRoleStatusColor = (status: BacklotProjectRoleStatus) => {
    const colors: Record<string, string> = {
      draft: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
      open: 'bg-green-500/20 text-green-400 border-green-500/30',
      closed: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      booked: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[status] || 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  };

  return (
    <Card className="bg-charcoal-black border-muted-gray/30">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg text-bone-white">{role.title}</h3>
              <Badge variant="outline" className="border-muted-gray/50 text-muted-gray">
                {PROJECT_ROLE_TYPE_LABELS[role.type]}
              </Badge>
              <Badge className={getRoleStatusColor(role.status)}>
                {PROJECT_ROLE_STATUS_LABELS[role.status]}
              </Badge>
              {role.is_order_only && (
                <Badge variant="secondary" className="gap-1">
                  <Shield className="w-3 h-3" />
                  Order Only
                </Badge>
              )}
            </div>

            {role.character_name && (
              <p className="text-sm text-muted-foreground mb-1">
                Character: {role.character_name}
              </p>
            )}

            {role.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {role.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {role.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {role.location}
                </span>
              )}
              {role.paid ? (
                <span className="flex items-center gap-1 text-green-600">
                  <DollarSign className="w-4 h-4" />
                  {role.rate_description || 'Paid'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Unpaid
                </span>
              )}
              {role.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(parseLocalDate(role.start_date), 'MMM d')}
                  {role.end_date && ` - ${format(parseLocalDate(role.end_date), 'MMM d')}`}
                </span>
              )}
              {role.days_estimated && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {role.days_estimated} day{role.days_estimated !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Applications Summary */}
            {role.application_count !== undefined && (
              <div className="mt-3 pt-3 border-t border-muted-gray/30">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onViewApplications}
                  className="mr-2 bg-muted-gray/20 hover:bg-muted-gray/30 text-bone-white border border-muted-gray/50"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View Applications ({role.application_count})
                </Button>
                {role.shortlisted_count !== undefined && role.shortlisted_count > 0 && (
                  <Badge variant="secondary" className="mr-2">
                    {role.shortlisted_count} shortlisted
                  </Badge>
                )}
              </div>
            )}

            {/* Booked User */}
            {role.booked_user && (
              <div className="mt-3 pt-3 border-t flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={role.booked_user.avatar_url || undefined} />
                  <AvatarFallback>
                    {role.booked_user.full_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  Booked: <span className="font-medium">{role.booked_user.full_name || role.booked_user.username}</span>
                </span>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-gray hover:text-bone-white hover:bg-muted-gray/20">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/30">
              <DropdownMenuItem onClick={onViewApplications} className="text-bone-white hover:bg-muted-gray/20">
                <Eye className="w-4 h-4 mr-2" />
                View Applications
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-muted-gray/30" />
              <DropdownMenuItem onClick={onDelete} className="text-red-500 hover:bg-red-500/10 hover:text-red-400">
                <Trash className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Collab Card Component (for Community Postings)
// =============================================================================

interface CollabCardProps {
  collab: CommunityCollab;
  projectId: string;
  onView: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}

function CollabCard({ collab, projectId, onView, onEdit, onDeactivate }: CollabCardProps) {
  const navigate = useNavigate();

  const getApprovalStatusColor = (status?: CollabApprovalStatus) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      approved: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[status || 'approved'] || 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  };

  const handleCardClick = () => {
    onView();
  };

  const handleViewApplicants = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/backlot/projects/${projectId}/postings/${collab.id}/applicants`);
  };

  return (
    <Card
      className="bg-charcoal-black border-muted-gray/30 border-l-4 border-l-accent-yellow cursor-pointer hover:border-accent-yellow/50 transition-colors"
      onClick={handleCardClick}
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-accent-yellow" />
              <h3 className="font-semibold text-lg text-bone-white">{collab.title}</h3>
              <Badge variant="outline" className="border-muted-gray/50 text-muted-gray">
                {collab.type}
              </Badge>
              {collab.approval_status && (
                <Badge className={getApprovalStatusColor(collab.approval_status)}>
                  {collab.approval_status === 'pending' && <AlertCircle className="w-3 h-3 mr-1" />}
                  {collab.approval_status}
                </Badge>
              )}
              {collab.is_remote && (
                <Badge variant="secondary">Remote</Badge>
              )}
              {collab.is_order_only && (
                <Badge variant="secondary" className="gap-1">
                  <Shield className="w-3 h-3" />
                  Order Only
                </Badge>
              )}
            </div>

            {collab.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {collab.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {collab.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {collab.location}
                </span>
              )}
              {collab.compensation_type && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {collab.compensation_type}
                </span>
              )}
              {collab.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(parseLocalDate(collab.start_date), 'MMM d')}
                  {collab.end_date && ` - ${format(parseLocalDate(collab.end_date), 'MMM d')}`}
                </span>
              )}
            </div>

            {/* View Applicants Button - Always visible */}
            <div className="mt-3 pt-3 border-t border-muted-gray/30">
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewApplicants}
                className="mr-2"
              >
                <Eye className="w-4 h-4 mr-1" />
                View Applicants {collab.application_count ? `(${collab.application_count})` : ''}
              </Button>
            </div>

            {/* Pending Approval Warning */}
            {collab.approval_status === 'pending' && (
              <div className="mt-3 pt-3 border-t border-muted-gray/30">
                <p className="text-xs text-yellow-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Awaiting admin approval. Not visible to community yet.
                </p>
              </div>
            )}

            {/* Rejection Reason */}
            {collab.approval_status === 'rejected' && collab.rejection_reason && (
              <div className="mt-3 pt-3 border-t border-muted-gray/30">
                <p className="text-xs text-red-400">
                  Rejected: {collab.rejection_reason}
                </p>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCardClick(); }}>
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleViewApplicants}>
                <Users className="w-4 h-4 mr-2" />
                View Applicants {collab.application_count ? `(${collab.application_count})` : ''}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeactivate(); }} className="text-red-600">
                <Trash className="w-4 h-4 mr-2" />
                Deactivate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Collab Applications Board Component
// =============================================================================

interface CollabApplicationsBoardProps {
  collabId: string;
  collabTitle: string;
}

function CollabApplicationsBoard({ collabId, collabTitle }: CollabApplicationsBoardProps) {
  const { toast } = useToast();
  const { data: applications, isLoading } = useCollabApplications(collabId);
  const updateStatus = useUpdateCollabApplicationStatus(collabId);

  const statusColumns = [
    { id: 'applied', label: 'Applied', color: 'bg-muted-gray/20' },
    { id: 'viewed', label: 'Viewed', color: 'bg-blue-500/20' },
    { id: 'shortlisted', label: 'Shortlisted', color: 'bg-yellow-500/20' },
    { id: 'interview', label: 'Interview', color: 'bg-purple-500/20' },
    { id: 'offered', label: 'Offered', color: 'bg-green-500/20' },
    { id: 'booked', label: 'Booked', color: 'bg-green-600/20' },
    { id: 'rejected', label: 'Rejected', color: 'bg-red-500/20' },
  ];

  const handleStatusChange = async (applicationId: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ applicationId, status: newStatus });
      toast({
        title: 'Status updated',
        description: `Application moved to ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <div className="py-12 text-center">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
        <h3 className="text-lg font-semibold mb-2 text-bone-white">No applications yet</h3>
        <p className="text-muted-gray">
          Applications will appear here when people apply to this posting.
        </p>
      </div>
    );
  }

  // Group applications by status
  const applicationsByStatus = statusColumns.reduce((acc, col) => {
    acc[col.id] = applications.filter((app: any) => app.status === col.id);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-4">
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {statusColumns.map((column) => (
            <div
              key={column.id}
              className={`w-64 rounded-lg p-3 ${column.color}`}
            >
              <h4 className="font-medium text-sm mb-3 text-bone-white flex items-center justify-between">
                {column.label}
                <Badge variant="secondary" className="text-xs">
                  {applicationsByStatus[column.id]?.length || 0}
                </Badge>
              </h4>
              <div className="space-y-2">
                {applicationsByStatus[column.id]?.map((app: any) => (
                  <Card key={app.id} className="bg-charcoal-black border-muted-gray/30">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={app.current_profile?.avatar_url} />
                          <AvatarFallback>
                            {app.current_profile?.full_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-bone-white truncate">
                            {app.current_profile?.full_name || app.current_profile?.username || 'Unknown'}
                          </p>
                          {app.elevator_pitch && (
                            <p className="text-xs text-muted-gray line-clamp-2 mt-1">
                              {app.elevator_pitch}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-muted-gray/30">
                        <Select
                          value={app.status}
                          onValueChange={(value) => handleStatusChange(app.id, value)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusColumns.map((col) => (
                              <SelectItem key={col.id} value={col.id}>
                                {col.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// =============================================================================
// Documents Section Component
// =============================================================================

interface DocumentsSectionProps {
  projectId: string;
}

function DocumentsSection({ projectId }: DocumentsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [documentMessage, setDocumentMessage] = useState('');

  // Deal memo state
  const [showDealMemoDialog, setShowDealMemoDialog] = useState(false);
  const [selectedDealMemo, setSelectedDealMemo] = useState<DealMemo | null>(null);
  const [showDealMemoDetails, setShowDealMemoDetails] = useState<DealMemo | null>(null);

  // Fetch deal memos
  const { data: dealMemos = [], isLoading: dealMemosLoading } = useDealMemos(projectId);
  const { updateDealMemoStatus, sendDealMemo, voidDealMemo, resendDealMemo, deleteDealMemo } = useDealMemoMutations(projectId);

  // Fetch history for selected deal memo
  const { data: dealMemoHistory = [], isLoading: historyLoading } = useDealMemoHistory(showDealMemoDetails?.id);

  const handleUpdateStatus = async (
    dealMemoId: string,
    status: 'sent' | 'viewed' | 'signed' | 'declined',
    notes?: string,
    signedDocumentUrl?: string
  ) => {
    try {
      await updateDealMemoStatus.mutateAsync({
        dealMemoId,
        status,
        notes,
        signedDocumentUrl,
      });
      toast({
        title: 'Status updated',
        description: `Deal memo marked as ${status}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  // Fetch document templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['document-templates', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/backlot/document-templates?project_id=${projectId}`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  // Fetch signature requests
  const { data: signatureRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['signature-requests', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/signature-requests`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch signature requests');
      return response.json();
    },
  });

  // Fetch team members for recipient selection
  const { data: teamMembers } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/access/members`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch team members');
      return response.json();
    },
  });

  const sendDocumentMutation = useMutation({
    mutationFn: async (data: { templateId: string; recipientIds: string[]; message: string }) => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/signature-requests/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({
          template_ids: [data.templateId],
          recipient_ids: data.recipientIds,
          message: data.message,
        }),
      });
      if (!response.ok) throw new Error('Failed to send document');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Documents sent', description: 'Documents have been sent for signature.' });
      queryClient.invalidateQueries({ queryKey: ['signature-requests', projectId] });
      setShowSendDialog(false);
      setSelectedTemplateId('');
      setSelectedRecipients([]);
      setDocumentMessage('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      viewed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      signed: 'bg-green-500/20 text-green-400 border-green-500/30',
      declined: 'bg-red-500/20 text-red-400 border-red-500/30',
      expired: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
    };
    return colors[status] || 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Documents & Onboarding</h3>
          <p className="text-sm text-muted-foreground">
            Send deal memos, NDAs, and onboarding paperwork for signature
          </p>
        </div>
        <Button onClick={() => setShowSendDialog(true)}>
          <Send className="w-4 h-4 mr-2" />
          Send Document
        </Button>
      </div>

      {/* Deal Memos Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Deal Memos</h4>
          <Button variant="outline" size="sm" onClick={() => setShowDealMemoDialog(true)}>
            <FileSignature className="w-4 h-4 mr-2" />
            New Deal Memo
          </Button>
        </div>
        {dealMemosLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : dealMemos.length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="py-8 text-center">
              <FileSignature className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
              <p className="text-muted-gray">No deal memos yet</p>
              <p className="text-sm text-muted-gray mt-1">
                Create deal memos when offering roles to capture rates and terms
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {dealMemos.map((memo) => (
              <div key={memo.id} className="group">
                <DealMemoStatus
                  dealMemo={memo}
                  onEdit={() => {
                    setSelectedDealMemo(memo);
                    setShowDealMemoDialog(true);
                  }}
                  onUpdateStatus={(status, notes, signedDocUrl) =>
                    handleUpdateStatus(memo.id, status, notes, signedDocUrl)
                  }
                  onSend={() => sendDealMemo.mutate(memo.id)}
                  onVoid={() => voidDealMemo.mutate(memo.id)}
                  onResend={() => resendDealMemo.mutate(memo.id)}
                  onDelete={() => {
                    if (confirm('Are you sure you want to delete this deal memo?')) {
                      deleteDealMemo.mutate(memo.id);
                    }
                  }}
                  onDownload={() => {
                    if (memo.signed_document_url) {
                      window.open(memo.signed_document_url, '_blank');
                    }
                  }}
                  isUpdating={updateDealMemoStatus.isPending}
                />
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs text-muted-foreground mt-1"
                  onClick={() => setShowDealMemoDetails(memo)}
                >
                  View details & history
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document Templates */}
      <div>
        <h4 className="text-sm font-medium mb-3">Available Templates</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {templatesLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 h-24 bg-muted" />
              </Card>
            ))
          ) : (
            templates?.map((template: any) => (
              <Card key={template.id} className="cursor-pointer hover:border-primary" onClick={() => {
                setSelectedTemplateId(template.id);
                setShowSendDialog(true);
              }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium text-sm">{template.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {template.document_type}
                  </Badge>
                  {template.requires_encryption && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      <Shield className="w-3 h-3 mr-1" />
                      Encrypted
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Pending Signatures */}
      <div>
        <h4 className="text-sm font-medium mb-3">Pending Signatures</h4>
        {requestsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : signatureRequests?.filter((r: any) => r.status !== 'signed').length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="py-8 text-center">
              <FileSignature className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
              <p className="text-muted-gray">No pending signature requests</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {signatureRequests?.filter((r: any) => r.status !== 'signed').map((request: any) => (
              <Card key={request.id} className="bg-charcoal-black border-muted-gray/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-gray" />
                    <div>
                      <p className="font-medium text-bone-white">{request.document_title}</p>
                      <p className="text-sm text-muted-gray">
                        To: {request.recipient_name || request.recipient_email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusBadge(request.status)}>
                      {request.status}
                    </Badge>
                    {request.due_date && (
                      <span className="text-xs text-muted-gray">
                        Due: {format(parseLocalDate(request.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Signed Documents */}
      <div>
        <h4 className="text-sm font-medium mb-3 text-bone-white">Completed Documents</h4>
        {signatureRequests?.filter((r: any) => r.status === 'signed').length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="py-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
              <p className="text-muted-gray">No completed documents yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {signatureRequests?.filter((r: any) => r.status === 'signed').slice(0, 5).map((request: any) => (
              <Card key={request.id} className="bg-charcoal-black border-muted-gray/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="font-medium text-bone-white">{request.document_title}</p>
                      <p className="text-sm text-muted-gray">
                        Signed by: {request.recipient_name}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-gray">
                    {request.signed_at && format(new Date(request.signed_at), 'MMM d, yyyy')}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Send Document Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Document for Signature</DialogTitle>
            <DialogDescription>
              Select a document template and recipients to send for signature.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Document Template</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((template: any) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-bone-white">Recipients</label>
              <div className="border border-muted-gray/30 rounded-md p-2 max-h-40 overflow-y-auto space-y-1 bg-charcoal-black">
                {teamMembers?.map((member: any) => (
                  <label key={member.id} className="flex items-center gap-2 p-2 hover:bg-muted-gray/20 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRecipients.includes(member.user_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecipients([...selectedRecipients, member.user_id]);
                        } else {
                          setSelectedRecipients(selectedRecipients.filter((id) => id !== member.user_id));
                        }
                      }}
                      className="h-4 w-4 rounded border-2 border-muted-gray/60 bg-transparent checked:bg-accent-yellow checked:border-accent-yellow accent-accent-yellow"
                    />
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{member.full_name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-bone-white">{member.full_name || member.email}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message (optional)</label>
              <Textarea
                placeholder="Add a personal message..."
                value={documentMessage}
                onChange={(e) => setDocumentMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendDocumentMutation.mutate({
                templateId: selectedTemplateId,
                recipientIds: selectedRecipients,
                message: documentMessage,
              })}
              disabled={!selectedTemplateId || selectedRecipients.length === 0 || sendDocumentMutation.isPending}
            >
              {sendDocumentMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deal Memo Dialog */}
      <DealMemoDialog
        open={showDealMemoDialog}
        onOpenChange={(open) => {
          setShowDealMemoDialog(open);
          if (!open) setSelectedDealMemo(null);
        }}
        projectId={projectId}
        dealMemo={selectedDealMemo || undefined}
        onSuccess={() => {
          setShowDealMemoDialog(false);
          setSelectedDealMemo(null);
        }}
      />

      {/* Deal Memo Details Dialog */}
      <Dialog open={!!showDealMemoDetails} onOpenChange={(open) => !open && setShowDealMemoDetails(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deal Memo Details</DialogTitle>
            <DialogDescription>
              {showDealMemoDetails?.position_title} - {showDealMemoDetails?.user?.display_name}
            </DialogDescription>
          </DialogHeader>

          {showDealMemoDetails && (
            <div className="space-y-6 py-4">
              {/* Workflow Stepper */}
              <div>
                <h4 className="text-sm font-medium mb-3">Paperwork Status</h4>
                <DealMemoWorkflow
                  dealMemo={showDealMemoDetails}
                  onUpdateStatus={(status, notes, signedDocUrl) =>
                    handleUpdateStatus(showDealMemoDetails.id, status, notes, signedDocUrl)
                  }
                  isUpdating={updateDealMemoStatus.isPending}
                />
              </div>

              {/* Deal Terms Summary */}
              <div>
                <h4 className="text-sm font-medium mb-3">Deal Terms</h4>
                <Card>
                  <CardContent className="py-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Rate:</span>{' '}
                      <span className="font-medium">
                        ${showDealMemoDetails.rate_amount}/{showDealMemoDetails.rate_type}
                      </span>
                    </div>
                    {showDealMemoDetails.overtime_multiplier && (
                      <div>
                        <span className="text-muted-foreground">OT:</span>{' '}
                        <span>{showDealMemoDetails.overtime_multiplier}x</span>
                      </div>
                    )}
                    {showDealMemoDetails.double_time_multiplier && (
                      <div>
                        <span className="text-muted-foreground">DT:</span>{' '}
                        <span>{showDealMemoDetails.double_time_multiplier}x</span>
                      </div>
                    )}
                    {showDealMemoDetails.kit_rental_rate && (
                      <div>
                        <span className="text-muted-foreground">Kit:</span>{' '}
                        <span>${showDealMemoDetails.kit_rental_rate}/day</span>
                      </div>
                    )}
                    {showDealMemoDetails.car_allowance && (
                      <div>
                        <span className="text-muted-foreground">Car:</span>{' '}
                        <span>${showDealMemoDetails.car_allowance}/day</span>
                      </div>
                    )}
                    {showDealMemoDetails.per_diem_rate && (
                      <div>
                        <span className="text-muted-foreground">Per Diem:</span>{' '}
                        <span>${showDealMemoDetails.per_diem_rate}/day</span>
                      </div>
                    )}
                    {showDealMemoDetails.start_date && (
                      <div>
                        <span className="text-muted-foreground">Start:</span>{' '}
                        <span>{format(parseLocalDate(showDealMemoDetails.start_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    {showDealMemoDetails.end_date && (
                      <div>
                        <span className="text-muted-foreground">End:</span>{' '}
                        <span>{format(parseLocalDate(showDealMemoDetails.end_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Status History */}
              <div>
                <h4 className="text-sm font-medium mb-3">Status History</h4>
                <Card>
                  <CardContent className="py-4">
                    <DealMemoHistory history={dealMemoHistory} isLoading={historyLoading} />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDealMemoDetails(null)}>
              Close
            </Button>
            <Button onClick={() => {
              setSelectedDealMemo(showDealMemoDetails);
              setShowDealMemoDetails(null);
              setShowDealMemoDialog(true);
            }}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Deal Memo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Communication Section Component
// =============================================================================

interface CommunicationSectionProps {
  projectId: string;
}

function CommunicationSection({ projectId }: CommunicationSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementPriority, setAnnouncementPriority] = useState<'normal' | 'high' | 'urgent'>('normal');

  // Draft persistence for announcement form
  const announcementDraftKey = useMemo(() => buildDraftKey('backlot', 'announcement', projectId), [projectId]);
  const announcementDraftTimer = useRef<ReturnType<typeof setTimeout>>();
  const announcementDraftInit = useRef(false);

  // Restore announcement draft on mount
  useEffect(() => {
    const draft = loadDraft<{ title: string; content: string; priority: 'normal' | 'high' | 'urgent' }>(announcementDraftKey);
    if (draft) {
      setAnnouncementTitle(draft.data.title);
      setAnnouncementContent(draft.data.content);
      setAnnouncementPriority(draft.data.priority);
    }
    announcementDraftInit.current = true;
  }, [announcementDraftKey]);

  // Auto-save announcement draft
  useEffect(() => {
    if (!announcementDraftInit.current) return;
    clearTimeout(announcementDraftTimer.current);
    const hasContent = announcementTitle || announcementContent;
    if (!hasContent) return;
    announcementDraftTimer.current = setTimeout(() => {
      saveDraft(announcementDraftKey, {
        title: announcementTitle,
        content: announcementContent,
        priority: announcementPriority,
      });
    }, 500);
    return () => clearTimeout(announcementDraftTimer.current);
  }, [announcementTitle, announcementContent, announcementPriority, announcementDraftKey]);

  // Fetch channels
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/channels`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch channels');
      return response.json();
    },
  });

  // Fetch messages for active channel
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['channel-messages', activeChannel],
    queryFn: async () => {
      if (!activeChannel) return [];
      const response = await fetch(`/api/v1/backlot/channels/${activeChannel}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!activeChannel,
  });

  // Fetch announcements
  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ['announcements', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/announcements`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch announcements');
      return response.json();
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/v1/backlot/channels/${activeChannel}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-messages', activeChannel] });
      setMessageContent('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Create channel mutation
  const createChannelMutation = useMutation({
    mutationFn: async (data: { name: string; channel_type: string }) => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create channel');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', projectId] });
      toast({ title: 'Channel created' });
    },
  });

  // Create announcement mutation
  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; priority: string }) => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create announcement');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', projectId] });
      toast({ title: 'Announcement posted' });
      setShowAnnouncementDialog(false);
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementPriority('normal');
      clearDraftStorage(announcementDraftKey);
    },
  });

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
      normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[priority] || 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Crew Communication</h3>
          <p className="text-sm text-muted-foreground">
            Message channels, direct messages, and announcements
          </p>
        </div>
        <Button onClick={() => setShowAnnouncementDialog(true)}>
          <Megaphone className="w-4 h-4 mr-2" />
          New Announcement
        </Button>
      </div>

      {/* Announcements */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Recent Announcements
        </h4>
        {announcementsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : announcements?.length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="py-8 text-center">
              <Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
              <p className="text-muted-gray">No announcements yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {announcements?.slice(0, 3).map((announcement: any) => (
              <Card key={announcement.id} className={`bg-charcoal-black ${announcement.priority === 'urgent' ? 'border-red-500/50' : 'border-muted-gray/30'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-medium text-bone-white">{announcement.title}</h5>
                        <Badge className={getPriorityColor(announcement.priority)}>
                          {announcement.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-gray line-clamp-2">
                        {announcement.content}
                      </p>
                      <p className="text-xs text-muted-gray mt-2">
                        By {announcement.sender_name} &bull; {format(new Date(announcement.published_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    {announcement.requires_acknowledgment && (
                      <Badge variant={announcement.is_acknowledged ? 'secondary' : 'outline'} className="border-muted-gray/50">
                        {announcement.is_acknowledged ? 'Acknowledged' : 'Pending'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Channels and Messages */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Channel List */}
        <Card className="md:col-span-1 bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between text-bone-white">
              <span>Channels</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const name = prompt('Enter channel name:');
                  if (name) {
                    createChannelMutation.mutate({ name, channel_type: 'general' });
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {channelsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-gray" />
              </div>
            ) : channels?.length === 0 ? (
              <p className="text-sm text-muted-gray text-center py-4">
                No channels yet. Create one to get started!
              </p>
            ) : (
              <div className="space-y-1">
                {channels?.map((channel: any) => (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannel(channel.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                      activeChannel === channel.id
                        ? 'bg-accent-yellow text-charcoal-black'
                        : 'text-bone-white hover:bg-muted-gray/20'
                    }`}
                  >
                    <Hash className="w-4 h-4" />
                    {channel.name}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="md:col-span-2 bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-bone-white">
              {activeChannel
                ? `#${channels?.find((c: any) => c.id === activeChannel)?.name || 'channel'}`
                : 'Select a channel'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {!activeChannel ? (
              <div className="flex items-center justify-center py-12 text-muted-gray">
                <MessageSquare className="w-8 h-8 mr-2" />
                Select a channel to view messages
              </div>
            ) : (
              <>
                <ScrollArea className="h-64 p-2">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-gray" />
                    </div>
                  ) : messages?.length === 0 ? (
                    <p className="text-sm text-muted-gray text-center py-8">
                      No messages yet. Start the conversation!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {messages?.map((message: any) => (
                        <div key={message.id} className="flex gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={message.sender_avatar} />
                            <AvatarFallback>
                              {message.sender_name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="font-medium text-sm text-bone-white">
                                {message.sender_name}
                              </span>
                              <span className="text-xs text-muted-gray">
                                {format(new Date(message.created_at), 'h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm text-bone-white">{message.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <div className="flex gap-2 mt-2 pt-2 border-t border-muted-gray/30">
                  <Input
                    placeholder="Type a message..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && messageContent.trim()) {
                        e.preventDefault();
                        sendMessageMutation.mutate(messageContent);
                      }
                    }}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                  <Button
                    size="icon"
                    onClick={() => sendMessageMutation.mutate(messageContent)}
                    disabled={!messageContent.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcement Dialog */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>
              Post an announcement to your crew. They will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="Announcement title"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                placeholder="Write your announcement..."
                value={announcementContent}
                onChange={(e) => setAnnouncementContent(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select value={announcementPriority} onValueChange={(v: any) => setAnnouncementPriority(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnnouncementDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createAnnouncementMutation.mutate({
                title: announcementTitle,
                content: announcementContent,
                priority: announcementPriority,
              })}
              disabled={!announcementTitle || !announcementContent || createAnnouncementMutation.isPending}
            >
              {createAnnouncementMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Megaphone className="w-4 h-4 mr-2" />
              )}
              Post Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booked Person Detail Modal - Rendered via DOM manipulation in useEffect above */}

      {/* Edit Booking Dialog - Will be rendered via DOM manipulation in useEffect */}
    </div>
  );
}

// Edit Booking Dialog Component
interface EditBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: BacklotBookedPerson | null;
  projectId: string;
  onSuccess: () => void;
}

// Extract unique departments from POSITIONS
const DEPARTMENTS = Array.from(new Set(POSITIONS.map(p => p.department)))
  .sort()
  .map((dept) => ({
    id: dept.toLowerCase().replace(/\s+/g, '-'),
    name: dept,
  }));

function EditBookingDialog({ open, onOpenChange, person, projectId, onSuccess }: EditBookingDialogProps) {
  console.log('=== EditBookingDialog FUNCTION CALLED ===');
  console.log('EditBookingDialog component rendering for:', person?.name);
  console.log('Props received:', { open, person: person?.name, projectId });

  const { toast } = useToast();
  const { updateRole } = useProjectRoleMutations(projectId);

  const [roleTitle, setRoleTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bookingRate, setBookingRate] = useState('');
  const [customRoles, setCustomRoles] = useState<Array<{ id: string; name: string; department?: string }>>([]);
  const [customDepartments, setCustomDepartments] = useState<Array<{ id: string; name: string }>>([]);

  // Initialize form when person changes
  React.useEffect(() => {
    if (person) {
      setRoleTitle(person.role_title || '');
      setDepartment(person.department || '');
      setCharacterName(person.character_name || '');
      setStartDate(person.start_date || '');
      setEndDate(person.end_date || '');
      setBookingRate(person.booking_rate || '');
    }
  }, [person]);

  const handleSubmit = async () => {
    if (!person) return;

    try {
      const input: ProjectRoleInput = {
        type: person.role_type,
        title: roleTitle,
        department: department || null,
        character_name: characterName || null,
        start_date: startDate || null,
        end_date: endDate || null,
        rate_description: bookingRate || null,
        status: 'booked',
      };

      await updateRole.mutateAsync({ roleId: person.role_id, input });
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update booking',
        variant: 'destructive',
      });
    }
  };

  if (!person) {
    console.log('EditBookingDialog: person is null, returning null');
    return null;
  }

  console.log('EditBookingDialog: rendering UI for', person.name);

  // Prepare roles for SearchableCombobox
  const baseRoles = POSITIONS.map(p => ({ id: p.id, name: p.name, department: p.department }));
  const allRoles = [...baseRoles, ...customRoles];
  const selectedRole = allRoles.find(r => r.name === roleTitle);

  const searchRoles = async (query: string) => {
    if (!query || query.length < 1) {
      return allRoles.sort((a, b) => a.name.localeCompare(b.name));
    }
    const lowerQuery = query.toLowerCase();
    return allRoles.filter(r =>
      r.name.toLowerCase().includes(lowerQuery) ||
      ('department' in r && (r as any).department?.toLowerCase().includes(lowerQuery))
    ).sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (aName === lowerQuery && bName !== lowerQuery) return -1;
      if (bName === lowerQuery && aName !== lowerQuery) return 1;
      if (aName.startsWith(lowerQuery) && !bName.startsWith(lowerQuery)) return -1;
      if (bName.startsWith(lowerQuery) && !aName.startsWith(lowerQuery)) return 1;
      return aName.localeCompare(bName);
    });
  };

  const handleAddRole = async (name: string) => {
    const newRole = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name,
    };
    setCustomRoles(prev => [...prev, newRole]);
    setRoleTitle(name);
    return newRole;
  };

  // Prepare departments for SearchableCombobox
  const allDepartments = [...DEPARTMENTS, ...customDepartments];
  const selectedDept = allDepartments.find(d => d.name === department);

  const searchDepartments = async (query: string) => {
    if (!query || query.length < 1) {
      return allDepartments.sort((a, b) => a.name.localeCompare(b.name));
    }
    const lowerQuery = query.toLowerCase();
    return allDepartments.filter(d =>
      d.name.toLowerCase().includes(lowerQuery)
    ).sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleAddDepartment = async (name: string) => {
    const newDept = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name,
    };
    setCustomDepartments(prev => [...prev, newDept]);
    setDepartment(name);
    return newDept;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-bone-white mb-2">Edit Booking</h2>
          <p className="text-muted-gray">
            Update booking details for {person.name}
          </p>
        </div>

        <div className="space-y-4">
          {/* Role Title with SearchableCombobox */}
          <div className="space-y-2">
            <Label className="text-bone-white">Position / Role Title</Label>
            <SearchableCombobox
              value={selectedRole?.id || null}
              onChange={(id, role) => setRoleTitle(role?.name || '')}
              searchFn={searchRoles}
              onAddNew={handleAddRole}
              placeholder="Select or add role title..."
              searchPlaceholder="Search roles..."
              emptyMessage="No roles found."
              addNewLabel="Add custom role"
              renderItem={(role) => (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-gray" />
                  <div className="flex flex-col">
                    <span className="text-bone-white">{role.name}</span>
                    {'department' in role && (role as any).department && (
                      <span className="text-[10px] text-muted-gray">{(role as any).department}</span>
                    )}
                  </div>
                </div>
              )}
              renderSelected={(role) => (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-gray" />
                  <span>{role.name}</span>
                </div>
              )}
              initialSelectedItem={selectedRole}
            />
          </div>

          {/* Department with SearchableCombobox */}
          <div className="space-y-2">
            <Label className="text-bone-white">Department</Label>
            <SearchableCombobox
              value={selectedDept?.id || null}
              onChange={(id, dept) => setDepartment(dept?.name || '')}
              searchFn={searchDepartments}
              onAddNew={handleAddDepartment}
              placeholder="Select department..."
              searchPlaceholder="Search departments..."
              emptyMessage="No departments found."
              addNewLabel="Add department"
              renderItem={(dept) => (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-gray" />
                  <span className="text-bone-white">{dept.name}</span>
                </div>
              )}
              renderSelected={(dept) => (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-gray" />
                  <span>{dept.name}</span>
                </div>
              )}
              initialSelectedItem={selectedDept}
            />
          </div>

          {/* Character Name (for cast) */}
          {person.role_type === 'cast' && (
            <div className="space-y-2">
              <Label htmlFor="character-name" className="text-bone-white">
                Character Name
              </Label>
              <Input
                id="character-name"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="e.g., John Doe"
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-bone-white">
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-bone-white">
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
          </div>

          {/* Booking Rate */}
          <div className="space-y-2">
            <Label htmlFor="booking-rate" className="text-bone-white">
              Booking Rate
            </Label>
            <Input
              id="booking-rate"
              value={bookingRate}
              onChange={(e) => setBookingRate(e.target.value)}
              placeholder="e.g., $500/daily, $2000/weekly"
              className="bg-charcoal-black border-muted-gray/30 text-bone-white"
            />
            <p className="text-xs text-muted-gray">
              Enter rate in format: $amount/period (e.g., $500/daily, $2000/weekly)
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6 pt-6 border-t border-muted-gray/30">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-muted-gray/30"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!roleTitle || updateRole.isPending}
            className="bg-primary-red hover:bg-primary-red/90"
          >
            {updateRole.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Edit className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
