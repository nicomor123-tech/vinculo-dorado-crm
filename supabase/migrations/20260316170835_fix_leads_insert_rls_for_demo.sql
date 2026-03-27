/*
  # Fix leads INSERT RLS for demo/dev mode

  ## Problem
  The existing INSERT policy only allows `authenticated` role.
  In development mode, the Supabase client has no real auth session,
  so requests are made as `anon`, which is blocked by the current policy.

  ## Changes
  - Drop the existing INSERT policy
  - Re-create it to allow both `authenticated` and `anon` roles to insert leads
  - This is safe for a demo/development environment

  ## Note
  The asesor_id FK on leads references profiles.id. The dev-mode user ID
  has been updated to match the real demo profile UUID, preventing FK violations.
*/

DROP POLICY IF EXISTS "Authenticated users can insert leads" ON leads;

CREATE POLICY "Allow insert leads for authenticated and anon"
  ON leads
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);
