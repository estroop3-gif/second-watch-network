/**
 * Hot Set Day Report PDF Generation
 *
 * Uses jsPDF to generate professional production day reports.
 * Shows projected vs actual schedule, scene completion, timing data.
 */

import type { HotSetSession, ProjectedScheduleItem } from '@/types/backlot';
import type { WrapReportData } from '@/hooks/backlot';

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format time from ISO string or HH:MM format
// @param timezone - Optional IANA timezone string (e.g., 'America/Los_Angeles')
function formatTime(time: string | null | undefined, timezone?: string | null): string {
  if (!time) return '--:--';

  // Handle ISO timestamp
  if (time.includes('T') || time.includes('Z')) {
    try {
      const date = new Date(time);
      const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
      if (timezone) {
        options.timeZone = timezone;
      }
      return date.toLocaleTimeString('en-US', options);
    } catch {
      return time;
    }
  }

  // Handle HH:MM format (schedule times are already in local time)
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch {
    return time;
  }
}

// Format elapsed time in hours and minutes
function formatElapsedTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Format date for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Get type label for schedule items
function getTypeLabel(type: string): string {
  switch (type) {
    case 'scene': return 'Scene';
    case 'meal': return 'Meal';
    case 'company_move': return 'Move';
    case 'crew_call': return 'Crew Call';
    case 'first_shot': return 'First Shot';
    case 'wrap': return 'Wrap';
    case 'activity': return 'Activity';
    default: return type.replace(/_/g, ' ');
  }
}

// Format variance string
function formatVariance(minutes: number): string {
  if (minutes === 0) return 'On Schedule';
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  let timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  return minutes > 0 ? `${timeStr} Under` : `${timeStr} Over`;
}

interface HotSetDayReportPdfOptions {
  session: HotSetSession;
  wrapReport: WrapReportData | null;
  projectedSchedule: ProjectedScheduleItem[];
  projectName?: string;
}

/**
 * Generate and download a PDF day report
 */
export async function generateHotSetDayReportPdf(options: HotSetDayReportPdfOptions): Promise<void> {
  const { session, wrapReport, projectedSchedule, projectName } = options;

  // Validate required data
  if (!session) {
    throw new Error('Session data is required');
  }

  // Dynamically import jsPDF and autotable
  let jsPDF, autoTable;
  try {
    const jsPDFModule = await import('jspdf');
    jsPDF = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    autoTable = autoTableModule.default;
  } catch (importError) {
    console.error('[Day Report PDF] Failed to load PDF libraries:', importError);
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
    console.error('[Day Report PDF] Failed to create PDF document:', docError);
    throw new Error('Failed to create PDF document');
  }

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  // Calculate stats
  const completedItems = projectedSchedule.filter(i => i.status === 'completed');
  const skippedItems = projectedSchedule.filter(i => i.status === 'skipped');
  const scenes = projectedSchedule.filter(i => i.type === 'scene');
  const completedScenes = scenes.filter(i => i.status === 'completed');
  const skippedScenes = scenes.filter(i => i.status === 'skipped');

  // Calculate total variance
  const totalVariance = completedItems.reduce((sum, item) => {
    if (item.actual_duration_minutes && item.planned_duration_minutes) {
      return sum + (item.planned_duration_minutes - item.actual_duration_minutes);
    }
    return sum;
  }, 0);

  // ============================================
  // HEADER
  // ============================================

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('PRODUCTION DAY REPORT', margin, y + 8);

  // Day number (right side)
  // Day number can be in production_day (from join) or backlot_production_days
  const dayNumber = (session as any).production_day?.day_number
    || (session as any).backlot_production_days?.day_number
    || '?';
  doc.setFontSize(32);
  doc.setTextColor(255, 60, 60); // Primary red
  doc.text(`Day ${dayNumber}`, pageWidth - margin, y + 8, { align: 'right' });

  y += 18;

  // Subtitle line
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);

  const subtitleParts = [];
  if (projectName) subtitleParts.push(projectName);
  const productionDate = (session as any).production_day?.date
    || (session as any).backlot_production_days?.date
    || (session as any).production_day_date;
  if (productionDate) subtitleParts.push(formatDate(productionDate));
  doc.text(subtitleParts.join('  |  '), margin, y);

  y += 8;

  // Horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============================================
  // DAY SUMMARY GRID
  // ============================================

  const colWidth = contentWidth / 4;

  // Row 1: Call Time, Wrap Time, Total Hours, Variance
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('CREW CALL', margin, y);
  doc.text('WRAP TIME', margin + colWidth, y);
  doc.text('TOTAL HOURS', margin + colWidth * 2, y);
  doc.text('VARIANCE', margin + colWidth * 3, y);

  y += 5;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(formatTime(session.actual_start_time, session.timezone) || wrapReport?.call_time || '--:--', margin, y);
  doc.text(formatTime(session.actual_wrap_time, session.timezone) || wrapReport?.wrap_time || '--:--', margin + colWidth, y);
  doc.text(wrapReport?.total_shooting_minutes ? formatElapsedTime(wrapReport.total_shooting_minutes) : '--', margin + colWidth * 2, y);

  // Variance with color
  if (totalVariance > 0) {
    doc.setTextColor(34, 197, 94); // Green
  } else if (totalVariance < 0) {
    doc.setTextColor(239, 68, 68); // Red
  }
  doc.text(formatVariance(totalVariance), margin + colWidth * 3, y);
  doc.setTextColor(40, 40, 40);

  y += 12;

  // Row 2: Scene stats
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('SCENES COMPLETED', margin, y);
  doc.text('SCENES SKIPPED', margin + colWidth, y);
  doc.text('TOTAL SCENES', margin + colWidth * 2, y);
  doc.text('DAY TYPE', margin + colWidth * 3, y);

  y += 5;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94); // Green for completed
  doc.text(String(completedScenes.length), margin, y);

  doc.setTextColor(239, 68, 68); // Red for skipped
  doc.text(String(skippedScenes.length), margin + colWidth, y);

  doc.setTextColor(40, 40, 40);
  doc.text(String(scenes.length), margin + colWidth * 2, y);
  doc.text(session.day_type || '10hr', margin + colWidth * 3, y);

  y += 12;

  // Horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ============================================
  // SCHEDULE COMPARISON TABLE
  // ============================================

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Schedule Comparison (Planned vs Actual)', margin, y);
  y += 6;

  if (projectedSchedule.length > 0) {
    const tableData = projectedSchedule.map((item) => {
      const variance = item.actual_duration_minutes && item.planned_duration_minutes
        ? item.planned_duration_minutes - item.actual_duration_minutes
        : 0;

      const varianceStr = item.status === 'completed' && variance !== 0
        ? (variance > 0 ? `+${variance}m` : `${variance}m`)
        : item.status === 'completed' ? 'On Time' : '--';

      return [
        getTypeLabel(item.type),
        item.name,
        formatTime(item.planned_start_time, session.timezone),
        item.actual_start_time ? formatTime(item.actual_start_time, session.timezone) : '--',
        `${item.planned_duration_minutes || 0}m`,
        item.actual_duration_minutes ? `${item.actual_duration_minutes}m` : '--',
        varianceStr,
        item.status === 'completed' ? 'Done' : item.status === 'skipped' ? 'Skip' : item.status,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Type', 'Item', 'Plan Start', 'Actual', 'Plan Dur', 'Actual', 'Var', 'Status']],
      body: tableData,
      styles: {
        fontSize: 7,
        cellPadding: 2,
        textColor: [40, 40, 40],
      },
      headStyles: {
        fillColor: [50, 50, 50],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 45 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 15, halign: 'center' },
      },
      margin: { left: margin, right: margin },
      didParseCell: function(data: any) {
        // Color variance column
        if (data.column.index === 6 && data.section === 'body') {
          const val = data.cell.raw as string;
          if (val.startsWith('+')) {
            data.cell.styles.textColor = [34, 197, 94]; // Green
          } else if (val.startsWith('-')) {
            data.cell.styles.textColor = [239, 68, 68]; // Red
          }
        }
        // Color status column
        if (data.column.index === 7 && data.section === 'body') {
          const val = data.cell.raw as string;
          if (val === 'Done') {
            data.cell.styles.textColor = [34, 197, 94];
          } else if (val === 'Skip') {
            data.cell.styles.textColor = [239, 68, 68];
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('No schedule data available', margin, y + 5);
    y += 15;
  }

  // ============================================
  // COMPLETED SCENES
  // ============================================

  if (wrapReport && wrapReport.scenes_completed.length > 0) {
    // Check if we need a new page
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text(`Completed Scenes (${wrapReport.scenes_completed.length})`, margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);

    const scenesText = wrapReport.scenes_completed
      .map(s => `${s.scene_number} (${s.actual_minutes}m)`)
      .join('   ');
    const sceneLines = doc.splitTextToSize(scenesText, contentWidth);

    // Check if the scenes text will overflow
    const textHeight = sceneLines.length * 4;
    if (y + textHeight > pageHeight - 20) {
      doc.addPage();
      y = margin;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text(`Completed Scenes (continued)`, margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
    }

    doc.text(sceneLines, margin, y);
    y += textHeight + 6;
  }

  // ============================================
  // SKIPPED SCENES
  // ============================================

  if (wrapReport && wrapReport.scenes_skipped.length > 0) {
    // Check if we need a new page
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text(`Skipped Scenes (${wrapReport.scenes_skipped.length})`, margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);

    const scenesText = wrapReport.scenes_skipped
      .map(s => s.scene_number)
      .join('   ');
    const sceneLines = doc.splitTextToSize(scenesText, contentWidth);

    // Check if the scenes text will overflow
    const textHeight = sceneLines.length * 4;
    if (y + textHeight > pageHeight - 20) {
      doc.addPage();
      y = margin;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(239, 68, 68);
      doc.text(`Skipped Scenes (continued)`, margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
    }

    doc.text(sceneLines, margin, y);
    y += textHeight + 6;
  }

  // ============================================
  // TIME MARKERS
  // ============================================

  if (wrapReport && wrapReport.markers.length > 0) {
    // Check if we need a new page for the header
    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246); // Blue
    doc.text('Time Markers', margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);

    wrapReport.markers.forEach(marker => {
      // Check if we need a new page before each marker
      if (y > pageHeight - 20) {
        doc.addPage();
        y = margin;
        // Re-add section header on new page
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('Time Markers (continued)', margin, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
      }
      doc.text(`${marker.time}  -  ${marker.label} (${marker.type.replace(/_/g, ' ')})`, margin, y);
      y += 5;
    });
    y += 3;
  }

  // ============================================
  // AD NOTES
  // ============================================

  if (wrapReport?.ad_notes) {
    // Check if we need a new page
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('AD Notes', margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);

    const notesLines = doc.splitTextToSize(wrapReport.ad_notes, contentWidth);

    // Handle notes that might span multiple pages
    for (let i = 0; i < notesLines.length; i++) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = margin;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('AD Notes (continued)', margin, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
      }
      doc.text(notesLines[i], margin, y);
      y += 4;
    }
  }

  // ============================================
  // FOOTER ON ALL PAGES
  // ============================================

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated from Second Watch Network  |  ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    // Page numbers
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  // ============================================
  // SAVE PDF
  // ============================================

  try {
    const dayNum = (session as any).production_day?.day_number
      || (session as any).backlot_production_days?.day_number
      || 'Unknown';
    const prodDate = (session as any).production_day?.date
      || (session as any).backlot_production_days?.date
      || (session as any).production_day_date;
    const dateStr = prodDate
      ? new Date(prodDate + 'T00:00:00').toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const filename = `Day-${dayNum}-Report-${dateStr}.pdf`;
    doc.save(filename);
  } catch (saveError) {
    console.error('[Day Report PDF] Failed to save PDF:', saveError);
    throw new Error('Failed to save PDF file');
  }
}

export default generateHotSetDayReportPdf;
