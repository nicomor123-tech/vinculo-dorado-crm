/*
  # Seed activity notes, timeline events, and follow-up tasks

  Adds realistic notes and tasks to the active leads so the CRM
  shows populated timelines, gestión history, and próxima contactabilidad.

  Uses the single ejecutivo profile: e44095a2-5660-4bf0-a73f-748a4df3790c
*/

DO $$
DECLARE
  ej_id uuid := 'e44095a2-5660-4bf0-a73f-748a4df3790c';

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
