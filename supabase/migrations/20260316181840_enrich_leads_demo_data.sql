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
