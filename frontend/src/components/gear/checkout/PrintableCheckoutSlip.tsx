/**
 * Printable Checkout Slip
 * PDF generation for gear checkout transactions
 * Following the invoice-pdf.ts pattern
 */

import type { GearTransaction, GearTransactionItem } from '@/types/gear';

// Transaction type display labels
const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  internal_checkout: 'Team Checkout',
  internal_checkin: 'Check-in',
  transfer: 'Transfer',
  rental_pickup: 'Rental Pickup',
  rental_return: 'Rental Return',
  write_off: 'Write-off',
  maintenance_send: 'Sent to Maintenance',
  maintenance_return: 'Returned from Maintenance',
  inventory_adjustment: 'Inventory Adjustment',
  initial_intake: 'Initial Intake',
};

// Status display labels
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
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
 * Generate and download a PDF checkout slip
 */
export async function generateCheckoutSlipPdf(transaction: GearTransaction): Promise<void> {
  // Validate required data
  if (!transaction) {
    throw new Error('Transaction data is required');
  }

  // Dynamically import jsPDF and autotable
  let jsPDF, autoTable;
  try {
    const jsPDFModule = await import('jspdf');
    jsPDF = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    autoTable = autoTableModule.default;
  } catch (importError) {
    console.error('[Checkout Slip PDF] Failed to load PDF libraries:', importError);
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
    console.error('[Checkout Slip PDF] Failed to create PDF document:', docError);
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

  // "CHECKOUT SLIP" title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('CHECKOUT SLIP', margin, y + 8);

  // Reference number (right aligned, prominent)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  const rightColumnX = pageWidth - margin;
  const refNumber = transaction.reference_number || transaction.id.slice(0, 8).toUpperCase();
  doc.text(`Ref #: ${refNumber}`, rightColumnX, y, { align: 'right' });
  doc.text(`Date: ${formatDateTime(transaction.created_at)}`, rightColumnX, y + 5, { align: 'right' });

  // Transaction type and status
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text(TRANSACTION_TYPE_LABELS[transaction.transaction_type] || transaction.transaction_type, rightColumnX, y + 12, {
    align: 'right',
  });

  y += 25;

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

  // LEFT COLUMN - Checkout Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('CHECKED OUT BY', leftColX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.text(transaction.initiated_by_name || 'Unknown', leftColX, y);
  y += 5;

  if (hasValue(transaction.checked_out_at)) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Checkout Time: ${formatDateTime(transaction.checked_out_at)}`, leftColX, y);
    y += 5;
  }

  const leftY = y;
  y = margin + 35;

  // RIGHT COLUMN - Custodian Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('ASSIGNED TO', rightColX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);

  // Show either user custodian or contact custodian
  const custodianName = transaction.custodian_contact_name || transaction.primary_custodian_name || 'Not Assigned';
  doc.text(custodianName, rightColX, y);
  y += 5;

  if (hasValue(transaction.custodian_contact_company)) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(transaction.custodian_contact_company!, rightColX, y);
    y += 5;
  }

  // Use the larger Y position
  y = Math.max(leftY, y) + 5;

  // ============================================
  // PROJECT & LOCATION INFO
  // ============================================

  const projectName = transaction.project_name || transaction.backlot_project_name;
  const locationName = transaction.destination_name || transaction.destination_location_name;
  const hasProjectLocation = hasValue(projectName) || hasValue(locationName) || hasValue(transaction.expected_return_at);

  if (hasProjectLocation) {
    y += 3;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);

    const details: string[] = [];
    if (hasValue(projectName)) {
      details.push(`Project: ${projectName}`);
    }
    if (hasValue(locationName)) {
      details.push(`Location: ${locationName}`);
    }
    if (hasValue(transaction.expected_return_at)) {
      details.push(`Return: ${formatDate(transaction.expected_return_at)}`);
    }

    doc.text(details.join('   |   '), margin, y);
    y += 8;
  }

  y += 5;

  // ============================================
  // ITEMS TABLE
  // ============================================

  const items = transaction.items || [];

  if (items.length > 0) {
    const tableData = items.map((item: GearTransactionItem) => {
      // Build equipment details string
      const details: string[] = [];
      if (hasValue(item.make) && hasValue(item.model)) {
        details.push(`${item.make} ${item.model}`);
      } else if (hasValue(item.make)) {
        details.push(item.make!);
      } else if (hasValue(item.model)) {
        details.push(item.model!);
      }

      const detailsStr = details.length > 0 ? details.join(' - ') : '';

      return [
        item.asset_name || item.kit_name || '-',
        item.asset_internal_id || item.kit_internal_id || '-',
        item.serial_number || '-',
        item.category_name || '-',
        detailsStr,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Item Name', 'ID', 'Serial #', 'Category', 'Make / Model']],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
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
        0: { cellWidth: 45 },
        1: { cellWidth: 25 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 45 },
      },
      margin: { left: margin, right: margin },
    });

    // Get the Y position after the table
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============================================
  // ITEM COUNT SUMMARY
  // ============================================

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(`Total Items: ${items.length}`, margin, y);
  y += 10;

  // ============================================
  // NOTES SECTION
  // ============================================

  if (hasValue(transaction.notes)) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('NOTES', margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const noteLines = doc.splitTextToSize(transaction.notes!, contentWidth);
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

  // Checked Out By signature
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('CHECKED OUT BY', sigLeftX, y);

  doc.text('RECEIVED BY', sigRightX, y);
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

  const filename = `Checkout-${refNumber}-${formatDate(transaction.created_at).replace(/[, ]/g, '-')}.pdf`;
  doc.save(filename);
}
