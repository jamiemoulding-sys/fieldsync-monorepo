-- Official private payslip storage and metadata.

CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  gross_pay numeric(12, 2) NOT NULL DEFAULT 0,
  net_pay numeric(12, 2) NOT NULL DEFAULT 0,
  hours_worked numeric(10, 2) NOT NULL DEFAULT 0,
  file_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT payslips_period_valid CHECK (pay_period_end >= pay_period_start),
  CONSTRAINT payslips_file_path_not_public CHECK (file_path !~* '^https?://')
);

CREATE INDEX IF NOT EXISTS idx_payslips_company_period
  ON public.payslips(company_id, pay_period_end DESC);

CREATE INDEX IF NOT EXISTS idx_payslips_employee_period
  ON public.payslips(employee_id, pay_period_end DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payslips_employee_period_unique
  ON public.payslips(employee_id, pay_period_start, pay_period_end);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

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

REVOKE ALL ON public.payslips FROM anon;
GRANT SELECT ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payslips',
  'payslips',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS payslip_files_employee_select_own ON storage.objects;
CREATE POLICY payslip_files_employee_select_own
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payslips'
    AND EXISTS (
      SELECT 1
      FROM public.payslips p
      WHERE p.file_path = storage.objects.name
      AND p.employee_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payslip_files_manager_select_company ON storage.objects;
CREATE POLICY payslip_files_manager_select_company
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payslips'
    AND EXISTS (
      SELECT 1
      FROM public.payslips p
      JOIN public.users u
        ON u.id = auth.uid()
      WHERE p.file_path = storage.objects.name
      AND u.company_id = p.company_id
      AND lower(COALESCE(u.role, 'employee')) IN ('manager', 'admin')
    )
  );

COMMENT ON TABLE public.payslips IS 'Official company-scoped payslip metadata for private PDF storage.';
COMMENT ON COLUMN public.payslips.file_path IS 'Private Supabase Storage object path in the payslips bucket, never a public URL.';
