import { useEffect, useState } from 'react';
import { FileText, Phone, Mail, MessageSquare, Eye, MoreHorizontal, Calendar, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Nota = Database['public']['Tables']['notas_seguimiento']['Row'];

interface LeadNotesProps {
  leadId: string;
  notas: Nota[];
  onNoteAdded: () => void;
}

const TIPO_ICONS: Record<string, typeof Phone> = {
  llamada: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  visita: Eye,
  otro: MoreHorizontal,
};

const TIPO_COLORS: Record<string, { border: string; dot: string; iconBg: string; iconColor: string; label: string }> = {
  llamada:  { border: 'border-blue-200',  dot: 'bg-blue-500',   iconBg: 'bg-blue-100',   iconColor: 'text-blue-600',  label: 'Llamada' },
  email:    { border: 'border-sky-200',   dot: 'bg-sky-500',    iconBg: 'bg-sky-100',    iconColor: 'text-sky-600',   label: 'Email' },
  whatsapp: { border: 'border-green-200', dot: 'bg-green-500',  iconBg: 'bg-green-100',  iconColor: 'text-green-600', label: 'WhatsApp' },
  visita:   { border: 'border-amber-200', dot: 'bg-amber-500',  iconBg: 'bg-amber-100',  iconColor: 'text-amber-600', label: 'Visita' },
  otro:     { border: 'border-gray-200',  dot: 'bg-gray-400',   iconBg: 'bg-gray-100',   iconColor: 'text-gray-500',  label: 'Otro' },
};

const TIPO_LABELS: Record<string, string> = {
  llamada: 'Llamada', email: 'Email', whatsapp: 'WhatsApp', visita: 'Visita', otro: 'Otro',
};

function formatRelative(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Ayer';
  if (diffD < 7) return `Hace ${diffD} días`;
  return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'Fecha no disponible';
  const iso = dateString.includes('T') ? dateString : dateString + 'T00:00:00';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Fecha no disponible';
  return d.toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

interface AuthorNameProps {
  asesorId: string;
}

function AuthorName({ asesorId }: AuthorNameProps) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('nombre_completo')
      .eq('id', asesorId)
      .maybeSingle()
      .then(({ data }) => setName(data?.nombre_completo ?? null));
  }, [asesorId]);

  return <span>{name ?? 'Asesor'}</span>;
}

export function LeadNotes({ notas }: LeadNotesProps) {
  const sortedNotas = [...notas].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-5">
        <FileText className="w-4 h-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-900">
          Notas de seguimiento
        </h2>
        {notas.length > 0 && (
          <span className="ml-auto text-xs text-gray-400 font-medium">
            {notas.length} nota{notas.length !== 1 ? 's' : ''} · Más reciente primero
          </span>
        )}
      </div>

      {sortedNotas.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin notas todavía.</p>
          <p className="text-xs mt-1">Usa el panel de gestión para agregar la primera nota.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
          <div className="space-y-0">
            {sortedNotas.map((nota, idx) => {
              const cfg = TIPO_COLORS[nota.tipo_seguimiento] ?? TIPO_COLORS['otro'];
              const Icon = TIPO_ICONS[nota.tipo_seguimiento] ?? MoreHorizontal;
              const isLast = idx === sortedNotas.length - 1;
              return (
                <div key={nota.id} className={`relative flex gap-4 ${isLast ? '' : 'pb-5'}`}>
                  <div className="relative z-10 flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full ${cfg.iconBg} flex items-center justify-center border-2 border-white shadow-sm`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
                    </div>
                  </div>

                  <div className={`flex-1 min-w-0 bg-white border ${cfg.border} rounded-xl p-4 shadow-sm`}>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-bold uppercase tracking-wide ${cfg.iconColor}`}>
                        {TIPO_LABELS[nota.tipo_seguimiento] ?? nota.tipo_seguimiento}
                      </span>
                      <span className="text-gray-200">·</span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <User className="w-3 h-3" />
                        <AuthorName asesorId={nota.asesor_id} />
                      </span>
                      <span className="text-gray-200">·</span>
                      <span
                        className="text-xs text-gray-400 cursor-default"
                        title={formatFullDate(nota.created_at)}
                      >
                        {formatRelative(nota.created_at)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{nota.descripcion}</p>

                    {nota.proxima_accion && (
                      <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800">Próxima acción</p>
                          <p className="text-xs text-amber-700 mt-0.5">{nota.proxima_accion}</p>
                          {nota.fecha_proxima_accion && (
                            <p className="text-xs text-amber-600 mt-0.5 font-medium">
                              {formatDate(nota.fecha_proxima_accion)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
