/**
 * StripboardPrintPage - Printable view for stripboard
 * Optimized for browser print-to-PDF
 */
import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useStripboardPrintData } from '@/hooks/backlot';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function StripboardPrintPage() {
  const { projectId, stripboardId } = useParams<{ projectId: string; stripboardId: string }>();
  const [searchParams] = useSearchParams();
  const start = searchParams.get('start') || undefined;
  const end = searchParams.get('end') || undefined;

  const { data, isLoading, error } = useStripboardPrintData(
    projectId || null,
    stripboardId || null,
    start,
    end
  );

  // Auto-open print dialog when data loads
  useEffect(() => {
    if (data && !isLoading) {
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load stripboard</h2>
          <p className="text-gray-600">{(error as Error)?.message || 'Stripboard not found'}</p>
        </div>
      </div>
    );
  }

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'SHOT':
        return 'Shot';
      case 'SCHEDULED':
        return 'Scheduled';
      case 'DROPPED':
        return 'Dropped';
      default:
        return 'Planned';
    }
  };

  const getStatusStyle = (status: string): string => {
    switch (status) {
      case 'SHOT':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'DROPPED':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-white text-black print:bg-white print:text-black">
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: letter landscape;
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
          .strip-card {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Header */}
      <header className="mb-6 pb-4 border-b-2 border-gray-900">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.stripboard.title}</h1>
            <p className="text-sm text-gray-600">{data.project_title}</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            {start && end && (
              <p className="font-semibold">
                {format(new Date(start), 'MMM d')} - {format(new Date(end), 'MMM d, yyyy')}
              </p>
            )}
            <p className="text-xs mt-1">
              Generated: {format(new Date(data.generated_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>
      </header>

      {/* Bank Section */}
      {data.bank_strips.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-300">
            BANK (Unscheduled) - {data.bank_strips.length} strips
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {data.bank_strips.map((strip) => {
              const title = strip.scene_number
                ? `${strip.scene_number}. ${strip.slugline || ''}`
                : strip.custom_title || 'Untitled';
              return (
                <div
                  key={strip.id}
                  className={`strip-card p-2 rounded border text-sm ${getStatusStyle(strip.status)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium truncate">{title}</span>
                    <span className="text-xs font-semibold flex-shrink-0">{strip.unit}</span>
                  </div>
                  {strip.estimated_duration_minutes && (
                    <p className="text-xs mt-1">{strip.estimated_duration_minutes} min</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Day Sections */}
      {data.day_columns.map((dayCol, idx) => {
        const { day, strips, cast_mismatch, derived_cast, dood_work_cast } = dayCol;
        const dateStr = format(new Date(day.date), 'EEEE, MMMM d, yyyy');

        return (
          <section key={day.id} className={`mb-8 ${idx > 0 ? 'page-break' : ''}`}>
            <div className="flex items-center justify-between pb-2 border-b-2 border-gray-900 mb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {dateStr}
                  {day.day_number > 0 && (
                    <span className="text-gray-600 font-normal ml-2">Day {day.day_number}</span>
                  )}
                </h2>
                <p className="text-sm text-gray-600">{day.day_type}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold">{strips.length} strips</span>
                {cast_mismatch.has_mismatch && (
                  <span className="flex items-center gap-1 text-amber-600 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Cast Mismatch
                  </span>
                )}
              </div>
            </div>

            {/* Cast Mismatch Warning */}
            {cast_mismatch.has_mismatch && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-sm">
                <p className="font-semibold text-amber-800 mb-2">Cast Mismatch Warning</p>
                {cast_mismatch.needed_but_not_working.length > 0 && (
                  <p className="text-amber-700">
                    <strong>Needed but not working:</strong>{' '}
                    {cast_mismatch.needed_but_not_working.join(', ')}
                  </p>
                )}
                {cast_mismatch.working_but_not_needed.length > 0 && (
                  <p className="text-amber-700">
                    <strong>Working but not in scenes:</strong>{' '}
                    {cast_mismatch.working_but_not_needed.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Strips Grid */}
            {strips.length === 0 ? (
              <p className="text-gray-500 text-sm italic">No strips scheduled</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left w-8">#</th>
                    <th className="border border-gray-300 px-2 py-1 text-left">Scene</th>
                    <th className="border border-gray-300 px-2 py-1 text-left w-12">Unit</th>
                    <th className="border border-gray-300 px-2 py-1 text-left w-20">Status</th>
                    <th className="border border-gray-300 px-2 py-1 text-left w-16">Duration</th>
                    <th className="border border-gray-300 px-2 py-1 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {strips.map((strip, stripIdx) => {
                    const title = strip.scene_number
                      ? `${strip.scene_number}. ${strip.slugline || ''}`
                      : strip.custom_title || 'Untitled';
                    return (
                      <tr key={strip.id} className="strip-card">
                        <td className="border border-gray-300 px-2 py-1 text-gray-600">
                          {stripIdx + 1}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 font-medium">{title}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center font-semibold">
                          {strip.unit}
                        </td>
                        <td className="border border-gray-300 px-2 py-1">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${getStatusStyle(
                              strip.status
                            )}`}
                          >
                            {getStatusLabel(strip.status)}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-gray-600">
                          {strip.estimated_duration_minutes
                            ? `${strip.estimated_duration_minutes}m`
                            : '-'}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-gray-600 text-xs">
                          {strip.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Cast Summary */}
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-gray-700 mb-1">
                  Characters in Scenes ({derived_cast.length})
                </p>
                <p className="text-gray-600">
                  {derived_cast.length > 0 ? derived_cast.join(', ') : 'None'}
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-1">
                  DOOD Working Cast ({dood_work_cast.length})
                </p>
                <p className="text-gray-600">
                  {dood_work_cast.length > 0 ? dood_work_cast.join(', ') : 'None'}
                </p>
              </div>
            </div>
          </section>
        );
      })}

      {/* Empty State */}
      {data.day_columns.length === 0 && data.bank_strips.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No strips in this stripboard</p>
          <p className="text-sm mt-1">Generate strips from script or add custom strips</p>
        </div>
      )}

      {/* Footer - no-print */}
      <footer className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500 no-print">
        <p>Press Ctrl+P (Cmd+P on Mac) to print or save as PDF</p>
      </footer>
    </div>
  );
}
