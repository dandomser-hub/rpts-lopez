-- Staff profile and role administration must be limited to active administrators.
-- SECURITY DEFINER avoids recursive RLS when the helper checks staff_users.
CREATE OR REPLACE FUNCTION public.is_active_staff_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_users AS staff
    JOIN public.staff_roles AS role ON role.id = staff.role_id
    WHERE staff.auth_id = auth.uid()
      AND staff.is_active = true
      AND role.code = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_staff_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_staff_admin() TO authenticated;

DROP POLICY IF EXISTS "insert_staff_users" ON public.staff_users;
CREATE POLICY "insert_staff_users" ON public.staff_users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff_admin());

DROP POLICY IF EXISTS "update_staff_users" ON public.staff_users;
CREATE POLICY "update_staff_users" ON public.staff_users
  FOR UPDATE TO authenticated
  USING (public.is_active_staff_admin())
  WITH CHECK (public.is_active_staff_admin());

DROP POLICY IF EXISTS "delete_staff_users" ON public.staff_users;
CREATE POLICY "delete_staff_users" ON public.staff_users
  FOR DELETE TO authenticated
  USING (public.is_active_staff_admin());

DROP POLICY IF EXISTS "insert_staff_roles" ON public.staff_roles;
CREATE POLICY "insert_staff_roles" ON public.staff_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff_admin());

DROP POLICY IF EXISTS "update_staff_roles" ON public.staff_roles;
CREATE POLICY "update_staff_roles" ON public.staff_roles
  FOR UPDATE TO authenticated
  USING (public.is_active_staff_admin())
  WITH CHECK (public.is_active_staff_admin());

DROP POLICY IF EXISTS "delete_staff_roles" ON public.staff_roles;
CREATE POLICY "delete_staff_roles" ON public.staff_roles
  FOR DELETE TO authenticated
  USING (public.is_active_staff_admin());
