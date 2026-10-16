-- Limit the Administrator role to configuration and user management.
UPDATE public.staff_roles
SET
  description = 'Configuration and user management only',
  permissions = ARRAY['configuration', 'user_management']::text[]
WHERE code = 'admin';