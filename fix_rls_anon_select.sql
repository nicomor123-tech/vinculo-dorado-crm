-- Allow anon role to SELECT leads and hogares in dev/demo mode
-- Run this in Supabase SQL Editor

CREATE POLICY "Allow anon select leads for dev"
  ON leads FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon select hogares for dev"
  ON hogares FOR SELECT TO anon USING (true);
