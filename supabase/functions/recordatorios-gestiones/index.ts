// Edge Function: recordatorios-gestiones
// Motor de recordatorios al ejecutivo + escalamiento al admin.
//
// La dispara pg_cron cada 15 min. Reglas:
//  - Solo actúa entre las 7am y 9pm hora Colombia (UTC-5). Fuera de eso, no-op.
//  - Un lead está PENDIENTE si: proxima_contactabilidad vencida (en el pasado),
//    etapa ACTIVA (no no_contesta/cierre_ganado/cierre_perdido/fallecido) y con
//    ejecutivo_id asignado.
//  - A cada lead pendiente se le recuerda como mucho 1 vez/hora: si nunca se le
//    recordó, o si pasó >= 1h desde el último recordatorio.
//  - Recordatorios 1..5 van al EJECUTIVO ("📋 Recordatorio N/5: ..."). En el 5to
//    se escala UNA vez a los admins (Nico + Jhonatan) y se deja de recordar
//    (escalado_supervision = true) hasta que el ejecutivo atienda.
//  - Atender = la proxima_contactabilidad cambia (el frontend también reinicia
//    los contadores al registrar una gestión). El motor detecta el cambio
//    comparando proxima_contactabilidad con recordatorio_ref y reinicia.
//
// Seguridad: header X-Cron-Secret == CRON_SECRET (fail-closed).

const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

// Etapas inactivas (no se recuerda).
const ETAPAS_INACTIVAS = ["no_contesta", "cierre_ganado", "cierre_perdido", "fallecido"];

// Ventana horaria (hora Colombia). Recordatorios solo si START <= hora < END.
const START_HOUR = 7;  // 7am
const END_HOUR = 21;   // 9pm (no se recuerda a las 21:xx)

const MAX_RECORDATORIOS = 5;     // al 5to se escala
const INTERVALO_MS = 60 * 60 * 1000; // >= 1h entre recordatorios

const TG_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function tgSend(chatId: number | string, text: string, replyMarkup?: unknown): Promise<void> {
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Telegram sendMessage falló (chat ${chatId}): ${res.status} ${body}`);
    }
  } catch (err) {
    console.error(`Telegram sendMessage error (chat ${chatId}):`, err);
  }
}

// Hora actual en Colombia (UTC-5, sin horario de verano).
function horaColombia(nowMs: number): number {
  return new Date(nowMs - 5 * 60 * 60 * 1000).getUTCHours();
}

// Formatea un timestamp ISO a hora Colombia legible.
function fmtFechaCO(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

// Chat IDs de los administradores activos, leídos de profiles (cero hardcode).
async function getAdminChatIds(): Promise<(number | string)[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?rol=eq.administrador&activo=eq.true&telegram_chat_id=not.is.null&select=telegram_chat_id`,
      { headers: restHeaders() },
    );
    const rows = await res.json().catch(() => []);
    if (Array.isArray(rows)) {
      return rows.map((r: any) => r.telegram_chat_id).filter(Boolean);
    }
  } catch (err) {
    console.error("No se pudieron leer los admins:", err);
  }
  return [];
}

// Memo simple (la function puede atender varios crons con la misma instancia).
let adminCache: { ids: (number | string)[]; at: number } | null = null;
async function getAdminChatIdsCached(): Promise<(number | string)[]> {
  if (adminCache && Date.now() - adminCache.at < 5 * 60_000) return adminCache.ids;
  const ids = await getAdminChatIds();
  adminCache = { ids, at: Date.now() };
  return ids;
}

// Lee nombre_completo + telegram_chat_id de un perfil (con cache).
async function getProfile(
  id: string,
  cache: Map<string, { nombre: string; chatId: number | string | null }>,
): Promise<{ nombre: string; chatId: number | string | null }> {
  const hit = cache.get(id);
  if (hit) return hit;
  let info = { nombre: "el ejecutivo", chatId: null as number | string | null };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=nombre_completo,telegram_chat_id`,
      { headers: restHeaders() },
    );
    const rows = await res.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]) {
      info = {
        nombre: rows[0].nombre_completo || "el ejecutivo",
        chatId: rows[0].telegram_chat_id ?? null,
      };
    }
  } catch (err) {
    console.error("No se pudo leer el perfil del ejecutivo:", err);
  }
  cache.set(id, info);
  return info;
}

async function patchLead(id: string, patch: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "PATCH",
      headers: restHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`PATCH lead ${id} falló: ${res.status} ${body}`);
    }
  } catch (err) {
    console.error(`PATCH lead ${id} error:`, err);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Seguridad: fail-closed.
  const secret = req.headers.get("X-Cron-Secret") ?? "";
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const hCO = horaColombia(nowMs);

  // Gate horario.
  if (hCO < START_HOUR || hCO >= END_HOUR) {
    return new Response(
      JSON.stringify({ ok: true, skipped: "fuera-de-horario", hora_colombia: hCO }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    // Leads pendientes: vencidos, etapa activa, con ejecutivo.
    const inList = ETAPAS_INACTIVAS.join(",");
    const url = `${SUPABASE_URL}/rest/v1/leads` +
      `?ejecutivo_id=not.is.null` +
      `&estado=not.in.(${inList})` +
      `&proxima_contactabilidad=not.is.null` +
      `&proxima_contactabilidad=lt.${encodeURIComponent(nowIso)}` +
      `&select=id,nombre_contacto,nombre_adulto_mayor,ejecutivo_id,estado,proxima_contactabilidad,proxima_accion,recordatorios_enviados,ultimo_recordatorio,escalado_supervision,recordatorio_ref` +
      `&order=proxima_contactabilidad.asc`;

    const res = await fetch(url, { headers: restHeaders() });
    const leads = await res.json().catch(() => []);
    if (!res.ok || !Array.isArray(leads)) {
      console.error("Query de pendientes falló:", res.status, leads);
      return new Response(
        JSON.stringify({ ok: false, error: "query pendientes", status: res.status }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const profCache = new Map<string, { nombre: string; chatId: number | string | null }>();
    let recordados = 0;
    let escalados = 0;

    for (const lead of leads) {
      const proxMs = Date.parse(lead.proxima_contactabilidad);
      const refMs = lead.recordatorio_ref ? Date.parse(lead.recordatorio_ref) : NaN;
      const cambio = !(refMs === proxMs); // cambió la próxima contactabilidad (o ref nulo)

      let count = cambio ? 0 : (lead.recordatorios_enviados ?? 0);
      let escalado = cambio ? false : (lead.escalado_supervision ?? false);
      const ultimoMs = (!cambio && lead.ultimo_recordatorio)
        ? Date.parse(lead.ultimo_recordatorio)
        : NaN;

      // Si ya se escaló, no recordar más (hasta que se atienda). Solo sincronizar ref.
      if (escalado) {
        if (cambio) await patchLead(lead.id, { recordatorio_ref: lead.proxima_contactabilidad });
        continue;
      }

      // ¿Toca enviar? Nunca recordado (count 0) o pasó >= 1h.
      const debeEnviar = count === 0 || !Number.isFinite(ultimoMs) || (nowMs - ultimoMs >= INTERVALO_MS);
      if (!debeEnviar) {
        if (cambio) {
          await patchLead(lead.id, {
            recordatorios_enviados: 0,
            ultimo_recordatorio: null,
            escalado_supervision: false,
            recordatorio_ref: lead.proxima_contactabilidad,
          });
        }
        continue;
      }

      const cliente = lead.nombre_contacto || lead.nombre_adulto_mayor || "el cliente";
      const accion = lead.proxima_accion || "Contactar";
      const link = `https://crm.vinculodorado.co/leads/${lead.id}`;
      const vencia = fmtFechaCO(lead.proxima_contactabilidad);
      const prof = await getProfile(lead.ejecutivo_id, profCache);

      const newCount = count + 1; // 1..5

      // Recordatorio al ejecutivo (si tiene chat_id; si no, igual cuenta).
      // Botones accionables: los procesa la Edge Function telegram-webhook
      // (rg:g = registrar gestión, rg:p = posponer, rg:r = ver resumen).
      if (prof.chatId) {
        await tgSend(
          prof.chatId,
          `📋 <b>Recordatorio ${newCount}/${MAX_RECORDATORIOS}</b>: ${accion} con <b>${cliente}</b> ` +
            `(vencía ${vencia}).\n🔗 ${link}`,
          {
            inline_keyboard: [
              [
                { text: "✅ Ya la gestioné", callback_data: `rg:g:${lead.id}` },
                { text: "⏰ Posponer", callback_data: `rg:p:${lead.id}` },
              ],
              [{ text: "👁 Ver resumen", callback_data: `rg:r:${lead.id}` }],
            ],
          },
        );
      }
      recordados++;

      // Escalamiento al 5to.
      let nuevoEscalado = escalado;
      if (newCount >= MAX_RECORDATORIOS && !escalado) {
        const msg =
          `🚨 <b>${cliente}</b> sin atención tras ${MAX_RECORDATORIOS} recordatorios — ` +
          `ejecutivo: ${prof.nombre}.\n` +
          `Pendiente: ${accion}.\n🔗 ${link}`;
        for (const adminId of await getAdminChatIdsCached()) {
          await tgSend(adminId, msg);
        }
        nuevoEscalado = true;
        escalados++;
      }

      await patchLead(lead.id, {
        recordatorios_enviados: newCount,
        ultimo_recordatorio: nowIso,
        escalado_supervision: nuevoEscalado,
        recordatorio_ref: lead.proxima_contactabilidad,
      });
    }

    // -----------------------------------------------------------------
    // CITAS PRÓXIMAS: aviso único ~1h antes de la proxima_contactabilidad,
    // agrupado por ejecutivo (anti-spam: 1 mensaje por corrida aunque haya
    // varias citas). Idempotente vía leads.cita_avisada_ref.
    // En try/catch propio: si la columna aún no existe, no rompe lo demás.
    // -----------------------------------------------------------------
    let citasAvisadas = 0;
    try {
      const enUnaHora = new Date(nowMs + 60 * 60 * 1000).toISOString();
      const urlCitas = `${SUPABASE_URL}/rest/v1/leads` +
        `?ejecutivo_id=not.is.null` +
        `&estado=not.in.(${inList})` +
        `&proxima_contactabilidad=gte.${encodeURIComponent(nowIso)}` +
        `&proxima_contactabilidad=lte.${encodeURIComponent(enUnaHora)}` +
        `&select=id,nombre_contacto,nombre_adulto_mayor,ejecutivo_id,proxima_contactabilidad,proxima_accion,cita_avisada_ref` +
        `&order=proxima_contactabilidad.asc`;
      const resCitas = await fetch(urlCitas, { headers: restHeaders() });
      const citas = await resCitas.json().catch(() => []);
      if (resCitas.ok && Array.isArray(citas) && citas.length > 0) {
        // Solo las que no se han avisado para ESTA fecha de cita.
        const pendientesAviso = citas.filter((c: any) =>
          !c.cita_avisada_ref || Date.parse(c.cita_avisada_ref) !== Date.parse(c.proxima_contactabilidad)
        );
        // Agrupar por ejecutivo.
        const porEjecutivo = new Map<string, any[]>();
        for (const c of pendientesAviso) {
          const arr = porEjecutivo.get(c.ejecutivo_id) ?? [];
          arr.push(c);
          porEjecutivo.set(c.ejecutivo_id, arr);
        }
        for (const [ejecutivoId, items] of porEjecutivo) {
          const prof = await getProfile(ejecutivoId, profCache);
          if (prof.chatId) {
            const lineas = items.map((c: any) => {
              const hora = new Date(c.proxima_contactabilidad).toLocaleTimeString("es-CO", {
                timeZone: "America/Bogota", hour: "numeric", minute: "2-digit", hour12: true,
              });
              const cliente = c.nombre_contacto || c.nombre_adulto_mayor || "el cliente";
              return `• <b>${hora}</b> — ${c.proxima_accion || "Contactar"} con <b>${cliente}</b>\n  🔗 https://crm.vinculodorado.co/leads/${c.id}`;
            }).join("\n");
            const titulo = items.length === 1
              ? `⏰ <b>Tienes un contacto en menos de 1 hora</b>`
              : `⏰ <b>Tienes ${items.length} contactos en la próxima hora</b>`;
            // Botones por cita (ct:c = confirmada, ct:r = reagendar); con varias
            // citas cada fila lleva el nombre para distinguirlas.
            const teclado = items.map((c: any) => {
              const corto = ((c.nombre_contacto || c.nombre_adulto_mayor || "cliente").split(" ")[0]).slice(0, 14);
              return items.length === 1
                ? [
                  { text: "✅ Confirmada", callback_data: `ct:c:${c.id}` },
                  { text: "🔄 Reagendar", callback_data: `ct:r:${c.id}` },
                ]
                : [
                  { text: `✅ ${corto}`, callback_data: `ct:c:${c.id}` },
                  { text: `🔄 ${corto}`, callback_data: `ct:r:${c.id}` },
                ];
            });
            await tgSend(prof.chatId, `${titulo}\n\n${lineas}`, { inline_keyboard: teclado });
          }
          // Marcar avisadas aunque no tenga chat (no insistir cada 15 min).
          for (const c of items) {
            await patchLead(c.id, { cita_avisada_ref: c.proxima_contactabilidad });
            citasAvisadas++;
          }
        }
      }
    } catch (err) {
      console.error("Aviso de citas próximas falló (no bloqueante):", err);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        hora_colombia: hCO,
        candidatos: leads.length,
        recordados,
        escalados,
        citas_avisadas: citasAvisadas,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error en recordatorios-gestiones:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
