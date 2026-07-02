-- Add customer_id and supplier_id columns to journal_entries for better tracking
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_customer_id ON journal_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_supplier_id ON journal_entries(supplier_id);