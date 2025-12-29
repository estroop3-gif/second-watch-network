import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FlaskConical, Bug, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import AlphaFeedbackModal from './AlphaFeedbackModal';

const MINIMIZED_KEY = 'alpha-banner-minimized';

const AlphaTesterBanner: React.FC = () => {
  const { profile, isLoading } = useEnrichedProfile();
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(MINIMIZED_KEY) === 'true';
  });
  const [modalType, setModalType] = useState<'bug' | 'feedback' | null>(null);

  const isAlphaTester = profile?.is_alpha_tester === true;

  // Persist minimized state
  useEffect(() => {
    localStorage.setItem(MINIMIZED_KEY, String(isMinimized));
  }, [isMinimized]);

  // Don't render if not an alpha tester or still loading
  if (isLoading || !isAlphaTester) {
    return null;
  }

  const openBugModal = () => setModalType('bug');
  const openFeedbackModal = () => setModalType('feedback');
  const closeModal = () => setModalType(null);

  // Minimized state - small floating button
  if (isMinimized) {
    return (
      <>
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-purple-900/95 border border-purple-600 rounded-full text-purple-200 hover:bg-purple-800 transition-colors shadow-lg"
          title="Expand Alpha Testing Banner"
        >
          <FlaskConical className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium">Alpha</span>
          <ChevronUp className="h-4 w-4" />
        </button>

        <AlphaFeedbackModal
          isOpen={modalType !== null}
          onClose={closeModal}
          type={modalType || 'feedback'}
        />
      </>
    );
  }

  // Full banner
  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-purple-900/95 border-t border-purple-600 backdrop-blur-sm shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 max-w-screen-2xl mx-auto">
          {/* Left side - Label */}
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-400" />
            <span className="text-purple-200 font-medium">Alpha Testing Account</span>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-3">
            <Button
              onClick={openBugModal}
              variant="ghost"
              className="bg-purple-600/50 hover:bg-purple-600 text-white border border-purple-500/50"
            >
              <Bug className="h-4 w-4 mr-2" />
              Report Bug
            </Button>

            <Button
              onClick={openFeedbackModal}
              variant="ghost"
              className="bg-purple-600/50 hover:bg-purple-600 text-white border border-purple-500/50"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Give Feedback
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(true)}
              className="text-purple-300 hover:text-purple-100 hover:bg-purple-800"
              title="Minimize"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Spacer to prevent content from being hidden behind the banner */}
      <div className="h-14" />

      <AlphaFeedbackModal
        isOpen={modalType !== null}
        onClose={closeModal}
        type={modalType || 'feedback'}
      />
    </>
  );
};

export default AlphaTesterBanner;
