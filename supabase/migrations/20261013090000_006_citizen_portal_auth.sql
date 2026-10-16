-- Move citizen sign-in to Supabase Auth, connect a verified email identity
-- to an existing municipal taxpayer record, and scope citizen reads to linked data.

ALTER TABLE public.taxpayer_users
  ADD COLUMN IF NOT EXISTS auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS taxpayer_users_auth_id_uidx
  ON public.taxpayer_users(auth_id) WHERE auth_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.taxpayer_property_access (
  taxpayer_user_id uuid NOT NULL REFERENCES public.taxpayer_users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (taxpayer_user_id, property_id)
);
ALTER TABLE public.taxpayer_property_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_staff_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users staff
    WHERE staff.auth_id = auth.uid() AND staff.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_taxpayer_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT taxpayer.id
  FROM public.taxpayer_users taxpayer
  WHERE taxpayer.auth_id = auth.uid() AND taxpayer.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_access_taxpayer_property(target_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_staff_user() OR EXISTS (
    SELECT 1 FROM public.taxpayer_property_access access
    WHERE access.taxpayer_user_id = public.current_taxpayer_user_id()
      AND access.property_id = target_property_id
  );
$$;

CREATE OR REPLACE FUNCTION public.link_taxpayer_properties(target_taxpayer_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_count integer;
BEGIN
  INSERT INTO public.taxpayer_property_access (taxpayer_user_id, property_id)
  SELECT target_taxpayer_user_id, interest.property_id
  FROM public.taxpayer_users taxpayer
  JOIN public.parties party
    ON lower(trim(party.email)) = lower(trim(taxpayer.email))
  JOIN public.property_interests interest ON interest.party_id = party.id
  WHERE taxpayer.id = target_taxpayer_user_id
    AND taxpayer.is_active = true
    AND taxpayer.email IS NOT NULL
  ON CONFLICT (taxpayer_user_id, property_id) DO NOTHING;
  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RETURN linked_count;
END;
$$;

REVOKE ALL ON FUNCTION public.is_active_staff_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_taxpayer_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_taxpayer_property(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_taxpayer_properties(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_staff_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_taxpayer_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_taxpayer_property(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_taxpayer_properties(uuid) TO service_role;

-- Remove the starter schema's broad authenticated/anonymous policies.
DO $$
DECLARE
  policy_row record;
  table_name text;
  app_tables text[] := ARRAY[
    'jurisdictions', 'offices', 'staff_roles', 'staff_users', 'taxpayer_users',
    'valuation_schedules', 'assessment_levels', 'tax_rates', 'discount_rules',
    'due_dates', 'levy_types', 'compliance_calendar', 'parties', 'properties',
    'property_units', 'property_interests', 'property_lineage', 'valuation_worksheets',
    'assessments', 'tax_charges', 'tax_adjustments', 'payments',
    'payment_allocations', 'receipts', 'cash_sessions', 'cases'
  ];
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(app_tables)
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;

  FOREACH table_name IN ARRAY app_tables LOOP
    IF table_name IN ('staff_users', 'staff_roles') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_active_staff_user())',
        'staff_read_' || table_name, table_name
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_active_staff_admin())',
        'admin_insert_' || table_name, table_name
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_active_staff_admin()) WITH CHECK (public.is_active_staff_admin())',
        'admin_update_' || table_name, table_name
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_active_staff_admin())',
        'admin_delete_' || table_name, table_name
      );
    ELSIF table_name = 'taxpayer_users' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_active_staff_admin())',
        'admin_read_' || table_name, table_name
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_active_staff_admin())',
        'admin_insert_' || table_name, table_name
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_active_staff_admin()) WITH CHECK (public.is_active_staff_admin())',
        'admin_update_' || table_name, table_name
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_active_staff_admin())',
        'admin_delete_' || table_name, table_name
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_active_staff_user()) WITH CHECK (public.is_active_staff_user())',
        'staff_manage_' || table_name, table_name
      );
    END IF;
  END LOOP;
END $$;

-- Citizens can only read their own profile and the property/financial records
-- explicitly mapped to that profile. Writes remain staff-only.
CREATE POLICY citizen_read_own_taxpayer ON public.taxpayer_users
  FOR SELECT TO authenticated USING (auth_id = auth.uid() AND is_active = true);

CREATE POLICY citizen_read_linked_properties ON public.properties
  FOR SELECT TO authenticated USING (public.can_access_taxpayer_property(id));
CREATE POLICY citizen_read_linked_units ON public.property_units
  FOR SELECT TO authenticated USING (public.can_access_taxpayer_property(property_id));
CREATE POLICY citizen_read_linked_assessments ON public.assessments
  FOR SELECT TO authenticated USING (public.can_access_taxpayer_property(property_id));
CREATE POLICY citizen_read_linked_charges ON public.tax_charges
  FOR SELECT TO authenticated USING (public.can_access_taxpayer_property(property_id));
CREATE POLICY citizen_read_own_payments ON public.payments
  FOR SELECT TO authenticated USING (
    taxpayer_id = public.current_taxpayer_user_id()
    OR public.can_access_taxpayer_property(property_id)
  );
CREATE POLICY citizen_read_own_allocations ON public.payment_allocations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.payments payment
      WHERE payment.id = payment_id
        AND (payment.taxpayer_id = public.current_taxpayer_user_id()
          OR public.can_access_taxpayer_property(payment.property_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.tax_charges charge
      WHERE charge.id = tax_charge_id AND public.can_access_taxpayer_property(charge.property_id)
    )
  );
CREATE POLICY citizen_read_own_receipts ON public.receipts
  FOR SELECT TO authenticated USING (
    public.can_access_taxpayer_property(property_id)
    OR EXISTS (
      SELECT 1 FROM public.payments payment
      WHERE payment.id = payment_id AND payment.taxpayer_id = public.current_taxpayer_user_id()
    )
  );
CREATE POLICY citizen_read_barangays ON public.jurisdictions
  FOR SELECT TO anon, authenticated USING (true);

-- The previous custom-password verifier is no longer an authentication path.
REVOKE ALL ON FUNCTION public.verify_taxpayer_password(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_taxpayer_password(text, text) FROM anon, authenticated;
DROP FUNCTION IF EXISTS public.verify_taxpayer_password(text, text);
ALTER TABLE public.taxpayer_users DROP COLUMN IF EXISTS password_hash;
