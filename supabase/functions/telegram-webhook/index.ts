// Edge Function: telegram-webhook
// Bot de Telegram del CRM Vínculo Dorado.
//
// Maneja:
//  1. callback_query "asg:<leadId>:<alias>"  — asignación de leads por botones
//     (alias resuelto contra profiles.telegram_alias: cero IDs hardcodeados).
//  2. callback_query "tgp:<pendienteId>:<idx>" — selección de lead cuando una
//     gestión dictada por texto/voz tuvo varios candidatos.
//  3. message (texto)  — comandos /hoy /lead /ayuda, o una gestión en lenguaje
//     natural que se interpreta con Gemini y se registra en el CRM.
//  4. message (voice/audio) — nota de voz: se transcribe + interpreta con
//     Gemini (audio inline base64) y se registra igual que el texto.
//
// Solo responde a chats cuyo chat_id exista en profiles.telegram_chat_id
// (activo = true). Cualquier otro chat se ignora EN SILENCIO.
//
// Seguridad:
//  - Header X-Telegram-Bot-Api-Secret-Token == TELEGRAM_WEBHOOK_SECRET (fail-closed).
//  - Idempotencia por update_id (tabla telegram_updates): Telegram reintenta
//    el webhook si tardamos; sin esto se duplicarían gestiones.

const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

const TG_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const TG_FILE = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}`;
const CRM_URL = "https://crm.vinculodorado.co";

const ETAPAS_VALIDAS = [
  "lead_nuevo", "lead_calificado", "no_contesta", "hogares_propuestos",
  "visitas_programadas", "en_decision_familiar", "escalado_nico",
  "cierre_ganado", "cierre_perdido", "fallecido",
];
const ETAPAS_TERMINALES = ["cierre_ganado", "cierre_perdido", "fallecido"];
const ETAPA_LABELS: Record<string, string> = {
  lead_nuevo: "Lead nuevo",
  lead_calificado: "Lead calificado",
  no_contesta: "No contesta",
  hogares_propuestos: "Hogares propuestos",
  visitas_programadas: "Visitas programadas",
  en_decision_familiar: "En decisión familiar",
  escalado_nico: "Escalado a Nicolás",
  cierre_ganado: "Cierre ganado",
  cierre_perdido: "Cierre perdido",
  fallecido: "Fallecido",
};
const TIPOS_GESTION = ["llamada", "whatsapp", "visita", "email", "otro"];

// ---------------------------------------------------------------------------
// Helpers genéricos
// ---------------------------------------------------------------------------

function ok(): Response {
  return new Response("ok", { status: 200 });
}

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sbGet(pathAndQuery: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: restHeaders(),
  });
  const rows = await res.json().catch(() => []);
  if (!res.ok) {
    console.error(`GET ${pathAndQuery} falló:`, res.status, rows);
    return [];
  }
  return Array.isArray(rows) ? rows : [];
}

async function sbInsert(table: string, body: unknown, prefer = "return=representation"): Promise<any[] | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: restHeaders({ Prefer: prefer }),
    body: JSON.stringify(body),
  });
  if (prefer === "return=minimal") {
    if (!res.ok) {
      console.error(`INSERT ${table} falló:`, res.status, await res.text().catch(() => ""));
      return null;
    }
    return [];
  }
  const rows = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`INSERT ${table} falló:`, res.status, rows);
    return null;
  }
  return Array.isArray(rows) ? rows : null;
}

async function sbPatch(pathAndQuery: string, body: unknown): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: "PATCH",
    headers: restHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`PATCH ${pathAndQuery} falló:`, res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

async function tg(method: string, payload: unknown): Promise<any> {
  try {
    const res = await fetch(`${TG_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) console.error(`Telegram ${method} falló: ${res.status}`, body);
    return body;
  } catch (err) {
    console.error(`Telegram ${method} error:`, err);
    return null;
  }
}

function tgSend(chatId: number | string, text: string, replyMarkup?: unknown): Promise<any> {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

// Hora/fecha legible en Colombia.
function fmtFechaCO(iso: string, conDia = true): string {
  try {
    return new Date(iso).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      ...(conDia ? { weekday: "long", day: "numeric", month: "long" } : {}),
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

// "ahora" en Bogotá como texto para el prompt de Gemini.
function ahoraBogotaTexto(): string {
  return new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

// Inicio del día actual en Bogotá (UTC-5 fijo, Colombia no tiene DST) como ISO UTC.
function inicioDiaBogotaIso(): string {
  const now = new Date();
  const bog = new Date(now.getTime() - 5 * 3600_000);
  const y = bog.getUTCFullYear(), m = bog.getUTCMonth(), d = bog.getUTCDate();
  return new Date(Date.UTC(y, m, d, 5, 0, 0)).toISOString(); // 00:00 Bogotá = 05:00 UTC
}

function normalizar(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// base64 seguro para buffers grandes (notas de voz).
function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Idempotencia por update_id
// ---------------------------------------------------------------------------

async function esUpdateNuevo(updateId: number): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/telegram_updates`, {
      method: "POST",
      headers: restHeaders({ Prefer: "resolution=ignore-duplicates,return=representation" }),
      body: JSON.stringify([{ update_id: updateId }]),
    });
    if (!res.ok) {
      // Si la tabla aún no existe, no bloqueamos el bot (modo degradado).
      console.error("telegram_updates insert falló:", res.status, await res.text().catch(() => ""));
      return true;
    }
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows.length > 0; // [] => duplicado ya procesado
  } catch (err) {
    console.error("esUpdateNuevo error:", err);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Perfiles
// ---------------------------------------------------------------------------

interface Perfil {
  id: string;
  nombre_completo: string;
  rol: string;
  telegram_chat_id: string | null;
}

async function getPerfilPorChatId(chatId: number | string): Promise<Perfil | null> {
  const rows = await sbGet(
    `profiles?telegram_chat_id=eq.${encodeURIComponent(String(chatId))}&activo=eq.true&select=id,nombre_completo,rol,telegram_chat_id`,
  );
  return rows[0] ?? null;
}

async function getPerfilPorAlias(alias: string): Promise<Perfil | null> {
  const rows = await sbGet(
    `profiles?telegram_alias=eq.${encodeURIComponent(alias)}&activo=eq.true&select=id,nombre_completo,rol,telegram_chat_id`,
  );
  return rows[0] ?? null;
}

function esAdmin(perfil: Perfil): boolean {
  return perfil.rol === "administrador";
}

function primerNombre(perfil: Perfil): string {
  return (perfil.nombre_completo || "").split(" ")[0] || "👋";
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

async function geminiGenerate(parts: unknown[]): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY no configurada");
    return null;
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("Gemini falló:", res.status, JSON.stringify(body).slice(0, 500));
      return null;
    }
    return body?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (err) {
    console.error("Gemini error:", err);
    return null;
  }
}

function parseJsonSeguro(raw: string | null): any | null {
  if (!raw) return null;
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(s);
  } catch {
    const i = s.indexOf("{"), j = s.lastIndexOf("}");
    if (i >= 0 && j > i) {
      try { return JSON.parse(s.slice(i, j + 1)); } catch { return null; }
    }
    return null;
  }
}

interface GestionParsed {
  transcripcion: string | null;
  lead_referencia: string | null;
  tipo_gestion: string;
  nota: string;
  proxima_accion: string | null;
  proxima_fecha_iso: string | null;
  etapa_sugerida: string | null;
}

function promptInterpretacion(): string {
  return `Eres el asistente del CRM de Vínculo Dorado, una empresa colombiana que ubica adultos mayores en hogares gerontológicos. Una ejecutiva comercial o un administrador acaba de dictar (por texto o nota de voz) la gestión que hizo con la familia de un cliente.

AHORA MISMO en Colombia (zona America/Bogota, UTC-05:00) es: ${ahoraBogotaTexto()}.

Tu trabajo: extraer la gestión en JSON ESTRICTO con EXACTAMENTE estos campos:
{
  "transcripcion": string | null,   // si el mensaje fue audio: transcripción fiel y completa en español. Si fue texto: null
  "lead_referencia": string | null, // nombre de la persona/cliente/familia mencionada (tal como la dijeron). null si no mencionan a nadie
  "tipo_gestion": "llamada" | "whatsapp" | "visita" | "email" | "otro",
  "nota": string,                   // resumen profesional en español de lo gestionado/acordado (1 a 3 frases, tercera persona)
  "proxima_accion": string | null,  // qué hay que hacer después, en infinitivo corto, ej: "Visitar el hogar San José". null si no se acordó nada
  "proxima_fecha_iso": string | null, // fecha y hora del próximo paso en formato ISO 8601 CON offset -05:00, ej: "2026-06-12T10:00:00-05:00". null si no mencionan cuándo
  "etapa_sugerida": string | null   // SOLO si piden explícitamente mover el caso de etapa. Valores permitidos: ${ETAPAS_VALIDAS.join(", ")}. En cualquier otro caso null
}

Reglas para fechas en lenguaje natural (interpreta SIEMPRE en America/Bogota):
- "mañana a las 10" => mañana 10:00. "el viernes" sin hora => ese viernes 09:00.
- "en la tarde" => 15:00; "en la mañana" => 09:00; "en la noche" => 19:00.
- Si la fecha ya pasó esta semana, usa la próxima ocurrencia futura.
- Nunca devuelvas una fecha en el pasado.

Reglas para etapa_sugerida:
- "no contesta / no me contesta" => "no_contesta". "ya cerramos / ingresó al hogar / quedó en el hogar" => "cierre_ganado".
- "se perdió / eligieron otra opción / ya no quieren" => "cierre_perdido". "falleció" => "fallecido".
- "escalar a Nicolás / que lo vea Nicolás" => "escalado_nico". Si solo narran una gestión normal => null.

Responde SOLO el JSON, sin texto adicional.`;
}

async function interpretarTexto(texto: string): Promise<GestionParsed | null> {
  const raw = await geminiGenerate([
    { text: promptInterpretacion() },
    { text: `Mensaje del usuario (texto):\n"""${texto}"""` },
  ]);
  return validarParsed(parseJsonSeguro(raw), null);
}

async function interpretarAudio(b64: string, mime: string): Promise<GestionParsed | null> {
  const raw = await geminiGenerate([
    { text: promptInterpretacion() + "\n\nEl mensaje del usuario es la NOTA DE VOZ adjunta. Transcríbela fielmente en el campo 'transcripcion' y extrae la gestión." },
    { inlineData: { mimeType: mime, data: b64 } },
  ]);
  return validarParsed(parseJsonSeguro(raw), "(audio)");
}

function validarParsed(p: any, transcripcionDefault: string | null): GestionParsed | null {
  if (!p || typeof p !== "object") return null;
  const tipo = TIPOS_GESTION.includes(p.tipo_gestion) ? p.tipo_gestion : "otro";
  let etapa = typeof p.etapa_sugerida === "string" && ETAPAS_VALIDAS.includes(p.etapa_sugerida)
    ? p.etapa_sugerida
    : null;
  let fechaIso: string | null = null;
  if (typeof p.proxima_fecha_iso === "string" && p.proxima_fecha_iso.trim()) {
    const d = new Date(p.proxima_fecha_iso);
    if (!isNaN(d.getTime())) fechaIso = d.toISOString();
  }
  return {
    transcripcion: typeof p.transcripcion === "string" && p.transcripcion.trim() ? p.transcripcion.trim() : transcripcionDefault,
    lead_referencia: typeof p.lead_referencia === "string" && p.lead_referencia.trim() ? p.lead_referencia.trim() : null,
    tipo_gestion: tipo,
    nota: typeof p.nota === "string" && p.nota.trim() ? p.nota.trim() : "Gestión registrada desde Telegram.",
    proxima_accion: typeof p.proxima_accion === "string" && p.proxima_accion.trim() ? p.proxima_accion.trim() : null,
    proxima_fecha_iso: fechaIso,
    etapa_sugerida: etapa,
  };
}

// ---------------------------------------------------------------------------
// Matching de leads
// ---------------------------------------------------------------------------

interface LeadLite {
  id: string;
  nombre_adulto_mayor: string;
  nombre_contacto: string;
  estado: string;
  urgencia: string | null;
  telefono_principal: string | null;
  ejecutivo_id: string | null;
  proxima_contactabilidad: string | null;
  proxima_accion: string | null;
}

const LEAD_SELECT = "id,nombre_adulto_mayor,nombre_contacto,estado,urgencia,telefono_principal,ejecutivo_id,proxima_contactabilidad,proxima_accion";

async function cargarLeadsActivos(perfil: Perfil): Promise<LeadLite[]> {
  let q = `leads?estado=not.in.(${ETAPAS_TERMINALES.join(",")})&select=${LEAD_SELECT}&order=updated_at.desc&limit=400`;
  if (!esAdmin(perfil)) q += `&ejecutivo_id=eq.${perfil.id}`;
  return await sbGet(q) as LeadLite[];
}

function scoreLead(lead: LeadLite, refNorm: string, tokens: string[]): number {
  const am = normalizar(lead.nombre_adulto_mayor);
  const ct = normalizar(lead.nombre_contacto);
  let score = 0;
  if (refNorm.length >= 4 && (am.includes(refNorm) || ct.includes(refNorm))) score += 5;
  for (const t of tokens) {
    if (am.includes(t)) score += 2;
    if (ct.includes(t)) score += 2;
  }
  return score;
}

function buscarLeads(leads: LeadLite[], referencia: string): LeadLite[] {
  const refNorm = normalizar(referencia);
  const tokens = refNorm.split(" ").filter((t) => t.length >= 2);
  if (!refNorm || tokens.length === 0) return [];
  const scored = leads
    .map((l) => ({ l, s: scoreLead(l, refNorm, tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0) return [];
  // Match claro: único, o el primero domina con score alto.
  if (scored.length === 1) return [scored[0].l];
  if (scored[0].s >= 4 && scored[0].s > scored[1].s) return [scored[0].l];
  return scored.slice(0, 5).map((x) => x.l);
}

// ---------------------------------------------------------------------------
// Ejecución de la gestión en el CRM
// ---------------------------------------------------------------------------

async function ejecutarGestion(lead: LeadLite, parsed: GestionParsed, perfil: Perfil): Promise<string> {
  const nowIso = new Date().toISOString();
  const cliente = lead.nombre_contacto || lead.nombre_adulto_mayor || "el cliente";

  let descripcion = parsed.nota;
  if (parsed.transcripcion && parsed.transcripcion !== "(audio)") {
    descripcion += `\n\n🎙️ Transcripción: "${parsed.transcripcion}"`;
  }

  // 1) Gestión en notas_seguimiento (la tabla real de gestiones del CRM).
  await sbInsert("notas_seguimiento", {
    lead_id: lead.id,
    asesor_id: perfil.id,
    tipo_seguimiento: parsed.tipo_gestion,
    descripcion,
    proxima_accion: parsed.proxima_accion,
    fecha_proxima_accion: parsed.proxima_fecha_iso,
  }, "return=minimal");

  // 2) Cronología.
  await sbInsert("activity_log", {
    lead_id: lead.id,
    user_id: perfil.id,
    tipo: "nota_agregada",
    descripcion: `Gestión registrada desde Telegram (${parsed.tipo_gestion})`,
    metadata: { origen: "telegram", tipo_gestion: parsed.tipo_gestion, voz: !!parsed.transcripcion },
  }, "return=minimal");

  // 3) Cambio de etapa (solo si el usuario lo pidió y es válida).
  const cambiaEtapa = !!parsed.etapa_sugerida && parsed.etapa_sugerida !== lead.estado;
  if (cambiaEtapa) {
    await sbInsert("activity_log", {
      lead_id: lead.id,
      user_id: perfil.id,
      tipo: "etapa_cambiada",
      descripcion: `Etapa cambiada: ${ETAPA_LABELS[lead.estado] ?? lead.estado} → ${ETAPA_LABELS[parsed.etapa_sugerida!]}`,
      metadata: { old: lead.estado, new: parsed.etapa_sugerida, origen: "telegram" },
    }, "return=minimal");
  }

  // 4) Lead: próxima contactabilidad + reset del motor de recordatorios.
  const patch: Record<string, unknown> = { updated_at: nowIso };
  if (cambiaEtapa) patch.estado = parsed.etapa_sugerida;
  if (parsed.proxima_fecha_iso) {
    patch.proxima_contactabilidad = parsed.proxima_fecha_iso;
    patch.proxima_accion = parsed.proxima_accion;
    patch.recordatorio_ref = parsed.proxima_fecha_iso;
  }
  if (cambiaEtapa || parsed.proxima_fecha_iso) {
    patch.recordatorios_enviados = 0;
    patch.ultimo_recordatorio = null;
    patch.escalado_supervision = false;
  }
  await sbPatch(`leads?id=eq.${lead.id}`, patch);
  // ultima_gestion por separado (best-effort, por si el SQL aún no se corrió).
  await sbPatch(`leads?id=eq.${lead.id}`, { ultima_gestion: nowIso });

  // 5) Tarea para la agenda (mismo comportamiento del panel de gestión del CRM).
  if (parsed.proxima_fecha_iso) {
    await sbInsert("lead_tasks", {
      lead_id: lead.id,
      creado_por: perfil.id,
      titulo: parsed.proxima_accion || `Próximo contacto – ${parsed.tipo_gestion}`,
      descripcion: parsed.nota.slice(0, 160) || null,
      fecha_vencimiento: parsed.proxima_fecha_iso,
      estado: "pendiente",
    }, "return=minimal");
  }

  // 6) Confirmación en lenguaje natural.
  const tipoTxt: Record<string, string> = {
    llamada: "la llamada", whatsapp: "el WhatsApp", visita: "la visita",
    email: "el correo", otro: "la gestión",
  };
  let msg = `✅ Listo ${primerNombre(perfil)}, registré ${tipoTxt[parsed.tipo_gestion] ?? "la gestión"} con <b>${escapeHtml(cliente)}</b>.`;
  if (parsed.proxima_accion && parsed.proxima_fecha_iso) {
    msg += `\n\n📅 Próximo paso: <b>${escapeHtml(parsed.proxima_accion)}</b> el ${fmtFechaCO(parsed.proxima_fecha_iso)}. Yo te lo recuerdo.`;
  } else if (parsed.proxima_fecha_iso) {
    msg += `\n\n📅 Próximo contacto: ${fmtFechaCO(parsed.proxima_fecha_iso)}. Yo te lo recuerdo.`;
  } else if (parsed.proxima_accion) {
    msg += `\n\n📌 Próximo paso: <b>${escapeHtml(parsed.proxima_accion)}</b> (sin fecha — si me dices cuándo, te lo recuerdo).`;
  } else {
    msg += `\n\n💡 No quedó próximo paso agendado. Si quieres, dime cuándo retomar y lo dejo programado.`;
  }
  if (cambiaEtapa) {
    msg += `\n\n🔄 Etapa actualizada a <b>${ETAPA_LABELS[parsed.etapa_sugerida!]}</b>.`;
    if (parsed.etapa_sugerida === "cierre_ganado") {
      msg += ` 🏆 ¡Felicitaciones! Recuerda registrar la comisión en el CRM.`;
    }
  }
  msg += `\n\n🔗 ${CRM_URL}/leads/${lead.id}`;
  return msg;
}

// Guarda un pendiente y pregunta cuál lead es.
async function preguntarCandidatos(
  chatId: number | string,
  perfil: Perfil,
  parsed: GestionParsed,
  candidatos: LeadLite[],
): Promise<void> {
  const payload = {
    parsed,
    candidatos: candidatos.map((c) => ({ id: c.id })),
  };
  const rows = await sbInsert("telegram_pendientes", {
    chat_id: String(chatId),
    profile_id: perfil.id,
    payload,
  });
  const pendienteId = rows?.[0]?.id;
  if (!pendienteId) {
    await tgSend(chatId, "😕 No pude guardar la selección. Inténtalo de nuevo en un momento.");
    return;
  }
  const keyboard = candidatos.map((c, i) => ([{
    text: `${c.nombre_adulto_mayor}${c.nombre_contacto ? ` (${c.nombre_contacto})` : ""}`.slice(0, 60),
    callback_data: `tgp:${pendienteId}:${i}`,
  }]));
  await tgSend(
    chatId,
    `🔎 Encontré <b>${candidatos.length}</b> clientes parecidos a "<i>${escapeHtml(parsed.lead_referencia ?? "")}</i>". ¿Con cuál registro la gestión?`,
    { inline_keyboard: keyboard },
  );
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

async function cmdAyuda(chatId: number | string, perfil: Perfil): Promise<void> {
  await tgSend(
    chatId,
    `👋 Hola ${primerNombre(perfil)}, soy el asistente de <b>Vínculo Dorado</b>.\n\n` +
      `Me puedes hablar normal, por texto o con una <b>nota de voz</b> 🎙️, por ejemplo:\n` +
      `<i>"Acabo de llamar a María Rodríguez, quedó de visitar el hogar San José el viernes a las 10 de la mañana"</i>\n\n` +
      `Y yo registro la gestión en el CRM, agendo el próximo paso y te lo recuerdo.\n\n` +
      `<b>Comandos:</b>\n` +
      `/hoy — tus citas y gestiones de hoy\n` +
      `/lead &lt;nombre&gt; — resumen rápido de un cliente\n` +
      `/ayuda — esta ayuda`,
  );
}

async function cmdHoy(chatId: number | string, perfil: Perfil): Promise<void> {
  const inicio = inicioDiaBogotaIso();
  const fin = new Date(Date.parse(inicio) + 24 * 3600_000).toISOString();
  const nowIso = new Date().toISOString();
  const filtroEj = esAdmin(perfil) ? "" : `&ejecutivo_id=eq.${perfil.id}`;

  const [citasHoy, vencidos, gestionesHoy] = await Promise.all([
    sbGet(
      `leads?estado=not.in.(${ETAPAS_TERMINALES.join(",")})${filtroEj}` +
        `&proxima_contactabilidad=gte.${encodeURIComponent(inicio)}` +
        `&proxima_contactabilidad=lt.${encodeURIComponent(fin)}` +
        `&select=${LEAD_SELECT}&order=proxima_contactabilidad.asc`,
    ),
    sbGet(
      `leads?estado=not.in.(${ETAPAS_TERMINALES.join(",")})${filtroEj}` +
        `&proxima_contactabilidad=lt.${encodeURIComponent(nowIso)}` +
        `&select=id,nombre_contacto,nombre_adulto_mayor,proxima_accion&order=proxima_contactabilidad.asc&limit=10`,
    ),
    sbGet(
      `notas_seguimiento?${esAdmin(perfil) ? "" : `asesor_id=eq.${perfil.id}&`}` +
        `created_at=gte.${encodeURIComponent(inicio)}&select=id,tipo_seguimiento`,
    ),
  ]);

  let msg = `📋 <b>Tu día, ${primerNombre(perfil)}</b> — ${new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" })}\n`;

  msg += `\n<b>📅 Citas y contactos de hoy (${citasHoy.length})</b>\n`;
  if (citasHoy.length === 0) {
    msg += `Sin contactos programados para hoy.\n`;
  } else {
    for (const l of citasHoy.slice(0, 10)) {
      const hora = fmtFechaCO(l.proxima_contactabilidad, false);
      msg += `• ${hora} — <b>${escapeHtml(l.nombre_contacto || l.nombre_adulto_mayor)}</b>: ${escapeHtml(l.proxima_accion || "Contactar")}\n`;
    }
  }

  if (vencidos.length > 0) {
    msg += `\n<b>⚠️ Vencidos sin atender (${vencidos.length})</b>\n`;
    for (const l of vencidos.slice(0, 5)) {
      msg += `• <b>${escapeHtml(l.nombre_contacto || l.nombre_adulto_mayor)}</b>: ${escapeHtml(l.proxima_accion || "Contactar")}\n`;
    }
    if (vencidos.length > 5) msg += `… y ${vencidos.length - 5} más.\n`;
  }

  msg += `\n<b>✍️ Gestiones registradas hoy:</b> ${gestionesHoy.length}`;
  if (gestionesHoy.length > 0) {
    const porTipo: Record<string, number> = {};
    for (const g of gestionesHoy) porTipo[g.tipo_seguimiento] = (porTipo[g.tipo_seguimiento] ?? 0) + 1;
    msg += ` (${Object.entries(porTipo).map(([t, n]) => `${n} ${t}`).join(", ")})`;
  }
  msg += `\n\n🔗 ${CRM_URL}`;

  await tgSend(chatId, msg);
}

async function cmdLead(chatId: number | string, perfil: Perfil, query: string): Promise<void> {
  if (!query.trim()) {
    await tgSend(chatId, `Dime el nombre, por ejemplo: <code>/lead María Rodríguez</code>`);
    return;
  }
  const leads = await cargarLeadsActivos(perfil);
  const matches = buscarLeads(leads, query);
  if (matches.length === 0) {
    await tgSend(chatId, `🔎 No encontré ningún cliente activo parecido a "<i>${escapeHtml(query)}</i>"${esAdmin(perfil) ? "" : " entre tus leads"}. ¿Me das el nombre más completo?`);
    return;
  }
  if (matches.length > 1) {
    const lista = matches.map((m) => `• <b>${escapeHtml(m.nombre_adulto_mayor)}</b> (${escapeHtml(m.nombre_contacto)}) — ${ETAPA_LABELS[m.estado] ?? m.estado}`).join("\n");
    await tgSend(chatId, `🔎 Encontré varios parecidos:\n\n${lista}\n\nRepite el comando con el nombre más completo.`);
    return;
  }
  const lead = matches[0];
  const [ultimaGestion] = await sbGet(
    `notas_seguimiento?lead_id=eq.${lead.id}&select=tipo_seguimiento,descripcion,created_at&order=created_at.desc&limit=1`,
  );
  let msg = `👤 <b>${escapeHtml(lead.nombre_adulto_mayor)}</b>\n` +
    `Contacto: ${escapeHtml(lead.nombre_contacto || "—")} · 📞 ${escapeHtml(lead.telefono_principal || "—")}\n` +
    `Etapa: <b>${ETAPA_LABELS[lead.estado] ?? lead.estado}</b> · Urgencia: ${escapeHtml(lead.urgencia || "—")}\n`;
  if (lead.proxima_contactabilidad) {
    msg += `Próximo contacto: ${fmtFechaCO(lead.proxima_contactabilidad)} — ${escapeHtml(lead.proxima_accion || "Contactar")}\n`;
  } else {
    msg += `Próximo contacto: <i>sin programar</i>\n`;
  }
  if (ultimaGestion) {
    msg += `\n📝 <b>Última gestión</b> (${escapeHtml(ultimaGestion.tipo_seguimiento)}, ${fmtFechaCO(ultimaGestion.created_at)}):\n<i>${escapeHtml((ultimaGestion.descripcion || "").slice(0, 300))}</i>\n`;
  } else {
    msg += `\n📝 Sin gestiones registradas aún.\n`;
  }
  msg += `\n🔗 ${CRM_URL}/leads/${lead.id}`;
  await tgSend(chatId, msg);
}

// ---------------------------------------------------------------------------
// Handler: mensaje entrante (texto o voz)
// ---------------------------------------------------------------------------

async function handleMessage(message: any): Promise<void> {
  const chatId = message?.chat?.id;
  if (chatId == null) return;

  // Solo chats autorizados (profiles.telegram_chat_id). Otros: silencio total.
  const perfil = await getPerfilPorChatId(chatId);
  if (!perfil) return;

  const texto: string | undefined = message.text;
  const voice = message.voice ?? message.audio ?? null;

  // --- Comandos ---
  if (texto) {
    const t = texto.trim();
    if (t === "/start" || t === "/ayuda" || t === "/help") {
      await cmdAyuda(chatId, perfil);
      return;
    }
    if (t === "/hoy" || t.startsWith("/hoy@")) {
      await cmdHoy(chatId, perfil);
      return;
    }
    if (t.startsWith("/lead")) {
      await cmdLead(chatId, perfil, t.replace(/^\/lead(@\w+)?/i, "").trim());
      return;
    }
    if (t.startsWith("/")) {
      await tgSend(chatId, `No conozco ese comando 🤔. Prueba /hoy, /lead &lt;nombre&gt; o /ayuda.`);
      return;
    }
  }

  // --- Gestión por texto o voz ---
  let parsed: GestionParsed | null = null;

  if (voice) {
    const size = voice.file_size ?? 0;
    if (size > 18 * 1024 * 1024) {
      await tgSend(chatId, `🎙️ Ese audio está muy pesado. Mándame una nota de voz más corta (máx ~15 minutos).`);
      return;
    }
    const fileInfo = await tg("getFile", { file_id: voice.file_id });
    const filePath = fileInfo?.result?.file_path;
    if (!filePath) {
      await tgSend(chatId, `😕 No pude descargar el audio de Telegram. Inténtalo otra vez.`);
      return;
    }
    try {
      const audioRes = await fetch(`${TG_FILE}/${filePath}`);
      if (!audioRes.ok) throw new Error(`status ${audioRes.status}`);
      const buf = await audioRes.arrayBuffer();
      const mime = voice.mime_type || "audio/ogg";
      parsed = await interpretarAudio(bufferToBase64(buf), mime);
    } catch (err) {
      console.error("Descarga/transcripción de audio falló:", err);
      await tgSend(chatId, `😕 No pude procesar el audio. Inténtalo de nuevo o mándame la gestión por texto.`);
      return;
    }
    if (!parsed) {
      await tgSend(chatId, `🤖 No logré entender el audio (¿se escucha bien?). Inténtalo de nuevo o escríbeme la gestión.`);
      return;
    }
  } else if (texto) {
    parsed = await interpretarTexto(texto);
    if (!parsed) {
      await tgSend(chatId, `🤖 En este momento no pude interpretar el mensaje. Inténtalo de nuevo en unos minutos.`);
      return;
    }
  } else {
    // Fotos, stickers, documentos…
    await tgSend(chatId, `Por ahora entiendo <b>texto</b> y <b>notas de voz</b> 🎙️. Cuéntame la gestión por ahí.`);
    return;
  }

  if (!parsed.lead_referencia) {
    await tgSend(
      chatId,
      `📝 Te entendí esto: <i>"${escapeHtml(parsed.nota)}"</i>\n\nPero no me dijiste <b>de qué cliente</b> es. Repíteme la gestión con el nombre, ej: <i>"llamé a María Rodríguez y..."</i>`,
    );
    return;
  }

  const leads = await cargarLeadsActivos(perfil);
  const matches = buscarLeads(leads, parsed.lead_referencia);

  if (matches.length === 0) {
    await tgSend(
      chatId,
      `🔎 No encontré ningún cliente activo parecido a "<i>${escapeHtml(parsed.lead_referencia)}</i>"${esAdmin(perfil) ? "" : " entre tus leads"}.\n\n¿Me repites la gestión con el nombre más completo?`,
    );
    return;
  }
  if (matches.length === 1) {
    const confirmacion = await ejecutarGestion(matches[0], parsed, perfil);
    await tgSend(chatId, confirmacion);
    return;
  }
  await preguntarCandidatos(chatId, perfil, parsed, matches);
}

// ---------------------------------------------------------------------------
// Handler: callbacks
// ---------------------------------------------------------------------------

async function answerCallback(callbackId: string, text: string): Promise<void> {
  await tg("answerCallbackQuery", { callback_query_id: callbackId, text });
}

// "asg:<leadId>:<alias>" — asignación de lead (botones del aviso de lead nuevo).
async function handleCallbackAsignacion(cb: any, leadId: string, alias: string): Promise<void> {
  const callbackId: string = cb.id;
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;

  const destino = await getPerfilPorAlias(alias);
  if (!destino) {
    await answerCallback(callbackId, "Destino no válido");
    return;
  }

  // (Re)asignación: cada toque manda; los admins pueden reasignar cuantas veces quieran.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
    method: "PATCH",
    headers: restHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({ ejecutivo_id: destino.id, fecha_asignacion: new Date().toISOString() }),
  });
  const updated = await res.json().catch(() => []);
  if (!res.ok || !Array.isArray(updated) || updated.length === 0) {
    await answerCallback(callbackId, "No se encontró el lead");
    return;
  }

  // Avisar al asignado por Telegram (si tiene chat y no es quien tocó el botón).
  if (destino.telegram_chat_id && String(destino.telegram_chat_id) !== String(chatId)) {
    await tgSend(
      destino.telegram_chat_id,
      `📌 <b>Nuevo lead asignado a ti</b>\n\n🔗 ${CRM_URL}/leads/${leadId}`,
    );
  }

  if (chatId != null && messageId != null) {
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
      text: `✅ Asignado a <b>${escapeHtml(destino.nombre_completo)}</b>`,
      reply_markup: { inline_keyboard: [] },
    });
  }
  await answerCallback(callbackId, `✅ Asignado a ${destino.nombre_completo}`);
}

// "tgp:<pendienteId>:<idx>" — el usuario eligió el lead para una gestión pendiente.
async function handleCallbackPendiente(cb: any, pendienteId: string, idxStr: string): Promise<void> {
  const callbackId: string = cb.id;
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const idx = parseInt(idxStr, 10);

  const [pendiente] = await sbGet(
    `telegram_pendientes?id=eq.${pendienteId}&select=id,chat_id,profile_id,payload,resolved,created_at`,
  );
  if (!pendiente) {
    await answerCallback(callbackId, "Esta selección ya no está disponible");
    return;
  }
  if (pendiente.resolved) {
    await answerCallback(callbackId, "Ya se había registrado esta gestión ✅");
    return;
  }
  if (Date.now() - Date.parse(pendiente.created_at) > 24 * 3600_000) {
    await answerCallback(callbackId, "Esta selección expiró");
    if (chatId != null) await tgSend(chatId, `⏳ Esa selección expiró. Mándame la gestión de nuevo, porfa.`);
    return;
  }

  const candidato = pendiente.payload?.candidatos?.[idx];
  const parsed: GestionParsed | undefined = pendiente.payload?.parsed;
  if (!candidato?.id || !parsed) {
    await answerCallback(callbackId, "Opción no válida");
    return;
  }

  const perfilRows = await sbGet(
    `profiles?id=eq.${pendiente.profile_id}&select=id,nombre_completo,rol,telegram_chat_id`,
  );
  const perfil: Perfil | undefined = perfilRows[0];
  if (!perfil) {
    await answerCallback(callbackId, "Usuario no encontrado");
    return;
  }

  const [lead] = await sbGet(`leads?id=eq.${candidato.id}&select=${LEAD_SELECT}`) as LeadLite[];
  if (!lead) {
    await answerCallback(callbackId, "El lead ya no existe");
    return;
  }

  // Marcar resuelto ANTES de ejecutar (evita doble toque).
  await sbPatch(`telegram_pendientes?id=eq.${pendienteId}&resolved=eq.false`, { resolved: true });

  const confirmacion = await ejecutarGestion(lead, parsed, perfil);

  if (chatId != null && messageId != null) {
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
      text: confirmacion,
      reply_markup: { inline_keyboard: [] },
    });
  } else if (chatId != null) {
    await tgSend(chatId, confirmacion);
  }
  await answerCallback(callbackId, "✅ Gestión registrada");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Seguridad: fail-closed contra el secret del setWebhook.
  const headerSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!WEBHOOK_SECRET || headerSecret !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return ok();
  }

  try {
    // Idempotencia: Telegram reintenta si no respondemos a tiempo.
    if (typeof update?.update_id === "number") {
      const nuevo = await esUpdateNuevo(update.update_id);
      if (!nuevo) return ok();
    }

    const cb = update?.callback_query;
    if (cb) {
      const data: string = cb.data ?? "";
      const parts = data.split(":");
      if (parts.length === 3 && parts[0] === "asg") {
        await handleCallbackAsignacion(cb, parts[1], parts[2]);
      } else if (parts.length === 3 && parts[0] === "tgp") {
        await handleCallbackPendiente(cb, parts[1], parts[2]);
      } else {
        await answerCallback(cb.id, "Acción no reconocida");
      }
      return ok();
    }

    if (update?.message) {
      await handleMessage(update.message);
      return ok();
    }

    return ok();
  } catch (err) {
    console.error("Error procesando update:", err);
    return ok(); // 200 siempre: no queremos loops de reintentos de Telegram.
  }
});
