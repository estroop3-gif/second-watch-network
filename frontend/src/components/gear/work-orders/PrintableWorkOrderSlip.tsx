/**
 * Printable Work Order Slip
 * PDF generation for gear work orders
 */

import type { GearWorkOrder, GearWorkOrderItem } from '@/types/gear';

// Status display labels
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  ready: 'Ready',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
};

// Format date for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format datetime for display
function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Check if a value has content
function hasValue(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !isNaN(value);
  return true;
}

/**
 * Generate and download a PDF work order slip
 */
export async function generateWorkOrderSlipPdf(workOrder: GearWorkOrder): Promise<void> {
  // Validate required data
  if (!workOrder) {
    throw new Error('Work order data is required');
  }

  // Dynamically import jsPDF and autotable
  let jsPDF, autoTable;
  try {
    const jsPDFModule = await import('jspdf');
    jsPDF = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    autoTable = autoTableModule.default;
  } catch (importError) {
    console.error('[Work Order Slip PDF] Failed to load PDF libraries:', importError);
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
    console.error('[Work Order Slip PDF] Failed to create PDF document:', docError);
    throw new Error('Failed to create PDF document');
  }

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ============================================
  // HEADER SECTION
  // ============================================

  // "WORK ORDER" title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('WORK ORDER', margin, y + 8);

  // Reference number (right aligned, prominent)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  const rightColumnX = pageWidth - margin;
  const refNumber = workOrder.reference_number || workOrder.id.slice(0, 8).toUpperCase();
  doc.text(`Ref #: ${refNumber}`, rightColumnX, y, { align: 'right' });
  doc.text(`Created: ${formatDateTime(workOrder.created_at)}`, rightColumnX, y + 5, { align: 'right' });

  // Status
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text(STATUS_LABELS[workOrder.status] || workOrder.status, rightColumnX, y + 12, {
    align: 'right',
  });

  y += 25;

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(workOrder.title, margin, y);
  y += 8;

  // Horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============================================
  // PEOPLE & DETAILS SECTION
  // ============================================

  const colWidth = contentWidth / 2 - 10;
  const leftColX = margin;
  const rightColX = margin + colWidth + 20;

  // LEFT COLUMN - Equipment For
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('EQUIPMENT FOR', leftColX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  const custodianName = workOrder.custodian_user_name ||
                        workOrder.custodian_contact_name ||
                        workOrder.project_name ||
                        'Not Assigned';
  doc.text(custodianName, leftColX, y);

  const leftY = y + 10;
  y = margin + 43;

  // RIGHT COLUMN - Preparer
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('PREPARER', rightColX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.text(workOrder.assigned_to_name || 'Unassigned', rightColX, y);

  y = Math.max(leftY, y + 10);

  // ============================================
  // DATES INFO
  // ============================================

  const hasDates = hasValue(workOrder.due_date) ||
                   hasValue(workOrder.pickup_date) ||
                   hasValue(workOrder.expected_return_date);

  if (hasDates) {
    y += 3;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);

    const details: string[] = [];
    if (hasValue(workOrder.due_date)) {
      details.push(`Due: ${formatDate(workOrder.due_date)}`);
    }
    if (hasValue(workOrder.pickup_date)) {
      details.push(`Pickup: ${formatDate(workOrder.pickup_date)}`);
    }
    if (hasValue(workOrder.expected_return_date)) {
      details.push(`Return: ${formatDate(workOrder.expected_return_date)}`);
    }

    doc.text(details.join('   |   '), margin, y);
    y += 8;
  }

  y += 5;

  // ============================================
  // ITEMS TABLE WITH STAGING CHECKBOXES
  // ============================================

  const items = workOrder.items || [];

  if (items.length > 0) {
    const tableData = items.map((item: GearWorkOrderItem) => {
      return [
        item.is_staged ? '[ X ]' : '[   ]', // Checkbox
        item.asset_name || item.kit_name || '-',
        item.asset_internal_id || item.kit_internal_id || '-',
        item.quantity > 1 ? `x${item.quantity}` : '1',
        item.notes || '',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Staged', 'Item Name', 'ID', 'Qty', 'Notes']],
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
        0: { cellWidth: 18, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 30 },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 55 },
      },
      margin: { left: margin, right: margin },
    });

    // Get the Y position after the table
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============================================
  // ITEM COUNT SUMMARY
  // ============================================

  const stagedCount = items.filter(i => i.is_staged).length;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(`Total Items: ${items.length}`, margin, y);
  doc.text(`Staged: ${stagedCount} / ${items.length}`, margin + 60, y);
  y += 10;

  // ============================================
  // NOTES SECTION
  // ============================================

  if (hasValue(workOrder.notes)) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('NOTES', margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const noteLines = doc.splitTextToSize(workOrder.notes!, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 8;
  }

  // ============================================
  // SIGNATURE SECTION
  // ============================================

  // Ensure signatures fit on page
  if (y > pageHeight - 60) {
    doc.addPage();
    y = margin;
  }

  y += 5;

  const sigColWidth = (contentWidth - 20) / 2;
  const sigLeftX = margin;
  const sigRightX = margin + sigColWidth + 20;

  // Prepared By signature
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('PREPARED BY', sigLeftX, y);

  doc.text('VERIFIED BY', sigRightX, y);
  y += 20;

  // Signature lines
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(sigLeftX, y, sigLeftX + sigColWidth - 10, y);
  doc.line(sigRightX, y, sigRightX + sigColWidth - 10, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Signature', sigLeftX, y);
  doc.text('Signature', sigRightX, y);
  y += 12;

  // Date lines
  doc.line(sigLeftX, y, sigLeftX + sigColWidth - 10, y);
  doc.line(sigRightX, y, sigRightX + sigColWidth - 10, y);
  y += 4;
  doc.text('Date', sigLeftX, y);
  doc.text('Date', sigRightX, y);

  // ============================================
  // FOOTER
  // ============================================

  const footerY = pageHeight - 15;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);

  // Reference number again for easy lookup
  doc.text(`Reference: ${refNumber}`, margin, footerY);

  // Generation timestamp
  const generatedAt = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  doc.text(`Generated: ${generatedAt}`, rightColumnX, footerY, { align: 'right' });

  // ============================================
  // SAVE THE PDF
  // ============================================

  const filename = `WorkOrder-${refNumber}-${formatDate(workOrder.created_at).replace(/[, ]/g, '-')}.pdf`;
  doc.save(filename);
}
