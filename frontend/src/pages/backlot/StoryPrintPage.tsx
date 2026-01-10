/**
 * StoryPrintPage - Printable view for stories
 * Optimized for browser print-to-PDF
 */
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useStoryPrintData } from '@/hooks/backlot';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const STRUCTURE_LABELS: Record<string, string> = {
  'three-act': 'Three-Act Structure',
  'five-act': 'Five-Act Structure',
  'hero-journey': "Hero's Journey",
  'save-the-cat': 'Save the Cat',
  'custom': 'Custom',
};

const ROLE_LABELS: Record<string, string> = {
  'protagonist': 'Protagonist',
  'antagonist': 'Antagonist',
  'supporting': 'Supporting',
  'minor': 'Minor',
};

export default function StoryPrintPage() {
  const { projectId, storyId } = useParams<{ projectId: string; storyId: string }>();
  const { data, isLoading, error } = useStoryPrintData(projectId || null, storyId || null);

  // Auto-open print dialog when data loads
  useEffect(() => {
    if (data && !isLoading) {
      // Small delay to ensure content renders
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [data, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-6 w-48 mb-8" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load story</h2>
          <p className="text-gray-600">{(error as Error)?.message || 'Story not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black print:bg-white print:text-black">
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 0.75in;
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
      `}</style>

      {/* Header */}
      <header className="mb-8 pb-4 border-b-2 border-gray-300">
        <h1 className="text-3xl font-bold text-gray-900">{data.story.title}</h1>
        <div className="flex items-center gap-4 mt-2 text-gray-600 text-sm">
          <span>{data.project_title}</span>
          <span>|</span>
          <span>Generated {format(new Date(data.generated_at), 'MMM d, yyyy')}</span>
        </div>
        {data.story.logline && (
          <p className="mt-3 text-gray-700 italic">{data.story.logline}</p>
        )}
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          {data.story.genre && (
            <span className="text-gray-600">
              <strong>Genre:</strong> {data.story.genre}
            </span>
          )}
          {data.story.tone && (
            <span className="text-gray-600">
              <strong>Tone:</strong> {data.story.tone}
            </span>
          )}
          {data.story.structure_type && (
            <span className="text-gray-600">
              <strong>Structure:</strong> {STRUCTURE_LABELS[data.story.structure_type] || data.story.structure_type}
            </span>
          )}
        </div>
        {data.story.themes && data.story.themes.length > 0 && (
          <div className="mt-2">
            <strong className="text-gray-600 text-sm">Themes:</strong>{' '}
            <span className="text-gray-700 text-sm">{data.story.themes.join(', ')}</span>
          </div>
        )}
      </header>

      {/* Story Beats */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
          Story Beats
        </h2>
        {data.beats.length === 0 ? (
          <p className="text-gray-500 italic">No beats defined</p>
        ) : (
          <div className="space-y-4">
            {data.beats.map((beat) => (
              <div key={beat.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    #{beat.sort_order}
                  </span>
                  {beat.act_marker && (
                    <span className="text-sm font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {beat.act_marker}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{beat.title}</h3>
                {beat.content && (
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{beat.content}</p>
                )}
                {beat.notes && (
                  <p className="text-gray-500 text-sm mt-2 italic">Note: {beat.notes}</p>
                )}
                {beat.character_arcs && beat.character_arcs.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-1">Character Arcs:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {beat.character_arcs.map((arc) => (
                        <li key={arc.id}>
                          <strong>{arc.character_name}:</strong> {arc.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Characters */}
      <section className="page-break mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
          Characters
        </h2>
        {data.characters.length === 0 ? (
          <p className="text-gray-500 italic">No characters defined</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {data.characters.map((character) => (
              <div key={character.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{character.name}</h3>
                  {character.role && (
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {ROLE_LABELS[character.role] || character.role}
                    </span>
                  )}
                </div>
                {character.arc_summary && (
                  <p className="text-gray-700 text-sm mb-2">{character.arc_summary}</p>
                )}
                {character.notes && (
                  <p className="text-gray-500 text-sm italic">Note: {character.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500 no-print">
        <p>Press Ctrl+P (Cmd+P on Mac) to print or save as PDF</p>
      </footer>
    </div>
  );
}
