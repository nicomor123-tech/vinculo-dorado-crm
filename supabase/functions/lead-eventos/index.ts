// Edge Function: lead-eventos
// La disparan TRIGGERS de la base de datos (vía pg_net), así que cubre leads
// y hogares creados desde CUALQUIER origen: formulario web (PostgREST), CRM,
// bot de Telegram o SQL manual.
//
// Eventos (body JSON):
//  { evento: "lead_nuevo",    record: <fila completa de leads> }
//    -> Notificación ENRIQUECIDA a cada admin con botones de asignación
//       dinámicos ("🙋 Asignármelo" + un botón por ejecutivo activo).
//       Guarda los message_id en telegram_mensajes_lead para que, al asignar,
//       AMBOS mensajes se editen (exclusión mutua, primer toque gana).
//  { evento: "lead_asignado", record: <fila de leads>, old_ejecutivo_id }
//    -> Edita los mensajes pendientes ("✅ Asignado a X · hora") y envía al
//       ejecutivo dueño la mini ficha + TOP 3 de hogares que encajan.
//  { evento: "hogar_nuevo",   record: <fila de hogares> }
//    -> Aviso a ambos admins para revisar y verificar el hogar.
//
// Seguridad: header X-Cron-Secret == CRON_SECRET (fail-closed), igual que los
// crons existentes.

import { topHogares, formatearTopHogares } from "../_shared/matching.ts";
import type { HogarRow } from "../_shared/matching.ts";

const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const TG_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const CRM_URL = "https://crm.vinculodorado.co";

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sbGet(pathAndQuery: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers: restHeaders() });
  const rows = await res.json().catch(() => []);
  if (!res.ok) {
    console.error(`GET ${pathAndQuery} falló:`, res.status, rows);
    return [];
  }
  return Array.isArray(rows) ? rows : [];
}

async function sbInsert(table: string, body: unknown): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`INSERT ${table} falló:`, res.status, await res.text().catch(() => ""));
}

async function sbPatch(pathAndQuery: string, body: unknown): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: "PATCH",
    headers: restHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`PATCH ${pathAndQuery} falló:`, res.status, await res.text().catch(() => ""));
}

async function tg(method: string, payload: unknown): Promise<any> {
  try {
    const res = await fetch(`${TG_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) console.error(`Telegram ${method} falló: ${res.status}`, JSON.stringify(body).slice(0, 200));
    return body;
  } catch (err) {
    console.error(`Telegram ${method} error:`, err);
    return null;
  }
}

function escapeHtml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtCOP(v: number | null): string | null {
  if (!v) return null;
  return `$${Number(v).toLocaleString("es-CO")}`;
}

function horaCO(): string {
  return new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

interface Perfil {
  id: string;
  nombre_completo: string;
  rol: string;
  activo: boolean;
  telegram_chat_id: string | null;
  telegram_alias: string | null;
}

async function getEquipo(): Promise<Perfil[]> {
  return await sbGet(
    `profiles?activo=eq.true&select=id,nombre_completo,rol,activo,telegram_chat_id,telegram_alias`,
  ) as Perfil[];
}

const HOGAR_SELECT = "id,nombre,localidad,barrio,ciudad,precio_desde,precio_hasta,habitaciones_disponibles,maneja_oxigeno,serv_enfermeria_24h,dieta_diabetica,dieta_blanda,un_solo_nivel,tiene_ascensor,hab_compartida,hab_privada_bano_privado,hab_privada_bano_compartido,telefono,whatsapp,estado,updated_at";

// ---------------------------------------------------------------------------
// Mensaje enriquecido del lead (A1)
// ---------------------------------------------------------------------------

function mensajeLeadNuevo(lead: any): string {
  const lineas: string[] = [`🆕 <b>Lead nuevo</b>`];
  const contacto = [lead.nombre_contacto, lead.parentesco ? `(${lead.parentesco})` : null].filter(Boolean).join(" ");
  if (contacto) lineas.push(`👤 ${escapeHtml(contacto)}`);
  if (lead.telefono_principal) lineas.push(`📞 ${escapeHtml(lead.telefono_principal)}`);
  const am = [lead.nombre_adulto_mayor, lead.edad ? `${lead.edad} años` : null].filter(Boolean).join(", ");
  if (am) lineas.push(`🧓 ${escapeHtml(am)}`);
  if (lead.diagnosticos) lineas.push(`🩺 ${escapeHtml(String(lead.diagnosticos).slice(0, 120))}`);
  if (lead.movilidad) lineas.push(`🚶 Movilidad: ${escapeHtml(lead.movilidad)}`);
  const cuidados: string[] = [];
  if (lead.requiere_oxigeno) cuidados.push("oxígeno");
  if (lead.requiere_enfermeria) cuidados.push("enfermería 24h");
  if (lead.deterioro_cognitivo) cuidados.push("deterioro cognitivo");
  if (lead.requiere_primer_piso) cuidados.push("primer piso");
  if (cuidados.length) lineas.push(`⚕️ Cuidados: ${cuidados.join(", ")}`);
  const presupuesto = fmtCOP(lead.presupuesto_mensual) ?? lead.presupuesto_rango;
  if (presupuesto) lineas.push(`💰 ${escapeHtml(String(presupuesto))}`);
  const zona = [lead.zona_localidad, lead.ciudad].filter(Boolean).join(" · ");
  if (zona) lineas.push(`📍 ${escapeHtml(zona)}`);
  if (lead.urgencia) lineas.push(`⏱️ Urgencia: ${escapeHtml(lead.urgencia)}`);
  if (lead.como_nos_conocio) lineas.push(`🌐 Origen: ${escapeHtml(lead.como_nos_conocio)}`);
  if (lead.observaciones) lineas.push(`📝 ${escapeHtml(String(lead.observaciones).slice(0, 200))}`);
  lineas.push(`\n🔗 ${CRM_URL}/leads/${lead.id}`);
  return lineas.join("\n");
}

async function handleLeadNuevo(lead: any): Promise<Response> {
  const equipo = await getEquipo();
  const admins = equipo.filter((p) => p.rol === "administrador" && p.telegram_chat_id);
  const ejecutivos = equipo.filter((p) => p.rol === "ejecutivo_comercial" && p.telegram_alias);

  const texto = mensajeLeadNuevo(lead);
  const filaEjecutivos = ejecutivos.map((e) => ({
    text: `→ ${e.nombre_completo.split(" ")[0]}`,
    callback_data: `asg:${lead.id}:${e.telegram_alias}`,
  }));

  const registros: { lead_id: string; chat_id: string; message_id: number }[] = [];

  for (const admin of admins) {
    const keyboard: any[][] = [];
    if (admin.telegram_alias) {
      keyboard.push([{ text: "🙋 Asignármelo", callback_data: `asg:${lead.id}:${admin.telegram_alias}` }]);
    }
    if (filaEjecutivos.length) keyboard.push(filaEjecutivos);

    const res = await tg("sendMessage", {
      chat_id: admin.telegram_chat_id,
      text: texto,
      parse_mode: "HTML",
      ...(keyboard.length ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
    const messageId = res?.result?.message_id;
    if (res?.ok && messageId != null) {
      registros.push({ lead_id: lead.id, chat_id: String(admin.telegram_chat_id), message_id: messageId });
    }
  }

  if (registros.length) await sbInsert("telegram_mensajes_lead", registros);
  return json({ ok: true, notificados: registros.length });
}

// ---------------------------------------------------------------------------
// Lead asignado (A2): editar mensajes + ficha + TOP 3 al ejecutivo
// ---------------------------------------------------------------------------

async function editarMensajesDeLead(leadId: string, textoFinal: string): Promise<number> {
  const mensajes = await sbGet(
    `telegram_mensajes_lead?lead_id=eq.${leadId}&editado=eq.false&select=id,chat_id,message_id`,
  );
  let editados = 0;
  for (const m of mensajes) {
    const res = await tg("editMessageText", {
      chat_id: m.chat_id,
      message_id: m.message_id,
      parse_mode: "HTML",
      text: textoFinal,
      reply_markup: { inline_keyboard: [] },
    });
    if (res?.ok) {
      editados++;
      await sbPatch(`telegram_mensajes_lead?id=eq.${m.id}`, { editado: true });
    }
  }
  return editados;
}

async function handleLeadAsignado(lead: any): Promise<Response> {
  if (!lead?.ejecutivo_id) return json({ ok: true, skipped: "sin ejecutivo" });

  const [ejecutivo] = await sbGet(
    `profiles?id=eq.${lead.ejecutivo_id}&select=id,nombre_completo,telegram_chat_id`,
  );
  const nombreEjecutivo = ejecutivo?.nombre_completo ?? "el ejecutivo";
  const cliente = lead.nombre_contacto || lead.nombre_adulto_mayor || "el cliente";

  // 1) Exclusión mutua: editar los mensajes de lead-nuevo aún sin editar.
  //    (El webhook edita con "por {quien}" cuando la asignación fue por botón;
  //    aquí cubrimos auto-asignación y asignación desde el CRM.)
  const editados = await editarMensajesDeLead(
    lead.id,
    `✅ <b>${escapeHtml(cliente)}</b> asignado a <b>${escapeHtml(nombreEjecutivo)}</b> · ${horaCO()}\n🔗 ${CRM_URL}/leads/${lead.id}`,
  );

  // 2) Ficha + TOP 3 al ejecutivo dueño.
  let enviado = false;
  if (ejecutivo?.telegram_chat_id) {
    const hogares = await sbGet(`hogares?estado=neq.rechazado&select=${HOGAR_SELECT}&limit=600`) as HogarRow[];
    const top = topHogares(hogares, lead, 3);

    const ficha = [
      `📌 <b>Lead asignado a ti: ${escapeHtml(cliente)}</b>`,
      lead.telefono_principal ? `📞 ${escapeHtml(lead.telefono_principal)}` : null,
      lead.nombre_adulto_mayor ? `🧓 ${escapeHtml(lead.nombre_adulto_mayor)}${lead.edad ? ` (${lead.edad} años)` : ""}` : null,
      lead.diagnosticos ? `🩺 ${escapeHtml(String(lead.diagnosticos).slice(0, 100))}` : null,
      (fmtCOP(lead.presupuesto_mensual) ?? lead.presupuesto_rango) ? `💰 ${escapeHtml(String(fmtCOP(lead.presupuesto_mensual) ?? lead.presupuesto_rango))}` : null,
      lead.zona_localidad ? `📍 ${escapeHtml(lead.zona_localidad)}` : null,
      lead.urgencia ? `⏱️ ${escapeHtml(lead.urgencia)}` : null,
    ].filter(Boolean).join("\n");

    const bloqueHogares = formatearTopHogares(top, escapeHtml);

    await tg("sendMessage", {
      chat_id: ejecutivo.telegram_chat_id,
      parse_mode: "HTML",
      text: `${ficha}\n\n${bloqueHogares}\n\n📨 Crea la propuesta aquí:\n${CRM_URL}/leads/${lead.id}`,
    });
    enviado = true;
  }

  return json({ ok: true, mensajes_editados: editados, ficha_enviada: enviado });
}

// ---------------------------------------------------------------------------
// Hogar nuevo registrado desde la web (B5)
// ---------------------------------------------------------------------------

async function handleHogarNuevo(hogar: any): Promise<Response> {
  const equipo = await getEquipo();
  const admins = equipo.filter((p) => p.rol === "administrador" && p.telegram_chat_id);
  const zona = [hogar.barrio, hogar.localidad].filter(Boolean).join(", ");
  const texto =
    `🏠 <b>Hogar nuevo registrado desde la web</b>\n\n` +
    `<b>${escapeHtml(hogar.nombre ?? "(sin nombre)")}</b>\n` +
    (zona ? `📍 ${escapeHtml(zona)}\n` : "") +
    (hogar.telefono ? `📞 ${escapeHtml(hogar.telefono)}\n` : "") +
    (hogar.precio_desde ? `💰 Desde ${fmtCOP(hogar.precio_desde)}\n` : "") +
    `\nEstado: <b>pendiente de verificación</b> — revísalo y apruébalo en el CRM.\n🔗 ${CRM_URL}`;
  let enviados = 0;
  for (const admin of admins) {
    const res = await tg("sendMessage", { chat_id: admin.telegram_chat_id, parse_mode: "HTML", text: texto });
    if (res?.ok) enviados++;
  }
  return json({ ok: true, notificados: enviados });
}

// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const secret = req.headers.get("X-Cron-Secret") ?? "";
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "body inválido" }, 400);
  }

  try {
    switch (body?.evento) {
      case "lead_nuevo":
        return await handleLeadNuevo(body.record ?? {});
      case "lead_asignado":
        return await handleLeadAsignado(body.record ?? {});
      case "hogar_nuevo":
        return await handleHogarNuevo(body.record ?? {});
      default:
        return json({ ok: false, error: "evento desconocido" }, 400);
    }
  } catch (err) {
    console.error("Error en lead-eventos:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
