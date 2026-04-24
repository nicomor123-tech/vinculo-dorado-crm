import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PIPELINE_STAGES, getStageLabel } from '../lib/pipeline';
import { Zap, AlertTriangle, Clock, Minus, Flame, Phone, ChevronRight } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Lead = Database['public']['Tables']['leads']['Row'];

interface KanbanViewProps {
  onViewDetail: (id: string) => void;
}

const STAGE_STYLES: Record<string, { header: string; dot: string; light: string }> = {
  lead_nuevo:           { header: '#e4ae3a', dot: '#d4951f', light: '#fdf9ef' },
  lead_calificado:      { header: '#d4951f', dot: '#b87616', light: '#faf0d4' },
  hogares_propuestos:   { header: '#2e9d93', dot: '#237e76', light: '#effaf8' },
  visitas_programadas:  { header: '#237e76', dot: '#1f6560', light: '#d7f3ee' },
  en_decision_familiar: { header: '#507f50', dot: '#3d653d', light: '#e6ede6' },
  escalado_nico:        { header: '#d97706', dot: '#b45309', light: '#fffbeb' },
  cierre_ganado:        { header: '#315031', dot: '#213521', light: '#ccdccc' },
  cierre_perdido:       { header: '#9ca3af', dot: '#6b7280', light: '#f9fafb' },
  fallecido:            { header: '#94a3b8', dot: '#64748b', light: '#f8fafc' },
};

const URGENCIA_CONFIG: Record<string, { label: string; icon: typeof Zap; cls: string }> = {
  inmediato:        { label: 'Inmediato',  icon: Flame,         cls: 'text-red-700 bg-red-50 border-red-200' },
  urgente:          { label: 'Urgente',    icon: Flame,         cls: 'text-red-700 bg-red-50 border-red-200' },
  alta:             { label: 'Alta',       icon: Zap,           cls: 'text-orange-700 bg-orange-50 border-orange-200' },
  semana_siguiente: { label: 'Semana',     icon: AlertTriangle, cls: 'text-orange-700 bg-orange-50 border-orange-200' },
  media:            { label: 'Media',      icon: Clock,         cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  este_mes:         { label: 'Este mes',   icon: Clock,         cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  baja:             { label: 'Baja',       icon: Minus,         cls: 'text-gray-500 bg-gray-50 border-gray-200' },
  mas_de_un_mes:    { label: '+1 mes',     icon: Minus,         cls: 'text-gray-500 bg-gray-50 border-gray-200' },
};

function UrgBadge({ urgencia }: { urgencia: string | null }) {
  const key = (urgencia ?? '').toLowerCase().replace(/ /g, '_');
  const cfg = URGENCIA_CONFIG[key];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

export function KanbanView({ onViewDetail }: KanbanViewProps) {
  const { isEjecutivo, profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  useEffect(() => { loadLeads(); }, []);

  const loadLeads = async () => {
    let q = supabase.from('leads').select('*').order('updated_at', { ascending: false });
    if (isEjecutivo && profile) q = q.eq('ejecutivo_id', profile.id);
    const { data } = await q;
    setLeads(data || []);
    setLoading(false);
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggingId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggingId) return;
    const lead = leads.find(l => l.id === draggingId);
    if (!lead || lead.estado === newStage) { setDraggingId(null); return; }

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === draggingId ? { ...l, estado: newStage } : l));
    setDraggingId(null);

    await supabase.from('leads').update({ estado: newStage, updated_at: new Date().toISOString() }).eq('id', draggingId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStage(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sage-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const visibleStages = PIPELINE_STAGES.filter(s => !['cierre_perdido', 'fallecido'].includes(s.value));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-sage-900">Pipeline Kanban</h1>
          <p className="text-sage-500 mt-1 text-xs sm:text-sm">
            <span className="hidden sm:inline">Arrastra los leads entre etapas · actualización inmediata</span>
            <span className="sm:hidden">Desliza para ver etapas · toca para ver detalles</span>
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-sage-400 bg-white border border-cream-200 rounded-xl px-3 py-2 shadow-card">
          <span>💡</span>
          <span>Arrastra y suelta para cambiar etapa</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3 min-w-max">
          {visibleStages.map((stage) => {
            const style = STAGE_STYLES[stage.value] ?? STAGE_STYLES['lead_nuevo'];
            const stageLeads = leads.filter(l => l.estado === stage.value);
            const isOver = dragOverStage === stage.value;

            return (
              <div
                key={stage.value}
                className={`flex flex-col rounded-2xl transition-all duration-150 ${isOver ? 'ring-2 ring-offset-2' : ''}`}
                style={{
                  width: 240,
                  minHeight: 500,
                  background: isOver ? style.light : '#f9f7f3',
                  ringColor: style.header,
                  border: `1px solid ${isOver ? style.header + '60' : '#e8e2d8'}`,
                }}
                onDragOver={(e) => handleDragOver(e, stage.value)}
                onDrop={(e) => handleDrop(e, stage.value)}
                onDragLeave={() => setDragOverStage(null)}
              >
                {/* Column header */}
                <div className="px-3 py-3 rounded-t-2xl flex items-center justify-between flex-shrink-0"
                  style={{ background: style.light, borderBottom: `2px solid ${style.header}30` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
                    <span className="text-sm font-semibold text-sage-800">{getStageLabel(stage.value)}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                    style={{ background: style.header }}>
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 600 }}>
                  {stageLeads.length === 0 && (
                    <div className={`rounded-xl border-2 border-dashed p-4 text-center transition-all ${isOver ? 'opacity-100' : 'opacity-40'}`}
                      style={{ borderColor: style.header + '50' }}>
                      <p className="text-xs text-sage-500">Suelta aquí</p>
                    </div>
                  )}
                  {stageLeads.map((lead) => {
                    const isDragging = draggingId === lead.id;
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => !isDragging && onViewDetail(lead.id)}
                        className={`bg-white rounded-xl p-3 border border-cream-200 cursor-grab active:cursor-grabbing hover:shadow-card-hover transition-all duration-150 group ${isDragging ? 'opacity-40 scale-95' : ''}`}
                        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                      >
                        {/* Name */}
                        <p className="text-sm font-semibold text-sage-900 leading-tight mb-1">{lead.nombre_adulto_mayor}</p>
                        {lead.edad && <p className="text-xs text-sage-500 mb-2">{lead.edad} años</p>}

                        {/* Contact */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <Phone className="w-3 h-3 text-sage-400 flex-shrink-0" />
                          <p className="text-xs text-sage-600 truncate">{lead.nombre_contacto}</p>
                        </div>

                        {/* Urgencia + budget */}
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <UrgBadge urgencia={lead.urgencia} />
                          {lead.presupuesto_mensual && (
                            <span className="text-xs text-sage-500 font-medium">
                              ${(lead.presupuesto_mensual / 1_000_000).toFixed(1)}M
                            </span>
                          )}
                        </div>

                        {/* Hot tag */}
                        {lead.etiqueta_caliente && (
                          <div className="mt-2 pt-2 border-t border-cream-200">
                            <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              {lead.etiqueta_caliente}
                            </span>
                          </div>
                        )}

                        <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition">
                          <ChevronRight className="w-3.5 h-3.5 text-sage-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
