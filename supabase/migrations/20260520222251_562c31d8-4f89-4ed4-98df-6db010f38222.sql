-- Allow unit admins (authenticated) to insert profit distribution runs so bagi hasil can be executed from unit pages (USP, etc).
-- Read & pusat full-access already exist. We add a permissive insert policy for authenticated users.

DROP POLICY IF EXISTS pdr_auth_insert ON public.profit_distribution_runs;
CREATE POLICY pdr_auth_insert
  ON public.profit_distribution_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
