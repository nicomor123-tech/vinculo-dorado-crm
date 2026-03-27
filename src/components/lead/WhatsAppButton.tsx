import { useState, useRef, useEffect } from 'react';
import { MessageCircle, ChevronDown, CreditCard as Edit3, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface WhatsAppButtonProps {
  phone: string;
  contactName: string;
}

function buildDefaultMessage(contactName: string, ejecutivoName: string): string {
  return `Hola ${contactName}, soy ${ejecutivoName} de Vínculo Dorado.\nEncontramos algunas opciones de hogares geriátricos que pueden ajustarse a lo que buscas.\n\n¿Te gustaría que te comparta las alternativas?`;
}

function buildWhatsAppUrl(rawPhone: string, message: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  const normalized = digits.startsWith('57') ? digits : `57${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function WhatsAppButton({ phone, contactName }: WhatsAppButtonProps) {
  const { profile } = useAuth();
  const ejecutivoName = profile?.nombre_completo ?? 'tu ejecutivo';
  const defaultMsg = buildDefaultMessage(contactName, ejecutivoName);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [customMessage, setCustomMessage] = useState(defaultMsg);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomMessage(buildDefaultMessage(contactName, ejecutivoName));
  }, [contactName, ejecutivoName]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const openChat = (message: string) => {
    window.open(buildWhatsAppUrl(phone, message), '_blank', 'noopener,noreferrer');
    setOpen(false);
    setEditing(false);
  };

  if (!phone) return null;

  const TEMPLATES = [
    {
      label: 'Envío de hogares',
      message: `Hola ${contactName}, soy ${ejecutivoName} de Vínculo Dorado. Te comparto algunas opciones de hogares geriátricos que podrían ajustarse a lo que buscas. ¿Te gustaría coordinar visitas?`,
    },
    {
      label: 'Confirmación de visita',
      message: `Hola ${contactName}, soy ${ejecutivoName} de Vínculo Dorado. Te escribo para confirmar la visita programada al hogar geriátrico. ¿Todo bien para la fecha acordada?`,
    },
    {
      label: 'Seguimiento de decisión',
      message: `Hola ${contactName}, soy ${ejecutivoName} de Vínculo Dorado. Queríamos saber si ya tuvieron oportunidad de revisar las opciones de hogares que compartimos. Quedamos atentos.`,
    },
  ];

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={() => openChat(customMessage)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-l-lg transition-colors"
        title={`Contactar a ${contactName} por WhatsApp`}
      >
        <MessageCircle className="w-4 h-4" />
        WhatsApp
      </button>
      <button
        onClick={() => { setOpen((v) => !v); setEditing(false); }}
        className="flex items-center px-2 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-r-lg border-l border-green-400 transition-colors"
        title="Más opciones"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-80">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mensaje a {contactName}</p>
            <button
              onClick={() => setEditing((v) => !v)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
              <Edit3 className="w-3 h-3" />
              {editing ? 'Cerrar' : 'Editar'}
            </button>
          </div>

          {editing ? (
            <div className="p-3 space-y-2">
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => openChat(customMessage)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  Enviar este mensaje
                </button>
                <button
                  onClick={() => { setCustomMessage(defaultMsg); setEditing(false); }}
                  className="px-3 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs rounded-lg transition"
                  title="Restaurar mensaje original"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => openChat(customMessage)}
                className="w-full text-left px-3 py-3 hover:bg-green-50 transition-colors group border-b border-gray-50"
              >
                <p className="text-sm font-medium text-gray-800 group-hover:text-green-700">Mensaje principal</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 whitespace-pre-line">{customMessage}</p>
              </button>
              <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Plantillas rápidas</p>
              </div>
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  onClick={() => openChat(tpl.message)}
                  className="w-full text-left px-3 py-3 hover:bg-green-50 transition-colors group border-b border-gray-50 last:border-0"
                >
                  <p className="text-sm font-medium text-gray-800 group-hover:text-green-700">{tpl.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tpl.message}</p>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
