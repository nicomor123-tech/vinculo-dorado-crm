// Datos públicos del negocio (un solo lugar para no regarlos por el código).

// WhatsApp comercial de Vínculo Dorado (fuente: hogaresgerontologicos.com).
// Formato wa.me: solo dígitos con indicativo de país.
export const BUSINESS_WHATSAPP = '573105577095';

export const BUSINESS_NAME = 'Vínculo Dorado';

export function buildWaLink(phoneDigits: string, message: string): string {
  const digits = phoneDigits.replace(/\D/g, '');
  const normalized = digits.startsWith('57') ? digits : `57${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
