# Staff account setup

## Bootstrap the first administrator

The staff demo entries are not real Auth users and are no longer shown on the sign-in page. Create the first administrator once in the Supabase project used by the app:

1. In Supabase, open **Authentication → Users → Add user**. Enter the administrator's email and a strong password, and confirm the user if prompted.
2. In **SQL Editor**, replace the sample email and name below with that user's values and run the statement. It links the Auth identity to the seeded `admin` role and `ICT` office.

```sql
INSERT INTO public.staff_users (
  auth_id, email, full_name, office_id, role_id, is_active
)
SELECT
  auth_user.id,
  lower(auth_user.email),
  'First Administrator',
  office.id,
  role.id,
  true
FROM auth.users AS auth_user
JOIN public.offices AS office ON office.code = 'ICT'
JOIN public.staff_roles AS role ON role.code = 'admin'
WHERE lower(auth_user.email) = lower('admin@example.gov.ph')
ON CONFLICT (email) DO UPDATE SET
  auth_id = EXCLUDED.auth_id,
  full_name = EXCLUDED.full_name,
  office_id = EXCLUDED.office_id,
  role_id = EXCLUDED.role_id,
  is_active = true;
```

If the query inserts no row, apply the existing core-schema and seed-data migrations first, then retry. Do not add the administrator's password or the service-role key to this repository.

## Provision future staff

After bootstrapping, create staff from **User Management** while signed in as an active administrator. The `staff-management` Edge Function verifies the access token and checks the caller's active `admin` profile before using its server-side service-role key.

Apply database migrations and deploy the updated function to the same Supabase project used by the frontend. Store `SUPABASE_SERVICE_ROLE_KEY` only in Supabase function secrets. The frontend must use the matching project's URL and public anon key in its environment.
