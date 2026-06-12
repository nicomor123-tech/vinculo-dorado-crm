import { supabase } from './supabase';

const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_TOKEN as string | undefined;

// ---------------------------------------------------------------------------
// Fuente única de chat IDs: profiles.telegram_chat_id (cero hardcode).
// Cache a nivel de módulo: una consulta por sesión de página.
// ---------------------------------------------------------------------------

interface NotifiableProfile {
  id: string;
  nombre_completo: string;
  rol: string;
  telegram_chat_id: string | null;
  telegram_alias: string | null;
}

let profilesCache: Promise<NotifiableProfile[]> | null = null;

function loadNotifiableProfiles(): Promise<NotifiableProfile[]> {
  if (!profilesCache) {
    profilesCache = (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nombre_completo, rol, telegram_chat_id, telegram_alias')
        .eq('activo', true);
      if (error) {
        console.error('No se pudieron leer los perfiles para Telegram:', error);
        profilesCache = null; // permite reintentar en la próxima notificación
        return [] as NotifiableProfile[];
      }
      return (data ?? []) as NotifiableProfile[];
    })();
  }
  return profilesCache;
}

export async function getAdminChatIds(): Promise<(string | number)[]> {
  const profiles = await loadNotifiableProfiles();
  return profiles
    .filter((p) => p.rol === 'administrador' && p.telegram_chat_id)
    .map((p) => p.telegram_chat_id as string);
}

async function getChatIdDePerfil(profileId: string): Promise<string | null> {
  const profiles = await loadNotifiableProfiles();
  const hit = profiles.find((p) => p.id === profileId);
  if (hit) return hit.telegram_chat_id;
  // Fallback directo por si el perfil no estaba en cache (p. ej. inactivo recién activado).
  try {
    const { data } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', profileId)
      .maybeSingle();
    return (data?.telegram_chat_id as string | null) ?? null;
  } catch (err) {
    console.error('No se pudo leer telegram_chat_id del ejecutivo:', err);
    return null;
  }
}

// Teclado inline de Telegram (subconjunto que usamos).
type InlineKeyboard = {
  inline_keyboard: { text: string; callback_data: string }[][];
};

// Nota: la notificación de "lead nuevo" con botones de asignación ya NO sale
// del frontend — la envía la Edge Function lead-eventos vía trigger de BD
// (cubre también los leads del formulario web, con exclusión mutua).

// Notifica SOLO a los admins (sin botones). Fire-and-forget.
// Se usa para eventos clave de pipeline (visita agendada, cierre ganado/perdido).
export async function notificarAdmins(mensaje: string): Promise<void> {
  await notificar(await getAdminChatIds(), mensaje);
}

// Notifica SOLO al ejecutivo dueño del lead (si tiene chat). Fire-and-forget.
// Se usa para reasignaciones y cambios de etapa hechos por otra persona.
export async function notificarEjecutivo(
  ejecutivoId: string | null | undefined,
  mensaje: string,
): Promise<void> {
  if (!ejecutivoId) return;
  const chatId = await getChatIdDePerfil(ejecutivoId);
  if (chatId) await notificar([chatId], mensaje);
}

export async function notificarAdminsYEjecutivo(
  ejecutivoId: string | null | undefined,
  mensaje: string,
): Promise<void> {
  const ids: (string | number)[] = [...(await getAdminChatIds())];
  if (ejecutivoId) {
    const chatId = await getChatIdDePerfil(ejecutivoId);
    if (chatId && !ids.includes(chatId)) ids.push(chatId);
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
  if (chatIds.length === 0) return;
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
