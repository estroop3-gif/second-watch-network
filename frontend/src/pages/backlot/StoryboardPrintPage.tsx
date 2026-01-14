/**
 * StoryboardPrintPage - Printable view for storyboards
 * Optimized for browser print-to-PDF
 */
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useStoryboard, SHOT_SIZES, CAMERA_MOVES } from '@/hooks/backlot';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';

export default function StoryboardPrintPage() {
  const { projectId, storyboardId } = useParams<{ projectId: string; storyboardId: string }>();
  const { data: storyboard, isLoading, error } = useStoryboard(projectId || null, storyboardId || null);

  // Auto-open print dialog when data loads
  useEffect(() => {
    if (storyboard && !isLoading) {
      // Delay to ensure images start loading
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [storyboard, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-6 w-48 mb-8" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="aspect-video" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !storyboard) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load storyboard</h2>
          <p className="text-gray-600">{(error as Error)?.message || 'Storyboard not found'}</p>
        </div>
      </div>
    );
  }

  const sortedSections = [...(storyboard.sections || [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  // Calculate totals
  const totalPanels = sortedSections.reduce((sum, s) => sum + (s.panels?.length || 0), 0);
  const totalDuration = sortedSections.reduce((sum, section) => {
    return sum + (section.panels || []).reduce((pSum, p) => pSum + (p.duration_seconds || 0), 0);
  }, 0);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="min-h-screen bg-white text-black print:bg-white print:text-black">
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.5in;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-before: always;
          }
        }
        @media screen {
          body {
            background: #f5f5f5;
          }
          .print-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 2rem;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
        }
      `}</style>

      <div className="print-container">
        {/* Header */}
        <header className="mb-8 pb-4 border-b-2 border-gray-300">
          <h1 className="text-3xl font-bold text-gray-900">{storyboard.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-gray-600">
            <span>Aspect Ratio: {storyboard.aspect_ratio}</span>
            <span>|</span>
            <span>{sortedSections.length} Section(s)</span>
            <span>|</span>
            <span>{totalPanels} Panel(s)</span>
            {totalDuration > 0 && (
              <>
                <span>|</span>
                <span>Total Duration: {formatDuration(totalDuration)}</span>
              </>
            )}
            <span>|</span>
            <span>Generated {format(new Date(), 'MMM d, yyyy')}</span>
          </div>
          {storyboard.description && (
            <p className="mt-2 text-gray-600">{storyboard.description}</p>
          )}
        </header>

        {/* Sections */}
        {sortedSections.map((section, sectionIdx) => {
          const sortedPanels = [...(section.panels || [])].sort(
            (a, b) => a.sort_order - b.sort_order
          );

          return (
            <section
              key={section.id}
              className={`mb-8 ${sectionIdx > 0 && sortedPanels.length > 8 ? 'page-break' : ''}`}
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                {section.title}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({sortedPanels.length} panel{sortedPanels.length !== 1 ? 's' : ''})
                </span>
              </h2>

              {sortedPanels.length > 0 ? (
                <div className="grid grid-cols-4 gap-4">
                  {sortedPanels.map((panel, panelIdx) => {
                    const shotInfo = SHOT_SIZES.find((s) => s.value === panel.shot_size);
                    const moveInfo = CAMERA_MOVES.find((m) => m.value === panel.camera_move);

                    return (
                      <div key={panel.id} className="break-inside-avoid">
                        <div className="border border-gray-300 rounded overflow-hidden">
                          {/* Panel Image */}
                          <div className="aspect-video bg-gray-100 relative">
                            {panel.reference_image_url ? (
                              <img
                                src={panel.reference_image_url}
                                alt={panel.title || `Panel ${panelIdx + 1}`}
                                className="w-full h-full object-cover"
                                loading="eager"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <ImageIcon className="w-8 h-8" />
                              </div>
                            )}
                            {/* Panel Number Badge */}
                            <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                              #{panelIdx + 1}
                            </div>
                          </div>

                          {/* Panel Info */}
                          <div className="p-2 bg-gray-50">
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {panel.title || `Panel ${panelIdx + 1}`}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {shotInfo && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">
                                  {shotInfo.label}
                                </span>
                              )}
                              {moveInfo && (
                                <span className="text-xs bg-green-100 text-green-800 px-1 rounded">
                                  {moveInfo.label}
                                </span>
                              )}
                              {panel.lens && (
                                <span className="text-xs bg-purple-100 text-purple-800 px-1 rounded">
                                  {panel.lens}
                                </span>
                              )}
                              {panel.duration_seconds && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">
                                  {panel.duration_seconds}s
                                </span>
                              )}
                            </div>
                            {(panel.action || panel.dialogue) && (
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                {panel.action || panel.dialogue}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 italic">No panels in this section</p>
              )}
            </section>
          );
        })}

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500 no-print">
          <p>Press Ctrl+P (Cmd+P on Mac) to print or save as PDF</p>
        </footer>
      </div>
    </div>
  );
}
