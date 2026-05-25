-- Production hardening phase 1.
--
-- This migration only locks down flows that are already backend-authoritative.
-- Broader write revokes for shifts, schedules, holidays, companies, and users
-- are intentionally deferred until remaining direct client writes are migrated.

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_route_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- No unauthenticated access to sensitive company/workforce data.
REVOKE ALL ON TABLE public.payslips FROM anon;
REVOKE ALL ON TABLE public.shift_route_logs FROM anon;
REVOKE ALL ON TABLE public.shifts FROM anon;
REVOKE ALL ON TABLE public.schedules FROM anon;
REVOKE ALL ON TABLE public.holidays FROM anon;
REVOKE ALL ON TABLE public.companies FROM anon;
REVOKE ALL ON TABLE public.users FROM anon;

-- Payslips are official payroll records. All writes go through the backend.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.payslips FROM authenticated;
GRANT SELECT ON TABLE public.payslips TO authenticated;
GRANT ALL ON TABLE public.payslips TO service_role;

DROP POLICY IF EXISTS payslips_employee_select_own ON public.payslips;
CREATE POLICY payslips_employee_select_own
  ON public.payslips
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

DROP POLICY IF EXISTS payslips_manager_select_company ON public.payslips;
CREATE POLICY payslips_manager_select_company
  ON public.payslips
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
      AND u.company_id = payslips.company_id
      AND lower(COALESCE(u.role, 'employee')) IN ('manager', 'admin')
    )
  );

-- Mobile tracking pings now write through POST /api/tracking/pings.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.shift_route_logs FROM authenticated;
GRANT SELECT ON TABLE public.shift_route_logs TO authenticated;
GRANT ALL ON TABLE public.shift_route_logs TO service_role;

DROP POLICY IF EXISTS "route company read" ON public.shift_route_logs;
DROP POLICY IF EXISTS shift_route_logs_employee_select_own ON public.shift_route_logs;
CREATE POLICY shift_route_logs_employee_select_own
  ON public.shift_route_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS shift_route_logs_manager_select_company ON public.shift_route_logs;
CREATE POLICY shift_route_logs_manager_select_company
  ON public.shift_route_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
      AND u.company_id = shift_route_logs.company_id
      AND lower(COALESCE(u.role, 'employee')) IN ('manager', 'admin')
    )
  );

-- Keep client reads scoped while write migration continues.
GRANT SELECT ON TABLE public.shifts TO authenticated;
GRANT SELECT ON TABLE public.schedules TO authenticated;
GRANT SELECT ON TABLE public.holidays TO authenticated;
GRANT SELECT ON TABLE public.companies TO authenticated;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.shifts TO service_role;
GRANT ALL ON TABLE public.schedules TO service_role;
GRANT ALL ON TABLE public.holidays TO service_role;
GRANT ALL ON TABLE public.companies TO service_role;
GRANT ALL ON TABLE public.users TO service_role;

DROP POLICY IF EXISTS "Users can insert shifts" ON public.shifts;
DROP POLICY IF EXISTS "Users can update their shifts" ON public.shifts;
DROP POLICY IF EXISTS "Users can view their shifts" ON public.shifts;
DROP POLICY IF EXISTS "allow read" ON public.users;

DROP POLICY IF EXISTS companies_select_own ON public.companies;
CREATE POLICY companies_select_own
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR id = (
      SELECT u.company_id
      FROM public.users u
      WHERE u.id = auth.uid()
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS users_select_company ON public.users;
CREATE POLICY users_select_company
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR company_id = (
      SELECT u.company_id
      FROM public.users u
      WHERE u.id = auth.uid()
      LIMIT 1
    )
  );
