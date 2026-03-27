/*
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
