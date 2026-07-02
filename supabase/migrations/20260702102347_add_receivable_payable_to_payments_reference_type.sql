-- Add 'receivable' and 'payable' to the payments reference_type check constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_reference_type_check;

ALTER TABLE payments ADD CONSTRAINT payments_reference_type_check
  CHECK (reference_type IN ('invoice', 'purchase_order', 'advance', 'refund', 'receivable', 'payable'));