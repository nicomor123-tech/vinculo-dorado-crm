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
