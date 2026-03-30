-- ============================================================
-- COMMISSIONS MODULE — Vínculo Dorado CRM
-- ============================================================

-- 1. Add commission percentage to hogares
ALTER TABLE hogares ADD COLUMN IF NOT EXISTS porcentaje_comision numeric DEFAULT 40;

-- ============================================================
-- 2. Main commissions table
-- One record per closed lead (estado = cierre_ganado)
-- ============================================================
CREATE TABLE IF NOT EXISTS comisiones (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               uuid REFERENCES leads(id) ON DELETE SET NULL,
  hogar_id              uuid REFERENCES hogares(id) ON DELETE SET NULL,
  ejecutivo_id          uuid REFERENCES profiles(id) ON DELETE SET NULL,

  valor_primer_mes      numeric NOT NULL DEFAULT 0,          -- agreed first month payment
  porcentaje_vinculo    numeric NOT NULL DEFAULT 40,         -- % VD charges the hogar
  valor_comision_total  numeric NOT NULL DEFAULT 0,          -- valor_primer_mes * porcentaje_vinculo / 100
  valor_ejecutivo       numeric NOT NULL DEFAULT 0,          -- 30% of total
  valor_vinculo_dorado  numeric NOT NULL DEFAULT 0,          -- 70% of total

  estado_cobro          text NOT NULL DEFAULT 'pendiente'    -- pendiente | cobrado | parcial
                        CHECK (estado_cobro IN ('pendiente','cobrado','parcial')),

  fecha_generacion      timestamptz DEFAULT now(),
  fecha_cobro           timestamptz,
  notas                 text,

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Advances against a commission
-- ============================================================
CREATE TABLE IF NOT EXISTS adelantos_comision (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comision_id   uuid NOT NULL REFERENCES comisiones(id) ON DELETE CASCADE,
  ejecutivo_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  monto         numeric NOT NULL,
  fecha         timestamptz DEFAULT now(),
  aprobado_por  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notas         text,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- 4. History of % changes per hogar
-- ============================================================
CREATE TABLE IF NOT EXISTS historial_porcentaje_hogar (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id            uuid NOT NULL REFERENCES hogares(id) ON DELETE CASCADE,
  porcentaje_anterior numeric,
  porcentaje_nuevo    numeric NOT NULL,
  fecha_cambio        timestamptz DEFAULT now(),
  cambiado_por        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  motivo              text,
  created_at          timestamptz DEFAULT now()
);

-- ============================================================
-- 5. Row Level Security
-- ============================================================
ALTER TABLE comisiones                ENABLE ROW LEVEL SECURITY;
ALTER TABLE adelantos_comision        ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_porcentaje_hogar ENABLE ROW LEVEL SECURITY;

-- comisiones policies
CREATE POLICY "auth_select_comisiones"
  ON comisiones FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_comisiones"
  ON comisiones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_comisiones"
  ON comisiones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_comisiones"
  ON comisiones FOR DELETE TO authenticated USING (true);

-- adelantos policies
CREATE POLICY "auth_select_adelantos"
  ON adelantos_comision FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_adelantos"
  ON adelantos_comision FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_adelantos"
  ON adelantos_comision FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_adelantos"
  ON adelantos_comision FOR DELETE TO authenticated USING (true);

-- historial policies
CREATE POLICY "auth_select_historial_pct"
  ON historial_porcentaje_hogar FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_historial_pct"
  ON historial_porcentaje_hogar FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 6. Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_comisiones_lead_id     ON comisiones(lead_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_ejecutivo_id ON comisiones(ejecutivo_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_estado_cobro ON comisiones(estado_cobro);
CREATE INDEX IF NOT EXISTS idx_adelantos_comision_id   ON adelantos_comision(comision_id);
CREATE INDEX IF NOT EXISTS idx_historial_hogar_id      ON historial_porcentaje_hogar(hogar_id);
