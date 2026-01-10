/**
 * ScriptTitlePage - Renders a formatted screenplay title page from structured data
 *
 * Industry-standard formatting based on Final Draft output:
 * - 12pt Courier New font throughout
 * - 1 inch margins on all sides
 * - Title centered, approximately 40% down the page
 * - "Written by" centered below title with spacing
 * - Author name(s) centered below "Written by"
 * - "Based on" credit below author if present
 * - Contact info in lower left corner
 * - Draft info in lower right corner (optional)
 */
import React from 'react';
import { TitlePageData } from '@/types/backlot';
import { cn } from '@/lib/utils';

interface ScriptTitlePageProps {
  data: TitlePageData | null;
  className?: string;
  style?: React.CSSProperties;
  onEdit?: () => void;
  isEditable?: boolean;
  /** Zoom level (0-200), defaults to 100. Scales fonts appropriately. */
  zoom?: number;
}

export const ScriptTitlePage: React.FC<ScriptTitlePageProps> = ({
  data,
  className,
  style,
  onEdit,
  isEditable = false,
  zoom = 100,
}) => {
  // Scale font sizes based on zoom level
  const baseFontSize = (12 * zoom) / 100; // 12pt at 100% zoom
  const marginSize = (72 * zoom) / 100; // 1 inch = 72px at 72dpi
  if (!data) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-full text-muted-gray',
          className
        )}
      >
        <div className="text-center">
          <p className="text-lg mb-2">No title page data</p>
          {isEditable && onEdit && (
            <button
              onClick={onEdit}
              className="text-accent-yellow hover:text-accent-yellow/80 underline"
            >
              Add title page
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative w-full h-full bg-white text-black',
        'flex flex-col',
        className
      )}
      style={{
        fontFamily: 'Courier New, Courier, monospace',
        padding: `${marginSize}px`,
        fontSize: `${baseFontSize}px`,
        lineHeight: '1.5',
        ...style,
      }}
    >
      {/* Edit button overlay */}
      {isEditable && onEdit && (
        <button
          onClick={onEdit}
          className="absolute top-4 right-4 px-3 py-1.5 bg-charcoal-black/90 text-bone-white text-sm rounded hover:bg-charcoal-black transition-colors z-10"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          Edit
        </button>
      )}

      {/* Top spacer - pushes title to vertical center */}
      <div style={{ flex: '1' }} />

      {/* Title block - centered horizontally and vertically */}
      <div className="text-center">
        {/* Title - ALL CAPS, centered */}
        {data.title && (
          <p style={{
            marginBottom: `${baseFontSize * 3}px`,
            textTransform: 'uppercase',
          }}>
            {data.title}
          </p>
        )}

        {/* Written by line */}
        {data.written_by && data.written_by.length > 0 && (
          <div>
            <p>Written by</p>
            <p style={{ marginTop: `${baseFontSize * 1.5}px` }}>
              {data.written_by.join(' & ')}
            </p>
          </div>
        )}

        {/* Based on credit */}
        {data.based_on && (
          <p style={{ marginTop: `${baseFontSize * 2}px` }}>{data.based_on}</p>
        )}
      </div>

      {/* Bottom spacer - pushes contact info to bottom */}
      <div style={{ flex: '1' }} />

      {/* Bottom section - contact info at bottom left only */}
      <div className="text-left" style={{ lineHeight: '1.2', fontSize: `${baseFontSize}px` }}>
        {data.contact?.name && <p>{data.contact.name}</p>}
        {data.contact?.company && <p>{data.contact.company}</p>}
        {data.contact?.address && (
          <div>
            {data.contact.address.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
        {data.contact?.phone && <p>{data.contact.phone}</p>}
        {data.contact?.email && <p>{data.contact.email}</p>}
        {/* Draft info below contact */}
        {data.draft_info?.revision && <p style={{ marginTop: `${baseFontSize}px` }}>{data.draft_info.revision}</p>}
        {data.draft_info?.date && <p>{data.draft_info.date}</p>}
        {data.copyright && <p>{data.copyright}</p>}
      </div>

      {/* Additional lines if any - at very bottom */}
      {data.additional_lines && data.additional_lines.length > 0 && (
        <div className="text-left" style={{ marginTop: `${baseFontSize}px`, lineHeight: '1.2' }}>
          {data.additional_lines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScriptTitlePage;
