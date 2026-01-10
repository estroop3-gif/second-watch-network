/**
 * MoodboardPrintPage - Printable view for moodboards
 * Optimized for browser print-to-PDF
 */
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMoodboardPrintData } from '@/hooks/backlot';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function MoodboardPrintPage() {
  const { projectId, moodboardId } = useParams<{ projectId: string; moodboardId: string }>();
  const { data, isLoading, error } = useMoodboardPrintData(projectId || null, moodboardId || null);

  // Auto-open print dialog when data loads
  useEffect(() => {
    if (data && !isLoading) {
      // Small delay to ensure images start loading
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
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="aspect-video" />
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load moodboard</h2>
          <p className="text-gray-600">{(error as Error)?.message || 'Moodboard not found'}</p>
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
      `}</style>

      {/* Header */}
      <header className="mb-8 pb-4 border-b-2 border-gray-300">
        <h1 className="text-3xl font-bold text-gray-900">{data.moodboard.title}</h1>
        <div className="flex items-center gap-4 mt-2 text-gray-600">
          <span>{data.project_title}</span>
          <span>|</span>
          <span>Generated {format(new Date(data.generated_at), 'MMM d, yyyy')}</span>
        </div>
        {data.moodboard.description && (
          <p className="mt-2 text-gray-600">{data.moodboard.description}</p>
        )}
      </header>

      {/* Unsorted Items */}
      {data.unsorted_items && data.unsorted_items.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
            Unsorted
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {data.unsorted_items.map((item) => (
              <div key={item.id} className="break-inside-avoid">
                <div className="border border-gray-300 rounded overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.title || 'Reference'}
                    className="w-full aspect-video object-cover bg-gray-100"
                    loading="eager"
                  />
                  <div className="p-2 bg-gray-50">
                    {item.title && (
                      <p className="font-medium text-sm text-gray-900 truncate">{item.title}</p>
                    )}
                    {item.tags && item.tags.length > 0 && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {item.tags.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sections */}
      {data.sections.map((section, sectionIdx) => (
        <section
          key={section.id}
          className={`mb-8 ${sectionIdx > 0 && section.items.length > 8 ? 'page-break' : ''}`}
        >
          <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
            {section.title}
          </h2>
          {section.items.length > 0 ? (
            <div className="grid grid-cols-4 gap-4">
              {section.items.map((item) => (
                <div key={item.id} className="break-inside-avoid">
                  <div className="border border-gray-300 rounded overflow-hidden">
                    <img
                      src={item.image_url}
                      alt={item.title || 'Reference'}
                      className="w-full aspect-video object-cover bg-gray-100"
                      loading="eager"
                    />
                    <div className="p-2 bg-gray-50">
                      {item.title && (
                        <p className="font-medium text-sm text-gray-900 truncate">{item.title}</p>
                      )}
                      {item.tags && item.tags.length > 0 && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {item.tags.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">No items in this section</p>
          )}
        </section>
      ))}

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500 no-print">
        <p>Press Ctrl+P (Cmd+P on Mac) to print or save as PDF</p>
      </footer>
    </div>
  );
}
