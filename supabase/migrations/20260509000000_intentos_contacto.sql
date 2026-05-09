-- Migration: intentos_contacto + columnas de tracking en leads
-- Fecha: 2026-05-09
-- Nota: idempotente (IF NOT EXISTS). Seguro re-ejecutar.
--
-- Schema actualizado para reflejar el estado REAL en producción:
-- - columna `nota` (singular, no `notas`)
-- - columna `created_at` (no `fecha`)
-- - columna `canal` con default 'llamada'
-- Verificado en producción 2026-05-09 vía PostgREST probe.
--
-- La tabla ya está creada y poblada en Supabase desde el deploy
-- manual del 21-abr-2026. Esta migration es la versión canónica del
-- repo y puede correrse de forma segura aunque la tabla ya exista.

-- 1. Tabla intentos_contacto (schema actual de producción)
CREATE TABLE IF NOT EXISTS intentos_contacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  canal text DEFAULT 'llamada',
  nota text,
  created_at timestamptz DEFAULT now()
);

-- Por si la tabla existe pero alguna columna falta:
ALTER TABLE intentos_contacto ADD COLUMN IF NOT EXISTS canal text DEFAULT 'llamada';
ALTER TABLE intentos_contacto ADD COLUMN IF NOT EXISTS nota text;
ALTER TABLE intentos_contacto ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

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
