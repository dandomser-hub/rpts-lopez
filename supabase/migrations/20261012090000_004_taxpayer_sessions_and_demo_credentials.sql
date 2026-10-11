-- Link taxpayer accounts to the party records that own their properties.
ALTER TABLE taxpayer_users
  ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES parties(id);

-- Keep the published demo IDs and password synchronized with the live database.
-- This upsert is limited to the two explicit demo accounts.
INSERT INTO taxpayer_users (
  taxpayer_id, full_name, email, phone, address, party_id, password_hash, is_active
)
VALUES
  (
    'TP-2026-0001', 'Juan dela Cruz Santos', 'juan.santos@email.com', '0917-123-4567',
    'Brgy. Poblacion, Lopez, Quezon',
    (SELECT id FROM parties WHERE email = 'juan.santos@email.com' ORDER BY created_at LIMIT 1),
    crypt('taxpayer123', gen_salt('bf')), true
  ),
  (
    'TP-2026-0002', 'Lopez Trading Corporation', 'info@lopeztrading.com', '042-123-4567',
    'Brgy. Magallanes, Lopez, Quezon',
    (SELECT id FROM parties WHERE email = 'info@lopeztrading.com' ORDER BY created_at LIMIT 1),
    crypt('taxpayer123', gen_salt('bf')), true
  )
ON CONFLICT (taxpayer_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  party_id = EXCLUDED.party_id,
  password_hash = EXCLUDED.password_hash,
  is_active = true;

-- Opaque, expiring portal sessions. Only the service role may read or modify them.
CREATE TABLE IF NOT EXISTS taxpayer_sessions (
  token_hash text PRIMARY KEY,
  taxpayer_user_id uuid NOT NULL REFERENCES taxpayer_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_taxpayer_sessions_user_expiry
  ON taxpayer_sessions (taxpayer_user_id, expires_at);

ALTER TABLE taxpayer_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE taxpayer_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE taxpayer_sessions TO service_role;

-- The Edge Function verifies passwords with the service-role client.
REVOKE EXECUTE ON FUNCTION verify_taxpayer_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_taxpayer_password(text, text) TO service_role;
