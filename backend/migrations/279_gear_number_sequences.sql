-- Migration 279: Sequences for gear rental quote and order numbers
-- Fixes race condition in COUNT(*)+1 number generation (Critical #3)

-- Quote number sequence
CREATE SEQUENCE IF NOT EXISTS gear_quote_number_seq;

-- Initialize to current max to avoid conflicts with existing records
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN quote_number ~ '^Q-[0-9]+$' THEN
        regexp_replace(quote_number, '[^0-9]', '', 'g')::integer
      ELSE 0
    END
  ), 0) INTO max_num
  FROM gear_rental_quotes;

  IF max_num > 0 THEN
    PERFORM setval('gear_quote_number_seq', max_num);
  END IF;
END $$;

-- Order number sequence
CREATE SEQUENCE IF NOT EXISTS gear_order_number_seq;

DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN order_number ~ '^RO-[0-9]+$' THEN
        regexp_replace(order_number, '[^0-9]', '', 'g')::integer
      ELSE 0
    END
  ), 0) INTO max_num
  FROM gear_rental_orders;

  IF max_num > 0 THEN
    PERFORM setval('gear_order_number_seq', max_num);
  END IF;
END $$;
