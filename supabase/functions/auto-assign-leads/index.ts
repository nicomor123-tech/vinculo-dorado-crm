// Edge Function: auto-assign-leads
// Auto-asignación de leads sin asignar tras un umbral (regla: 2 horas).
//
// La dispara pg_cron (vía pg_net.http_post) cada pocos minutos. Busca leads
// con ejecutivo_id IS NULL y created_at más viejo que el umbral, los asigna
// al ejecutivo (Vanessa por ahora) y avisa por Telegram a los admins y a
// Vanessa (si tiene telegram_chat_id).
//
// Seguridad: requiere el header X-Cron-Secret == CRON_SECRET (fail-closed).
// El umbral en minutos se puede pasar en el body { "minutes": N }; si no,
// usa AUTOASSIGN_THRESHOLD_MINUTES (env) y, por último, 120 (2h).

const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const ENV_MINUTES = Number(Deno.env.get("AUTOASSIGN_THRESHOLD_MINUTES") ?? "");

// Ejecutivo destino (Vanessa por ahora).
const EJECUTIVO = {
  id: "5631a018-cf0a-4d34-91a8-f1ff2cc5e7aa",
  nombre: "Vanessa",
};

// Admins que reciben el aviso de auto-asignación: Nico, Jhonatan.
const ADMIN_CHAT_IDS: number[] = [2094733004, 1145747754];

const DEFAULT_MINUTES = 120; // 2 horas

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

// "120" -> "2h"; "3" -> "3 min".
function etiquetaUmbral(min: number): string {
  return min % 60 === 0 ? `${min / 60}h` : `${min} min`;
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

  // Umbral en minutos: body.minutes > env > default.
  let bodyMinutes = NaN;
  try {
    const body = await req.json();
    if (body && typeof body.minutes === "number") bodyMinutes = body.minutes;
  } catch {
    // sin body: usamos env/default
  }
  const minutes = Number.isFinite(bodyMinutes) && bodyMinutes > 0
    ? bodyMinutes
    : (Number.isFinite(ENV_MINUTES) && ENV_MINUTES > 0 ? ENV_MINUTES : DEFAULT_MINUTES);

  const thresholdIso = new Date(Date.now() - minutes * 60_000).toISOString();
  const etiqueta = etiquetaUmbral(minutes);

  try {
    // Leads sin asignar más viejos que el umbral.
    const url = `${SUPABASE_URL}/rest/v1/leads` +
      `?ejecutivo_id=is.null` +
      `&created_at=lt.${encodeURIComponent(thresholdIso)}` +
      `&select=id,nombre_adulto_mayor,nombre_contacto` +
      `&order=created_at.asc`;
    const res = await fetch(url, { headers: restHeaders() });
    const leads = await res.json().catch(() => []);
    if (!res.ok || !Array.isArray(leads) || leads.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, assigned: 0, threshold_minutes: minutes }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // chat_id de Vanessa (una sola vez).
    let ejeChatId: number | string | null = null;
    try {
      const pRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${EJECUTIVO.id}&select=telegram_chat_id`,
        { headers: restHeaders() },
      );
      const pRows = await pRes.json().catch(() => []);
      ejeChatId = Array.isArray(pRows) && pRows[0] ? pRows[0].telegram_chat_id : null;
    } catch (err) {
      console.error("No se pudo leer telegram_chat_id del ejecutivo:", err);
    }

    const asignados: string[] = [];

    for (const lead of leads) {
      // Asignación atómica: solo si SIGUE sin asignar (evita pisar un toque de
      // botón que ocurra al mismo tiempo).
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/leads?id=eq.${lead.id}&ejecutivo_id=is.null`,
        {
          method: "PATCH",
          headers: restHeaders({ Prefer: "return=representation" }),
          body: JSON.stringify({
            ejecutivo_id: EJECUTIVO.id,
            fecha_asignacion: new Date().toISOString(),
          }),
        },
      );
      const updated = await patchRes.json().catch(() => []);
      if (!patchRes.ok || !Array.isArray(updated) || updated.length === 0) {
        // Lo asignaron por botón entre el SELECT y el UPDATE: saltar.
        continue;
      }

      asignados.push(lead.id);
      const nombre = lead.nombre_contacto || lead.nombre_adulto_mayor || "(sin nombre)";

      // Aviso a admins.
      const msgAdmin =
        `⏰ Lead <b>${nombre}</b> auto-asignado a ${EJECUTIVO.nombre} ` +
        `(no se asignó en ${etiqueta})\n` +
        `🔗 https://crm.vinculodorado.co/leads/${lead.id}`;
      for (const adminId of ADMIN_CHAT_IDS) {
        await tgSend(adminId, msgAdmin);
      }

      // Aviso a Vanessa (solo si tiene chat_id).
      if (ejeChatId) {
        await tgSend(
          ejeChatId,
          `📌 <b>Lead auto-asignado a ti</b>\n${nombre}\n` +
            `🔗 https://crm.vinculodorado.co/leads/${lead.id}`,
        );
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        assigned: asignados.length,
        ids: asignados,
        threshold_minutes: minutes,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error en auto-assign-leads:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
