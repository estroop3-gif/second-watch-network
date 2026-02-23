/**
 * Filmmakers / Community Hub
 * Main community page with tabbed navigation for Home, People, Collabs, and Topics
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CommunityTabs, { CommunityTabType } from '@/components/community/CommunityTabs';
import CommunityHome from '@/components/community/CommunityHome';
import PeopleDirectory from '@/components/community/PeopleDirectory';
import CollabBoard from '@/components/community/CollabBoard';
import CollabForm from '@/components/community/CollabForm';
import CollabDetailModal from '@/components/community/CollabDetailModal';
import { ApplicationModal } from '@/components/applications';
import TopicsBoard from '@/components/community/TopicsBoard';
import ThreadForm from '@/components/community/ThreadForm';
import ThreadView from '@/components/community/ThreadView';
import { FeedBoard } from '@/components/community/feed';
import CommunityMarketplaceTab from '@/components/community/CommunityMarketplaceTab';
import CommunityForSaleTab from '@/components/community/CommunityForSaleTab';
import { CommunityCollab, CommunityThread } from '@/types/community';
import { useAuth } from '@/context/AuthContext';

const Filmmakers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as CommunityTabType) || 'home';
  const initialFilter = searchParams.get('filter') || undefined;

  const [activeTab, setActiveTab] = useState<CommunityTabType>(initialTab);
  const [peopleFilter, setPeopleFilter] = useState<string | undefined>(initialFilter);
  const [showCollabForm, setShowCollabForm] = useState(false);
  const [editingCollab, setEditingCollab] = useState<CommunityCollab | undefined>();
  const [viewingCollab, setViewingCollab] = useState<CommunityCollab | undefined>();
  const [applyingToCollab, setApplyingToCollab] = useState<CommunityCollab | undefined>();
  const [showThreadForm, setShowThreadForm] = useState(false);
  const [threadFormTopicId, setThreadFormTopicId] = useState<string | undefined>();
  const [viewingThread, setViewingThread] = useState<CommunityThread | undefined>();

  const handleTabChange = (tab: CommunityTabType) => {
    // Navigate to dedicated page for "My Posts"
    if (tab === 'my-posts') {
      navigate('/my-job-posts');
      return;
    }

    setActiveTab(tab);
    // Update URL without full navigation
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'home') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    newParams.delete('filter');
    setSearchParams(newParams, { replace: true });
  };

  const handleNavigate = (tab: CommunityTabType, filters?: Record<string, any>) => {
    setActiveTab(tab);
    if (filters?.filter) {
      setPeopleFilter(filters.filter);
    }
    const newParams = new URLSearchParams();
    if (tab !== 'home') {
      newParams.set('tab', tab);
    }
    if (filters?.filter) {
      newParams.set('filter', filters.filter);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Collab form handlers
  const handleCreateCollab = () => {
    setEditingCollab(undefined);
    setShowCollabForm(true);
  };

  const handleViewCollab = (collab: CommunityCollab) => {
    setViewingCollab(collab);
  };

  const handleCloseCollabDetail = () => {
    setViewingCollab(undefined);
  };

  const handleApplyFromDetail = (collab: CommunityCollab) => {
    setViewingCollab(undefined);
    setApplyingToCollab(collab);
  };

  const handleCloseApplication = () => {
    setApplyingToCollab(undefined);
  };

  const handleCloseCollabForm = () => {
    setShowCollabForm(false);
    setEditingCollab(undefined);
  };

  // Thread form handlers
  const handleCreateThread = (topicId?: string) => {
    setThreadFormTopicId(topicId);
    setShowThreadForm(true);
  };

  const handleViewThread = (thread: CommunityThread) => {
    setViewingThread(thread);
  };

  const handleCloseThreadForm = () => {
    setShowThreadForm(false);
    setThreadFormTopicId(undefined);
  };

  const handleCloseThreadView = () => {
    setViewingThread(undefined);
  };

  // If viewing a thread, show the thread view instead of tabs
  if (viewingThread) {
    return (
      <div className="container mx-auto px-4 max-w-4xl py-8">
        <ThreadView
          threadId={viewingThread.id}
          onBack={handleCloseThreadView}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 max-w-6xl py-8">
      {/* Tabs Navigation */}
      <CommunityTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab Content */}
      {activeTab === 'home' && (
        <CommunityHome onNavigate={handleNavigate} />
      )}

      {activeTab === 'feed' && (
        <FeedBoard />
      )}

      {activeTab === 'people' && (
        <PeopleDirectory initialFilter={peopleFilter} />
      )}

      {activeTab === 'collabs' && (
        <CollabBoard onCreateCollab={handleCreateCollab} onViewCollab={handleViewCollab} />
      )}

      {/* Collab Form Modal */}
      {showCollabForm && (
        <CollabForm
          onClose={handleCloseCollabForm}
          editCollab={editingCollab}
        />
      )}

      {activeTab === 'marketplace' && (
        <CommunityMarketplaceTab />
      )}

      {activeTab === 'for-sale' && (
        <CommunityForSaleTab />
      )}

      {activeTab === 'topics' && (
        <TopicsBoard onCreateThread={handleCreateThread} onViewThread={handleViewThread} />
      )}

      {/* Thread Form Modal */}
      {showThreadForm && (
        <ThreadForm
          onClose={handleCloseThreadForm}
          initialTopicId={threadFormTopicId}
        />
      )}

      {/* Collab Detail Modal */}
      <CollabDetailModal
        collab={viewingCollab || null}
        isOpen={!!viewingCollab}
        onClose={handleCloseCollabDetail}
        onApply={handleApplyFromDetail}
        isOwnCollab={viewingCollab?.user_id === user?.id}
      />

      {/* Application Modal */}
      <ApplicationModal
        isOpen={!!applyingToCollab}
        onClose={handleCloseApplication}
        collab={applyingToCollab || null}
        onSuccess={handleCloseApplication}
      />
    </div>
  );
};

export default Filmmakers;
