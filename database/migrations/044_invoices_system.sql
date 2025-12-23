-- Migration: 044_invoices_system.sql
-- Description: Invoices system for crew billing
-- Created: 2024-12-22

-- ============================================================================
-- INVOICES
-- Main invoice records for crew members billing the production
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Identification
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,

    -- Invoicer (crew member)
    invoicer_name TEXT NOT NULL,
    invoicer_email TEXT,
    invoicer_phone TEXT,
    invoicer_address TEXT,

    -- Bill To (production)
    bill_to_name TEXT NOT NULL,
    bill_to_company TEXT,
    bill_to_address TEXT,
    bill_to_email TEXT,

    -- Film Context (optional)
    position_role TEXT,
    production_title TEXT,
    date_range_start DATE,
    date_range_end DATE,
    po_number TEXT,

    -- Financials
    subtotal NUMERIC(12,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    discount_amount NUMERIC(12,2) DEFAULT 0,
    total_amount NUMERIC(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',

    -- Payment Terms
    payment_terms TEXT DEFAULT 'net_30', -- due_on_receipt, net_15, net_30, net_45, net_60, custom
    payment_terms_custom TEXT,
    payment_method TEXT, -- check, direct_deposit, paypal, venmo, zelle, wire, other
    payment_details TEXT, -- Bank account info, PayPal email, etc.

    -- Status Workflow
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    paid_amount NUMERIC(12,2),

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique invoice number per project
    CONSTRAINT unique_invoice_number_per_project UNIQUE (project_id, invoice_number)
);

-- ============================================================================
-- INVOICE LINE ITEMS
-- Individual billable items on an invoice
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES backlot_invoices(id) ON DELETE CASCADE,

    -- Description
    description TEXT NOT NULL,

    -- Rate Information
    rate_type TEXT DEFAULT 'flat' CHECK (rate_type IN ('hourly', 'daily', 'weekly', 'flat')),
    rate_amount NUMERIC(12,2) NOT NULL,
    quantity NUMERIC(10,2) DEFAULT 1,
    units TEXT, -- hours, days, weeks, items, etc.

    -- Calculated total
    line_total NUMERIC(12,2) NOT NULL,

    -- Source linking (for imports from timecards, expenses, etc.)
    source_type TEXT CHECK (source_type IS NULL OR source_type IN ('manual', 'timecard', 'kit_rental', 'mileage', 'per_diem', 'receipt')),
    source_id UUID, -- FK to source table (timecard_id, receipt_id, etc.)

    -- Service dates (for date range display)
    service_date_start DATE,
    service_date_end DATE,

    -- Ordering
    sort_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_backlot_invoices_project ON backlot_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_invoices_user ON backlot_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_invoices_status ON backlot_invoices(status);
CREATE INDEX IF NOT EXISTS idx_backlot_invoices_date ON backlot_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_backlot_invoices_due_date ON backlot_invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_backlot_invoice_items_invoice ON backlot_invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_backlot_invoice_items_source ON backlot_invoice_line_items(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_backlot_invoice_items_sort ON backlot_invoice_line_items(invoice_id, sort_order);

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_backlot_invoices_updated_at
    BEFORE UPDATE ON backlot_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_updated_at();

CREATE TRIGGER trigger_backlot_invoice_line_items_updated_at
    BEFORE UPDATE ON backlot_invoice_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_updated_at();

-- ============================================================================
-- AUTO-CALCULATE INVOICE TOTALS
-- Recalculate totals when line items change
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id UUID;
    v_subtotal NUMERIC(12, 2);
    v_tax_rate NUMERIC(5, 2);
    v_discount NUMERIC(12, 2);
BEGIN
    -- Get the invoice ID
    v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

    -- Calculate subtotal from line items
    SELECT COALESCE(SUM(line_total), 0)
    INTO v_subtotal
    FROM backlot_invoice_line_items
    WHERE invoice_id = v_invoice_id;

    -- Get tax rate and discount from invoice
    SELECT COALESCE(tax_rate, 0), COALESCE(discount_amount, 0)
    INTO v_tax_rate, v_discount
    FROM backlot_invoices
    WHERE id = v_invoice_id;

    -- Update invoice totals
    UPDATE backlot_invoices
    SET
        subtotal = v_subtotal,
        tax_amount = ROUND(v_subtotal * (v_tax_rate / 100), 2),
        total_amount = v_subtotal + ROUND(v_subtotal * (v_tax_rate / 100), 2) - v_discount,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalculate_invoice_totals
    AFTER INSERT OR UPDATE OR DELETE ON backlot_invoice_line_items
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_invoice_totals();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE backlot_invoices IS 'Invoices created by crew members to bill the production company';
COMMENT ON TABLE backlot_invoice_line_items IS 'Individual billable line items on an invoice';

COMMENT ON COLUMN backlot_invoices.status IS 'draft=editable, sent=submitted to production, paid=payment received, overdue=past due date, cancelled=voided';
COMMENT ON COLUMN backlot_invoices.payment_terms IS 'Payment schedule: due_on_receipt, net_15, net_30, net_45, net_60, or custom';
COMMENT ON COLUMN backlot_invoice_line_items.source_type IS 'Where this line item was imported from: manual entry, timecard, kit_rental, mileage, per_diem, or receipt';
COMMENT ON COLUMN backlot_invoice_line_items.source_id IS 'ID of the source record if imported (prevents duplicate imports)';
