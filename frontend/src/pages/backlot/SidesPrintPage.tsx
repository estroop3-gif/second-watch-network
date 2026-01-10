/**
 * SidesPrintPage - Printable view for sides packets
 * Optimized for browser print-to-PDF with monospaced script formatting
 */
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSidesPrintData } from '@/hooks/backlot';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function SidesPrintPage() {
  const { projectId, packetId } = useParams<{ projectId: string; packetId: string }>();
  const { data, isLoading, error } = useSidesPrintData(projectId || null, packetId || null);

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
            <Skeleton key={i} className="h-48" />
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load sides packet</h2>
          <p className="text-gray-600">{(error as Error)?.message || 'Packet not found'}</p>
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
            size: letter portrait;
            margin: 0.5in 1in;
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
          .scene-block {
            page-break-inside: avoid;
          }
        }

        /* Script formatting - industry standard */
        .script-text {
          font-family: "Courier New", Courier, monospace;
          font-size: 12pt;
          line-height: 1;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .scene-heading {
          font-weight: bold;
          margin-bottom: 1em;
        }

        .action {
          margin-bottom: 1em;
        }

        .character-name {
          margin-left: 2.5in;
          margin-bottom: 0;
        }

        .dialogue {
          margin-left: 1.5in;
          margin-right: 1.5in;
          margin-bottom: 1em;
        }

        .parenthetical {
          margin-left: 2in;
          margin-right: 2in;
        }
      `}</style>

      {/* Header - repeated on each page via print CSS */}
      <header className="mb-6 pb-4 border-b-2 border-gray-900">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.packet.title}</h1>
            <p className="text-sm text-gray-600">{data.project_title}</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            {data.production_day && (
              <>
                <p className="font-semibold">{format(new Date(data.production_day.shoot_date), 'EEEE, MMMM d, yyyy')}</p>
                <p>{data.production_day.day_type}</p>
              </>
            )}
            <p className="text-xs mt-1">Generated: {format(new Date(data.generated_at), 'MMM d, yyyy h:mm a')}</p>
          </div>
        </div>
      </header>

      {/* Cast List */}
      {(data.cast_working.length > 0 || data.characters_from_scenes.length > 0) && (
        <section className="mb-6 pb-4 border-b border-gray-300">
          <h2 className="text-lg font-bold text-gray-900 mb-2">CAST</h2>
          <div className="grid grid-cols-2 gap-4">
            {data.cast_working.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Working Today (DOOD)</p>
                <ul className="text-sm">
                  {data.cast_working.map((name, idx) => (
                    <li key={idx}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.characters_from_scenes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Characters in Scenes</p>
                <ul className="text-sm">
                  {data.characters_from_scenes.map((name, idx) => (
                    <li key={idx}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Scenes */}
      {data.scenes.map((scene, idx) => (
        <section
          key={scene.script_scene.id}
          className={`scene-block mb-8 ${idx > 0 ? 'page-break' : ''}`}
        >
          {/* Scene Header */}
          <div className="mb-4 pb-2 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                Scene {scene.script_scene.scene_number}
              </h3>
              {scene.script_scene.page_start && (
                <span className="text-sm text-gray-600">
                  Page {scene.script_scene.page_start}
                  {scene.script_scene.page_end && scene.script_scene.page_end !== scene.script_scene.page_start && ` - ${scene.script_scene.page_end}`}
                </span>
              )}
            </div>
          </div>

          {/* Scene Notes (if any) */}
          {scene.scene_notes && (
            <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
              <strong>Note:</strong> {scene.scene_notes}
            </div>
          )}

          {/* Script Text */}
          <div className="script-text">
            {scene.script_scene.raw_scene_text}
          </div>
        </section>
      ))}

      {/* Packet Notes */}
      {data.packet.notes && (
        <section className="mt-8 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-2">PACKET NOTES</h3>
          <p className="text-sm text-gray-600">{data.packet.notes}</p>
        </section>
      )}

      {/* Footer - no-print */}
      <footer className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500 no-print">
        <p>Press Ctrl+P (Cmd+P on Mac) to print or save as PDF</p>
      </footer>
    </div>
  );
}
