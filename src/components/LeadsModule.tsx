import { useEffect, useState } from 'react';
import {
  Search, Plus, Phone, CircleUser as UserCircle,
  Zap, AlertTriangle, Clock, Minus, Calendar, Flame, Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PIPELINE_STAGES, getStageLabel, getStageStrongColor, getStageDotColor } from '../lib/pipeline';
import type { Database } from '../lib/database.types';

type Lead = Database['public']['Tables']['leads']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface LeadsModuleProps {
  onCreateNew: () => void;
  onViewDetail: (leadId: string) => void;
  initialFilter?: { estado?: string; urgencia?: string } | null;
}

const URGENCIA_CONFIG: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  inmediato:        { label: 'Inmediato',    icon: Flame,         color: 'text-red-700 bg-red-50 border-red-200' },
  urgente:          { label: 'Urgente',      icon: Flame,         color: 'text-red-700 bg-red-50 border-red-200' },
  alta:             { label: 'Alta',         icon: Zap,           color: 'text-orange-700 bg-orange-50 border-orange-200' },
  semana_siguiente: { label: 'Esta semana',  icon: AlertTriangle, color: 'text-orange-700 bg-orange-50 border-orange-200' },
  media:            { label: 'Media',        icon: Clock,         color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  este_mes:         { label: 'Este mes',     icon: Clock,         color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  baja:             { label: 'Baja',         icon: Minus,         color: 'text-gray-500 bg-gray-50 border-gray-200' },
  mas_de_un_mes:    { label: '+1 mes',       icon: Minus,         color: 'text-gray-500 bg-gray-50 border-gray-200' },
};

function UrgBadge({ urgencia }: { urgencia: string | null }) {
  const key = (urgencia ?? '').toLowerCase().replace(/ /g, '_');
  const cfg = URGENCIA_CONFIG[key];
  if (!cfg) return <span className="text-xs text-gray-400">—</span>;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function StagePill({ estado }: { estado: string }) {
  const strong = getStageStrongColor(estado);
  const dot = getStageDotColor(estado).replace('-400','-200').replace('-500','-200').replace('-600','-200');
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${strong.bg} ${strong.text} ${strong.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {getStageLabel(estado)}
    </span>
  );
}

function formatCurrency(value: number | null) {
  if (!value) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString('es-CO')}`;
}

export function LeadsModule({ onCreateNew, onViewDetail, initialFilter }: LeadsModuleProps) {
  const { isAdmin, isEjecutivo, profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [ejecutivos, setEjecutivos] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterUrgencia, setFilterUrgencia] = useState('todos');
  const [filterEjecutivo, setFilterEjecutivo] = useState('todos');

  useEffect(() => { loadLeads(); if (isAdmin) loadEjecutivos(); }, []);
  useEffect(() => { applyFilters(); }, [leads, searchTerm, filterEstado, filterUrgencia, filterEjecutivo]);
  useEffect(() => {
    if (initialFilter?.estado) setFilterEstado(initialFilter.estado);
    if (initialFilter?.urgencia) setFilterUrgencia(initialFilter.urgencia);
  }, [initialFilter]);

  const loadLeads = async () => {
    let q = supabase.from('leads').select('*').order('updated_at', { ascending: false });
    if (isEjecutivo && profile) q = q.eq('ejecutivo_id', profile.id);
    const { data } = await q;
    setLeads(data || []);
    setLoading(false);
  };

  const loadEjecutivos = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('activo', true).order('nombre_completo');
    setEjecutivos(data || []);
  };

  const applyFilters = () => {
    let f = [...leads];
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      f = f.filter(l =>
        l.nombre_adulto_mayor.toLowerCase().includes(s) ||
        l.nombre_contacto.toLowerCase().includes(s) ||
        (l.telefono_principal || '').includes(s) ||
        (l.ciudad || '').toLowerCase().includes(s) ||
        (l.diagnosticos || '').toLowerCase().includes(s)
      );
    }
    if (filterEstado !== 'todos') f = f.filter(l => l.estado === filterEstado);
    if (filterUrgencia !== 'todos') {
      const map: Record<string, string[]> = {
        inmediato: ['inmediato', 'urgente'],
        semana_siguiente: ['semana_siguiente', 'alta'],
        este_mes: ['este_mes', 'media'],
        mas_de_un_mes: ['mas_de_un_mes', 'baja'],
      };
      const keys = map[filterUrgencia] || [filterUrgencia];
      f = f.filter(l => keys.includes((l.urgencia ?? '').toLowerCase().replace(/ /g, '_')));
    }
    if (isAdmin && filterEjecutivo !== 'todos') {
      if (filterEjecutivo === 'sin_asignar') f = f.filter(l => !l.ejecutivo_id);
      else f = f.filter(l => l.ejecutivo_id === filterEjecutivo);
    }
    setFilteredLeads(f);
  };

  const getEjecutivoNombre = (id: string | null) =>
    id ? (ejecutivos.find(e => e.id === id)?.nombre_completo ?? null) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-sage-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-sage-500">Cargando leads...</p>
        </div>
      </div>
    );
  }

  const hotCount = leads.filter(l => ['inmediato','urgente'].includes((l.urgencia??'').toLowerCase())).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-sage-900">Leads</h1>
          <p className="text-sage-500 mt-1 text-sm">
            {isEjecutivo ? 'Tus leads asignados' : 'Todos los leads · gestión comercial'}
            {hotCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 font-semibold">
                <Flame className="w-3.5 h-3.5" />
                {hotCount} urgentes hoy
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 shadow-sm active:scale-95"
          style={{ background: 'linear-gradient(135deg, #3d653d, #315031)' }}
        >
          <Plus className="w-4 h-4" />
          Nuevo Lead
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-cream-200 p-5">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar nombre, teléfono, ciudad, diagnóstico..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-cream-300 text-sm text-sage-900 placeholder-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-transparent bg-cream-50"
            />
          </div>
          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="px-3 py-2 rounded-xl border border-cream-300 text-sm text-sage-800 focus:outline-none focus:ring-2 focus:ring-sage-400 bg-cream-50"
          >
            <option value="todos">Todas las etapas</option>
            {PIPELINE_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            value={filterUrgencia}
            onChange={e => setFilterUrgencia(e.target.value)}
            className="px-3 py-2 rounded-xl border border-cream-300 text-sm text-sage-800 focus:outline-none focus:ring-2 focus:ring-sage-400 bg-cream-50"
          >
            <option value="todos">Toda urgencia</option>
            <option value="inmediato">🔥 Inmediato / Urgente</option>
            <option value="semana_siguiente">⚡ Esta semana</option>
            <option value="este_mes">📅 Este mes</option>
            <option value="mas_de_un_mes">— Más de 1 mes</option>
          </select>
          {isAdmin && (
            <select
              value={filterEjecutivo}
              onChange={e => setFilterEjecutivo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-cream-300 text-sm text-sage-800 focus:outline-none focus:ring-2 focus:ring-sage-400 bg-cream-50"
            >
              <option value="todos">Todos los ejecutivos</option>
              <option value="sin_asignar">Sin asignar</option>
              {ejecutivos.filter(e => e.rol === 'ejecutivo_comercial').map(e => (
                <option key={e.id} value={e.id}>{e.nombre_completo}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-sage-500 font-medium">
            <span className="text-sage-800 font-bold">{filteredLeads.length}</span> de {leads.length} leads
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50 rounded-l-lg">Adulto mayor</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50">Contacto</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50">Ciudad</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50">Presupuesto</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50">Urgencia</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50">Etapa</th>
                {isAdmin && <th className="text-left py-2.5 px-3 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50">Ejecutivo</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {filteredLeads.map((lead) => {
                const ejNombre = getEjecutivoNombre(lead.ejecutivo_id);
                const isHot = ['inmediato','urgente'].includes((lead.urgencia??'').toLowerCase());
                return (
                  <tr
                    key={lead.id}
                    onClick={() => onViewDetail(lead.id)}
                    className={`cursor-pointer hover:bg-cream-100 transition-colors ${isHot ? 'border-l-2 border-red-400' : ''}`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-semibold text-sage-900 text-sm leading-tight">{lead.nombre_adulto_mayor}</div>
                      {lead.edad && <div className="text-xs text-sage-400 mt-0.5">{lead.edad} años{lead.sexo ? ` · ${lead.sexo}` : ''}</div>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm text-sage-700 font-medium">{lead.nombre_contacto}</div>
                      <div className="flex items-center gap-1 text-xs text-sage-400 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {lead.telefono_principal}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm text-sage-800">{lead.ciudad || '—'}</div>
                      {lead.zona_localidad && <div className="text-xs text-sage-400">{lead.zona_localidad}</div>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm font-semibold text-sage-900">{formatCurrency(lead.presupuesto_mensual)}</div>
                    </td>
                    <td className="py-3 px-3"><UrgBadge urgencia={lead.urgencia} /></td>
                    <td className="py-3 px-3"><StagePill estado={lead.estado} /></td>
                    {isAdmin && (
                      <td className="py-3 px-3">
                        {ejNombre ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg, #507f50, #315031)' }}>
                              {ejNombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </div>
                            <span className="text-xs text-sage-700 font-medium truncate max-w-[100px]">{ejNombre.split(' ')[0]}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-sage-400 italic">Sin asignar</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredLeads.length === 0 && (
            <div className="text-center py-16">
              <Filter className="w-10 h-10 text-sage-200 mx-auto mb-3" />
              <p className="text-sage-500 font-medium">Sin resultados</p>
              <p className="text-sm text-sage-400 mt-1">Ajusta los filtros o busca con otro término</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
