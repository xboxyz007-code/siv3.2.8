
-- =============================================================
-- Fix 1: Invoice accounting trigger fires on INSERT too
-- (POS sales are inserted directly as 'paid', never go through UPDATE)
-- Also fires on UPDATE for non-POS invoices that transition status
-- =============================================================
CREATE OR REPLACE FUNCTION invoice_accounting_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_total_amount decimal(15,2);
  v_tenant_id uuid;
  v_customer_name text;
  v_should_post boolean := false;
BEGIN
  v_total_amount := COALESCE(NEW.total_amount, 0);
  v_tenant_id := COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000001');

  -- INSERT: post immediately if invoice is paid or sent (e.g. POS)
  IF TG_OP = 'INSERT' AND NEW.status IN ('paid', 'sent', 'partial') THEN
    v_should_post := true;
  END IF;

  -- UPDATE: only post on first status transition from draft
  IF TG_OP = 'UPDATE'
    AND NEW.status IN ('sent', 'paid', 'partial')
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger to fire on both INSERT and UPDATE
DROP TRIGGER IF EXISTS invoice_accounting ON invoices;
CREATE TRIGGER invoice_accounting
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoice_accounting_trigger();

-- =============================================================
-- Fix 2: Payment trigger — also handle purchase payments (payment_type = 'made')
-- =============================================================
CREATE OR REPLACE FUNCTION payment_accounting_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id uuid;
  v_account_code text;
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
    PERFORM post_journal_entry(
      p_description := 'Payment received - ' || COALESCE(NEW.payment_number, NEW.id::text),
      p_lines := jsonb_build_array(
        jsonb_build_object('account_code', v_account_code, 'debit', NEW.amount, 'description', 'Payment received via ' || COALESCE(NEW.payment_method, 'cash')),
        jsonb_build_object('account_code', '1100', 'credit', NEW.amount, 'description', 'Accounts Receivable cleared')
      ),
      p_entry_date := COALESCE(NEW.payment_date, CURRENT_DATE),
      p_reference_type := 'payment',
      p_reference_id := NEW.id,
      p_tenant_id := v_tenant_id
    );
  ELSIF NEW.payment_type = 'made' THEN
    -- Supplier payment: debit AP, credit cash/bank
    PERFORM post_journal_entry(
      p_description := 'Payment made - ' || COALESCE(NEW.payment_number, NEW.id::text),
      p_lines := jsonb_build_array(
        jsonb_build_object('account_code', '2000', 'debit', NEW.amount, 'description', 'Accounts Payable reduced'),
        jsonb_build_object('account_code', v_account_code, 'credit', NEW.amount, 'description', 'Payment made via ' || COALESCE(NEW.payment_method, 'cash'))
      ),
      p_entry_date := COALESCE(NEW.payment_date, CURRENT_DATE),
      p_reference_type := 'payment',
      p_reference_id := NEW.id,
      p_tenant_id := v_tenant_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- Fix 3: Post COGS when a sale invoice is created/confirmed
-- Fires after invoice_accounting so AR/Revenue is already posted
-- Only posts if avg cost data is available from inventory
-- =============================================================
CREATE OR REPLACE FUNCTION invoice_cogs_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id uuid;
  v_cogs_total decimal(15,2) := 0;
  v_item record;
BEGIN
  v_tenant_id := COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000001');

  -- Only run on invoice confirmation (same conditions as revenue posting)
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status IN ('paid', 'sent', 'partial')) OR
    (TG_OP = 'UPDATE' AND NEW.status IN ('sent', 'paid', 'partial') AND OLD.status = 'draft')
  ) THEN
    RETURN NEW;
  END IF;

  -- Sum COGS from invoice_items × product cost_price
  SELECT COALESCE(SUM(ii.quantity * p.cost_price), 0) INTO v_cogs_total
  FROM invoice_items ii
  JOIN products p ON p.id = ii.product_id
  WHERE ii.invoice_id = NEW.id
    AND p.cost_price > 0;

  IF v_cogs_total > 0 THEN
    PERFORM post_journal_entry(
      p_description := 'COGS - Invoice #' || NEW.invoice_number,
      p_lines := jsonb_build_array(
        jsonb_build_object('account_code', '5000', 'debit', v_cogs_total, 'description', 'Cost of Goods Sold'),
        jsonb_build_object('account_code', '1200', 'credit', v_cogs_total, 'description', 'Inventory reduced')
      ),
      p_entry_date := COALESCE(NEW.invoice_date, CURRENT_DATE),
      p_reference_type := 'invoice',
      p_reference_id := NEW.id,
      p_tenant_id := v_tenant_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS invoice_cogs ON invoices;
CREATE TRIGGER invoice_cogs
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoice_cogs_trigger();

-- =============================================================
-- Fix 4: GRN trigger — post AP when goods received
-- =============================================================
CREATE OR REPLACE FUNCTION grn_accounting_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id uuid;
  v_total_cost decimal(15,2);
  v_po_number text;
BEGIN
  v_tenant_id := COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000001');

  IF TG_OP = 'UPDATE' AND NEW.status = 'posted' AND OLD.status != 'posted' THEN
    SELECT COALESCE(SUM(poi.received_quantity * poi.unit_cost), 0), po.po_number
    INTO v_total_cost, v_po_number
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    WHERE poi.purchase_order_id = NEW.purchase_order_id;

    IF v_total_cost > 0 THEN
      PERFORM post_journal_entry(
        p_description := 'Goods Received - GRN #' || NEW.grn_number || COALESCE(' / PO #' || v_po_number, ''),
        p_lines := jsonb_build_array(
          jsonb_build_object('account_code', '1200', 'debit', v_total_cost, 'description', 'Inventory received'),
          jsonb_build_object('account_code', '2000', 'credit', v_total_cost, 'description', 'Accounts Payable - goods received')
        ),
        p_entry_date := COALESCE(NEW.receipt_date, CURRENT_DATE),
        p_reference_type := 'grn',
        p_reference_id := NEW.id,
        p_tenant_id := v_tenant_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS grn_accounting ON goods_receipt_notes;
CREATE TRIGGER grn_accounting
  AFTER UPDATE ON goods_receipt_notes
  FOR EACH ROW EXECUTE FUNCTION grn_accounting_trigger();
