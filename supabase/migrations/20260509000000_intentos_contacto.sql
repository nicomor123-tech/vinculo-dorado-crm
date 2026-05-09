-- Migration: intentos_contacto + columnas de tracking en leads
-- Fecha: 2026-05-09
-- Nota: idempotente (IF NOT EXISTS). Seguro re-ejecutar.
--
-- Existe un placeholder previo (20260420000000_add_tracking_and_no_contesta.sql)
-- que indica que algo similar pudo haberse aplicado manualmente. Esta migration
-- es la versión canónica del repo y puede correrse aunque ya se haya aplicado
-- parcialmente, gracias a IF NOT EXISTS.

-- 1. Tabla intentos_contacto
CREATE TABLE IF NOT EXISTS intentos_contacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  fecha timestamptz DEFAULT now(),
  notas text
);

-- 2. Columnas de tracking en leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS intentos_fallidos int DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultimo_intento_fallido timestamptz;

-- 3. RLS
ALTER TABLE intentos_contacto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver intentos" ON intentos_contacto;
CREATE POLICY "Usuarios autenticados pueden ver intentos"
  ON intentos_contacto FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar intentos" ON intentos_contacto;
CREATE POLICY "Usuarios autenticados pueden insertar intentos"
  ON intentos_contacto FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
