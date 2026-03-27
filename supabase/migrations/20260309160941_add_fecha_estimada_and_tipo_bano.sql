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
