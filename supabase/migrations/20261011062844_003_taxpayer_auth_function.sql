/*
# Taxpayer Password Verification Function

Creates a SECURITY DEFINER function to verify taxpayer passwords using
PostgreSQL's crypt() function. This allows the edge function to verify
taxpayer login credentials without exposing password hashes to the client.

## Security
- SECURITY DEFINER: runs with elevated privileges to access password_hash
- Returns only a boolean — never exposes the hash
- Inputs are sanitized via parameterized query
*/

CREATE OR REPLACE FUNCTION verify_taxpayer_password(
  input_taxpayer_id text,
  input_password text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM taxpayer_users
  WHERE taxpayer_id = input_taxpayer_id AND is_active = true;

  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN stored_hash = extensions.crypt(input_password, stored_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION verify_taxpayer_password(text, text) TO authenticated;
