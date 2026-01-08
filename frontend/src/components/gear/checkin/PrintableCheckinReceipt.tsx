/**
 * Printable Check-in Receipt
 * PDF generation for gear check-in transactions
 * Following the PrintableCheckoutSlip.tsx pattern
 */

// Receipt data structure from the API
interface CheckinReceiptItem {
  asset_id: string;
  asset_name: string;
  barcode?: string;
  current_status?: string;
  scanned_in_at?: string;
  condition_grade?: string;
  has_cosmetic_damage?: boolean;
  has_functional_damage?: boolean;
  is_unsafe?: boolean;
  condition_notes?: string;
}

interface CheckinIncident {
  id: string;
  incident_type: string;
  damage_tier?: string;
  damage_description?: string;
  asset_name: string;
}

interface CheckinRepair {
  id: string;
  status: string;
  priority: string;
  description?: string;
  asset_name: string;
}

interface CheckinReceiptData {
  transaction_id: string;
  transaction_type?: string;
  returned_at?: string;
  returned_by_id?: string;
  custodian_name: string;
  items: CheckinReceiptItem[];
  total_items: number;
  is_overdue: boolean;
  late_days: number;
  late_fee_amount: number;
  partial_return: boolean;
  items_not_returned: number;
  incidents: CheckinIncident[];
  repairs: CheckinRepair[];
  notes?: string;
  project_name?: string;
  organization_id: string;
}

// Transaction type display labels
const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  internal_checkout: 'Team Check-in',
  internal_checkin: 'Check-in',
  transfer: 'Transfer',
  rental_pickup: 'Rental Return',
  rental_return: 'Rental Return',
  write_off: 'Write-off',
  maintenance_send: 'Sent to Maintenance',
  maintenance_return: 'Returned from Maintenance',
  inventory_adjustment: 'Inventory Adjustment',
  initial_intake: 'Initial Intake',
};

// Condition grade colors for PDF [R, G, B]
const CONDITION_COLORS: Record<string, [number, number, number]> = {
  excellent: [22, 101, 52],    // green
  good: [30, 64, 175],         // blue
  fair: [146, 64, 14],         // amber
  poor: [194, 65, 12],         // orange
  non_functional: [153, 27, 27], // red
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

// Get condition display text
function getConditionText(grade: string | undefined): string {
  if (!grade) return '-';
  return grade.charAt(0).toUpperCase() + grade.slice(1).replace('_', ' ');
}

// Get damage status text
function getDamageStatus(item: CheckinReceiptItem): string {
  if (item.is_unsafe) return 'UNSAFE';
  if (item.has_functional_damage) return 'Functional Damage';
  if (item.has_cosmetic_damage) return 'Cosmetic Damage';
  return 'OK';
}

/**
 * Generate and download a PDF check-in receipt
 */
export async function generateCheckinReceiptPdf(receipt: CheckinReceiptData): Promise<void> {
  // Validate required data
  if (!receipt) {
    throw new Error('Receipt data is required');
  }

  // Dynamically import jsPDF and autotable
  let jsPDF, autoTable;
  try {
    const jsPDFModule = await import('jspdf');
    jsPDF = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    autoTable = autoTableModule.default;
  } catch (importError) {
    console.error('[Check-in Receipt PDF] Failed to load PDF libraries:', importError);
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
    console.error('[Check-in Receipt PDF] Failed to create PDF document:', docError);
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

  // "CHECK-IN RECEIPT" title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('CHECK-IN RECEIPT', margin, y + 8);

  // Reference number (right aligned, prominent)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  const rightColumnX = pageWidth - margin;
  const refNumber = receipt.transaction_id.slice(0, 8).toUpperCase();
  doc.text(`Ref #: ${refNumber}`, rightColumnX, y, { align: 'right' });
  doc.text(`Date: ${formatDateTime(receipt.returned_at)}`, rightColumnX, y + 5, { align: 'right' });

  // Transaction type
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  const typeLabel = TRANSACTION_TYPE_LABELS[receipt.transaction_type || 'internal_checkin'] || 'Check-in';
  doc.text(typeLabel, rightColumnX, y + 12, { align: 'right' });

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

  // LEFT COLUMN - Returned By Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('RETURNED BY', leftColX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.text(receipt.custodian_name || 'Unknown', leftColX, y);
  y += 5;

  if (hasValue(receipt.returned_at)) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Return Time: ${formatDateTime(receipt.returned_at)}`, leftColX, y);
    y += 5;
  }

  const leftY = y;
  y = margin + 35;

  // RIGHT COLUMN - Custodian Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('CUSTODIAN', rightColX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.text(receipt.custodian_name || 'Unknown', rightColX, y);
  y += 5;

  // Use the larger Y position
  y = Math.max(leftY, y) + 5;

  // ============================================
  // PROJECT INFO
  // ============================================

  if (hasValue(receipt.project_name)) {
    y += 3;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Project: ${receipt.project_name}`, margin, y);
    y += 8;
  }

  // ============================================
  // LATE RETURN ALERT (if overdue)
  // ============================================

  if (receipt.is_overdue && receipt.late_days > 0) {
    y += 5;

    // Red background box
    doc.setFillColor(254, 226, 226); // Light red
    doc.setDrawColor(239, 68, 68);   // Red border
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

    // Alert text
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(153, 27, 27);
    doc.text('LATE RETURN', margin + 5, y + 7);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${receipt.late_days} day${receipt.late_days !== 1 ? 's' : ''} overdue`, margin + 5, y + 14);

    if (receipt.late_fee_amount > 0) {
      doc.text(`Late Fee: $${receipt.late_fee_amount.toFixed(2)}`, margin + contentWidth / 2, y + 14);
    }

    y += 28;
  }

  // ============================================
  // PARTIAL RETURN WARNING (if applicable)
  // ============================================

  if (receipt.partial_return && receipt.items_not_returned > 0) {
    y += 3;

    // Yellow background box
    doc.setFillColor(254, 243, 199); // Light yellow
    doc.setDrawColor(234, 179, 8);   // Yellow border
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 15, 2, 2, 'FD');

    // Warning text
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(146, 64, 14);
    doc.text('PARTIAL RETURN', margin + 5, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.text(`${receipt.items_not_returned} item${receipt.items_not_returned !== 1 ? 's' : ''} not returned`, margin + 50, y + 7);

    y += 23;
  }

  y += 5;

  // ============================================
  // ITEMS TABLE
  // ============================================

  const items = receipt.items || [];

  if (items.length > 0) {
    const tableData = items.map((item: CheckinReceiptItem) => {
      const conditionText = getConditionText(item.condition_grade);
      const damageStatus = getDamageStatus(item);

      return [
        item.asset_name || '-',
        item.barcode || '-',
        conditionText,
        damageStatus,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Item Name', 'Barcode', 'Condition', 'Status']],
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
        0: { cellWidth: 60 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 40 },
      },
      margin: { left: margin, right: margin },
      didParseCell: function (data: { section: string; column: { index: number }; row: { index: number }; cell: { styles: { textColor: number[] } } }) {
        // Color the condition column based on grade
        if (data.section === 'body' && data.column.index === 2) {
          const item = items[data.row.index];
          if (item?.condition_grade && CONDITION_COLORS[item.condition_grade]) {
            data.cell.styles.textColor = CONDITION_COLORS[item.condition_grade];
          }
        }
        // Color the status column red for damage
        if (data.section === 'body' && data.column.index === 3) {
          const item = items[data.row.index];
          if (item?.is_unsafe || item?.has_functional_damage || item?.has_cosmetic_damage) {
            data.cell.styles.textColor = [153, 27, 27];
          }
        }
      },
    });

    // Get the Y position after the table
    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
    y += 10;
  }

  // ============================================
  // ITEM COUNT SUMMARY
  // ============================================

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(`Total Items Returned: ${receipt.total_items}`, margin, y);
  y += 10;

  // ============================================
  // INCIDENTS SECTION (if any)
  // ============================================

  if (receipt.incidents && receipt.incidents.length > 0) {
    // Section header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('INCIDENTS LOGGED', margin, y);
    y += 5;

    const incidentData = receipt.incidents.map((incident: CheckinIncident) => [
      incident.asset_name || '-',
      incident.incident_type || '-',
      incident.damage_description?.substring(0, 50) || '-',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Asset', 'Type', 'Description']],
      body: incidentData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [40, 40, 40],
      },
      headStyles: {
        fillColor: [251, 191, 36],
        textColor: [60, 60, 60],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [254, 249, 195],
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 10;
  }

  // ============================================
  // REPAIRS SECTION (if any)
  // ============================================

  if (receipt.repairs && receipt.repairs.length > 0) {
    // Section header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('REPAIR TICKETS CREATED', margin, y);
    y += 5;

    const repairData = receipt.repairs.map((repair: CheckinRepair) => [
      repair.asset_name || '-',
      repair.priority || '-',
      repair.description?.substring(0, 50) || '-',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Asset', 'Priority', 'Description']],
      body: repairData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [40, 40, 40],
      },
      headStyles: {
        fillColor: [251, 146, 60],
        textColor: [60, 60, 60],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [254, 234, 209],
      },
      margin: { left: margin, right: margin },
      didParseCell: function (data: { section: string; column: { index: number }; row: { index: number }; cell: { styles: { textColor: number[]; fontStyle: string } } }) {
        // Color urgent/high priority red
        if (data.section === 'body' && data.column.index === 1) {
          const repair = receipt.repairs[data.row.index];
          if (repair?.priority === 'urgent' || repair?.priority === 'high') {
            data.cell.styles.textColor = [153, 27, 27];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 10;
  }

  // ============================================
  // NOTES SECTION
  // ============================================

  if (hasValue(receipt.notes)) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('NOTES', margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const noteLines = doc.splitTextToSize(receipt.notes!, contentWidth);
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

  // Returned By signature
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('RETURNED BY', sigLeftX, y);

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

  const filename = `Checkin-${refNumber}-${formatDate(receipt.returned_at).replace(/[, ]/g, '-')}.pdf`;
  doc.save(filename);
}
