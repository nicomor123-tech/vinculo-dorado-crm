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
  asesor_id uuid REFERENCES profiles(id) NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_hogares_ciudad ON hogares(ciudad);