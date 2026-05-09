const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_TOKEN as string | undefined;

export async function notificar(chatIds: (string | number)[], mensaje: string): Promise<void> {
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
