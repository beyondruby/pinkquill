-- Add missing checkout draft fields for buyer contact/note capture.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS buyer_phone TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS buyer_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'orders'::regclass
      AND conname = 'orders_buyer_note_length_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_buyer_note_length_check
      CHECK (buyer_note IS NULL OR char_length(buyer_note) <= 500);
  END IF;
END $$;
