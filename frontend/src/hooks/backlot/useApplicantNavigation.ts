/**
 * useApplicantNavigation - Navigation hook for prev/next applicant and keyboard shortcuts
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CollabApplication } from '@/types/applications';

interface UseApplicantNavigationProps {
  applications: CollabApplication[] | undefined;
  currentApplicationId: string;
  projectId: string;
  collabId: string;
}

interface ApplicantNavigationResult {
  currentIndex: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  goToNext: () => void;
  goToPrev: () => void;
  goBack: () => void;
}

export function useApplicantNavigation({
  applications,
  currentApplicationId,
  projectId,
  collabId,
}: UseApplicantNavigationProps): ApplicantNavigationResult {
  const navigate = useNavigate();

  const { currentIndex, total } = useMemo(() => {
    if (!applications || applications.length === 0) {
      return { currentIndex: -1, total: 0 };
    }
    const index = applications.findIndex((app) => app.id === currentApplicationId);
    return { currentIndex: index, total: applications.length };
  }, [applications, currentApplicationId]);

  const hasNext = currentIndex >= 0 && currentIndex < total - 1;
  const hasPrev = currentIndex > 0;

  const goToNext = useCallback(() => {
    if (!applications || !hasNext) return;
    const nextApp = applications[currentIndex + 1];
    navigate(`/backlot/projects/${projectId}/postings/${collabId}/applicants/${nextApp.id}`);
  }, [applications, hasNext, currentIndex, navigate, projectId, collabId]);

  const goToPrev = useCallback(() => {
    if (!applications || !hasPrev) return;
    const prevApp = applications[currentIndex - 1];
    navigate(`/backlot/projects/${projectId}/postings/${collabId}/applicants/${prevApp.id}`);
  }, [applications, hasPrev, currentIndex, navigate, projectId, collabId]);

  const goBack = useCallback(() => {
    navigate(`/backlot/projects/${projectId}/postings/${collabId}/applicants`);
  }, [navigate, projectId, collabId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 'Escape':
          e.preventDefault();
          goBack();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, goBack]);

  return {
    currentIndex,
    total,
    hasNext,
    hasPrev,
    goToNext,
    goToPrev,
    goBack,
  };
}
