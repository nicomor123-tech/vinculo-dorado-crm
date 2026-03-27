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
