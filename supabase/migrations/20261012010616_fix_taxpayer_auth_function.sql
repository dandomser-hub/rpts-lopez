-- Fix verify_taxpayer_password:
-- 1. Add extensions to search_path so crypt() resolves (pgcrypto lives in extensions schema on Supabase).
-- 2. Use lower(trim()) on both sides so Taxpayer ID matching is case-insensitive and whitespace-trimmed.
-- 3. Re-grant execute to service_role only (edge function uses the service-role client).
DROP FUNCTION IF EXISTS verify_taxpayer_password(text, text);

CREATE OR REPLACE FUNCTION verify_taxpayer_password(
  input_taxpayer_id text,
  input_password text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM taxpayer_users
  WHERE lower(trim(taxpayer_id)) = lower(trim(input_taxpayer_id))
    AND is_active = true;

  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN stored_hash = crypt(input_password, stored_hash);
END;
$$;

REVOKE EXECUTE ON FUNCTION verify_taxpayer_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_taxpayer_password(text, text) TO service_role;