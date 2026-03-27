/*
  # Add etiqueta_caliente to leads

  ## Summary
  Adds a heat indicator column to the leads table so the system can automatically
  mark high-intent families when they open a proposal more than 3 times.

  ## Changes
  - `leads.etiqueta_caliente` (text, nullable) — e.g. 'interesado_activo'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'etiqueta_caliente'
  ) THEN
    ALTER TABLE leads ADD COLUMN etiqueta_caliente text DEFAULT NULL;
  END IF;
END $$;
