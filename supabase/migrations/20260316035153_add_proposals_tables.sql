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
