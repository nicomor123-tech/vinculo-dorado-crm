/*
  # Add activity log and follow-up tasks

  ## Summary
  Adds two new tables to support a real follow-up system for sales advisors:
  - `activity_log`: automatic history of key events per lead
  - `lead_tasks`: manual follow-up tasks created by advisors

  ## New Tables

  ### activity_log
  Stores an immutable timeline of events on each lead.
  - `id` - UUID primary key
  - `lead_id` - foreign key to leads
  - `user_id` - who triggered the action (nullable for system events)
  - `tipo` - event type: 'lead_creado' | 'etapa_cambiada' | 'nota_agregada' | 'ejecutivo_asignado'
  - `descripcion` - human-readable summary
  - `metadata` - optional JSON for extra info (old/new stage, etc.)
  - `created_at` - timestamp of the event

  ### lead_tasks
  Follow-up tasks related to a lead.
  - `id` - UUID primary key
  - `lead_id` - foreign key to leads
  - `creado_por` - user who created the task
  - `titulo` - task title
  - `descripcion` - optional task description
  - `fecha_vencimiento` - due date
  - `estado` - 'pendiente' | 'completada'
  - `created_at`, `updated_at` - timestamps

  ## Security
  - RLS enabled on both tables
  - Authenticated users can read/write their own data and data on leads they can see
*/

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  descripcion text NOT NULL,
  metadata jsonb DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_lead_id ON activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activity log"
  ON activity_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activity log"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);


CREATE TABLE IF NOT EXISTS lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  creado_por uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text DEFAULT NULL,
  fecha_vencimiento date DEFAULT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead_id ON lead_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_creado_por ON lead_tasks(creado_por);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_estado ON lead_tasks(estado);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_fecha_vencimiento ON lead_tasks(fecha_vencimiento);

ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read lead tasks"
  ON lead_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert lead tasks"
  ON lead_tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creado_por);

CREATE POLICY "Task creator can update lead tasks"
  ON lead_tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = creado_por)
  WITH CHECK (auth.uid() = creado_por);

CREATE POLICY "Task creator can delete lead tasks"
  ON lead_tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = creado_por);


/*
  Backfill activity_log for existing leads:
  Insert a 'lead_creado' event for every lead that doesn't have one yet.
*/
INSERT INTO activity_log (lead_id, user_id, tipo, descripcion, created_at)
SELECT
  id,
  asesor_id,
  'lead_creado',
  'Lead registrado en el sistema',
  created_at
FROM leads
WHERE id NOT IN (SELECT lead_id FROM activity_log WHERE tipo = 'lead_creado');
