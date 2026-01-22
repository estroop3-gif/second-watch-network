/**
 * ApplicantDetailPage - Full-page view for reviewing a single applicant
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useCollabApplications,
  useUpdateCollabApplicationStatus,
  useProject,
} from '@/hooks/backlot';
import { useApplicantNavigation } from '@/hooks/backlot/useApplicantNavigation';
import { useApplicantProfile } from '@/hooks/backlot/useApplicantProfile';
import { api } from '@/lib/api';
import { CommunityCollab } from '@/types/community';
import { CollabApplication, ApplicationStatus } from '@/types/applications';
import {
  ApplicantHeader,
  ApplicantSidebar,
  ApplicantMainContent,
} from '@/components/backlot/applicants';

export default function ApplicantDetailPage() {
  const { projectId, collabId, applicationId } = useParams<{
    projectId: string;
    collabId: string;
    applicationId: string;
  }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch project info
  const { data: project } = useProject(projectId);

  // Fetch collab details
  const { data: collab, isLoading: collabLoading } = useQuery({
    queryKey: ['collab', collabId],
    queryFn: async () => {
      const response = await api.get<CommunityCollab>(
        `/api/v1/community/collabs/${collabId}`
      );
      return response;
    },
    enabled: !!collabId,
  });

  // Fetch all applications (for navigation)
  const { data: applications, isLoading: applicationsLoading } =
    useCollabApplications(collabId);

  // Find current application
  const application = applications?.find(
    (app: CollabApplication) => app.id === applicationId
  ) as CollabApplication | undefined;

  // Fetch full profile for this applicant
  const { profile, credits: profileCredits } = useApplicantProfile(
    application?.applicant_user_id
  );

  // Navigation hook
  const navigation = useApplicantNavigation({
    applications: applications as CollabApplication[] | undefined,
    currentApplicationId: applicationId || '',
    projectId: projectId || '',
    collabId: collabId || '',
  });

  // Update status mutation
  const updateStatus = useUpdateCollabApplicationStatus(collabId || '');

  // Handle status change
  const handleStatusChange = async (newStatus: ApplicationStatus) => {
    if (!application) return;

    try {
      await updateStatus.mutateAsync({
        applicationId: application.id,
        status: newStatus,
        internalNotes: application.internal_notes || undefined,
        rating: application.rating || undefined,
      });
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

  // Handle rating change
  const handleRatingChange = async (newRating: number) => {
    if (!application) return;

    try {
      await updateStatus.mutateAsync({
        applicationId: application.id,
        status: application.status,
        internalNotes: application.internal_notes || undefined,
        rating: newRating || undefined,
      });
      toast({
        title: 'Rating updated',
        description: newRating ? `Rated ${newRating} star${newRating !== 1 ? 's' : ''}` : 'Rating cleared',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update rating',
        variant: 'destructive',
      });
    }
  };

  // Handle notes change (debounced in sidebar)
  const handleNotesChange = async (newNotes: string) => {
    if (!application) return;

    try {
      await updateStatus.mutateAsync({
        applicationId: application.id,
        status: application.status,
        internalNotes: newNotes || undefined,
        rating: application.rating || undefined,
      });
      // Silent save - no toast for auto-save
    } catch (error: any) {
      toast({
        title: 'Error saving notes',
        description: error.message || 'Failed to save notes',
        variant: 'destructive',
      });
    }
  };

  // Handle message action
  const handleMessage = () => {
    const userId = application?.current_profile?.id || application?.applicant_user_id;
    if (userId) {
      // Get applicant name and role for quick templates
      const applicantName =
        application?.current_profile?.display_name ||
        application?.current_profile?.full_name ||
        application?.current_profile?.username ||
        'there';
      const roleName = collab?.title || 'this position';

      // Build URL with context for quick templates
      const params = new URLSearchParams({
        user: userId,
        context: 'applicant',
        name: applicantName,
        role: roleName,
      });

      navigate(`/messages?${params.toString()}`);
    }
  };

  // Handle email action
  const handleEmail = () => {
    // Email would come from the profile - check if available
    // For now, we just show a message if not available
    toast({
      title: 'Email not available',
      description: 'Use the Message button to contact this applicant',
    });
  };

  const isLoading = collabLoading || applicationsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-yellow" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-bone-white mb-2">
            Application not found
          </h2>
          <p className="text-muted-gray mb-4">
            This application may have been removed or you don't have access.
          </p>
          <button
            onClick={navigation.goBack}
            className="text-accent-yellow hover:underline"
          >
            Return to applicants list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-black flex flex-col">
      {/* Header */}
      <ApplicantHeader
        collabTitle={collab?.title || 'Loading...'}
        currentIndex={navigation.currentIndex}
        total={navigation.total}
        hasNext={navigation.hasNext}
        hasPrev={navigation.hasPrev}
        onNext={navigation.goToNext}
        onPrev={navigation.goToPrev}
        onBack={navigation.goBack}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <ApplicantSidebar
          profile={application.current_profile}
          location={profile?.location}
          experienceLevel={profile?.experience_level}
          status={application.status}
          rating={application.rating}
          internalNotes={application.internal_notes}
          isUpdating={updateStatus.isPending}
          onStatusChange={handleStatusChange}
          onRatingChange={handleRatingChange}
          onNotesChange={handleNotesChange}
          onMessage={handleMessage}
          onEmail={handleEmail}
        />

        {/* Main content */}
        <ApplicantMainContent
          application={application}
          collab={collab}
          profile={profile}
          profileCredits={profileCredits}
        />
      </div>
    </div>
  );
}
