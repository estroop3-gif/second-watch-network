/**
 * Storyboard Executive Summary PDF Generation
 *
 * Uses jsPDF to generate a summary report of all storyboards in a project.
 * Includes overview statistics, storyboard list, and per-storyboard details.
 */

import type { Storyboard, StoryboardSection } from '@/hooks/backlot/useStoryboard';

// Format date for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Format duration in human-readable format
function formatDuration(totalSeconds: number): string {
  if (totalSeconds === 0) return '0s';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

// Calculate total panels for a storyboard
function getTotalPanels(storyboard: Storyboard): number {
  if (storyboard.panel_count !== undefined) return storyboard.panel_count;
  if (!storyboard.sections) return 0;
  return storyboard.sections.reduce((sum, s) => sum + (s.panels?.length || 0), 0);
}

// Calculate total sections for a storyboard
function getTotalSections(storyboard: Storyboard): number {
  if (storyboard.section_count !== undefined) return storyboard.section_count;
  return storyboard.sections?.length || 0;
}

// Calculate total duration for a storyboard (in seconds)
function getTotalDuration(storyboard: Storyboard): number {
  if (!storyboard.sections) return 0;
  return storyboard.sections.reduce((sum, section) => {
    return sum + (section.panels || []).reduce((pSum, p) => pSum + (p.duration_seconds || 0), 0);
  }, 0);
}

interface GenerateStoryboardSummaryOptions {
  projectName: string;
  storyboards: Storyboard[];
}

/**
 * Generate and download a PDF executive summary of all storyboards
 */
export async function generateStoryboardSummaryPdf({
  projectName,
  storyboards,
}: GenerateStoryboardSummaryOptions): Promise<void> {
  if (!storyboards || storyboards.length === 0) {
    throw new Error('No storyboards to export');
  }

  // Dynamically import jsPDF and autotable
  let jsPDF, autoTable;
  try {
    const jsPDFModule = await import('jspdf');
    jsPDF = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    autoTable = autoTableModule.default;
  } catch (importError) {
    console.error('[Storyboard Summary PDF] Failed to load PDF libraries:', importError);
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
    console.error('[Storyboard Summary PDF] Failed to create PDF document:', docError);
    throw new Error('Failed to create PDF document');
  }

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  // ============================================
  // HEADER SECTION
  // ============================================

  // "STORYBOARD EXECUTIVE SUMMARY" title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('STORYBOARD EXECUTIVE SUMMARY', margin, y + 8);

  // Project name and date (right aligned)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  const rightColumnX = pageWidth - margin;
  doc.text(projectName, rightColumnX, y, { align: 'right' });
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, rightColumnX, y + 5, { align: 'right' });

  y += 20;

  // Horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============================================
  // OVERVIEW STATISTICS
  // ============================================

  // Calculate totals
  const totalStoryboards = storyboards.length;
  const totalSections = storyboards.reduce((sum, sb) => sum + getTotalSections(sb), 0);
  const totalPanels = storyboards.reduce((sum, sb) => sum + getTotalPanels(sb), 0);
  const totalDuration = storyboards.reduce((sum, sb) => sum + getTotalDuration(sb), 0);
  const draftCount = storyboards.filter(sb => sb.status === 'DRAFT').length;
  const lockedCount = storyboards.filter(sb => sb.status === 'LOCKED').length;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('OVERVIEW', margin, y);
  y += 8;

  // Stats box
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  const colWidth = contentWidth / 4;
  const statsY = y + 10;

  // Stat labels
  doc.text('Storyboards', margin + 10, statsY);
  doc.text('Sections', margin + colWidth + 10, statsY);
  doc.text('Panels', margin + (colWidth * 2) + 10, statsY);
  doc.text('Duration', margin + (colWidth * 3) + 10, statsY);

  // Stat values
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(String(totalStoryboards), margin + 10, statsY + 12);
  doc.text(String(totalSections), margin + colWidth + 10, statsY + 12);
  doc.text(String(totalPanels), margin + (colWidth * 2) + 10, statsY + 12);
  doc.text(formatDuration(totalDuration) || 'N/A', margin + (colWidth * 3) + 10, statsY + 12);

  y += 38;

  // Status breakdown
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Status: ${draftCount} Draft, ${lockedCount} Locked`, margin, y);
  y += 12;

  // ============================================
  // STORYBOARDS TABLE
  // ============================================

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('STORYBOARDS', margin, y);
  y += 6;

  const tableData = storyboards.map((sb, index) => [
    String(index + 1),
    sb.title,
    sb.aspect_ratio || '-',
    String(getTotalSections(sb)),
    String(getTotalPanels(sb)),
    formatDuration(getTotalDuration(sb)) || '-',
    sb.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Title', 'Aspect', 'Sections', 'Panels', 'Duration', 'Status']],
    body: tableData,
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
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 20 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 20, halign: 'center' },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // ============================================
  // STORYBOARD DETAILS (One per storyboard)
  // ============================================

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);

  // Check if we need a new page
  if (y > pageHeight - 60) {
    doc.addPage();
    y = margin;
  }

  doc.text('STORYBOARD DETAILS', margin, y);
  y += 10;

  storyboards.forEach((storyboard, sbIndex) => {
    // Check if we need a new page
    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }

    // Storyboard header
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(`${sbIndex + 1}. ${storyboard.title}`, margin, y);
    y += 5;

    // Storyboard metadata
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);

    const metaItems: string[] = [];
    metaItems.push(`Aspect: ${storyboard.aspect_ratio || 'N/A'}`);
    metaItems.push(`Status: ${storyboard.status}`);
    if (storyboard.episode) {
      metaItems.push(`Episode: ${storyboard.episode.episode_code || storyboard.episode.title}`);
    }
    if (storyboard.scene) {
      metaItems.push(`Scene: ${storyboard.scene.scene_number}`);
    }
    doc.text(metaItems.join('  |  '), margin + 5, y);
    y += 5;

    // Description (if present)
    if (storyboard.description) {
      doc.setTextColor(60, 60, 60);
      const descLines = doc.splitTextToSize(storyboard.description, contentWidth - 10);
      doc.text(descLines, margin + 5, y);
      y += descLines.length * 4;
    }

    // Sections list (if available)
    const sections = storyboard.sections || [];
    if (sections.length > 0) {
      y += 3;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(70, 70, 70);
      doc.text('Sections:', margin + 5, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);

      sections.forEach((section, secIndex) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = margin;
        }

        const panelCount = section.panels?.length || 0;
        const sectionDuration = (section.panels || []).reduce(
          (sum, p) => sum + (p.duration_seconds || 0),
          0
        );

        let sectionText = `• ${section.title} (${panelCount} panel${panelCount !== 1 ? 's' : ''}`;
        if (sectionDuration > 0) {
          sectionText += `, ${formatDuration(sectionDuration)}`;
        }
        sectionText += ')';

        doc.text(sectionText, margin + 10, y);
        y += 4;
      });
    }

    y += 8;

    // Separator between storyboards
    if (sbIndex < storyboards.length - 1) {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, y - 2, margin + contentWidth / 2, y - 2);
      y += 4;
    }
  });

  // ============================================
  // FOOTER
  // ============================================

  // Footer with generation date
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated by Second Watch Network`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // ============================================
  // SAVE PDF
  // ============================================

  try {
    const sanitizedProject = projectName.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 30);
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `Storyboard-Summary-${sanitizedProject}-${dateStr}.pdf`;
    doc.save(filename);
  } catch (saveError) {
    console.error('[Storyboard Summary PDF] Failed to save PDF:', saveError);
    throw new Error('Failed to save PDF file');
  }
}

export default generateStoryboardSummaryPdf;
