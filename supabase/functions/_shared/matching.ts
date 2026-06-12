// Módulo compartido: matching lead↔hogares para Telegram.
// Lo usan lead-eventos (al asignar un lead) y telegram-webhook (/hogares).
// Mismo espíritu del motor de ProposalBuilder del CRM, adaptado a Deno.

export interface HogarRow {
  id: string;
  nombre: string;
  localidad: string | null;
  barrio: string | null;
  ciudad: string | null;
  precio_desde: number | null;
  precio_hasta: number | null;
  habitaciones_disponibles: number | null;
  maneja_oxigeno: boolean;
  serv_enfermeria_24h: boolean;
  dieta_diabetica: boolean;
  dieta_blanda: boolean;
  un_solo_nivel: boolean;
  tiene_ascensor: boolean;
  hab_compartida: boolean;
  hab_privada_bano_privado: boolean;
  hab_privada_bano_compartido: boolean;
  telefono: string | null;
  whatsapp: string | null;
  estado: string;
  updated_at: string;
}

export interface LeadParaMatching {
  presupuesto_mensual: number | null;
  presupuesto_rango: string | null;
  zona_localidad: string | null;
  ciudad: string | null;
  requiere_oxigeno: boolean;
  requiere_enfermeria: boolean;
  dieta_diabetica: boolean;
  dieta_blanda: boolean;
  requiere_primer_piso: boolean;
  tipo_habitacion: string | null;
}

const PRESUPUESTO_MAP: Record<string, { min: number; max: number }> = {
  "Menor a 2 millones": { min: 0, max: 2_000_000 },
  "Entre 2 y 4 millones": { min: 2_000_000, max: 4_000_000 },
  "Entre 4 y 6 millones": { min: 4_000_000, max: 6_000_000 },
  "Entre 6 y 8 millones": { min: 6_000_000, max: 8_000_000 },
  "Más de 8 millones": { min: 8_000_000, max: Infinity },
  // Rangos del formulario web nuevo
  "Menos de $2.5M": { min: 0, max: 2_500_000 },
  "Entre $2.5M y $4M": { min: 2_500_000, max: 4_000_000 },
  "Entre $4M y $6M": { min: 4_000_000, max: 6_000_000 },
  "Más de $6M": { min: 6_000_000, max: Infinity },
};

export function normTexto(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface HogarScored {
  hogar: HogarRow;
  score: number;
  razones: string[];
  advertencias: string[];
}

export function scoreHogarParaLead(h: HogarRow, lead: LeadParaMatching): HogarScored {
  let score = 0;
  const razones: string[] = [];
  const advertencias: string[] = [];

  // Presupuesto
  let presMin: number | null = null, presMax: number | null = null;
  if (lead.presupuesto_mensual) {
    presMin = lead.presupuesto_mensual; presMax = lead.presupuesto_mensual;
  } else if (lead.presupuesto_rango && PRESUPUESTO_MAP[lead.presupuesto_rango]) {
    presMin = PRESUPUESTO_MAP[lead.presupuesto_rango].min;
    presMax = PRESUPUESTO_MAP[lead.presupuesto_rango].max;
  }
  if (presMin != null && presMax != null && (h.precio_desde || h.precio_hasta)) {
    const desde = h.precio_desde ?? 0;
    const hasta = h.precio_hasta ?? Number.MAX_SAFE_INTEGER;
    if (hasta >= presMin && desde <= presMax) {
      score += 3;
      razones.push(h.precio_desde ? `$${(h.precio_desde / 1_000_000).toFixed(1)}M` : "presupuesto ok");
    }
  }
  if (!h.precio_desde && !h.precio_hasta) advertencias.push("sin precio");

  // Zona
  const zonaLead = normTexto(lead.zona_localidad);
  if (zonaLead && zonaLead !== "me da igual" && zonaLead !== "cualquier zona") {
    const zonaHogar = `${normTexto(h.localidad)} ${normTexto(h.barrio)}`;
    const tokens = zonaLead.split(/[,/]| y /).map((t) => t.trim()).filter((t) => t.length >= 3);
    const hit = tokens.some((t) => zonaHogar.includes(t)) ||
      (zonaHogar.trim() && zonaLead.includes(normTexto(h.localidad)) && normTexto(h.localidad).length >= 3);
    if (hit) {
      score += 3;
      razones.push(h.localidad || h.barrio || "zona");
    }
  }
  if (!h.localidad && !h.barrio) advertencias.push("sin zona");

  // Necesidades de cuidado
  if (lead.requiere_oxigeno && h.maneja_oxigeno) { score += 2; razones.push("maneja oxígeno"); }
  if (lead.requiere_enfermeria && h.serv_enfermeria_24h) { score += 2; razones.push("enfermería 24h"); }
  if (lead.dieta_diabetica && h.dieta_diabetica) { score += 1; razones.push("dieta diabética"); }
  if (lead.dieta_blanda && h.dieta_blanda) { score += 1; razones.push("dieta blanda"); }
  if (lead.requiere_primer_piso && (h.un_solo_nivel || h.tiene_ascensor)) { score += 2; razones.push("sin escaleras"); }
  if (lead.tipo_habitacion === "Compartida" && h.hab_compartida) score += 1;
  if (lead.tipo_habitacion === "Independiente" && (h.hab_privada_bano_privado || h.hab_privada_bano_compartido)) score += 1;

  // Disponibilidad y frescura
  if ((h.habitaciones_disponibles ?? 0) > 0) {
    score += 2;
    razones.push(`${h.habitaciones_disponibles} cupo${h.habitaciones_disponibles !== 1 ? "s" : ""}`);
  }
  if (h.estado === "activo" || h.estado === "aprobado") score += 1;
  const dias = (Date.now() - Date.parse(h.updated_at)) / 86_400_000;
  if (isFinite(dias) && dias <= 30) score += 1;

  if (!h.telefono && !h.whatsapp) advertencias.push("sin teléfono");

  return { hogar: h, score, razones, advertencias };
}

export function topHogares(hogares: HogarRow[], lead: LeadParaMatching, n = 3): HogarScored[] {
  return hogares
    .filter((h) => h.estado !== "rechazado")
    .map((h) => scoreHogarParaLead(h, lead))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// Bloque de texto Telegram (HTML) con el TOP de hogares.
export function formatearTopHogares(scored: HogarScored[], escapeHtml: (s: string) => string): string {
  if (scored.length === 0 || scored.every((s) => s.score === 0)) {
    return "🏠 <b>Hogares sugeridos:</b> aún no hay coincidencias claras (faltan datos del lead o de los hogares).";
  }
  const lineas = scored.map((s, i) => {
    const razon = s.razones.length ? `encaja: ${s.razones.slice(0, 3).join(", ")}` : "pocos datos para comparar";
    const warn = s.advertencias.length ? ` ⚠ ${s.advertencias.join(", ")}` : "";
    return `${i + 1}. <b>${escapeHtml(s.hogar.nombre)}</b>\n   ${escapeHtml(razon)}${escapeHtml(warn)}`;
  });
  return `🏠 <b>TOP ${scored.length} hogares para este caso:</b>\n${lineas.join("\n")}`;
}
