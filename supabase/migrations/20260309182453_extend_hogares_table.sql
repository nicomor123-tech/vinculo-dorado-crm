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
