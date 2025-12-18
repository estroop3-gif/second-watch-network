/**
 * SceneDetailView - Comprehensive scene hub with all aggregated data
 * This component serves as the wrapper that renders SceneDetailPage
 */
import React from 'react';
import SceneDetailPage from './SceneDetailPage/SceneDetailPage';

interface SceneDetailViewProps {
  projectId: string;
  sceneId: string;
  canEdit: boolean;
  onBack: () => void;
}

export default function SceneDetailView({ projectId, sceneId, canEdit, onBack }: SceneDetailViewProps) {
  return (
    <SceneDetailPage
      projectId={projectId}
      sceneId={sceneId}
      canEdit={canEdit}
      onBack={onBack}
    />
  );
}
