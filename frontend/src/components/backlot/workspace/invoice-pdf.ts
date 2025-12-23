/**
 * Invoice PDF Generation
 *
 * Uses jsPDF to generate professional invoices.
 * Only includes fields that have values - empty/null fields are skipped.
 */

import type { BacklotInvoice, BacklotInvoiceLineItem, InvoicePaymentTerms } from '@/types/backlot';

// Payment terms display labels
const PAYMENT_TERMS_LABELS: Record<InvoicePaymentTerms, string> = {
  due_on_receipt: 'Due on Receipt',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
  custom: 'Custom',
};

// Rate type labels for line items
const RATE_TYPE_LABELS: Record<string, string> = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  flat: 'Flat Rate',
};

// Format currency
function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format date for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Check if a value is empty/null/undefined
function hasValue(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !isNaN(value);
  return true;
}

/**
 * Generate and download a PDF invoice
 * Only includes filled fields in the output
 */
export async function generateInvoicePdf(invoice: BacklotInvoice): Promise<void> {
  // Validate required invoice data
  if (!invoice) {
    throw new Error('Invoice data is required');
  }
  if (!invoice.invoice_number) {
    throw new Error('Invoice number is required');
  }
  if (!invoice.invoicer_name) {
    throw new Error('Invoicer name is required');
  }
  if (!invoice.bill_to_name) {
    throw new Error('Bill to name is required');
  }

  // Dynamically import jsPDF and autotable
  let jsPDF, autoTable;
  try {
    const jsPDFModule = await import('jspdf');
    jsPDF = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    autoTable = autoTableModule.default;
  } catch (importError) {
    console.error('[Invoice PDF] Failed to load PDF libraries:', importError);
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
    console.error('[Invoice PDF] Failed to create PDF document:', docError);
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

  // "INVOICE" title
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('INVOICE', margin, y + 10);

  // Invoice number and date (right aligned)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  const rightColumnX = pageWidth - margin;
  doc.text(`Invoice #: ${invoice.invoice_number}`, rightColumnX, y, { align: 'right' });
  doc.text(`Date: ${formatDate(invoice.invoice_date)}`, rightColumnX, y + 5, { align: 'right' });

  if (hasValue(invoice.due_date)) {
    doc.text(`Due: ${formatDate(invoice.due_date)}`, rightColumnX, y + 10, { align: 'right' });
  }

  if (hasValue(invoice.po_number)) {
    doc.text(`PO #: ${invoice.po_number}`, rightColumnX, y + 15, { align: 'right' });
  }

  y += 30;

  // Horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============================================
  // FROM / BILL TO SECTION
  // ============================================

  const colWidth = contentWidth / 2 - 10;
  const leftColX = margin;
  const rightColX = margin + colWidth + 20;
  const startY = y;

  // FROM section (Invoicer)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('FROM', leftColX, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.text(invoice.invoicer_name, leftColX, y);
  y += 5;

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  if (hasValue(invoice.position_role)) {
    doc.text(invoice.position_role!, leftColX, y);
    y += 4;
  }
  if (hasValue(invoice.invoicer_email)) {
    doc.text(invoice.invoicer_email!, leftColX, y);
    y += 4;
  }
  if (hasValue(invoice.invoicer_phone)) {
    doc.text(invoice.invoicer_phone!, leftColX, y);
    y += 4;
  }
  if (hasValue(invoice.invoicer_address)) {
    // Address might be multi-line
    const addressLines = doc.splitTextToSize(invoice.invoicer_address!, colWidth);
    doc.text(addressLines, leftColX, y);
    y += addressLines.length * 4;
  }

  // BILL TO section (Production)
  let y2 = startY;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('BILL TO', rightColX, y2);
  y2 += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.text(invoice.bill_to_name, rightColX, y2);
  y2 += 5;

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  if (hasValue(invoice.bill_to_company)) {
    doc.text(invoice.bill_to_company!, rightColX, y2);
    y2 += 4;
  }
  if (hasValue(invoice.bill_to_email)) {
    doc.text(invoice.bill_to_email!, rightColX, y2);
    y2 += 4;
  }
  if (hasValue(invoice.bill_to_address)) {
    const addressLines = doc.splitTextToSize(invoice.bill_to_address!, colWidth);
    doc.text(addressLines, rightColX, y2);
    y2 += addressLines.length * 4;
  }

  // Use the larger y position
  y = Math.max(y, y2) + 5;

  // ============================================
  // PROJECT DETAILS (if filled)
  // ============================================

  const hasProjectDetails = hasValue(invoice.production_title) ||
    (hasValue(invoice.date_range_start) && hasValue(invoice.date_range_end));

  if (hasProjectDetails) {
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);

    const details: string[] = [];
    if (hasValue(invoice.production_title)) {
      details.push(`Production: ${invoice.production_title}`);
    }
    if (hasValue(invoice.date_range_start) && hasValue(invoice.date_range_end)) {
      details.push(`Period: ${formatDate(invoice.date_range_start)} - ${formatDate(invoice.date_range_end)}`);
    } else if (hasValue(invoice.date_range_start)) {
      details.push(`Start Date: ${formatDate(invoice.date_range_start)}`);
    }

    doc.text(details.join('   |   '), margin, y);
    y += 6;
  }

  y += 5;

  // ============================================
  // LINE ITEMS TABLE
  // ============================================

  const lineItems = invoice.line_items || [];

  if (lineItems.length > 0) {
    const tableData = lineItems.map((item: BacklotInvoiceLineItem) => {
      const dateRange = item.service_date_start
        ? (item.service_date_end && item.service_date_end !== item.service_date_start
            ? `${formatDate(item.service_date_start)} - ${formatDate(item.service_date_end)}`
            : formatDate(item.service_date_start))
        : '';

      const rateInfo = item.rate_type !== 'flat'
        ? `${formatCurrency(item.rate_amount, invoice.currency)} × ${item.quantity} ${item.units || RATE_TYPE_LABELS[item.rate_type] || ''}`
        : formatCurrency(item.rate_amount, invoice.currency);

      return [
        item.description,
        dateRange,
        rateInfo,
        formatCurrency(item.line_total, invoice.currency),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Service Date', 'Rate / Qty', 'Amount']],
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
        0: { cellWidth: 70 },
        1: { cellWidth: 40 },
        2: { cellWidth: 40, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    // Get the Y position after the table
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============================================
  // TOTALS SECTION
  // ============================================

  const totalsX = pageWidth - margin - 70;
  const valuesX = pageWidth - margin;
  const totalsWidth = 70;

  // Subtotal
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsX, y);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), valuesX, y, { align: 'right' });
  y += 5;

  // Tax (if applicable)
  if (invoice.tax_rate > 0 || invoice.tax_amount > 0) {
    const taxLabel = invoice.tax_rate > 0 ? `Tax (${invoice.tax_rate}%):` : 'Tax:';
    doc.text(taxLabel, totalsX, y);
    doc.text(formatCurrency(invoice.tax_amount, invoice.currency), valuesX, y, { align: 'right' });
    y += 5;
  }

  // Discount (if applicable)
  if (invoice.discount_amount > 0) {
    doc.text('Discount:', totalsX, y);
    doc.text(`-${formatCurrency(invoice.discount_amount, invoice.currency)}`, valuesX, y, { align: 'right' });
    y += 5;
  }

  // Total line
  y += 2;
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y, valuesX, y);
  y += 5;

  // Total amount
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Total:', totalsX, y);
  doc.text(formatCurrency(invoice.total_amount, invoice.currency), valuesX, y, { align: 'right' });
  y += 10;

  // Paid amount (if partial payment)
  if (invoice.paid_amount && invoice.paid_amount > 0 && invoice.paid_amount < invoice.total_amount) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 128, 0);
    doc.text('Paid:', totalsX, y);
    doc.text(`-${formatCurrency(invoice.paid_amount, invoice.currency)}`, valuesX, y, { align: 'right' });
    y += 5;

    const balance = invoice.total_amount - invoice.paid_amount;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Balance Due:', totalsX, y);
    doc.text(formatCurrency(balance, invoice.currency), valuesX, y, { align: 'right' });
    y += 10;
  }

  // ============================================
  // PAYMENT INFORMATION (if filled)
  // ============================================

  const hasPaymentInfo = hasValue(invoice.payment_terms) ||
    hasValue(invoice.payment_method) ||
    hasValue(invoice.payment_details);

  if (hasPaymentInfo) {
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('PAYMENT INFORMATION', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    if (hasValue(invoice.payment_terms)) {
      const termsLabel = invoice.payment_terms === 'custom' && hasValue(invoice.payment_terms_custom)
        ? invoice.payment_terms_custom!
        : PAYMENT_TERMS_LABELS[invoice.payment_terms!] || invoice.payment_terms;
      doc.text(`Payment Terms: ${termsLabel}`, margin, y);
      y += 5;
    }

    if (hasValue(invoice.payment_method)) {
      doc.text(`Payment Method: ${invoice.payment_method}`, margin, y);
      y += 5;
    }

    if (hasValue(invoice.payment_details)) {
      const detailsLines = doc.splitTextToSize(invoice.payment_details!, contentWidth);
      doc.text(detailsLines, margin, y);
      y += detailsLines.length * 4;
    }
  }

  // ============================================
  // NOTES (if filled)
  // ============================================

  if (hasValue(invoice.notes)) {
    y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('NOTES', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const notesLines = doc.splitTextToSize(invoice.notes!, contentWidth);
    doc.text(notesLines, margin, y);
  }

  // ============================================
  // FOOTER
  // ============================================

  // Status badge (for paid invoices)
  if (invoice.status === 'paid') {
    doc.setFontSize(40);
    doc.setTextColor(200, 240, 200);
    doc.setFont('helvetica', 'bold');

    // Rotate and place "PAID" stamp
    doc.saveGraphicsState();
    doc.text('PAID', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
    doc.restoreGraphicsState();
  }

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
    const sanitizedNumber = invoice.invoice_number.replace(/[^a-zA-Z0-9-]/g, '-');
    const filename = `Invoice-${sanitizedNumber}.pdf`;
    doc.save(filename);
  } catch (saveError) {
    console.error('[Invoice PDF] Failed to save PDF:', saveError);
    throw new Error('Failed to save PDF file');
  }
}

export default generateInvoicePdf;
