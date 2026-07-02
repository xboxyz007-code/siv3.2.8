-- Fix invoice accounting trigger to use correct 'partially_paid' status instead of 'partial'
CREATE OR REPLACE FUNCTION handle_invoice_accounting()
RETURNS TRIGGER AS $$
DECLARE
v_total_amount decimal(15,2);
v_tenant_id uuid;
v_customer_name text;
v_should_post boolean := false;
BEGIN
v_total_amount := COALESCE(NEW.total_amount, 0);
v_tenant_id := COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000001');

-- INSERT: post immediately if invoice is paid, sent, or partially_paid (e.g. POS)
IF TG_OP = 'INSERT' AND NEW.status IN ('paid', 'sent', 'partially_paid') THEN
v_should_post := true;
END IF;

-- UPDATE: only post on first status transition from draft
IF TG_OP = 'UPDATE'
AND NEW.status IN ('sent', 'paid', 'partially_paid')
AND OLD.status = 'draft'
AND NOT EXISTS (
SELECT 1 FROM journal_entries
WHERE reference_type = 'invoice' AND reference_id = NEW.id
)
THEN
v_should_post := true;
END IF;

IF v_should_post AND v_total_amount > 0 THEN
SELECT name INTO v_customer_name FROM customers WHERE id = NEW.customer_id;

PERFORM post_journal_entry(
p_description := 'Invoice #' || NEW.invoice_number || ' - ' || COALESCE(v_customer_name, 'Customer'),
p_lines := jsonb_build_array(
jsonb_build_object('account_code', '1100', 'debit', v_total_amount, 'description', 'Accounts Receivable'),
jsonb_build_object('account_code', '4000', 'credit', v_total_amount, 'description', 'Sales Revenue')
),
p_entry_date := COALESCE(NEW.invoice_date, CURRENT_DATE),
p_reference_type := 'invoice',
p_reference_id := NEW.id,
p_tenant_id := v_tenant_id
);
END IF;

RETURN NEW;
END;
$$ LANGUAGE plpgsql;