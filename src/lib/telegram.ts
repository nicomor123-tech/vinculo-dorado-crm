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

// Botones de asignación de lead, generados desde profiles.telegram_alias.
// callback_data: "asg:<leadId>:<alias>" — lo procesa la Edge Function telegram-webhook.
async function tecladoAsignacion(leadId: string): Promise<InlineKeyboard | undefined> {
  const profiles = await loadNotifiableProfiles();
  const asignables = profiles.filter((p) => p.telegram_alias);
  if (asignables.length === 0) return undefined;
  const admins = asignables.filter((p) => p.rol === 'administrador');
  const ejecutivos = asignables.filter((p) => p.rol !== 'administrador');
  const fila = (ps: NotifiableProfile[]) =>
    ps.map((p) => ({
      text: p.nombre_completo.split(' ')[0],
      callback_data: `asg:${leadId}:${p.telegram_alias}`,
    }));
  const keyboard: InlineKeyboard = { inline_keyboard: [] };
  if (admins.length > 0) keyboard.inline_keyboard.push(fila(admins));
  if (ejecutivos.length > 0) keyboard.inline_keyboard.push(fila(ejecutivos));
  return keyboard;
}

// Notifica a los ADMINS de un lead nuevo con botones de asignación, y al
// ejecutivo asignado (si lo hay y tiene telegram_chat_id) SIN botones.
// Fire-and-forget: nunca lanza.
export async function notificarNuevoLead(
  leadId: string,
  ejecutivoId: string | null | undefined,
  mensaje: string,
): Promise<void> {
  const adminIds = await getAdminChatIds();
  await notificar(adminIds, mensaje, await tecladoAsignacion(leadId));

  // Ejecutivo asignado (si aplica): mismo mensaje, sin botones.
  if (ejecutivoId) {
    const chatId = await getChatIdDePerfil(ejecutivoId);
    if (chatId && !adminIds.includes(chatId)) {
      await notificar([chatId], mensaje);
    }
  }
}

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
