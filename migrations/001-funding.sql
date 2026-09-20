CREATE TABLE IF NOT EXISTS funding_pool (
 id boolean PRIMARY KEY DEFAULT true CHECK (id), seconds bigint NOT NULL DEFAULT 0 CHECK (seconds >= 0)
);
INSERT INTO funding_pool(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS funding_orders (
 id uuid PRIMARY KEY, capability_hash text NOT NULL, reference text UNIQUE NOT NULL,
 recipient text NOT NULL, mint text NOT NULL, units bigint NOT NULL CHECK(units > 0),
 seconds integer NOT NULL CHECK(seconds > 0), created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, signature text UNIQUE, credited_at timestamptz
);
CREATE TABLE IF NOT EXISTS funding_usage (
 id uuid PRIMARY KEY, seconds integer NOT NULL CHECK(seconds > 0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION credit_funding(order_id uuid, tx_signature text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE o funding_orders; balance bigint;
BEGIN
 SELECT * INTO o FROM funding_orders WHERE id=order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown order'; END IF;
 IF o.signature IS NULL THEN
  UPDATE funding_orders SET signature=tx_signature, credited_at=now() WHERE id=order_id;
  UPDATE funding_pool SET seconds=seconds+o.seconds WHERE id=true;
 ELSIF o.signature <> tx_signature THEN RAISE EXCEPTION 'Receipt mismatch'; END IF;
 SELECT seconds INTO balance FROM funding_pool WHERE id=true;
 RETURN balance;
END $$;
-- The publisher reports completed broadcast segments with stable UUIDs.
-- It must stop before publishing a segment when the balance is insufficient.
-- Only ONE publisher may operate. A future live adapter must enforce this and
-- stop on API failure; this ledger alone is not a working streaming system.
CREATE OR REPLACE FUNCTION consume_funding(segment_id uuid, duration integer) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE balance bigint; previous integer;
BEGIN
 IF duration < 1 OR duration > 30 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
 SELECT seconds INTO balance FROM funding_pool WHERE id=true FOR UPDATE;
 SELECT seconds INTO previous FROM funding_usage WHERE id=segment_id;
 IF FOUND THEN
  IF previous <> duration THEN RAISE EXCEPTION 'Segment mismatch'; END IF;
  RETURN balance;
 END IF;
 IF balance < duration THEN RAISE EXCEPTION 'Insufficient time'; END IF;
 INSERT INTO funding_usage(id,seconds) VALUES(segment_id,duration);
 UPDATE funding_pool SET seconds=seconds-duration WHERE id=true RETURNING seconds INTO balance;
 RETURN balance;
END $$;
