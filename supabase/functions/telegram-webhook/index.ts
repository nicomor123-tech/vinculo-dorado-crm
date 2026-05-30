// Edge Function: telegram-webhook
// Asignación de leads desde botones inline de Telegram (Fase 1).
//
// Flujo: un admin toca un botón en la notificación de "lead nuevo".
// Telegram envía un callback_query con callback_data = "asg:<leadId>:<target>".
// target ∈ { jho, nic, eje }. La función:
//   1. Verifica el header secreto contra TELEGRAM_WEBHOOK_SECRET (fail-closed).
//   2. Si el lead ya está asignado, responde "Ya estaba asignado" (sin reasignar).
//   3. Asigna ejecutivo_id + fecha_asignacion con el service role (bypass RLS),
//      de forma atómica (PATCH condicionado a ejecutivo_id IS NULL).
//   4. Si target=eje y el ejecutivo tiene telegram_chat_id, le avisa por Telegram.
//   5. Edita el mensaje original a "✅ Asignado a <nombre>" y quita los botones.
//   6. Responde el answerCallbackQuery.

const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";

// target -> { profile id, nombre a mostrar }
const TARGETS: Record<string, { id: string; nombre: string }> = {
  jho: { id: "28413736-a9cc-4a41-80a3-9c791521f574", nombre: "Jhonatan" },
  nic: { id: "dc0cca2c-ec00-4fb0-848d-089adb8d9fbf", nombre: "Nicolás" },
  eje: { id: "5631a018-cf0a-4d34-91a8-f1ff2cc5e7aa", nombre: "Vanessa" },
};

const TG_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

function ok() {
  return new Response("ok", { status: 200 });
}

async function tg(method: string, payload: unknown): Promise<void> {
  try {
    const res = await fetch(`${TG_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Telegram ${method} falló: ${res.status} ${body}`);
    }
  } catch (err) {
    console.error(`Telegram ${method} error:`, err);
  }
}

async function answerCallback(callbackId: string, text: string): Promise<void> {
  await tg("answerCallbackQuery", { callback_query_id: callbackId, text });
}

// Helpers REST (PostgREST) con service role.
function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 1. Seguridad: fail-closed. Si no hay secreto configurado o no coincide -> 401.
  const headerSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!WEBHOOK_SECRET || headerSecret !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return ok(); // body inválido: nada que hacer, no reintentar.
  }

  const cb = update?.callback_query;
  if (!cb) {
    // Solo manejamos callback_query en la Fase 1.
    return ok();
  }

  const callbackId: string = cb.id;
  const data: string = cb.data ?? "";
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;

  // 2. Parseo de callback_data "asg:<leadId>:<target>".
  const parts = data.split(":");
  if (parts.length !== 3 || parts[0] !== "asg") {
    await answerCallback(callbackId, "Acción no reconocida");
    return ok();
  }
  const leadId = parts[1];
  const target = parts[2];
  const mapped = TARGETS[target];
  if (!mapped) {
    await answerCallback(callbackId, "Destino no válido");
    return ok();
  }

  try {
    // 3. Pre-chequeo: ¿el lead ya está asignado?
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}&select=ejecutivo_id,fecha_asignacion`,
      { headers: restHeaders() },
    );
    const rows = await checkRes.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) {
      await answerCallback(callbackId, "Lead no encontrado");
      return ok();
    }
    const lead = rows[0];
    if (lead.ejecutivo_id || lead.fecha_asignacion) {
      await answerCallback(callbackId, "Ya estaba asignado");
      return ok();
    }

    // 4. Asignación atómica: solo si sigue sin ejecutivo (gana el primer toque).
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}&ejecutivo_id=is.null`,
      {
        method: "PATCH",
        headers: restHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify({
          ejecutivo_id: mapped.id,
          fecha_asignacion: new Date().toISOString(),
        }),
      },
    );
    const updated = await patchRes.json().catch(() => []);
    if (!patchRes.ok || !Array.isArray(updated) || updated.length === 0) {
      // Otro admin ganó la carrera entre el chequeo y el update.
      await answerCallback(callbackId, "Ya estaba asignado");
      return ok();
    }

    // 5. Si es el ejecutivo, avisarle por Telegram SOLO si tiene chat_id.
    if (target === "eje") {
      try {
        const profRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${mapped.id}&select=telegram_chat_id`,
          { headers: restHeaders() },
        );
        const profRows = await profRes.json().catch(() => []);
        const ejeChatId = Array.isArray(profRows) && profRows[0]
          ? profRows[0].telegram_chat_id
          : null;
        if (ejeChatId) {
          await tg("sendMessage", {
            chat_id: ejeChatId,
            parse_mode: "HTML",
            text:
              `📌 <b>Nuevo lead asignado a ti</b>\n\n` +
              `🔗 https://crm.vinculodorado.co/leads/${leadId}`,
          });
        }
        // Si no tiene chat_id: no hacemos nada (Vanessa entra después sin romper).
      } catch (err) {
        console.error("No se pudo avisar al ejecutivo:", err);
      }
    }

    // 6. Editar el mensaje original y quitar los botones.
    if (chatId != null && messageId != null) {
      await tg("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        text: `✅ Asignado a <b>${mapped.nombre}</b>`,
        reply_markup: { inline_keyboard: [] },
      });
    }

    await answerCallback(callbackId, `✅ Asignado a ${mapped.nombre}`);
    return ok();
  } catch (err) {
    console.error("Error procesando asignación:", err);
    await answerCallback(callbackId, "Error al asignar, intenta de nuevo");
    return ok();
  }
});
