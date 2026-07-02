-- Update payment accounting trigger to store customer_id on journal entries for received payments
CREATE OR REPLACE FUNCTION handle_payment_accounting()
RETURNS TRIGGER AS $$
DECLARE
v_tenant_id uuid;
v_account_code text;
v_journal_id uuid;
BEGIN
IF TG_OP != 'INSERT' THEN RETURN NEW; END IF;

v_tenant_id := COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000001');

-- Get the account code from payment_methods table
SELECT a.code INTO v_account_code
FROM payment_methods pm
JOIN accounts a ON a.id = pm.account_id
WHERE pm.code = LOWER(NEW.payment_method)
OR pm.name ILIKE '%' || NEW.payment_method || '%'
OR pm.id::text = NEW.payment_method
LIMIT 1;

-- Fallback defaults
IF v_account_code IS NULL THEN
v_account_code := CASE
WHEN NEW.payment_method ILIKE '%bank%' OR NEW.payment_method ILIKE '%transfer%' THEN '1002'
WHEN NEW.payment_method ILIKE '%card%' THEN '1021'
WHEN NEW.payment_method ILIKE '%bkash%' THEN '1022'
WHEN NEW.payment_method ILIKE '%nagad%' THEN '1023'
WHEN NEW.payment_method ILIKE '%cheque%' THEN '1024'
ELSE '1001'
END;
END IF;

IF NEW.payment_type = 'received' THEN
-- Customer payment: debit cash/bank, credit AR
INSERT INTO journal_entries (
tenant_id, entry_number, entry_date, description, reference_type, reference_id,
total_debit, total_credit, is_posted, customer_id
)
VALUES (
v_tenant_id,
'JE-' || EXTRACT(EPOCH FROM NOW())::bigint::text,
COALESCE(NEW.payment_date, CURRENT_DATE),
'Payment received - ' || COALESCE(NEW.payment_number, NEW.id::text),
'payment',
NEW.id,
NEW.amount,
NEW.amount,
true,
NEW.customer_id
)
RETURNING id INTO v_journal_id;

-- Insert journal lines
INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit, sort_order)
SELECT v_journal_id, a.id,
       CASE WHEN code = v_account_code THEN 'Payment received via ' || COALESCE(NEW.payment_method, 'cash')
            ELSE 'Accounts Receivable cleared' END,
       CASE WHEN code = v_account_code THEN NEW.amount ELSE 0 END,
       CASE WHEN code = '1100' THEN NEW.amount ELSE 0 END,
       CASE WHEN code = v_account_code THEN 0 ELSE 1 END
FROM accounts a
WHERE a.code IN (v_account_code, '1100');

ELSIF NEW.payment_type = 'made' THEN
-- Supplier payment: debit AP, credit cash/bank
INSERT INTO journal_entries (
tenant_id, entry_number, entry_date, description, reference_type, reference_id,
total_debit, total_credit, is_posted, supplier_id
)
VALUES (
v_tenant_id,
'JE-' || EXTRACT(EPOCH FROM NOW())::bigint::text,
COALESCE(NEW.payment_date, CURRENT_DATE),
'Payment made - ' || COALESCE(NEW.payment_number, NEW.id::text),
'payment',
NEW.id,
NEW.amount,
NEW.amount,
true,
NEW.supplier_id
)
RETURNING id INTO v_journal_id;

-- Insert journal lines
INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit, sort_order)
SELECT v_journal_id, a.id,
       CASE WHEN code = '2000' THEN 'Accounts Payable reduced'
            ELSE 'Payment made via ' || COALESCE(NEW.payment_method, 'cash') END,
       CASE WHEN code = '2000' THEN NEW.amount ELSE 0 END,
       CASE WHEN code = v_account_code THEN NEW.amount ELSE 0 END,
       CASE WHEN code = '2000' THEN 0 ELSE 1 END
FROM accounts a
WHERE a.code IN (v_account_code, '2000');
END IF;

RETURN NEW;
END;
$$ LANGUAGE plpgsql;