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

const ETAPAS_TERMINALES = ["cierre_ganado", "cierre_perdido", "fallecido"];

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

// Chat IDs de los administradores activos (leídos de profiles, cero hardcode).
async function getAdminChatIds(): Promise<(number | string)[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?rol=eq.administrador&activo=eq.true&telegram_chat_id=not.is.null&select=telegram_chat_id`,
      { headers: restHeaders() },
    );
    const rows = await res.json().catch(() => []);
    if (Array.isArray(rows)) return rows.map((r: any) => r.telegram_chat_id).filter(Boolean);
  } catch (err) {
    console.error("No se pudieron leer los admins:", err);
  }
  return [];
}

// Ejecutivo comercial destino: el activo con MENOS leads activos asignados
// (con un solo ejecutivo, siempre es ese; con varios, balancea la carga).
async function getEjecutivoDestino(): Promise<{ id: string; nombre: string; chatId: number | string | null } | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?rol=eq.ejecutivo_comercial&activo=eq.true&select=id,nombre_completo,telegram_chat_id&order=created_at.asc`,
      { headers: restHeaders() },
    );
    const ejecutivos = await res.json().catch(() => []);
    if (!Array.isArray(ejecutivos) || ejecutivos.length === 0) return null;

    let elegido = ejecutivos[0];
    if (ejecutivos.length > 1) {
      const cargaRes = await fetch(
        `${SUPABASE_URL}/rest/v1/leads?ejecutivo_id=not.is.null&estado=not.in.(${ETAPAS_TERMINALES.join(",")})&select=ejecutivo_id`,
        { headers: restHeaders() },
      );
      const cargaRows = await cargaRes.json().catch(() => []);
      const carga = new Map<string, number>();
      if (Array.isArray(cargaRows)) {
        for (const r of cargaRows) carga.set(r.ejecutivo_id, (carga.get(r.ejecutivo_id) ?? 0) + 1);
      }
      elegido = [...ejecutivos].sort(
        (a, b) => (carga.get(a.id) ?? 0) - (carga.get(b.id) ?? 0),
      )[0];
    }
    return {
      id: elegido.id,
      nombre: (elegido.nombre_completo || "el ejecutivo").split(" ")[0],
      chatId: elegido.telegram_chat_id ?? null,
    };
  } catch (err) {
    console.error("No se pudo elegir ejecutivo destino:", err);
    return null;
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

    // Ejecutivo destino y admins, leídos de profiles (una sola vez por corrida).
    const EJECUTIVO = await getEjecutivoDestino();
    if (!EJECUTIVO) {
      console.error("No hay ejecutivos comerciales activos: no se auto-asigna.");
      return new Response(
        JSON.stringify({ ok: true, assigned: 0, reason: "sin-ejecutivos-activos" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    const ADMIN_CHAT_IDS = await getAdminChatIds();
    const ejeChatId = EJECUTIVO.chatId;

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
