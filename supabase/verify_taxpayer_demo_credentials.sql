-- Run in the Supabase SQL Editor for the same project configured in the frontend.
-- This reports only account status and a boolean password check; it never returns
-- password hashes or any other taxpayer records.
SELECT
  taxpayer_id,
  is_active,
  password_hash = crypt('taxpayer123', password_hash) AS demo_password_matches
FROM taxpayer_users
WHERE taxpayer_id IN ('TP-2026-0001', 'TP-2026-0002')
ORDER BY taxpayer_id;
