/**
 * Camera Log PDF Generation
 *
 * Uses jsPDF to generate professional camera reports.
 * Includes camera logs, media cards, and continuity notes.
 */

import type { CameraLogItem } from '@/hooks/backlot/useCameraLog';
import type { CameraMediaItem, ContinuityNoteItem } from '@/hooks/backlot';

// Status labels for media cards
const MEDIA_STATUS_LABELS: Record<string, string> = {
  in_camera: 'In Camera',
  with_DIT: 'With DIT',
  backed_up: 'Backed Up',
  ready_to_format: 'Ready to Format',
  archived: 'Archived',
  failed: 'Failed',
};

// Department labels for continuity notes
const DEPARTMENT_LABELS: Record<string, string> = {
  general: 'General',
  script: 'Script',
  wardrobe: 'Wardrobe',
  makeup: 'Makeup',
  hair: 'Hair',
  props: 'Props',
  art: 'Art',
};

// Format date for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Format time for display
function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

interface ProductionDay {
  day_number: number;
  shoot_date: string;
}

/**
 * Generate and download a PDF camera report
 */
export async function generateCameraLogPdf(
  logs: CameraLogItem[],
  mediaCards: CameraMediaItem[],
  notes: ContinuityNoteItem[],
  productionDay: ProductionDay | null
): Promise<void> {
  // Dynamically import jsPDF and autotable
  let jsPDF, autoTable;
  try {
    const jsPDFModule = await import('jspdf');
    jsPDF = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    autoTable = autoTableModule.default;
  } catch (importError) {
    console.error('[Camera PDF] Failed to load PDF libraries:', importError);
    throw new Error('PDF library failed to load. Please refresh and try again.');
  }

  let doc;
  try {
    doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });
  } catch (docError) {
    console.error('[Camera PDF] Failed to create PDF document:', docError);
    throw new Error('Failed to create PDF document');
  }

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  // ============================================
  // HEADER SECTION
  // ============================================

  // "CAMERA REPORT" title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('CAMERA REPORT', margin, y + 8);

  // Date info (right aligned)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  const rightColumnX = pageWidth - margin;

  if (productionDay) {
    doc.text(`Day ${productionDay.day_number}`, rightColumnX, y, { align: 'right' });
    doc.text(formatDate(productionDay.shoot_date), rightColumnX, y + 5, { align: 'right' });
  } else {
    doc.text(formatDate(new Date().toISOString()), rightColumnX, y, { align: 'right' });
  }

  y += 18;

  // Horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ============================================
  // CAMERA LOGS SECTION
  // ============================================

  if (logs && logs.length > 0) {
    // Section header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`CAMERA LOGS (${logs.length})`, margin, y);
    y += 6;

    // Sort logs by scene, then shot, then take
    const sortedLogs = [...logs].sort((a, b) => {
      const sceneCompare = (a.scene_number || '').localeCompare(b.scene_number || '');
      if (sceneCompare !== 0) return sceneCompare;
      const shotCompare = (a.shot_type || '').localeCompare(b.shot_type || '');
      if (shotCompare !== 0) return shotCompare;
      return (a.take_number || 0) - (b.take_number || 0);
    });

    const tableData = sortedLogs.map(log => [
      log.camera_id || '-',
      log.scene_number || '-',
      log.shot_type || '-',
      `T${log.take_number || 1}`,
      log.lens || '-',
      log.iris || '-',
      log.filter || '-',
      log.focus_distance || '-',
      log.notes || '',
      log.is_circle_take ? '*' : '',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Cam', 'Scene', 'Shot', 'Take', 'Lens', 'Iris', 'Filter', 'Focus', 'Notes', 'Circle']],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [40, 40, 40],
      },
      headStyles: {
        fillColor: [50, 50, 50],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      columnStyles: {
        0: { cellWidth: 12 },  // Cam
        1: { cellWidth: 18 },  // Scene
        2: { cellWidth: 14 },  // Shot
        3: { cellWidth: 12 },  // Take
        4: { cellWidth: 16 },  // Lens
        5: { cellWidth: 12 },  // Iris
        6: { cellWidth: 14 },  // Filter
        7: { cellWidth: 14 },  // Focus
        8: { cellWidth: 'auto' }, // Notes
        9: { cellWidth: 12, halign: 'center' },  // Circle
      },
      margin: { left: margin, right: margin },
    });

    // Get the Y position after the table
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============================================
  // MEDIA CARDS SECTION
  // ============================================

  if (mediaCards && mediaCards.length > 0) {
    // Check if we need a new page
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    // Section header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`MEDIA CARDS (${mediaCards.length})`, margin, y);
    y += 6;

    const mediaTableData = mediaCards.map(card => [
      card.media_label || '-',
      card.camera || '-',
      card.capacity_gb ? `${card.capacity_gb} GB` : '-',
      MEDIA_STATUS_LABELS[card.status] || card.status || '-',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Card Label', 'Camera', 'Capacity', 'Status']],
      body: mediaTableData,
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [40, 40, 40],
      },
      headStyles: {
        fillColor: [50, 50, 50],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 25 },
        2: { cellWidth: 30 },
        3: { cellWidth: 'auto' },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============================================
  // CONTINUITY NOTES SECTION
  // ============================================

  if (notes && notes.length > 0) {
    // Check if we need a new page
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    // Section header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`CONTINUITY NOTES (${notes.length})`, margin, y);
    y += 8;

    // Render each note as a block
    notes.forEach((note, index) => {
      // Check if we need a new page
      if (y > pageHeight - 40) {
        doc.addPage();
        y = margin;
      }

      // Note header
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      const deptLabel = DEPARTMENT_LABELS[note.department] || note.department || 'General';
      doc.text(`Scene ${note.scene_number || 'N/A'} - ${deptLabel}`, margin, y);
      y += 4;

      // Note text
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      const noteLines = doc.splitTextToSize(note.note || '', contentWidth);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 4;

      // Timestamp
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(formatTime(note.created_at), margin, y);
      y += 6;

      // Separator between notes (except for last)
      if (index < notes.length - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(margin, y, margin + contentWidth / 2, y);
        y += 4;
      }
    });
  }

  // ============================================
  // FOOTER
  // ============================================

  // Footer with generation date
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated on ${new Date().toLocaleDateString()}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // ============================================
  // SAVE PDF
  // ============================================

  try {
    let filename = 'Camera-Report';
    if (productionDay) {
      filename += `-Day-${productionDay.day_number}`;
      const dateStr = productionDay.shoot_date.replace(/-/g, '');
      filename += `-${dateStr}`;
    } else {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      filename += `-${today}`;
    }
    filename += '.pdf';

    doc.save(filename);
  } catch (saveError) {
    console.error('[Camera PDF] Failed to save PDF:', saveError);
    throw new Error('Failed to save PDF file');
  }
}

export default generateCameraLogPdf;
