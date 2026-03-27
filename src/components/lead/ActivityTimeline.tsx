import { Activity, UserPlus, GitBranch, FileText, CheckCircle2, Pencil } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type ActivityEvent = Database['public']['Tables']['activity_log']['Row'];

interface ActivityTimelineProps {
  events: ActivityEvent[];
}

const EVENT_CONFIG: Record<string, { icon: typeof Activity; color: string; dot: string }> = {
  lead_creado:        { icon: UserPlus,     color: 'text-blue-600',   dot: 'bg-blue-600' },
  etapa_cambiada:     { icon: GitBranch,    color: 'text-teal-600',   dot: 'bg-teal-500' },
  nota_agregada:      { icon: FileText,     color: 'text-amber-600',  dot: 'bg-amber-500' },
  ejecutivo_asignado: { icon: CheckCircle2, color: 'text-green-600',  dot: 'bg-green-500' },
  campo_editado:      { icon: Pencil,       color: 'text-purple-600', dot: 'bg-purple-500' },
};

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-teal-600" />
        Historial de actividad
      </h2>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">Sin actividad registrada</p>
      ) : (
        <div className="relative">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200" />
          <ul className="space-y-4">
            {sorted.map((event) => {
              const config = EVENT_CONFIG[event.tipo] ?? {
                icon: Activity,
                color: 'text-gray-500',
                dot: 'bg-gray-400',
              };
              const Icon = config.icon;
              const meta = event.metadata as Record<string, unknown> | null;
              return (
                <li key={event.id} className="flex gap-3">
                  <div className={`relative z-10 flex-shrink-0 w-7 h-7 rounded-full ${config.dot} flex items-center justify-center`}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm text-gray-900">{event.descripcion}</p>
                    {event.tipo === 'campo_editado' && meta &&
                      meta.valor_anterior !== undefined && meta.valor_nuevo !== undefined && (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-xs line-through max-w-[140px] truncate">
                            {String(meta.valor_anterior ?? '') || '—'}
                          </span>
                          <span className="text-gray-400 text-xs">→</span>
                          <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs max-w-[140px] truncate">
                            {String(meta.valor_nuevo ?? '') || '—'}
                          </span>
                        </div>
                      )}
                    <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(event.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
