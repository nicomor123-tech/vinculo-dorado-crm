/*
  # Fix nombre_adulto_mayor NOT NULL + ensure profiles.activo column

  ## Problems
  1. nombre_adulto_mayor was NOT NULL but families often don't know the name yet
  2. profiles.activo column is used in code but missing from migrations

  ## Fixes
  - Drop NOT NULL on nombre_adulto_mayor
  - Add activo column to profiles if missing (defaults to true)
*/

ALTER TABLE leads ALTER COLUMN nombre_adulto_mayor DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'activo'
  ) THEN
    ALTER TABLE profiles ADD COLUMN activo boolean DEFAULT true;
  END IF;
END $$;
