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

// Admins que reciben el escalamiento: Nico, Jhonatan.
const ADMIN_CHAT_IDS: number[] = [2094733004, 1145747754];

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

async function tgSend(chatId: number | string, text: string): Promise<void> {
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
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
      if (prof.chatId) {
        await tgSend(
          prof.chatId,
          `📋 <b>Recordatorio ${newCount}/${MAX_RECORDATORIOS}</b>: ${accion} con <b>${cliente}</b> ` +
            `(vencía ${vencia}).\n🔗 ${link}`,
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
        for (const adminId of ADMIN_CHAT_IDS) {
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

    return new Response(
      JSON.stringify({
        ok: true,
        hora_colombia: hCO,
        candidatos: leads.length,
        recordados,
        escalados,
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
