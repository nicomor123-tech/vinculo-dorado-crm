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
  - admin:     49b10aa4-baf1-4eb6-9545-ed5a571d2aac
  - ejecutivo: e44095a2-5660-4bf0-a73f-748a4df3790c
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
  '49b10aa4-baf1-4eb6-9545-ed5a571d2aac'
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
  '49b10aa4-baf1-4eb6-9545-ed5a571d2aac'
WHERE NOT EXISTS (SELECT 1 FROM hogares WHERE nombre = 'Residencia Las Palmas Cali');

-- ============================================================
-- STEP 3: Assign ejecutivo + asesor to all leads missing them
-- ============================================================

UPDATE leads SET
  ejecutivo_id = 'e44095a2-5660-4bf0-a73f-748a4df3790c',
  asesor_id = '49b10aa4-baf1-4eb6-9545-ed5a571d2aac'
WHERE ejecutivo_id IS NULL AND ciudad IN ('Bogotá', 'Medellín');

UPDATE leads SET
  ejecutivo_id = '49b10aa4-baf1-4eb6-9545-ed5a571d2aac',
  asesor_id = '49b10aa4-baf1-4eb6-9545-ed5a571d2aac'
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
  '49b10aa4-baf1-4eb6-9545-ed5a571d2aac',
  'e44095a2-5660-4bf0-a73f-748a4df3790c'
WHERE NOT EXISTS (
  SELECT 1 FROM leads WHERE nombre_contacto = 'Roberto Peña' AND estado = 'cierre_perdido'
);
