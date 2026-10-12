# Taxpayer portal authentication deployment

The taxpayer portal sign-in depends on three independently deployed pieces: the web app, the Supabase database migrations, and the `taxpayer-auth` Edge Function. Publishing the web app alone does not update demo account passwords or the backend login handler.

## Supplied demo credentials

- `TP-2026-0001` / `taxpayer123`
- `TP-2026-0002` / `taxpayer123`

Taxpayer IDs are trimmed and treated as case-insensitive during sign-in. Passwords remain case-sensitive.

## Deployment checklist

1. Confirm the frontend `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong to the intended Supabase project. Rebuild/redeploy the frontend after changing either value.
2. Link the Supabase CLI to that same project and apply pending migrations, including `20261012090000_004_taxpayer_sessions_and_demo_credentials.sql`. This migration upserts the two published demo accounts with the documented password and creates the taxpayer session table:

   ```sh
   supabase link --project-ref <project-ref>
   supabase migration list
   supabase db push
   ```

3. Deploy the `taxpayer-auth` Edge Function to the same project. The repository config disables platform JWT verification for this function because it validates its own action-specific credentials and opaque taxpayer session tokens:

   ```sh
   supabase functions deploy taxpayer-auth
   ```
4. In that project's SQL Editor, run [`verify_taxpayer_demo_credentials.sql`](verify_taxpayer_demo_credentials.sql). It returns only whether each demo account is active and whether the documented demo password matches; it never returns password hashes. Both rows should appear with `is_active` and `demo_password_matches` set to `true`.
5. Retry with one of the exact demo ID/password pairs above. If the generic invalid-credentials response persists, check that the migration and function were deployed to the project identified by the frontend URL. The unauthenticated response intentionally does not reveal whether an account exists.

A successful source change or frontend deployment is not evidence that the remote database migration or Edge Function is up to date. Confirm those deployments in the Supabase project dashboard or CLI before treating the login issue as resolved.

## Staff demo sign-in

The staff demo email/password pairs shown on the sign-in screen are not provisioned by the SQL seed migrations. The migrations create roles and offices, but Supabase Auth users and `staff_users` profiles must also exist for staff login to work.

Run the following one-time script only against a development/demo Supabase project after applying the migrations. It creates or updates the six published demo Auth users and upserts their staff profiles with the matching role and office. It requires the privileged service-role key and refuses to run without the explicit confirmation flag. Keep that key out of the browser and repository.

In PowerShell, from the repository root:

```powershell
$env:SUPABASE_URL = 'https://<project-ref>.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = '<service-role-key>'
node scripts/provision-demo-staff.mjs --confirm-demo-project
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
```

The script resets the listed demo passwords when matching Auth users already exist. Do not run it against production identities. Once it completes, sign in with one of the demo account pairs shown in `src/lib/constants.ts`.
