-- Update handle_invoice_accounting to also store customer_id on journal entries
CREATE OR REPLACE FUNCTION handle_invoice_accounting()
RETURNS TRIGGER AS $$
DECLARE
v_total_amount decimal(15,2);
v_tenant_id uuid;
v_customer_name text;
v_journal_id uuid;
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

-- Insert journal entry with customer_id
INSERT INTO journal_entries (
tenant_id, entry_number, entry_date, description, reference_type, reference_id,
total_debit, total_credit, is_posted, customer_id
)
VALUES (
v_tenant_id,
'JE-' || EXTRACT(EPOCH FROM NOW())::bigint::text,
COALESCE(NEW.invoice_date, CURRENT_DATE),
'Invoice #' || NEW.invoice_number || ' - ' || COALESCE(v_customer_name, 'Customer'),
'invoice',
NEW.id,
v_total_amount,
v_total_amount,
true,
NEW.customer_id
)
RETURNING id INTO v_journal_id;

-- Insert journal lines
INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit, sort_order)
SELECT v_journal_id, a.id, 
       CASE WHEN a.code = '1100' THEN 'Accounts Receivable' ELSE 'Sales Revenue' END,
       CASE WHEN a.code = '1100' THEN v_total_amount ELSE 0 END,
       CASE WHEN a.code = '4000' THEN v_total_amount ELSE 0 END,
       CASE WHEN a.code = '1100' THEN 0 ELSE 1 END
FROM accounts a
WHERE a.code IN ('1100', '4000');
END IF;

RETURN NEW;
END;
$$ LANGUAGE plpgsql;