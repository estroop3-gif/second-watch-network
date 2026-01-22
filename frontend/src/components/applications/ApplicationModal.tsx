/**
 * Application Modal - Orchestrator component for applying to collabs/roles
 * Renders mobile wizard on small screens, desktop modal on larger screens
 */
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useApplicationForm } from '@/hooks/applications/useApplicationForm';
import ApplicationModalDesktop from './ApplicationModalDesktop';
import ApplicationWizardMobile from './ApplicationWizardMobile';

import type { CommunityCollab } from '@/types/community';

interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  collab: CommunityCollab | null;
  onSuccess?: () => void;
}

const ApplicationModal: React.FC<ApplicationModalProps> = ({
  isOpen,
  onClose,
  collab,
  onSuccess,
}) => {
  const isMobile = useIsMobile();

  // Use the shared form hook
  const form = useApplicationForm({
    collab,
    isOpen,
    onClose,
    onSuccess,
  });

  // Don't render if no collab
  if (!collab) return null;

  // Render mobile wizard or desktop modal based on screen size
  if (isMobile) {
    return (
      <ApplicationWizardMobile
        isOpen={isOpen}
        onClose={onClose}
        collab={collab}
        form={form}
      />
    );
  }

  return (
    <ApplicationModalDesktop
      isOpen={isOpen}
      onClose={onClose}
      collab={collab}
      form={form}
    />
  );
};

export default ApplicationModal;
