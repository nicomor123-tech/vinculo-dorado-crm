// Qué le falta a un hogar para estar "completo" comercialmente.
// Lo usan el módulo de Hogares (badge + filtro) e Inteligencia (contador).
// Nota: oxígeno/servicios son booleanos NOT NULL en la BD (false ≠ "falta el
// dato"), por eso la completitud se mide sobre los campos que sí distinguen
// vacío: precio, zona, teléfono, fotos y descripción.

export interface HogarParaCompletitud {
  precio_desde: number | null;
  localidad: string | null;
  barrio: string | null;
  telefono: string | null;
  whatsapp: string | null;
  descripcion: string | null;
}

export function faltantesDeHogar(h: HogarParaCompletitud, fotosCount: number | null): string[] {
  const faltan: string[] = [];
  if (fotosCount !== null && fotosCount === 0) faltan.push('fotos');
  if (!h.precio_desde) faltan.push('precio');
  if (!h.localidad && !h.barrio) faltan.push('zona');
  if (!h.telefono && !h.whatsapp) faltan.push('teléfono');
  if (!h.descripcion || h.descripcion.trim().length < 20) faltan.push('descripción');
  return faltan;
}
