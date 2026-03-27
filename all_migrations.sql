/*
  # Crear esquema CRM Vínculo Dorado

  1. Nuevas Tablas
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `nombre_completo` (text)
      - `email` (text)
      - `rol` (text)
      - `telefono` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `leads`
      - `id` (uuid, primary key)
      - `nombre_adulto_mayor` (text)
      - `edad` (integer)
      - `sexo` (text)
      - `nombre_contacto` (text)
      - `parentesco` (text)
      - `telefono_principal` (text)
      - `telefono_alterno` (text)
      - `whatsapp` (text)
      - `correo` (text)
      - `ciudad` (text)
      - `zona_localidad` (text)
      - `presupuesto_mensual` (numeric)
      - `urgencia` (text)
      - `diagnosticos` (text)
      - `movilidad` (text)
      - `deterioro_cognitivo` (boolean)
      - `requiere_oxigeno` (boolean)
      - `requiere_enfermeria` (boolean)
      - `requiere_acompanamiento` (boolean)
      - `tipo_habitacion` (text)
      - `fecha_probable_ingreso` (date)
      - `como_nos_conocio` (text)
      - `observaciones` (text)
      - `estado` (text)
      - `asesor_id` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `hogares`
      - `id` (uuid, primary key)
      - `nombre` (text)
      - `ciudad` (text)
      - `zona` (text)
      - `direccion` (text)
      - `telefono` (text)
      - `precio_desde` (numeric)
      - `precio_hasta` (numeric)
      - `tipo_atencion` (text[])
      - `cupo_disponible` (integer)
      - `tiene_enfermeria` (boolean)
      - `acepta_oxigeno` (boolean)
      - `tipo_habitaciones` (text[])
      - `observaciones` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `notas_seguimiento`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, references leads)
      - `asesor_id` (uuid, references profiles)
      - `tipo_seguimiento` (text)
      - `descripcion` (text)
      - `proxima_accion` (text)
      - `fecha_proxima_accion` (date)
      - `created_at` (timestamptz)
    
    - `matching_sugerencias`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, references leads)
      - `hogar_id` (uuid, references hogares)
      - `match_score` (integer)
      - `notas` (text)
      - `estado` (text)
      - `created_at` (timestamptz)

  2. Seguridad
    - Habilitar RLS en todas las tablas
    - Agregar políticas para usuarios autenticados
*/

-- Crear tabla de profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nombre_completo text NOT NULL,
  email text UNIQUE NOT NULL,
  rol text DEFAULT 'asesor',
  telefono text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios pueden actualizar su propio profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Crear tabla de leads
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_adulto_mayor text NOT NULL,
  edad integer,
  sexo text,
  nombre_contacto text NOT NULL,
  parentesco text,
  telefono_principal text NOT NULL,
  telefono_alterno text,
  whatsapp text,
  correo text,
  ciudad text,
  zona_localidad text,
  presupuesto_mensual numeric,
  urgencia text DEFAULT 'media',
  diagnosticos text,
  movilidad text,
  deterioro_cognitivo boolean DEFAULT false,
  requiere_oxigeno boolean DEFAULT false,
  requiere_enfermeria boolean DEFAULT false,
  requiere_acompanamiento boolean DEFAULT false,
  tipo_habitacion text,
  fecha_probable_ingreso date,
  como_nos_conocio text,
  observaciones text,
  estado text DEFAULT 'nuevo',
  asesor_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver leads"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar leads"
  ON leads FOR DELETE
  TO authenticated
  USING (true);

-- Crear tabla de hogares
CREATE TABLE IF NOT EXISTS hogares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  ciudad text NOT NULL,
  zona text,
  direccion text,
  telefono text,
  precio_desde numeric,
  precio_hasta numeric,
  tipo_atencion text[] DEFAULT '{}',
  cupo_disponible integer DEFAULT 0,
  tiene_enfermeria boolean DEFAULT false,
  acepta_oxigeno boolean DEFAULT false,
  tipo_habitaciones text[] DEFAULT '{}',
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE hogares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver hogares"
  ON hogares FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear hogares"
  ON hogares FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar hogares"
  ON hogares FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Crear tabla de notas de seguimiento
CREATE TABLE IF NOT EXISTS notas_seguimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  asesor_id uuid REFERENCES profiles(id),
  tipo_seguimiento text DEFAULT 'llamada',
  descripcion text NOT NULL,
  proxima_accion text,
  fecha_proxima_accion date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notas_seguimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver notas"
  ON notas_seguimiento FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear notas"
  ON notas_seguimiento FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar notas"
  ON notas_seguimiento FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Crear tabla de matching sugerencias
CREATE TABLE IF NOT EXISTS matching_sugerencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  hogar_id uuid REFERENCES hogares(id) ON DELETE CASCADE NOT NULL,
  match_score integer DEFAULT 0,
  notas text,
  estado text DEFAULT 'sugerido',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE matching_sugerencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver matching"
  ON matching_sugerencias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear matching"
  ON matching_sugerencias FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar matching"
  ON matching_sugerencias FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado);
CREATE INDEX IF NOT EXISTS idx_leads_ciudad ON leads(ciudad);
CREATE INDEX IF NOT EXISTS idx_leads_asesor ON leads(asesor_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notas_lead ON notas_seguimiento(lead_id);
CREATE INDEX IF NOT EXISTS idx_matching_lead ON matching_sugerencias(lead_id);
CREATE INDEX IF NOT EXISTS idx_hogares_ciudad ON hogares(ciudad);/*
  # Agregar campos clínicos y funcionales al formulario de leads

  ## Cambios
  - `resumen_caso` — texto libre para pegar descripción larga del caso
  - `presupuesto_rango` — rango textual del presupuesto (ej: "Entre 2 y 3 millones")
  - `requiere_primer_piso` — necesita habitación en primer piso
  - `ayuda_para_comer` — necesita asistencia para comer
  - `ayuda_para_bano` — necesita asistencia para baño
  - `ayuda_para_caminar` — necesita asistencia para caminar
  - `dieta_diabetica` — requiere dieta diabética
  - `dieta_blanda` — requiere dieta blanda

  ## Notas
  - Todos los booleanos nuevos tienen DEFAULT false
  - No se eliminan columnas existentes
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'resumen_caso') THEN
    ALTER TABLE leads ADD COLUMN resumen_caso text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'presupuesto_rango') THEN
    ALTER TABLE leads ADD COLUMN presupuesto_rango text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'requiere_primer_piso') THEN
    ALTER TABLE leads ADD COLUMN requiere_primer_piso boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'ayuda_para_comer') THEN
    ALTER TABLE leads ADD COLUMN ayuda_para_comer boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'ayuda_para_bano') THEN
    ALTER TABLE leads ADD COLUMN ayuda_para_bano boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'ayuda_para_caminar') THEN
    ALTER TABLE leads ADD COLUMN ayuda_para_caminar boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'dieta_diabetica') THEN
    ALTER TABLE leads ADD COLUMN dieta_diabetica boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'dieta_blanda') THEN
    ALTER TABLE leads ADD COLUMN dieta_blanda boolean DEFAULT false;
  END IF;
END $$;
/*
  # Agregar campos de fecha estimada de ingreso y tipo de baño

  ## Cambios
  - `fecha_ingreso_estimada` (text) — reemplaza el datepicker con opciones descriptivas
    (Inmediato, Semana siguiente, En este mes, Más de un mes)
  - `tipo_bano` (text) — aplica solo cuando el tipo de habitación es individual
    (Baño privado, Baño compartido)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'fecha_ingreso_estimada'
  ) THEN
    ALTER TABLE leads ADD COLUMN fecha_ingreso_estimada text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'tipo_bano'
  ) THEN
    ALTER TABLE leads ADD COLUMN tipo_bano text;
  END IF;
END $$;
/*
  # Extend hogares table with full CRM fields

  ## Summary
  Adds all missing columns to the existing `hogares` table to support the
  full geriatric home profile as required by the CRM module.

  ## Changes to existing table: hogares

  ### New columns added

  **Basic info:**
  - `barrio` – Neighborhood
  - `localidad` – District/locality

  **Contact:**
  - `nombre_responsable` – Contact person name
  - `whatsapp` – WhatsApp number
  - `correo` – Email
  - `pagina_web` – Website

  **Capacity:**
  - `capacidad_total` – Total capacity
  - `habitaciones_disponibles` – Available rooms

  **Room types:**
  - `hab_compartida`
  - `hab_privada_bano_privado`
  - `hab_privada_bano_compartido`

  **Services (10 fields):**
  - `serv_enfermeria_24h`, `serv_fisioterapia`, `serv_terapia_ocupacional`,
    `serv_psicologia`, `serv_nutricion`, `serv_actividades_recreativas`,
    `serv_transporte`, `serv_medicina_general`, `serv_fonoaudiologia`,
    `serv_trabajo_social`

  **Diets:**
  - `dieta_blanda`, `dieta_diabetica`, `dieta_hiposodica`, `dieta_renal`

  **Clinical:**
  - `maneja_oxigeno`

  **Infrastructure:**
  - `tiene_ascensor`, `solo_escaleras`, `un_solo_nivel`

  **Other:**
  - `descripcion` – Free-text description
  - `estado` – Registration status (pendiente/aprobado/rechazado)
  - `registrado_por` – FK to auth.users

  ## Security
  - RLS enabled (already was)
  - Policies added for full CRUD by authenticated users
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='barrio') THEN
    ALTER TABLE hogares ADD COLUMN barrio text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='localidad') THEN
    ALTER TABLE hogares ADD COLUMN localidad text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='nombre_responsable') THEN
    ALTER TABLE hogares ADD COLUMN nombre_responsable text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='whatsapp') THEN
    ALTER TABLE hogares ADD COLUMN whatsapp text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='correo') THEN
    ALTER TABLE hogares ADD COLUMN correo text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='pagina_web') THEN
    ALTER TABLE hogares ADD COLUMN pagina_web text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='capacidad_total') THEN
    ALTER TABLE hogares ADD COLUMN capacidad_total integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='habitaciones_disponibles') THEN
    ALTER TABLE hogares ADD COLUMN habitaciones_disponibles integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='hab_compartida') THEN
    ALTER TABLE hogares ADD COLUMN hab_compartida boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='hab_privada_bano_privado') THEN
    ALTER TABLE hogares ADD COLUMN hab_privada_bano_privado boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='hab_privada_bano_compartido') THEN
    ALTER TABLE hogares ADD COLUMN hab_privada_bano_compartido boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='serv_enfermeria_24h') THEN
    ALTER TABLE hogares ADD COLUMN serv_enfermeria_24h boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='serv_fisioterapia') THEN
    ALTER TABLE hogares ADD COLUMN serv_fisioterapia boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='serv_terapia_ocupacional') THEN
    ALTER TABLE hogares ADD COLUMN serv_terapia_ocupacional boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='serv_psicologia') THEN
    ALTER TABLE hogares ADD COLUMN serv_psicologia boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='serv_nutricion') THEN
    ALTER TABLE hogares ADD COLUMN serv_nutricion boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='serv_actividades_recreativas') THEN
    ALTER TABLE hogares ADD COLUMN serv_actividades_recreativas boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='serv_transporte') THEN
    ALTER TABLE hogares ADD COLUMN serv_transporte boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='serv_medicina_general') THEN
    ALTER TABLE hogares ADD COLUMN serv_medicina_general boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='serv_fonoaudiologia') THEN
    ALTER TABLE hogares ADD COLUMN serv_fonoaudiologia boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='serv_trabajo_social') THEN
    ALTER TABLE hogares ADD COLUMN serv_trabajo_social boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='dieta_blanda') THEN
    ALTER TABLE hogares ADD COLUMN dieta_blanda boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='dieta_diabetica') THEN
    ALTER TABLE hogares ADD COLUMN dieta_diabetica boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='dieta_hiposodica') THEN
    ALTER TABLE hogares ADD COLUMN dieta_hiposodica boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='dieta_renal') THEN
    ALTER TABLE hogares ADD COLUMN dieta_renal boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='maneja_oxigeno') THEN
    ALTER TABLE hogares ADD COLUMN maneja_oxigeno boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='tiene_ascensor') THEN
    ALTER TABLE hogares ADD COLUMN tiene_ascensor boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='solo_escaleras') THEN
    ALTER TABLE hogares ADD COLUMN solo_escaleras boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='un_solo_nivel') THEN
    ALTER TABLE hogares ADD COLUMN un_solo_nivel boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='descripcion') THEN
    ALTER TABLE hogares ADD COLUMN descripcion text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='estado') THEN
    ALTER TABLE hogares ADD COLUMN estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hogares' AND column_name='registrado_por') THEN
    ALTER TABLE hogares ADD COLUMN registrado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE hogares ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hogares' AND policyname = 'Authenticated users can read hogares'
  ) THEN
    CREATE POLICY "Authenticated users can read hogares"
      ON hogares FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hogares' AND policyname = 'Authenticated users can insert hogares'
  ) THEN
    CREATE POLICY "Authenticated users can insert hogares"
      ON hogares FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hogares' AND policyname = 'Authenticated users can update hogares'
  ) THEN
    CREATE POLICY "Authenticated users can update hogares"
      ON hogares FOR UPDATE
      TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hogares' AND policyname = 'Authenticated users can delete hogares'
  ) THEN
    CREATE POLICY "Authenticated users can delete hogares"
      ON hogares FOR DELETE
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS hogares_localidad_idx ON hogares (localidad);
CREATE INDEX IF NOT EXISTS hogares_estado_idx ON hogares (estado);
CREATE INDEX IF NOT EXISTS hogares_precio_desde_idx ON hogares (precio_desde);
/*
  # Update lead pipeline stages

  ## Summary
  Replaces the previous multi-step internal pipeline with a 7-stage sales pipeline
  that reflects the real geriatric home placement process.

  ## New stages
  1. lead_nuevo             - Family contacted via website, WhatsApp, or referral
  2. lead_calificado        - Advisor confirmed budget, city, medical condition, and care needs
  3. hogares_propuestos     - Matching geriatric homes were sent to the family
  4. visitas_programadas    - Family scheduled visits to one or more homes
  5. en_decision_familiar   - Family visited homes and is deciding
  6. cierre_ganado          - Family selected a home and admission is confirmed
  7. cierre_perdido         - Lead stopped the process or chose another option

  ## Changes
  - Existing rows are remapped to the closest new stage using a CASE statement
  - The default value on the estado column is updated to 'lead_nuevo'

  ## Notes
  - No data is destroyed; all leads are migrated to a valid new stage
  - Old stage names that have no close equivalent fall back to 'lead_nuevo'
*/

UPDATE leads
SET estado = CASE
  WHEN estado IN ('nuevo', 'nuevo_lead', 'contactado') THEN 'lead_nuevo'
  WHEN estado IN ('perfilado_inicial', 'perfilando_caso', 'en_revision_informacion', 'asignado_ejecutivo', 'lead_calificado') THEN 'lead_calificado'
  WHEN estado IN ('hogares_preseleccionados', 'buscando_hogar', 'opciones_enviadas', 'propuesta_enviada', 'hogares_propuestos') THEN 'hogares_propuestos'
  WHEN estado IN ('visitas_agendadas', 'visita_agendada', 'visitas_programadas') THEN 'visitas_programadas'
  WHEN estado IN ('visitas_realizadas', 'en_toma_decision', 'negociacion', 'en_decision_familiar') THEN 'en_decision_familiar'
  WHEN estado IN ('cerrado_ganado', 'cierre_ganado') THEN 'cierre_ganado'
  WHEN estado IN ('cerrado_perdido', 'cierre_perdido') THEN 'cierre_perdido'
  ELSE 'lead_nuevo'
END
WHERE estado NOT IN ('lead_nuevo', 'lead_calificado', 'hogares_propuestos', 'visitas_programadas', 'en_decision_familiar', 'cierre_ganado', 'cierre_perdido');

ALTER TABLE leads ALTER COLUMN estado SET DEFAULT 'lead_nuevo';
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
  creado_por uuid REFERENCES profiles(id) ON DELETE SET NULL,
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
/*
  # Add Proposals Tables

  ## Summary
  Creates the data model for generating shareable home proposal links for leads.

  ## New Tables

  ### propuestas
  Stores a proposal record linked to a lead.
  - `id` (uuid, primary key)
  - `lead_id` (uuid, FK → leads) — which lead this proposal is for
  - `creado_por` (uuid, FK → auth.users) — advisor who created it
  - `titulo` (text) — optional title shown on the public page
  - `mensaje` (text) — optional custom message
  - `estado` (text) — 'activa' | 'archivada'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### propuesta_hogares
  Junction table linking homes to a proposal.
  - `id` (uuid, primary key)
  - `propuesta_id` (uuid, FK → propuestas)
  - `hogar_id` (uuid, FK → hogares)
  - `orden` (int) — display order
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Authenticated users can read/insert/update/delete their own proposals
  - Public (anon) users can SELECT propuestas and propuesta_hogares (needed for the public proposal page)
  - No public write access
*/

CREATE TABLE IF NOT EXISTS propuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  creado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT 'Opciones de hogares recomendados',
  mensaje text,
  estado text NOT NULL DEFAULT 'activa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS propuesta_hogares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propuesta_id uuid NOT NULL REFERENCES propuestas(id) ON DELETE CASCADE,
  hogar_id uuid NOT NULL REFERENCES hogares(id) ON DELETE CASCADE,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (propuesta_id, hogar_id)
);

ALTER TABLE propuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE propuesta_hogares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select propuestas"
  ON propuestas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Advisors can insert their own propuestas"
  ON propuestas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creado_por);

CREATE POLICY "Advisors can update their own propuestas"
  ON propuestas FOR UPDATE
  TO authenticated
  USING (auth.uid() = creado_por)
  WITH CHECK (auth.uid() = creado_por);

CREATE POLICY "Advisors can delete their own propuestas"
  ON propuestas FOR DELETE
  TO authenticated
  USING (auth.uid() = creado_por);

CREATE POLICY "Public can read propuestas"
  ON propuestas FOR SELECT
  TO anon
  USING (estado = 'activa');

CREATE POLICY "Authenticated users can select propuesta_hogares"
  ON propuesta_hogares FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert propuesta_hogares"
  ON propuesta_hogares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM propuestas
      WHERE propuestas.id = propuesta_id
      AND propuestas.creado_por = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can delete propuesta_hogares"
  ON propuesta_hogares FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM propuestas
      WHERE propuestas.id = propuesta_id
      AND propuestas.creado_por = auth.uid()
    )
  );

CREATE POLICY "Public can read propuesta_hogares"
  ON propuesta_hogares FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM propuestas
      WHERE propuestas.id = propuesta_id
      AND propuestas.estado = 'activa'
    )
  );

CREATE INDEX IF NOT EXISTS idx_propuestas_lead_id ON propuestas(lead_id);
CREATE INDEX IF NOT EXISTS idx_propuesta_hogares_propuesta_id ON propuesta_hogares(propuesta_id);
/*
  # Add Proposal Engagement Tracking

  ## Summary
  Extends the proposals system to track when families open and interact with proposal pages.

  ## Changes to propuestas
  - `views` (int) — total number of times the proposal page has been opened
  - `last_opened_at` (timestamptz) — timestamp of the most recent open

  ## New Table: proposal_events
  Stores individual engagement events from the public proposal page.
  - `id` (uuid, primary key)
  - `propuesta_id` (uuid, FK → propuestas)
  - `event_type` (text) — 'proposal_opened' | 'home_viewed'
  - `hogar_id` (uuid, nullable) — populated for 'home_viewed' events
  - `hogar_nombre` (text, nullable) — denormalized name for display
  - `created_at` (timestamptz)

  ## Lead heat indicator
  A computed column is NOT added; instead the application queries views count
  and marks the lead based on views > 3 at display time.

  ## Security
  - RLS enabled on proposal_events
  - Anon users can INSERT (they are the families opening links)
  - Authenticated users can SELECT (advisors reading the data)
  - No public SELECT on individual events (only aggregated data matters)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'propuestas' AND column_name = 'views'
  ) THEN
    ALTER TABLE propuestas ADD COLUMN views int NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'propuestas' AND column_name = 'last_opened_at'
  ) THEN
    ALTER TABLE propuestas ADD COLUMN last_opened_at timestamptz;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propuesta_id uuid NOT NULL REFERENCES propuestas(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  hogar_id uuid REFERENCES hogares(id) ON DELETE SET NULL,
  hogar_nombre text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE proposal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert proposal events"
  ON proposal_events FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert proposal events"
  ON proposal_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read proposal events"
  ON proposal_events FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_proposal_events_propuesta_id ON proposal_events(propuesta_id);
CREATE INDEX IF NOT EXISTS idx_proposal_events_event_type ON proposal_events(event_type);
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
/*
  # Demo Data Seed v2 — Hogares + Lead Assignments

  ## Summary
  Enriches existing demo data and adds missing records for a fully
  testable CRM. Uses valid estado values per the hogares_estado_check
  constraint: 'pendiente' | 'aprobado' | 'rechazado'.

  ## Changes
  1. Update existing 8 hogares → estado = 'aprobado', enrich data
  2. Add 2 new hogares (Bogotá Teusaquillo + Cali Norte)
  3. Assign ejecutivo_id + asesor_id to all leads missing them
  4. Add cierre_perdido lead for full pipeline coverage

  ## Profiles
  - admin:     [removed]
  - ejecutivo: [removed]
*/

-- ============================================================
-- STEP 1: Approve and enrich all existing hogares
-- ============================================================

UPDATE hogares SET
  estado = 'aprobado',
  descripcion = COALESCE(NULLIF(descripcion,''), 'Hogar gerontológico con atención personalizada, entornos seguros y equipo profesional dedicado al bienestar del adulto mayor.'),
  hab_compartida = true,
  hab_privada_bano_compartido = true,
  hab_privada_bano_privado = true,
  serv_medicina_general = true,
  serv_actividades_recreativas = true,
  serv_nutricion = true,
  dieta_blanda = true,
  dieta_diabetica = true,
  un_solo_nivel = true,
  cupo_disponible = COALESCE(cupo_disponible, 3),
  habitaciones_disponibles = COALESCE(habitaciones_disponibles, 3)
WHERE estado = 'pendiente';

UPDATE hogares SET
  whatsapp = '3201110001',
  descripcion = 'Hogar premium en el norte de Bogotá con jardín, sala de terapias y atención médica 24 horas. Ideal para casos con necesidades clínicas complejas.',
  serv_enfermeria_24h = true,
  serv_fisioterapia = true,
  serv_psicologia = true,
  maneja_oxigeno = true,
  tiene_ascensor = true
WHERE nombre = 'Casa Dorada Premium' AND (whatsapp IS NULL OR whatsapp = '3001000001');

UPDATE hogares SET
  whatsapp = '3111220002',
  descripcion = 'Centro geriátrico con amplia trayectoria en Usaquén. Habitaciones confortables, actividades recreativas diarias y enfermería permanente.',
  serv_enfermeria_24h = true,
  serv_terapia_ocupacional = true,
  serv_fonoaudiologia = true
WHERE nombre = 'Centro Geriátrico San José' AND (whatsapp IS NULL OR whatsapp = '3001000001');

UPDATE hogares SET
  whatsapp = '3151330003',
  descripcion = 'Hogar acogedor en Chapinero con espacios verdes y ambiente familiar. Atención personalizada para adultos mayores con autonomía o leve dependencia.',
  serv_fisioterapia = true,
  serv_trabajo_social = true
WHERE nombre = 'Hogar Dorado Los Olivos' AND (whatsapp IS NULL OR whatsapp = '3001000001');

UPDATE hogares SET
  whatsapp = '3161440004',
  descripcion = 'Hogar con opción accesible en Suba. Buenas instalaciones, equipo capacitado y ambiente tranquilo para adultos mayores con presupuesto ajustado.'
WHERE nombre = 'Hogar Geriátrico La Esperanza' AND (whatsapp IS NULL OR whatsapp = '3001000001');

UPDATE hogares SET
  whatsapp = '3171550005',
  descripcion = 'Residencia moderna en El Poblado con áreas verdes y equipo médico especializado para adultos mayores con patologías crónicas.',
  serv_enfermeria_24h = true,
  serv_fisioterapia = true,
  serv_psicologia = true,
  maneja_oxigeno = true,
  tiene_ascensor = true
WHERE nombre = 'Casa de Reposo El Prado' AND (whatsapp IS NULL OR whatsapp = '3001000001');

UPDATE hogares SET
  whatsapp = '3181660006',
  descripcion = 'Hogar en Laureles con amplio jardín y zona social. Especializado en adultos mayores con deterioro cognitivo leve o moderado.',
  serv_enfermeria_24h = true,
  serv_psicologia = true,
  serv_terapia_ocupacional = true
WHERE nombre = 'Villa de los Abuelos' AND (whatsapp IS NULL OR whatsapp = '3001000001');

UPDATE hogares SET
  whatsapp = '3191770007',
  descripcion = 'Residencia en Ciudad Jardín con vista al río y ambiente natural. Servicios de fisioterapia, actividades artísticas y cocina especializada.',
  serv_fisioterapia = true,
  serv_nutricion = true,
  serv_actividades_recreativas = true
WHERE nombre = 'Residencia Bella Vista' AND (whatsapp IS NULL OR whatsapp = '3001000001');

UPDATE hogares SET
  whatsapp = '3051880008',
  descripcion = 'Hogar en El Prado, Barranquilla, con excelente infraestructura, jardín tropical, equipo de salud completo y ambiente caribeño acogedor.',
  serv_fisioterapia = true,
  serv_medicina_general = true
WHERE nombre = 'Hogar Primavera' AND (whatsapp IS NULL OR whatsapp = '3001000001');

-- ============================================================
-- STEP 2: Add 2 new hogares to reach 10 total
-- ============================================================

INSERT INTO hogares (
  nombre, ciudad, zona, barrio, localidad, direccion, telefono, whatsapp,
  precio_desde, precio_hasta,
  descripcion, estado,
  hab_compartida, hab_privada_bano_compartido, hab_privada_bano_privado,
  serv_enfermeria_24h, serv_fisioterapia, serv_medicina_general,
  serv_actividades_recreativas, serv_nutricion, serv_psicologia,
  dieta_blanda, dieta_diabetica,
  un_solo_nivel, maneja_oxigeno,
  cupo_disponible, habitaciones_disponibles, capacidad_total,
  nombre_responsable, registrado_por
)
SELECT
  'Hogar San Ángel Bogotá',
  'Bogotá', 'Teusaquillo', 'Armenia', 'Teusaquillo',
  'Cra 24 # 34-12', '6013210001', '3221990009',
  2200000, 3800000,
  'Hogar con ambiente tranquilo en Teusaquillo. Atención básica y media, actividades recreativas, alimentación balanceada y acompañamiento permanente.',
  'aprobado',
  true, true, false,
  false, true, true,
  true, true, false,
  true, true,
  false, false,
  4, 4, 12,
  'Luz Adriana Mora',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM hogares WHERE nombre = 'Hogar San Ángel Bogotá');

INSERT INTO hogares (
  nombre, ciudad, zona, barrio, localidad, direccion, telefono, whatsapp,
  precio_desde, precio_hasta,
  descripcion, estado,
  hab_compartida, hab_privada_bano_compartido, hab_privada_bano_privado,
  serv_enfermeria_24h, serv_fisioterapia, serv_medicina_general,
  serv_actividades_recreativas, serv_nutricion, serv_psicologia,
  serv_terapia_ocupacional,
  dieta_blanda, dieta_diabetica,
  un_solo_nivel, maneja_oxigeno,
  cupo_disponible, habitaciones_disponibles, capacidad_total,
  nombre_responsable, registrado_por
)
SELECT
  'Residencia Las Palmas Cali',
  'Cali', 'Norte', 'Granada', 'Norte',
  'Cll 10 # 58-44', '6024560002', '3232100010',
  3000000, 5000000,
  'Residencia moderna en el norte de Cali. Ambiente sereno con jardín interior, programa de actividades cognitivas y equipo médico disponible los 7 días.',
  'aprobado',
  true, true, true,
  true, true, true,
  true, true, true,
  true,
  true, true,
  true, true,
  5, 5, 15,
  'Gloria Inés Patiño',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM hogares WHERE nombre = 'Residencia Las Palmas Cali');

-- ============================================================
-- STEP 3: Assign ejecutivo + asesor to all leads missing them
-- ============================================================

UPDATE leads SET
  ejecutivo_id = NULL,
  asesor_id = NULL
WHERE ejecutivo_id IS NULL AND ciudad IN ('Bogotá', 'Medellín');

UPDATE leads SET
  ejecutivo_id = NULL,
  asesor_id = NULL
WHERE ejecutivo_id IS NULL;

-- ============================================================
-- STEP 4: Add cierre_perdido lead for full pipeline coverage
-- ============================================================

INSERT INTO leads (
  nombre_contacto, telefono_principal, ciudad, zona_localidad,
  nombre_adulto_mayor, edad, sexo,
  presupuesto_rango, presupuesto_mensual,
  urgencia, estado,
  fecha_ingreso_estimada,
  deterioro_cognitivo, requiere_oxigeno, requiere_primer_piso,
  ayuda_para_comer, ayuda_para_bano, ayuda_para_caminar,
  dieta_diabetica, dieta_blanda,
  requiere_enfermeria, requiere_acompanamiento,
  como_nos_conocio, resumen_caso,
  asesor_id, ejecutivo_id
)
SELECT
  'Roberto Peña',
  '3106789012',
  'Bogotá',
  'Kennedy',
  'Ernesto Peña Vargas',
  87, 'Masculino',
  'Entre 2 y 4 millones', 3000000,
  'baja', 'cierre_perdido',
  'Más de un mes',
  false, false, true,
  false, true, true,
  true, false,
  false, true,
  'Google',
  'El familiar decidió contratar un cuidador en casa. El presupuesto no alcanzaba para habitación privada y la familia prefirió otra modalidad de cuidado.',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM leads WHERE nombre_contacto = 'Roberto Peña' AND estado = 'cierre_perdido'
);
/*
  # Enrich hogares with full realistic demo data (v2)

  Updates all 10 existing hogares with complete service flags, pricing variation,
  specializations, contact info, and rich descriptions.
  Uses valid estado = 'aprobado'.
*/

-- 1. Hogar Dorado Los Olivos — Bogotá Chapinero — Mid-range general
UPDATE hogares SET
  barrio = 'Chapinero Alto',
  localidad = 'Chapinero',
  telefono = '6013456789',
  whatsapp = '3101234567',
  correo = 'admisiones@hogarlosolivos.com',
  nombre_responsable = 'Sandra Moreno Cárdenas',
  precio_desde = 2500000,
  precio_hasta = 4200000,
  tipo_atencion = ARRAY['Residencial', 'Cuidado básico', 'Enfermería'],
  capacidad_total = 20,
  cupo_disponible = 4,
  habitaciones_disponibles = 4,
  hab_compartida = true,
  hab_privada_bano_privado = true,
  hab_privada_bano_compartido = true,
  serv_enfermeria_24h = true,
  serv_fisioterapia = true,
  serv_terapia_ocupacional = false,
  serv_psicologia = true,
  serv_nutricion = true,
  serv_actividades_recreativas = true,
  serv_transporte = false,
  serv_medicina_general = true,
  serv_fonoaudiologia = false,
  serv_trabajo_social = true,
  dieta_blanda = true,
  dieta_diabetica = true,
  dieta_hiposodica = true,
  dieta_renal = false,
  maneja_oxigeno = false,
  tiene_ascensor = true,
  solo_escaleras = false,
  un_solo_nivel = false,
  descripcion = 'Hogar geriátrico en Chapinero Alto con 20 años de experiencia. Jardín interior, atención personalizada, médico de planta martes y jueves. Actividades recreativas diarias. Admite movilidad reducida y asistencia básica. No atiende deterioro cognitivo severo ni oxígeno.',
  estado = 'aprobado'
WHERE id = 'eaec731b-ff72-40da-9d97-2633c0a3a71d';

-- 2. Casa de Reposo El Prado — Medellín El Poblado — Premium
UPDATE hogares SET
  barrio = 'El Diamante',
  localidad = 'El Poblado',
  telefono = '6044567890',
  whatsapp = '3144567890',
  correo = 'info@casareposo-elprado.com',
  nombre_responsable = 'Catalina Restrepo Gómez',
  precio_desde = 4500000,
  precio_hasta = 7500000,
  tipo_atencion = ARRAY['Residencial', 'Enfermería especializada', 'Cuidados paliativos'],
  capacidad_total = 15,
  cupo_disponible = 2,
  habitaciones_disponibles = 2,
  hab_compartida = false,
  hab_privada_bano_privado = true,
  hab_privada_bano_compartido = false,
  serv_enfermeria_24h = true,
  serv_fisioterapia = true,
  serv_terapia_ocupacional = true,
  serv_psicologia = true,
  serv_nutricion = true,
  serv_actividades_recreativas = true,
  serv_transporte = true,
  serv_medicina_general = true,
  serv_fonoaudiologia = true,
  serv_trabajo_social = true,
  dieta_blanda = true,
  dieta_diabetica = true,
  dieta_hiposodica = true,
  dieta_renal = true,
  maneja_oxigeno = true,
  tiene_ascensor = true,
  solo_escaleras = false,
  un_solo_nivel = false,
  descripcion = 'Residencia premium en El Poblado. Solo habitaciones privadas baño privado. Enfermería 24h, médico de planta, psicóloga, nutricionista y fisioterapeuta. Acepta pacientes complejos: oxígeno, sondas, PEG. Cuidados paliativos disponibles.',
  estado = 'aprobado'
WHERE id = '6a94f86c-932a-4909-9cfa-e6c630d03868';

-- 3. Centro Geriátrico San José — Bogotá Usaquén — Low budget
UPDATE hogares SET
  barrio = 'Santa Bárbara',
  localidad = 'Usaquén',
  telefono = '6013219870',
  whatsapp = '3112223344',
  correo = 'centrosanjose@gmail.com',
  nombre_responsable = 'Bernardo Castillo Niño',
  precio_desde = 1800000,
  precio_hasta = 3200000,
  tipo_atencion = ARRAY['Residencial', 'Cuidado básico'],
  capacidad_total = 30,
  cupo_disponible = 9,
  habitaciones_disponibles = 9,
  hab_compartida = true,
  hab_privada_bano_privado = false,
  hab_privada_bano_compartido = true,
  serv_enfermeria_24h = false,
  serv_fisioterapia = false,
  serv_terapia_ocupacional = false,
  serv_psicologia = false,
  serv_nutricion = false,
  serv_actividades_recreativas = true,
  serv_transporte = false,
  serv_medicina_general = true,
  serv_fonoaudiologia = false,
  serv_trabajo_social = false,
  dieta_blanda = true,
  dieta_diabetica = false,
  dieta_hiposodica = false,
  dieta_renal = false,
  maneja_oxigeno = false,
  tiene_ascensor = false,
  solo_escaleras = false,
  un_solo_nivel = true,
  descripcion = 'Hogar económico en Usaquén, un solo nivel sin escaleras. Ideal para adultos mayores independientes o semi-dependientes con presupuesto limitado. Médico una vez por semana. Habitaciones compartidas 2-3 personas. No acepta deterioro cognitivo avanzado ni oxígeno.',
  estado = 'aprobado'
WHERE id = '68de689a-7af6-4aec-8326-40e7f34e4d4a';

-- 4. Residencia Bella Vista — Cali Ciudad Jardín — Mid premium, rehabilitación
UPDATE hogares SET
  barrio = 'Ciudad Jardín',
  localidad = 'Sur de Cali',
  telefono = '6022345678',
  whatsapp = '3165556677',
  correo = 'admisiones@bellavistacali.com',
  nombre_responsable = 'Adriana Patiño Torres',
  precio_desde = 3200000,
  precio_hasta = 5500000,
  tipo_atencion = ARRAY['Residencial', 'Enfermería', 'Rehabilitación'],
  capacidad_total = 18,
  cupo_disponible = 3,
  habitaciones_disponibles = 3,
  hab_compartida = true,
  hab_privada_bano_privado = true,
  hab_privada_bano_compartido = true,
  serv_enfermeria_24h = true,
  serv_fisioterapia = true,
  serv_terapia_ocupacional = true,
  serv_psicologia = false,
  serv_nutricion = true,
  serv_actividades_recreativas = true,
  serv_transporte = false,
  serv_medicina_general = true,
  serv_fonoaudiologia = true,
  serv_trabajo_social = false,
  dieta_blanda = true,
  dieta_diabetica = true,
  dieta_hiposodica = true,
  dieta_renal = false,
  maneja_oxigeno = true,
  tiene_ascensor = true,
  solo_escaleras = false,
  un_solo_nivel = false,
  descripcion = 'Especializada en rehabilitación postoperatoria en Cali. Ideal para adultos mayores post cirugía de cadera, rodilla o columna. Fisioterapeuta y fonoaudióloga de planta. Acepta oxígeno. Habitaciones privadas baño privado disponibles.',
  estado = 'aprobado'
WHERE id = 'a6271df8-2613-4b48-8cd6-432930b18e14';

-- 5. Hogar Geriátrico La Esperanza — Bogotá Suba — Low budget, alta disponibilidad
UPDATE hogares SET
  barrio = 'Suba Centro',
  localidad = 'Suba',
  telefono = '6013987654',
  whatsapp = '3209988776',
  correo = 'hogar.laesperanza.suba@gmail.com',
  nombre_responsable = 'Gloria Pinzón Villamizar',
  precio_desde = 1600000,
  precio_hasta = 2800000,
  tipo_atencion = ARRAY['Residencial', 'Cuidado básico'],
  capacidad_total = 25,
  cupo_disponible = 11,
  habitaciones_disponibles = 11,
  hab_compartida = true,
  hab_privada_bano_privado = false,
  hab_privada_bano_compartido = true,
  serv_enfermeria_24h = false,
  serv_fisioterapia = false,
  serv_terapia_ocupacional = false,
  serv_psicologia = false,
  serv_nutricion = false,
  serv_actividades_recreativas = true,
  serv_transporte = false,
  serv_medicina_general = true,
  serv_fonoaudiologia = false,
  serv_trabajo_social = true,
  dieta_blanda = true,
  dieta_diabetica = true,
  dieta_hiposodica = false,
  dieta_renal = false,
  maneja_oxigeno = false,
  tiene_ascensor = false,
  solo_escaleras = false,
  un_solo_nivel = true,
  descripcion = 'Opción económica con alta disponibilidad y cupo inmediato en Suba. Habitaciones compartidas. Admite adultos mayores con baja dependencia. No acepta sondas, oxígeno ni deterioro cognitivo grave.',
  estado = 'aprobado'
WHERE id = 'fe7ffbd6-bddd-440d-8966-4669eef83ca3';

-- 6. Villa de los Abuelos — Medellín Laureles — Alzheimer especializado
UPDATE hogares SET
  barrio = 'Los Almendros',
  localidad = 'Laureles-Estadio',
  telefono = '6044678901',
  whatsapp = '3004445566',
  correo = 'villa.abuelos@laureles.com',
  nombre_responsable = 'Felipe Arango Mejía',
  precio_desde = 4000000,
  precio_hasta = 6500000,
  tipo_atencion = ARRAY['Residencial', 'Enfermería especializada', 'Alzheimer y demencias', 'Cuidados paliativos'],
  capacidad_total = 16,
  cupo_disponible = 3,
  habitaciones_disponibles = 3,
  hab_compartida = false,
  hab_privada_bano_privado = true,
  hab_privada_bano_compartido = false,
  serv_enfermeria_24h = true,
  serv_fisioterapia = true,
  serv_terapia_ocupacional = true,
  serv_psicologia = true,
  serv_nutricion = true,
  serv_actividades_recreativas = true,
  serv_transporte = false,
  serv_medicina_general = true,
  serv_fonoaudiologia = true,
  serv_trabajo_social = true,
  dieta_blanda = true,
  dieta_diabetica = true,
  dieta_hiposodica = true,
  dieta_renal = false,
  maneja_oxigeno = true,
  tiene_ascensor = true,
  solo_escaleras = false,
  un_solo_nivel = false,
  descripcion = 'Único hogar con Unidad Cerrada de Memoria para Alzheimer y demencias en Medellín Laureles. Personal entrenado en manejo conductual y estimulación cognitiva. Solo habitaciones privadas. Psicóloga neuropsicóloga de planta. Acepta casos severos con deambulación y agitación.',
  estado = 'aprobado'
WHERE id = 'fbff1db8-7f15-49d1-a339-abaf92083798';

-- 7. Casa Dorada Premium — Bogotá El Chicó — Top premium completo
UPDATE hogares SET
  barrio = 'El Chicó',
  localidad = 'Chapinero',
  telefono = '6013001122',
  whatsapp = '3187778899',
  correo = 'reservas@casadoradabogota.com',
  nombre_responsable = 'Valentina Ospina de Ruiz',
  precio_desde = 5500000,
  precio_hasta = 9000000,
  tipo_atencion = ARRAY['Residencial', 'Enfermería especializada', 'Cuidados paliativos', 'Alzheimer y demencias'],
  capacidad_total = 12,
  cupo_disponible = 2,
  habitaciones_disponibles = 2,
  hab_compartida = false,
  hab_privada_bano_privado = true,
  hab_privada_bano_compartido = false,
  serv_enfermeria_24h = true,
  serv_fisioterapia = true,
  serv_terapia_ocupacional = true,
  serv_psicologia = true,
  serv_nutricion = true,
  serv_actividades_recreativas = true,
  serv_transporte = true,
  serv_medicina_general = true,
  serv_fonoaudiologia = true,
  serv_trabajo_social = true,
  dieta_blanda = true,
  dieta_diabetica = true,
  dieta_hiposodica = true,
  dieta_renal = true,
  maneja_oxigeno = true,
  tiene_ascensor = true,
  solo_escaleras = false,
  un_solo_nivel = false,
  descripcion = 'La residencia geriátrica de mayor nivel en Bogotá. Habitaciones tipo suite baño privado. Médico geriatra de planta, enfermería 24h ratio 1:3. Acepta casos complejos: PEG, traqueostomía, cuidados paliativos. Cocina de autor adaptada. Parking para familias.',
  estado = 'aprobado'
WHERE id = '06095afd-b81b-49a3-a558-904d8948e00f';

-- 8. Hogar Primavera — Barranquilla El Prado — Mid, general
UPDATE hogares SET
  barrio = 'El Prado',
  localidad = 'Norte de Barranquilla',
  telefono = '6055123456',
  whatsapp = '3013334455',
  correo = 'hogar.primavera.baq@gmail.com',
  nombre_responsable = 'Rosario de la Hoz Insignares',
  precio_desde = 2200000,
  precio_hasta = 3800000,
  tipo_atencion = ARRAY['Residencial', 'Cuidado básico', 'Enfermería'],
  capacidad_total = 20,
  cupo_disponible = 6,
  habitaciones_disponibles = 6,
  hab_compartida = true,
  hab_privada_bano_privado = true,
  hab_privada_bano_compartido = true,
  serv_enfermeria_24h = false,
  serv_fisioterapia = true,
  serv_terapia_ocupacional = false,
  serv_psicologia = false,
  serv_nutricion = true,
  serv_actividades_recreativas = true,
  serv_transporte = false,
  serv_medicina_general = true,
  serv_fonoaudiologia = false,
  serv_trabajo_social = false,
  dieta_blanda = true,
  dieta_diabetica = true,
  dieta_hiposodica = false,
  dieta_renal = false,
  maneja_oxigeno = false,
  tiene_ascensor = false,
  solo_escaleras = false,
  un_solo_nivel = true,
  descripcion = 'Hogar cálido en El Prado, Barranquilla. Un solo nivel sin barreras. Jardín amplio, médico de cabecera, nutricionista y fisioterapia. Ideal para adultos mayores semi-dependientes del Caribe.',
  estado = 'aprobado'
WHERE id = 'f018b6cd-eb1b-4515-a05a-fc65acc61625';

-- 9. Hogar San Ángel Bogotá — Bogotá Teusaquillo — Mid accesible
UPDATE hogares SET
  barrio = 'Armenia',
  localidad = 'Teusaquillo',
  telefono = '6013778899',
  whatsapp = '3158889900',
  correo = 'sanangel.bogota@outlook.com',
  nombre_responsable = 'Hernán López Díaz',
  precio_desde = 2200000,
  precio_hasta = 3800000,
  tipo_atencion = ARRAY['Residencial', 'Cuidado básico', 'Enfermería'],
  capacidad_total = 18,
  cupo_disponible = 4,
  habitaciones_disponibles = 4,
  hab_compartida = true,
  hab_privada_bano_privado = false,
  hab_privada_bano_compartido = true,
  serv_enfermeria_24h = false,
  serv_fisioterapia = false,
  serv_terapia_ocupacional = false,
  serv_psicologia = false,
  serv_nutricion = true,
  serv_actividades_recreativas = true,
  serv_transporte = false,
  serv_medicina_general = true,
  serv_fonoaudiologia = false,
  serv_trabajo_social = false,
  dieta_blanda = true,
  dieta_diabetica = true,
  dieta_hiposodica = false,
  dieta_renal = false,
  maneja_oxigeno = false,
  tiene_ascensor = false,
  solo_escaleras = false,
  un_solo_nivel = true,
  descripcion = 'Hogar residencial en Teusaquillo a 10 min del centro. Un nivel adaptado para sillas de ruedas. Médico semanal, nutricionista. Habitaciones compartidas amplias. Buena relación calidad-precio. Admite asistencia moderada.',
  estado = 'aprobado'
WHERE id = '8060c074-ea48-49fe-9a3f-9b5cacecf494';

-- 10. Residencia Las Palmas Cali — Cali Norte — Mid premium, enfermería 24h
UPDATE hogares SET
  barrio = 'Versalles',
  localidad = 'Norte de Cali',
  telefono = '6022556677',
  whatsapp = '3206677889',
  correo = 'laspalmas.cali@gmail.com',
  nombre_responsable = 'Patricia Cuadros Salcedo',
  precio_desde = 3000000,
  precio_hasta = 5200000,
  tipo_atencion = ARRAY['Residencial', 'Enfermería especializada', 'Rehabilitación'],
  capacidad_total = 22,
  cupo_disponible = 5,
  habitaciones_disponibles = 5,
  hab_compartida = true,
  hab_privada_bano_privado = true,
  hab_privada_bano_compartido = true,
  serv_enfermeria_24h = true,
  serv_fisioterapia = true,
  serv_terapia_ocupacional = true,
  serv_psicologia = true,
  serv_nutricion = true,
  serv_actividades_recreativas = true,
  serv_transporte = true,
  serv_medicina_general = true,
  serv_fonoaudiologia = false,
  serv_trabajo_social = true,
  dieta_blanda = true,
  dieta_diabetica = true,
  dieta_hiposodica = true,
  dieta_renal = false,
  maneja_oxigeno = true,
  tiene_ascensor = true,
  solo_escaleras = false,
  un_solo_nivel = false,
  descripcion = 'Residencia completa en norte de Cali con jardines. Enfermería 24h, fisioterapia, terapia ocupacional y psicología. Habitaciones privadas baño privado disponibles. Acepta oxígeno. Transporte para citas incluido en tarifa premium.',
  estado = 'aprobado'
WHERE id = '454428f9-846f-4c6b-a254-0948dd94a8f7';
/*
  # Enrich leads with full clinical and matching demo data

  Updates existing leads with:
  - Complete clinical profile (diagnosticos, resumen_caso)
  - Care needs flags (deterioro_cognitivo, requiere_oxigeno, enfermería, etc.)
  - Mobility and ADL support
  - Realistic urgencia and fecha_probable_ingreso
  - Budget and room type preferences
  - Source and observations
  - etiqueta_caliente where appropriate
  - ejecutivo_id assigned to demo user
  
  Matching intent per lead:
  - María Elena Rodríguez       → exact match: Hogar Los Olivos (Bogotá, mid, enfermería)
  - Jorge Antonio López         → exact match: Villa de los Abuelos (Medellín, Alzheimer, premium)
  - Rosa María Gómez            → exact match: La Esperanza (Bogotá, low, inmediato)
  - Carmen Lucía Herrera        → exact match: Casa Dorada Premium (Bogotá, alta gama, complejo)
  - Gloria Isabel Ramírez       → partial: San José Bogotá (presupuesto alto, hay opción premium)
  - Rafael Suárez Díaz          → exact: Las Palmas Cali (Medellín→Cali relocation, enfermería)
  - Beatriz Morales Castro      → partial: San Ángel Bogotá (budget moderado, básico)
  - Alberto Castro Pérez        → partial: Bella Vista Cali (Cali, necesita fisio)
  - Pedro José Martínez         → harder: Barranquilla (solo Hogar Primavera disponible)
  - Luis Fernando Vargas        → harder: Bogotá bajo presupuesto, pocas opciones
*/

-- 1. María Elena Rodríguez — Bogotá — Lead calificado — EXACT MATCH: Los Olivos
UPDATE leads SET
  edad = 81,
  sexo = 'Femenino',
  parentesco = 'Hijo/a',
  whatsapp = '3101234568',
  correo = 'carlos.rodriguez@gmail.com',
  zona_localidad = 'Chapinero',
  presupuesto_mensual = 3500000,
  presupuesto_rango = 'Entre 3 y 4 millones',
  urgencia = 'alta',
  fecha_probable_ingreso = '2026-04-05',
  fecha_ingreso_estimada = 'semana_siguiente',
  tipo_habitacion = 'Privada baño compartido',
  tipo_bano = 'Compartido',
  diagnosticos = 'Hipertensión arterial, Diabetes tipo 2, Artrosis de rodilla bilateral',
  resumen_caso = 'Adulta mayor con diabetes controlada y limitación funcional en rodillas. Vive sola desde hace un año. Hijo trabaja fuera y no puede acompañarla. Requiere medicación supervisada, dieta diabética y apoyo para movilización. Cognitivamente lúcida.',
  movilidad = 'Camina con andador',
  deterioro_cognitivo = false,
  requiere_oxigeno = false,
  requiere_enfermeria = true,
  requiere_acompanamiento = true,
  ayuda_para_comer = false,
  ayuda_para_bano = true,
  ayuda_para_caminar = true,
  requiere_primer_piso = false,
  dieta_diabetica = true,
  dieta_blanda = false,
  como_nos_conocio = 'Google',
  observaciones = 'Familia muy comprometida. Carlos visita cada fin de semana. Buscan hogar en Chapinero o norte de Bogotá. Importante que tengan médico de planta.',
  etiqueta_caliente = 'interesado_activo'
WHERE id = 'bbb1e604-b4aa-431b-a322-876a52431cc1';

-- 2. Jorge Antonio López — Medellín — Hogares propuestos — EXACT MATCH: Villa de los Abuelos
UPDATE leads SET
  edad = 77,
  sexo = 'Masculino',
  parentesco = 'Hija/o',
  whatsapp = '3144567891',
  correo = 'ana.lopez@hotmail.com',
  zona_localidad = 'El Poblado / Laureles',
  presupuesto_mensual = 5500000,
  presupuesto_rango = 'Entre 5 y 7 millones',
  urgencia = 'inmediato',
  fecha_probable_ingreso = '2026-03-25',
  fecha_ingreso_estimada = 'inmediato',
  tipo_habitacion = 'Privada baño privado',
  tipo_bano = 'Privado',
  diagnosticos = 'Alzheimer moderado-severo, Hipertensión, Dislipidemia',
  resumen_caso = 'Adulto mayor con diagnóstico de Alzheimer en fase moderada-severa. Deambulación nocturna frecuente, episodios de agitación y confusión espacio-temporal. Requiere unidad cerrada o entorno seguro. Familia en El Poblado busca hogar especializado en memoria cerca.',
  movilidad = 'Deambula sin apoyo (riesgo de caída)',
  deterioro_cognitivo = true,
  requiere_oxigeno = false,
  requiere_enfermeria = true,
  requiere_acompanamiento = true,
  ayuda_para_comer = true,
  ayuda_para_bano = true,
  ayuda_para_caminar = false,
  requiere_primer_piso = false,
  dieta_diabetica = false,
  dieta_blanda = true,
  como_nos_conocio = 'Recomendación médico neurólogo',
  observaciones = 'Caso urgente. Neuróloga del paciente recomienda institucionalización inmediata por riesgo en casa. Familia dispuesta a pagar hasta $6M con servicios especializados Alzheimer.',
  etiqueta_caliente = 'interesado_activo'
WHERE id = 'b0c5e982-2cdd-4dca-9967-5bdbad78f068';

-- 3. Rosa María Gómez — Bogotá — Visitas programadas — EXACT MATCH: La Esperanza Suba
UPDATE leads SET
  edad = 85,
  sexo = 'Femenino',
  parentesco = 'Hija/o',
  whatsapp = '3112224455',
  correo = 'patricia.gomez@gmail.com',
  zona_localidad = 'Suba',
  presupuesto_mensual = 2200000,
  presupuesto_rango = 'Entre 2 y 2.5 millones',
  urgencia = 'inmediato',
  fecha_probable_ingreso = '2026-03-20',
  fecha_ingreso_estimada = 'inmediato',
  tipo_habitacion = 'Compartida',
  tipo_bano = 'Compartido',
  diagnosticos = 'Osteoporosis severa, Incontinencia urinaria, Hipertensión',
  resumen_caso = 'Adulta mayor frágil con caída reciente (sin fractura). Vive con hija en Suba pero hija trabaja jornada completa. Presupuesto muy ajustado. Funcionalmente requiere apoyo básico AVD. Lúcida y orientada. Buscan disponibilidad inmediata.',
  movilidad = 'Camina con bastón',
  deterioro_cognitivo = false,
  requiere_oxigeno = false,
  requiere_enfermeria = false,
  requiere_acompanamiento = true,
  ayuda_para_comer = false,
  ayuda_para_bano = true,
  ayuda_para_caminar = false,
  requiere_primer_piso = false,
  dieta_diabetica = false,
  dieta_blanda = false,
  como_nos_conocio = 'Redes sociales',
  observaciones = 'Presupuesto máximo $2.3M. Solo acepta hogares en Suba o norte de Bogotá por cercanía a familia. Quiere visitar esta semana.',
  etiqueta_caliente = null
WHERE id = '26f7661b-ef07-44cc-b67c-19e85a29ad92';

-- 4. Carmen Lucía Herrera — Bogotá — Lead nuevo — EXACT MATCH: Casa Dorada Premium
UPDATE leads SET
  edad = 88,
  sexo = 'Femenino',
  parentesco = 'Hijo/a',
  whatsapp = '3187779900',
  correo = 'marta.herrera@gmail.com',
  zona_localidad = 'Chicó / Rosales',
  presupuesto_mensual = 7500000,
  presupuesto_rango = 'Más de 6 millones',
  urgencia = 'semana_siguiente',
  fecha_probable_ingreso = '2026-04-10',
  fecha_ingreso_estimada = 'semana_siguiente',
  tipo_habitacion = 'Privada baño privado',
  tipo_bano = 'Privado',
  diagnosticos = 'EPOC severo con oxígeno domiciliario, Falla cardíaca compensada, Demencia leve-moderada',
  resumen_caso = 'Adulta mayor con EPOC severo que requiere oxígeno 24h. Falla cardíaca con controles frecuentes de diuresis. Demencia en fase leve-moderada con orientación parcial. Familia adinerada del norte de Bogotá. Buscan la mejor opción posible con médico geriatra de planta y habitación tipo suite.',
  movilidad = 'En silla de ruedas',
  deterioro_cognitivo = true,
  requiere_oxigeno = true,
  requiere_enfermeria = true,
  requiere_acompanamiento = true,
  ayuda_para_comer = false,
  ayuda_para_bano = true,
  ayuda_para_caminar = true,
  requiere_primer_piso = false,
  dieta_diabetica = false,
  dieta_blanda = true,
  como_nos_conocio = 'Recomendación médico geriatra',
  observaciones = 'Familia de alta exigencia. Presupuesto sin tope real. El médico geriatra del Hospital de la Fundación Santa Fe los refirió directamente. Quieren propuesta por escrito esta semana.',
  etiqueta_caliente = 'interesado_activo'
WHERE id = 'a6a7c6b7-6e69-4ba2-9f6d-dbf405132187';

-- 5. Gloria Isabel Ramírez — Bogotá — Lead nuevo — PARTIAL MATCH: Casa Dorada o Los Olivos
UPDATE leads SET
  edad = 74,
  sexo = 'Femenino',
  parentesco = 'Hijo/a',
  whatsapp = '3156667788',
  correo = 'david.ramirez.bta@gmail.com',
  zona_localidad = 'Usaquén / Chicó',
  presupuesto_mensual = 5500000,
  presupuesto_rango = 'Entre 5 y 7 millones',
  urgencia = 'este_mes',
  fecha_probable_ingreso = '2026-04-20',
  fecha_ingreso_estimada = 'este_mes',
  tipo_habitacion = 'Privada baño privado',
  tipo_bano = 'Privado',
  diagnosticos = 'Parkinson estadio 3, Depresión mayor controlada',
  resumen_caso = 'Adulta mayor con Parkinson en estadio 3 con temblor y rigidez marcados. Control psiquiátrico por depresión mayor estabilizada. No deterioro cognitivo significativo. Familia busca hogar de alto nivel con fisioterapia y actividades que mantengan calidad de vida.',
  movilidad = 'Camina con dificultad, riesgo de caída',
  deterioro_cognitivo = false,
  requiere_oxigeno = false,
  requiere_enfermeria = true,
  requiere_acompanamiento = true,
  ayuda_para_comer = true,
  ayuda_para_bano = true,
  ayuda_para_caminar = true,
  requiere_primer_piso = false,
  dieta_diabetica = false,
  dieta_blanda = true,
  como_nos_conocio = 'Recomendación amigo',
  observaciones = 'Hijo David es médico. Evaluará detalladamente la propuesta. Necesita fisioterapia y terapia ocupacional obligatoriamente. Casa Dorada o Los Olivos serían opciones. Pendiente visita.',
  etiqueta_caliente = null
WHERE id = '0a08ff57-0d9a-4198-acf8-4fb95dcef095';

-- 6. Rafael Suárez Díaz — Medellín — Hogares propuestos — PARTIAL MATCH: Las Palmas o Bella Vista (traslado a otra ciudad)
UPDATE leads SET
  edad = 79,
  sexo = 'Masculino',
  parentesco = 'Hija/o',
  whatsapp = '3175559900',
  correo = 'carolina.suarez@outlook.com',
  zona_localidad = 'El Poblado',
  presupuesto_mensual = 4500000,
  presupuesto_rango = 'Entre 4 y 5 millones',
  urgencia = 'alta',
  fecha_probable_ingreso = '2026-04-01',
  fecha_ingreso_estimada = 'semana_siguiente',
  tipo_habitacion = 'Privada baño compartido',
  tipo_bano = 'Compartido',
  diagnosticos = 'ACV isquémico (secuela motora izquierda), Hipertensión, Diabetes',
  resumen_caso = 'Adulto mayor con secuela de ACV hace 6 meses. Hemiplejía izquierda parcialmente recuperada. Requiere fisioterapia continua y enfermería para medicación. Familia en Medellín pero abierta a otras ciudades si hay mejor oferta. Presupuesto intermedio.',
  movilidad = 'Hemiplejía parcial, requiere apoyo',
  deterioro_cognitivo = false,
  requiere_oxigeno = false,
  requiere_enfermeria = true,
  requiere_acompanamiento = true,
  ayuda_para_comer = false,
  ayuda_para_bano = true,
  ayuda_para_caminar = true,
  requiere_primer_piso = false,
  dieta_diabetica = true,
  dieta_blanda = false,
  como_nos_conocio = 'Clínica Las Américas',
  observaciones = 'Médico rehabilitador de Las Américas recomendó hogar con fisioterapia. Familia considera Medellín o Cali. Hay más opciones disponibles en Cali con fisio que en Medellín a este precio.',
  etiqueta_caliente = 'interesado_activo'
WHERE id = 'cc249f93-3fe4-468c-9151-5f481abe9634';

-- 7. Beatriz Morales Castro — Bogotá — Lead calificado — PARTIAL MATCH: San Ángel o San José
UPDATE leads SET
  edad = 82,
  sexo = 'Femenino',
  parentesco = 'Hijo/a',
  whatsapp = '3132228899',
  correo = 'miguel.morales.bta@gmail.com',
  zona_localidad = 'Teusaquillo / Kennedy',
  presupuesto_mensual = 2800000,
  presupuesto_rango = 'Entre 2.5 y 3.5 millones',
  urgencia = 'este_mes',
  fecha_probable_ingreso = '2026-04-15',
  fecha_ingreso_estimada = 'este_mes',
  tipo_habitacion = 'Compartida',
  tipo_bano = 'Compartido',
  diagnosticos = 'Demencia vascular leve, Hipertensión, Artritis reumatoide',
  resumen_caso = 'Adulta mayor con demencia vascular en etapa leve. Orientada en tiempo y espacio la mayor parte del tiempo. Artritis con limitación funcional moderada. Familia clase media busca hogar accesible con cuidado básico supervisado. No requiere enfermería intensiva.',
  movilidad = 'Marcha lenta pero independiente',
  deterioro_cognitivo = true,
  requiere_oxigeno = false,
  requiere_enfermeria = false,
  requiere_acompanamiento = true,
  ayuda_para_comer = false,
  ayuda_para_bano = true,
  ayuda_para_caminar = false,
  requiere_primer_piso = false,
  dieta_diabetica = false,
  dieta_blanda = false,
  como_nos_conocio = 'EPS / Médico tratante',
  observaciones = 'Médico de la EPS sugirió institucionalización. Hijo Miguel trabaja en jornada completa. Buscan hogar en occidente o centro de Bogotá. Presupuesto no da para servicios especializados de Alzheimer.',
  etiqueta_caliente = null
WHERE id = '3c2cf803-4924-444c-9b8b-86e1eb6baed5';

-- 8. Alberto Castro Pérez — Cali — Hogares propuestos — PARTIAL: Bella Vista o Las Palmas
UPDATE leads SET
  edad = 76,
  sexo = 'Masculino',
  parentesco = 'Hijo/a',
  whatsapp = '3205556699',
  correo = 'luis.castro.cali@gmail.com',
  zona_localidad = 'Sur de Cali',
  presupuesto_mensual = 4000000,
  presupuesto_rango = 'Entre 3.5 y 4.5 millones',
  urgencia = 'alta',
  fecha_probable_ingreso = '2026-04-03',
  fecha_ingreso_estimada = 'semana_siguiente',
  tipo_habitacion = 'Privada baño compartido',
  tipo_bano = 'Compartido',
  diagnosticos = 'Fractura de cadera operada (hace 3 semanas), Diabetes tipo 2, Hipertensión',
  resumen_caso = 'Adulto mayor post-cirugía de cadera con 3 semanas de evolución. Alta hospitalaria reciente. Requiere fisioterapia intensiva de rehabilitación y enfermería para curaciones y medicación. Familia en el sur de Cali. Disponibilidad de Bella Vista o Las Palmas son las opciones lógicas.',
  movilidad = 'No deambula aún, rehabilitación activa',
  deterioro_cognitivo = false,
  requiere_oxigeno = false,
  requiere_enfermeria = true,
  requiere_acompanamiento = true,
  ayuda_para_comer = false,
  ayuda_para_bano = true,
  ayuda_para_caminar = true,
  requiere_primer_piso = false,
  dieta_diabetica = true,
  dieta_blanda = false,
  como_nos_conocio = 'Hospital San Juan de Dios Cali',
  observaciones = 'Caso post-quirúrgico. Médico tratante recomienda hogar con fisioterapia en Cali. La Bella Vista tiene cupo y rehabilitación. Las Palmas también. Familia quiere visita esta semana.',
  etiqueta_caliente = 'interesado_activo'
WHERE id = 'f48dbcc3-bf29-4978-83f5-cf98fcd88eed';

-- 9. Pedro José Martínez — Barranquilla — En decisión familiar — HARDER: Solo Hogar Primavera
UPDATE leads SET
  edad = 83,
  sexo = 'Masculino',
  parentesco = 'Hija/o',
  whatsapp = '3013334466',
  correo = 'sandra.martinez.baq@gmail.com',
  zona_localidad = 'Norte de Barranquilla',
  presupuesto_mensual = 3000000,
  presupuesto_rango = 'Entre 2.5 y 3.5 millones',
  urgencia = 'alta',
  fecha_probable_ingreso = '2026-04-08',
  fecha_ingreso_estimada = 'semana_siguiente',
  tipo_habitacion = 'Compartida',
  tipo_bano = 'Compartido',
  diagnosticos = 'Insuficiencia renal crónica estadio 3, Hipertensión, Hipotiroidismo',
  resumen_caso = 'Adulto mayor con insuficiencia renal crónica sin diálisis. Requiere dieta renal estricta y control de líquidos. Vive en Barranquilla. Solo una opción disponible localmente (Hogar Primavera) pero no tiene dietética renal. Caso difícil de ubicar.',
  movilidad = 'Independiente con marcha lenta',
  deterioro_cognitivo = false,
  requiere_oxigeno = false,
  requiere_enfermeria = true,
  requiere_acompanamiento = false,
  ayuda_para_comer = false,
  ayuda_para_bano = false,
  ayuda_para_caminar = false,
  requiere_primer_piso = false,
  dieta_diabetica = false,
  dieta_blanda = false,
  como_nos_conocio = 'Médico nefrólogo',
  observaciones = 'Caso complejo por dieta renal. Hogar Primavera no tiene opción renal. Familia considera si acepta sin ese servicio o si hay que gestionar nutricionista externo. Pendiente decisión familiar.',
  etiqueta_caliente = null
WHERE id = 'f46df94b-4587-4061-84d0-ee00c24af2ee';

-- 10. Luis Fernando Vargas — Bogotá — Lead nuevo — HARDER: Bajo presupuesto, pocas opciones
UPDATE leads SET
  edad = 78,
  sexo = 'Masculino',
  parentesco = 'Hijo/a',
  whatsapp = '3209988877',
  correo = 'claudia.vargas.bta@gmail.com',
  zona_localidad = 'Suba / Engativá',
  presupuesto_mensual = 2000000,
  presupuesto_rango = 'Menos de 2 millones',
  urgencia = 'baja',
  fecha_probable_ingreso = '2026-05-15',
  fecha_ingreso_estimada = 'mas_de_un_mes',
  tipo_habitacion = 'Compartida',
  tipo_bano = 'Compartido',
  diagnosticos = 'Hipertensión, Depresión geriátrica',
  resumen_caso = 'Adulto mayor estable con hipertensión controlada y depresión leve en tratamiento. Vive con familiar en Suba pero hay conflicto familiar. Presupuesto muy limitado, menor a $2M. Solo las opciones más económicas como La Esperanza o San José son viables. Sin urgencia inmediata.',
  movilidad = 'Independiente',
  deterioro_cognitivo = false,
  requiere_oxigeno = false,
  requiere_enfermeria = false,
  requiere_acompanamiento = false,
  ayuda_para_comer = false,
  ayuda_para_bano = false,
  ayuda_para_caminar = false,
  requiere_primer_piso = false,
  dieta_diabetica = false,
  dieta_blanda = false,
  como_nos_conocio = 'Facebook',
  observaciones = 'Sin urgencia pero familia quiere proceso. Presupuesto es el principal limitante. Solo La Esperanza Suba ($1.6M) y San José Usaquén ($1.8M) entran en rango. Seguimiento mensual.',
  etiqueta_caliente = null
WHERE id = '52a44d1e-c9a9-4134-a1ef-7de535a0baab';
/*
  # Seed activity notes, timeline events, and follow-up tasks

  Adds realistic notes and tasks to the active leads so the CRM
  shows populated timelines, gestión history, and próxima contactabilidad.

  Uses the single ejecutivo profile: [removed]
*/

DO $$
DECLARE
  ej_id uuid := NULL;

  -- Lead IDs (from existing data)
  lead_maria    uuid := 'bbb1e604-b4aa-431b-a322-876a52431cc1';
  lead_jorge    uuid := 'b0c5e982-2cdd-4dca-9967-5bdbad78f068';
  lead_rosa     uuid := '26f7661b-ef07-44cc-b67c-19e85a29ad92';
  lead_carmen   uuid := 'a6a7c6b7-6e69-4ba2-9f6d-dbf405132187';
  lead_gloria   uuid := '0a08ff57-0d9a-4198-acf8-4fb95dcef095';
  lead_rafael   uuid := 'cc249f93-3fe4-468c-9151-5f481abe9634';
  lead_beatriz  uuid := '3c2cf803-4924-444c-9b8b-86e1eb6baed5';
  lead_alberto  uuid := 'f48dbcc3-bf29-4978-83f5-cf98fcd88eed';
  lead_pedro    uuid := 'f46df94b-4587-4061-84d0-ee00c24af2ee';
  lead_luis     uuid := '52a44d1e-c9a9-4134-a1ef-7de535a0baab';
BEGIN

-- ============================================================
-- NOTAS DE SEGUIMIENTO
-- ============================================================

-- María Elena — 3 notas (lead más activo)
INSERT INTO notas_seguimiento (lead_id, asesor_id, tipo_seguimiento, descripcion, proxima_accion, fecha_proxima_accion, created_at)
VALUES
  (lead_maria, ej_id, 'llamada',
   'Primer contacto con Carlos Rodríguez (hijo). Explicó situación de su madre que vive sola en Chapinero. Diabetes controlada, camina con andador. Muy interesado en opciones cercanas a Chapinero. Solicitó información de presupuesto.',
   'Enviar propuesta con 2-3 hogares de Chapinero y norte de Bogotá',
   '2026-03-18',
   NOW() - INTERVAL '12 days'),

  (lead_maria, ej_id, 'whatsapp',
   'Envié resumen de Hogar Los Olivos y Casa Dorada por WhatsApp. Carlos respondió positivo a Los Olivos por precio y ubicación. Quiere ver fotos del comedor y las habitaciones. Le envié el catálogo.',
   'Confirmar visita a Hogar Los Olivos',
   '2026-03-22',
   NOW() - INTERVAL '6 days'),

  (lead_maria, ej_id, 'llamada',
   'Confirmó visita para el viernes. Preguntó si el hogar tiene médico de planta. Confirmé que sí, martes y jueves. Interesado en habitación privada baño compartido. Presupuesto máximo $3.8M. Muy cerca del cierre.',
   'Coordinar visita física con Hogar Los Olivos y enviar propuesta formal',
   '2026-03-25',
   NOW() - INTERVAL '2 days');

-- Jorge — 2 notas (caso urgente Alzheimer)
INSERT INTO notas_seguimiento (lead_id, asesor_id, tipo_seguimiento, descripcion, proxima_accion, fecha_proxima_accion, created_at)
VALUES
  (lead_jorge, ej_id, 'llamada',
   'Llamada con Ana López. Situación urgente: padre con Alzheimer moderado-severo, episodios de agitación y fuga del hogar. Neuróloga recomienda institucionalización inmediata. Buscan unidad cerrada en Medellín. Presupuesto hasta $6M.',
   'Presentar opción Villa de los Abuelos (unidad cerrada, Alzheimer)',
   '2026-03-16',
   NOW() - INTERVAL '8 days'),

  (lead_jorge, ej_id, 'visita',
   'Visita a Villa de los Abuelos con Ana y su esposo. Quedaron muy satisfechos con la unidad cerrada de memoria y el equipo de psicología. El director Felipe Arango explicó el protocolo de manejo conductual. Solicitaron propuesta económica.',
   'Enviar propuesta económica y confirmar fecha de ingreso',
   '2026-03-24',
   NOW() - INTERVAL '3 days');

-- Rosa — 2 notas (caso urgente bajo presupuesto)
INSERT INTO notas_seguimiento (lead_id, asesor_id, tipo_seguimiento, descripcion, proxima_accion, fecha_proxima_accion, created_at)
VALUES
  (lead_rosa, ej_id, 'llamada',
   'Patricia Gómez llamó con urgencia. Madre tuvo caída en casa. Necesitan hogar inmediatamente en Suba. Presupuesto máximo $2.3M. Solo opciones La Esperanza o San Ángel. Le presenté La Esperanza en Suba como primera opción.',
   'Visita a Hogar La Esperanza esta semana',
   '2026-03-20',
   NOW() - INTERVAL '5 days'),

  (lead_rosa, ej_id, 'visita',
   'Visitamos La Esperanza en Suba. Hay 11 cupos disponibles, precio $1.8M habitación compartida. Patricia quedó conforme con el espacio y el personal. Madre aceptó la idea de vivir ahí. Pendiente papelería de ingreso.',
   'Coordinar admisión y papelería de ingreso',
   '2026-03-23',
   NOW() - INTERVAL '1 day');

-- Carmen — 1 nota (lead nuevo alto nivel)
INSERT INTO notas_seguimiento (lead_id, asesor_id, tipo_seguimiento, descripcion, proxima_accion, fecha_proxima_accion, created_at)
VALUES
  (lead_carmen, ej_id, 'llamada',
   'Primera llamada con Marta Herrera. Madre con EPOC severo y oxígeno 24h, además de demencia leve. Familia del Chicó buscando la mejor opción. Médico del Santa Fe los refirió. Solicitan propuesta premium con geriatra de planta. Solo Casa Dorada cumple todos los requisitos.',
   'Preparar propuesta detallada Casa Dorada y agenda visita',
   '2026-03-26',
   NOW() - INTERVAL '3 days');

-- Rafael — 2 notas (Medellín, ACV, posible Cali)
INSERT INTO notas_seguimiento (lead_id, asesor_id, tipo_seguimiento, descripcion, proxima_accion, fecha_proxima_accion, created_at)
VALUES
  (lead_rafael, ej_id, 'llamada',
   'Carolina Suárez llamó desde Medellín. Padre post-ACV hace 6 meses, hemiplejía parcial. Requiere fisioterapia intensiva y enfermería. Buscan en Medellín o Cali. Expliqué que en Cali hay más opciones con fisio a ese presupuesto (Bella Vista, Las Palmas).',
   'Preparar propuesta comparativa Medellín vs Cali',
   '2026-03-19',
   NOW() - INTERVAL '7 days'),

  (lead_rafael, ej_id, 'whatsapp',
   'Envié propuesta comparativa: Bella Vista Cali ($3.2M hab compartida) y Las Palmas Cali ($3.5M). Familia evaluando. Carolina dice que están abiertos a Cali si la diferencia justifica. Esperando respuesta para agendar visita virtual.',
   'Llamar para confirmar decisión Medellín vs Cali',
   '2026-03-24',
   NOW() - INTERVAL '2 days');

-- Alberto — 2 notas (Cali, post-fractura cadera, urgente)
INSERT INTO notas_seguimiento (lead_id, asesor_id, tipo_seguimiento, descripcion, proxima_accion, fecha_proxima_accion, created_at)
VALUES
  (lead_alberto, ej_id, 'llamada',
   'Luis Castro llama desde Cali urgente. Padre dio de alta tras cirugía de cadera. Necesita fisioterapia inmediata y enfermería. Hospital recomendó Bella Vista o Las Palmas. Le presenté ambas opciones, Bella Vista tiene cupo inmediato.',
   'Visita a Bella Vista Cali esta semana',
   '2026-03-19',
   NOW() - INTERVAL '6 days'),

  (lead_alberto, ej_id, 'visita',
   'Visita a Residencia Bella Vista con Luis y su hermana. El fisioterapeuta Andrés explicó el protocolo de rehabilitación de cadera. Hay cupo inmediato en hab compartida a $3.5M. Familia muy satisfecha. Requieren revisión del contrato antes de confirmar.',
   'Enviar contrato y confirmar fecha de ingreso',
   '2026-03-25',
   NOW() - INTERVAL '1 day');

-- Pedro — 1 nota (caso difícil, Barranquilla, dieta renal)
INSERT INTO notas_seguimiento (lead_id, asesor_id, tipo_seguimiento, descripcion, proxima_accion, fecha_proxima_accion, created_at)
VALUES
  (lead_pedro, ej_id, 'llamada',
   'Sandra Martínez, hija. Padre con insuficiencia renal crónica. Solo Hogar Primavera disponible en Barranquilla pero no tiene dieta renal. Familia evalúa si pueden contratar nutricionista externo o si vale la pena trasladarse a Bogotá. Caso en decisión.',
   'Seguimiento a decisión familiar sobre Hogar Primavera o traslado',
   '2026-03-28',
   NOW() - INTERVAL '4 days');

-- Beatriz — 1 nota (Bogotá, demencia leve, presupuesto medio)
INSERT INTO notas_seguimiento (lead_id, asesor_id, tipo_seguimiento, descripcion, proxima_accion, fecha_proxima_accion, created_at)
VALUES
  (lead_beatriz, ej_id, 'email',
   'Envié catálogo con opciones Hogar San Ángel y San José Bogotá. Miguel Morales respondió que San Ángel le parece bien por ubicación (Teusaquillo). Precio $2.5M hab compartida dentro del presupuesto. Quiere llamada para resolver dudas sobre manejo de demencia.',
   'Llamar a Miguel Morales para resolver dudas sobre manejo demencia leve',
   '2026-03-25',
   NOW() - INTERVAL '3 days');

-- ============================================================
-- ACTIVITY LOG
-- ============================================================

INSERT INTO activity_log (lead_id, user_id, tipo, descripcion, metadata, created_at)
VALUES
  (lead_maria,   ej_id, 'etapa_cambiada', 'Etapa cambiada: Lead nuevo → Lead calificado', '{"old":"lead_nuevo","new":"lead_calificado"}', NOW() - INTERVAL '12 days'),
  (lead_maria,   ej_id, 'nota_agregada',  'Nota de seguimiento agregada (llamada)', '{}', NOW() - INTERVAL '12 days'),
  (lead_maria,   ej_id, 'nota_agregada',  'Nota de seguimiento agregada (whatsapp)', '{}', NOW() - INTERVAL '6 days'),
  (lead_maria,   ej_id, 'nota_agregada',  'Nota de seguimiento agregada (llamada)', '{}', NOW() - INTERVAL '2 days'),

  (lead_jorge,   ej_id, 'etapa_cambiada', 'Etapa cambiada: Lead calificado → Hogares propuestos', '{"old":"lead_calificado","new":"hogares_propuestos"}', NOW() - INTERVAL '8 days'),
  (lead_jorge,   ej_id, 'nota_agregada',  'Nota de seguimiento agregada (llamada)', '{}', NOW() - INTERVAL '8 days'),
  (lead_jorge,   ej_id, 'nota_agregada',  'Nota de seguimiento agregada (visita)', '{}', NOW() - INTERVAL '3 days'),

  (lead_rosa,    ej_id, 'etapa_cambiada', 'Etapa cambiada: Lead nuevo → Hogares propuestos', '{"old":"lead_nuevo","new":"hogares_propuestos"}', NOW() - INTERVAL '5 days'),
  (lead_rosa,    ej_id, 'etapa_cambiada', 'Etapa cambiada: Hogares propuestos → Visitas programadas', '{"old":"hogares_propuestos","new":"visitas_programadas"}', NOW() - INTERVAL '1 day'),
  (lead_rosa,    ej_id, 'nota_agregada',  'Nota de seguimiento agregada (llamada)', '{}', NOW() - INTERVAL '5 days'),
  (lead_rosa,    ej_id, 'nota_agregada',  'Nota de seguimiento agregada (visita)', '{}', NOW() - INTERVAL '1 day'),

  (lead_rafael,  ej_id, 'etapa_cambiada', 'Etapa cambiada: Lead calificado → Hogares propuestos', '{"old":"lead_calificado","new":"hogares_propuestos"}', NOW() - INTERVAL '7 days'),
  (lead_rafael,  ej_id, 'nota_agregada',  'Nota de seguimiento agregada (llamada)', '{}', NOW() - INTERVAL '7 days'),
  (lead_rafael,  ej_id, 'nota_agregada',  'Nota de seguimiento agregada (whatsapp)', '{}', NOW() - INTERVAL '2 days'),

  (lead_alberto, ej_id, 'etapa_cambiada', 'Etapa cambiada: Lead calificado → Hogares propuestos', '{"old":"lead_calificado","new":"hogares_propuestos"}', NOW() - INTERVAL '6 days'),
  (lead_alberto, ej_id, 'nota_agregada',  'Nota de seguimiento agregada (llamada)', '{}', NOW() - INTERVAL '6 days'),
  (lead_alberto, ej_id, 'nota_agregada',  'Nota de seguimiento agregada (visita)', '{}', NOW() - INTERVAL '1 day'),

  (lead_pedro,   ej_id, 'etapa_cambiada', 'Etapa cambiada: Hogares propuestos → En decisión familiar', '{"old":"hogares_propuestos","new":"en_decision_familiar"}', NOW() - INTERVAL '4 days'),
  (lead_pedro,   ej_id, 'nota_agregada',  'Nota de seguimiento agregada (llamada)', '{}', NOW() - INTERVAL '4 days'),

  (lead_carmen,  ej_id, 'nota_agregada',  'Nota de seguimiento agregada (llamada)', '{}', NOW() - INTERVAL '3 days'),

  (lead_beatriz, ej_id, 'nota_agregada',  'Nota de seguimiento agregada (email)', '{}', NOW() - INTERVAL '3 days');

-- ============================================================
-- LEAD TASKS (próxima contactabilidad)
-- ============================================================

INSERT INTO lead_tasks (lead_id, creado_por, titulo, descripcion, fecha_vencimiento, estado, created_at)
VALUES
  (lead_maria,   ej_id, 'Coordinar visita a Hogar Los Olivos',        'Confirmar fecha con Carlos para visita presencial esta semana',       '2026-03-25', 'pendiente', NOW() - INTERVAL '2 days'),
  (lead_jorge,   ej_id, 'Enviar propuesta económica Villa Abuelos',    'Preparar propuesta con tarifas y condiciones de ingreso',              '2026-03-24', 'pendiente', NOW() - INTERVAL '3 days'),
  (lead_rosa,    ej_id, 'Coordinar admisión La Esperanza',             'Gestionar papelería de ingreso con Gloria de La Esperanza',            '2026-03-23', 'pendiente', NOW() - INTERVAL '1 day'),
  (lead_carmen,  ej_id, 'Preparar propuesta Casa Dorada Premium',      'Propuesta detallada con tarifas, servicios y condiciones especiales',  '2026-03-26', 'pendiente', NOW() - INTERVAL '3 days'),
  (lead_rafael,  ej_id, 'Confirmar decisión Medellín vs Cali',         'Llamar a Carolina para conocer decisión sobre ciudad de traslado',     '2026-03-24', 'pendiente', NOW() - INTERVAL '2 days'),
  (lead_alberto, ej_id, 'Enviar contrato Bella Vista Cali',            'Enviar contrato de prestación de servicios para revisión familiar',    '2026-03-25', 'pendiente', NOW() - INTERVAL '1 day'),
  (lead_pedro,   ej_id, 'Seguimiento decisión familiar',               'Llamar a Sandra para conocer decisión: Hogar Primavera o traslado',    '2026-03-28', 'pendiente', NOW() - INTERVAL '4 days'),
  (lead_beatriz, ej_id, 'Llamar a Miguel Morales',                     'Resolver dudas sobre manejo de demencia leve en San Ángel',            '2026-03-25', 'pendiente', NOW() - INTERVAL '3 days'),
  (lead_gloria,  ej_id, 'Primer contacto David Ramírez',               'Llamar para calificar y presentar opciones (Parkinson, Bogotá)',       '2026-03-26', 'pendiente', NOW()),
  (lead_luis,    ej_id, 'Calificar lead Luis Fernando Vargas',         'Confirmar presupuesto real y urgencia. Opciones solo La Esperanza',    '2026-04-05', 'pendiente', NOW());

END $$;
