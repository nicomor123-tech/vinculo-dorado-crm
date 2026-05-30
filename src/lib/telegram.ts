import { supabase } from './supabase';

const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_TOKEN as string | undefined;

// Admins que siempre reciben notificaciones: Nico, Jhonatan
export const ADMIN_CHAT_IDS: number[] = [2094733004, 1145747754];

// Teclado inline de Telegram (subconjunto que usamos).
type InlineKeyboard = {
  inline_keyboard: { text: string; callback_data: string }[][];
};

// Botones de asignación de lead. callback_data: "asg:<leadId>:<target>".
// La Edge Function telegram-webhook procesa estos toques.
function tecladoAsignacion(leadId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: 'Jhonatan', callback_data: `asg:${leadId}:jho` },
        { text: 'Nicolás', callback_data: `asg:${leadId}:nic` },
      ],
      [{ text: 'Ejecutivo', callback_data: `asg:${leadId}:eje` }],
    ],
  };
}

// Notifica a los ADMINS de un lead nuevo con botones de asignación, y al
// ejecutivo asignado (si lo hay y tiene telegram_chat_id) SIN botones.
// Fire-and-forget: nunca lanza.
export async function notificarNuevoLead(
  leadId: string,
  ejecutivoId: string | null | undefined,
  mensaje: string,
): Promise<void> {
  // Admins: mensaje + botones de asignación.
  await notificar(ADMIN_CHAT_IDS, mensaje, tecladoAsignacion(leadId));

  // Ejecutivo asignado (si aplica): mismo mensaje, sin botones.
  if (ejecutivoId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', ejecutivoId)
        .maybeSingle();
      const chatId = data?.telegram_chat_id;
      if (chatId && !ADMIN_CHAT_IDS.includes(chatId)) {
        await notificar([chatId], mensaje);
      }
    } catch (err) {
      console.error('No se pudo leer telegram_chat_id del ejecutivo:', err);
    }
  }
}

// Notifica SIEMPRE a los admins y, si el ejecutivo asignado tiene
// telegram_chat_id, también a él. Fire-and-forget: nunca lanza.
export async function notificarAdminsYEjecutivo(
  ejecutivoId: string | null | undefined,
  mensaje: string,
): Promise<void> {
  const ids: (string | number)[] = [...ADMIN_CHAT_IDS];
  if (ejecutivoId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', ejecutivoId)
        .maybeSingle();
      const chatId = data?.telegram_chat_id;
      if (chatId && !ids.includes(chatId)) ids.push(chatId);
    } catch (err) {
      console.error('No se pudo leer telegram_chat_id del ejecutivo:', err);
    }
  }
  await notificar(ids, mensaje);
}

export async function notificar(
  chatIds: (string | number)[],
  mensaje: string,
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('VITE_TELEGRAM_TOKEN no configurado');
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: mensaje,
            parse_mode: 'HTML',
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error(`Telegram notify failed for chat ${chatId}: ${res.status} ${body}`);
        }
      } catch (err) {
        console.error(`Telegram notify error for chat ${chatId}:`, err);
      }
    })
  );
}
