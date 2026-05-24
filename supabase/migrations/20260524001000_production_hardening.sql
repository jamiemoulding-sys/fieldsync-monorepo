-- Production hardening for backend-authoritative data access.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.shift_route_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.shift_route_logs FROM authenticated;
GRANT SELECT ON TABLE public.shift_route_logs TO authenticated;
GRANT ALL ON TABLE public.shift_route_logs TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.payroll_exports FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.payroll_exports FROM authenticated;
GRANT SELECT ON TABLE public.payroll_exports TO authenticated;
GRANT ALL ON TABLE public.payroll_exports TO service_role;

REVOKE ALL ON TABLE public.payslips FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.payslips FROM authenticated;
GRANT SELECT ON TABLE public.payslips TO authenticated;
GRANT ALL ON TABLE public.payslips TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.shifts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.shifts FROM authenticated;
GRANT SELECT ON TABLE public.shifts TO authenticated;
GRANT ALL ON TABLE public.shifts TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.schedules FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.schedules FROM authenticated;
GRANT SELECT ON TABLE public.schedules TO authenticated;
GRANT ALL ON TABLE public.schedules TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.holidays FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.holidays FROM authenticated;
GRANT SELECT ON TABLE public.holidays TO authenticated;
GRANT ALL ON TABLE public.holidays TO service_role;

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

DROP POLICY IF EXISTS payroll_exports_manager_select_company ON public.payroll_exports;
CREATE POLICY payroll_exports_manager_select_company
  ON public.payroll_exports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
      AND u.company_id = payroll_exports.company_id
      AND lower(COALESCE(u.role, 'employee')) IN ('manager', 'admin')
    )
  );
