import { useEffect, useState } from 'react';
import {
  Users, UserCheck, UserX, CheckCircle2, Clock, TrendingUp,
  CircleUser as UserCircle, ListTodo, Send, Eye, Zap, AlertTriangle,
  Flame, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getStageLabel } from '../lib/pipeline';
import type { Database } from '../lib/database.types';

type Lead = Database['public']['Tables']['leads']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

const STAGE_CONFIG = [
  { key: 'lead_nuevo',           label: 'Lead nuevo',         color: '#e4ae3a', bg: '#fdf9ef' },
  { key: 'lead_calificado',      label: 'Calificado',         color: '#d4951f', bg: '#faf0d4' },
  { key: 'hogares_propuestos',   label: 'Propuestos',         color: '#2e9d93', bg: '#effaf8' },
  { key: 'visitas_programadas',  label: 'Visitas',            color: '#237e76', bg: '#d7f3ee' },
  { key: 'en_decision_familiar', label: 'Decisión familiar',  color: '#507f50', bg: '#e6ede6' },
  { key: 'cierre_ganado',        label: 'Ganados ✓',          color: '#315031', bg: '#ccdccc' },
  { key: 'cierre_perdido',       label: 'Perdidos',           color: '#9ca3af', bg: '#f3f4f6' },
];

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `Hace ${days}d`;
  if (hours > 0) return `Hace ${hours}h`;
  if (minutes > 0) return `Hace ${minutes}m`;
  return 'Ahora';
}

const URGENCIA_CONFIG: Record<string, { label: string; icon: typeof Zap; cls: string }> = {
  inmediato:        { label: 'Inmediato',    icon: Flame,         cls: 'text-red-700 bg-red-50 border-red-200' },
  urgente:          { label: 'Urgente',      icon: Flame,         cls: 'text-red-700 bg-red-50 border-red-200' },
  alta:             { label: 'Alta',         icon: Zap,           cls: 'text-orange-700 bg-orange-50 border-orange-200' },
  semana_siguiente: { label: 'Esta semana',  icon: AlertTriangle, cls: 'text-orange-700 bg-orange-50 border-orange-200' },
  media:            { label: 'Media',        icon: Clock,         cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  este_mes:         { label: 'Este mes',     icon: Clock,         cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  baja:             { label: 'Baja',         icon: Clock,         cls: 'text-gray-600 bg-gray-50 border-gray-200' },
  mas_de_un_mes:    { label: 'Más de 1 mes', icon: Clock,         cls: 'text-gray-600 bg-gray-50 border-gray-200' },
};

interface DashboardProps {
  onNavigateToLeads?: (filter: { estado?: string; urgencia?: string }) => void;
  onViewLead?: (id: string) => void;
}

export function Dashboard({ onNavigateToLeads, onViewLead }: DashboardProps) {
  const { isAdmin, isEjecutivo, profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [ejecutivos, setEjecutivos] = useState<Profile[]>([]);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [proposalStats, setProposalStats] = useState({ sent: 0, opened: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    try {
      let leadsQuery = supabase.from('leads').select('*').order('updated_at', { ascending: false });
      if (isEjecutivo && profile) leadsQuery = leadsQuery.eq('ejecutivo_id', profile.id);

      let tasksQuery = supabase.from('lead_tasks').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente');
      if (isEjecutivo && profile) tasksQuery = tasksQuery.eq('creado_por', profile.id);

      let proposalsQuery = supabase.from('propuestas').select('id, views', { count: 'exact' }).eq('estado', 'activa');
      if (isEjecutivo && profile) proposalsQuery = proposalsQuery.eq('creado_por', profile.id);

      const [leadsResult, profilesResult, tasksResult, proposalsResult] = await Promise.all([
        leadsQuery,
        isAdmin ? supabase.from('profiles').select('*').eq('activo', true).eq('rol', 'ejecutivo_comercial').order('nombre_completo') : Promise.resolve({ data: [] as Profile[] }),
        tasksQuery,
        proposalsQuery,
      ]);

      setLeads(leadsResult.data || []);
      setEjecutivos((profilesResult as { data: Profile[] }).data || []);
      setPendingTasksCount((tasksResult as { count: number | null }).count ?? 0);
      const proposals = (proposalsResult as { data: { id: string; views: number }[] | null }).data || [];
      setProposalStats({ sent: proposals.length, opened: proposals.filter(p => (p.views ?? 0) > 0).length });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-sage-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-sage-500">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  const activeLeads = leads.filter(l => !['cierre_ganado', 'cierre_perdido', 'fallecido'].includes(l.estado));
  const wonLeads = leads.filter(l => l.estado === 'cierre_ganado');
  const hotLeads = leads.filter(l => ['inmediato', 'urgente'].includes((l.urgencia ?? '').toLowerCase()));
  const totalActive = leads.filter(l => !['cierre_perdido', 'fallecido'].includes(l.estado)).length;
  const conversionRate = leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0;

  // Recent leads needing attention (hot + no recent activity)
  const attentionLeads = leads
    .filter(l => !['cierre_ganado', 'cierre_perdido', 'fallecido'].includes(l.estado))
    .sort((a, b) => {
      const urgOrder = ['inmediato', 'urgente', 'alta', 'semana_siguiente', 'media', 'este_mes', 'baja', 'mas_de_un_mes'];
      return urgOrder.indexOf(a.urgencia ?? '') - urgOrder.indexOf(b.urgencia ?? '');
    })
    .slice(0, 6);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-sage-900">
            {isEjecutivo ? `Hola, ${profile?.nombre_completo?.split(' ')[0]} 👋` : 'Dashboard'}
          </h1>
          <p className="text-sage-500 mt-1 text-xs sm:text-sm">
            {isEjecutivo ? 'Tus leads activos y próximas acciones' : 'Resumen comercial · Vínculo Dorado'}
          </p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-xs text-sage-400">{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Leads activos', value: activeLeads.length, icon: Users, color: '#315031', bg: '#e6ede6', desc: 'en pipeline', filter: {} as { estado?: string; urgencia?: string } },
          { label: 'Urgentes 🔥', value: hotLeads.length, icon: Flame, color: '#b91c1c', bg: '#fee2e2', desc: 'requieren acción hoy', filter: { urgencia: 'inmediato' } },
          { label: 'Ganados', value: wonLeads.length, icon: CheckCircle2, color: '#237e76', bg: '#d7f3ee', desc: 'cierres exitosos', filter: { estado: 'cierre_ganado' } },
          { label: 'Tasa de cierre', value: `${conversionRate}%`, icon: TrendingUp, color: '#d4951f', bg: '#faf0d4', desc: 'conversión total', filter: null },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          const clickable = kpi.filter !== null && !!onNavigateToLeads;
          return (
            <div
              key={i}
              onClick={() => clickable && onNavigateToLeads!(kpi.filter!)}
              className={`bg-white rounded-2xl p-5 shadow-card border border-cream-200 ${clickable ? 'cursor-pointer hover:shadow-md hover:border-sage-300 transition-all' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: kpi.bg }}>
                  <Icon className="w-5 h-5" style={{ color: kpi.color }} />
                </div>
                {clickable && <ChevronRight className="w-4 h-4 text-sage-300" />}
              </div>
              <p className="text-2xl font-bold text-sage-900">{kpi.value}</p>
              <p className="text-sm font-semibold text-sage-700 mt-0.5">{kpi.label}</p>
              <p className="text-xs text-sage-400 mt-0.5">{kpi.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Pipeline visual */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-card border border-cream-200">
        <h2 className="font-semibold text-sage-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-sage-500" />
          Estado del pipeline
        </h2>
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex gap-2 min-w-max md:grid md:grid-cols-7 md:min-w-0">
            {STAGE_CONFIG.map((stage) => {
              const count = leads.filter(l => l.estado === stage.key).length;
              const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => onNavigateToLeads?.({ estado: stage.key })}
                  className="text-center hover:opacity-80 transition-opacity cursor-pointer group w-20 md:w-auto flex-shrink-0 md:flex-shrink"
                >
                  <div className="rounded-xl p-2 mb-1.5 group-hover:ring-2 group-hover:ring-offset-1 transition-all" style={{ background: stage.bg, ['--tw-ring-color' as string]: stage.color }}>
                    <p className="text-xl font-bold" style={{ color: stage.color }}>{count}</p>
                  </div>
                  <p className="text-xs font-medium text-sage-700 leading-tight">{stage.label}</p>
                  <p className="text-xs text-sage-400">{pct}%</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Leads que necesitan atención */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 shadow-card border border-cream-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sage-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold-500" />
              Requieren acción
            </h2>
            <span className="text-xs text-sage-400 bg-cream-100 px-2 py-1 rounded-full">{attentionLeads.length} leads</span>
          </div>
          <div className="space-y-2">
            {attentionLeads.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 text-sage-300 mx-auto mb-2" />
                <p className="text-sm text-sage-400">Todo al día 🎉</p>
              </div>
            ) : (
              attentionLeads.map((lead) => {
                const urgKey = (lead.urgencia ?? '').toLowerCase().replace(/ /g, '_');
                const urg = URGENCIA_CONFIG[urgKey];
                const UrgIcon = urg?.icon ?? Clock;
                return (
                  <div key={lead.id} onClick={() => onViewLead?.(lead.id)} className="flex items-center gap-3 p-3 rounded-xl border border-cream-200 hover:border-sage-300 hover:bg-cream-50 transition-all cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-sage-100 flex items-center justify-center flex-shrink-0">
                      <UserCheck className="w-4 h-4 text-sage-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-sage-900 truncate">{lead.nombre_adulto_mayor}</p>
                      <p className="text-xs text-sage-500 truncate">{lead.nombre_contacto} · {getStageLabel(lead.estado)}</p>
                    </div>
                    {urg && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${urg.cls}`}>
                        <UrgIcon className="w-3 h-3" />
                        {urg.label}
                      </span>
                    )}
                    <p className="text-xs text-sage-400 flex-shrink-0">{formatRelativeTime(lead.updated_at || lead.created_at)}</p>
                    <ChevronRight className="w-3.5 h-3.5 text-sage-300 flex-shrink-0 group-hover:text-sage-500 transition" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Stats sidebar */}
        <div className="space-y-4">
          {/* Propuestas */}
          <div className="bg-white rounded-2xl p-5 shadow-card border border-cream-200">
            <h2 className="font-semibold text-sage-800 flex items-center gap-2 mb-4">
              <Send className="w-4 h-4 text-teal-500" />
              Propuestas
            </h2>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-2xl font-bold text-sage-900">{proposalStats.sent}</p>
                <p className="text-xs text-sage-500 mt-0.5">enviadas</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-teal-500" />
                  <p className="text-xl font-bold text-teal-600">{proposalStats.opened}</p>
                </div>
                <p className="text-xs text-sage-500 mt-0.5">abiertas</p>
              </div>
              {proposalStats.sent > 0 && (
                <div className="ml-auto text-right">
                  <p className="text-lg font-bold text-gold-600">{Math.round((proposalStats.opened / proposalStats.sent) * 100)}%</p>
                  <p className="text-xs text-sage-400">apertura</p>
                </div>
              )}
            </div>
          </div>

          {/* Tareas */}
          <div className="bg-white rounded-2xl p-5 shadow-card border border-amber-100">
            <h2 className="font-semibold text-sage-800 flex items-center gap-2 mb-3">
              <ListTodo className="w-4 h-4 text-gold-500" />
              Tareas pendientes
            </h2>
            <p className="text-3xl font-bold text-sage-900">{pendingTasksCount}</p>
            {pendingTasksCount > 0 && (
              <p className="text-xs text-orange-600 mt-1 font-medium">⚠ Revisar tareas del día</p>
            )}
          </div>

          {/* Ejecutivos (admin only) */}
          {isAdmin && ejecutivos.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-card border border-cream-200">
              <h2 className="font-semibold text-sage-800 flex items-center gap-2 mb-3">
                <UserCircle className="w-4 h-4 text-sage-500" />
                Equipo comercial
              </h2>
              <div className="space-y-2">
                {ejecutivos.slice(0, 4).map((ej) => {
                  const ejLeads = leads.filter(l => l.ejecutivo_id === ej.id);
                  const ejActivos = ejLeads.filter(l => !['cierre_ganado', 'cierre_perdido', 'fallecido'].includes(l.estado)).length;
                  const ejGanados = ejLeads.filter(l => l.estado === 'cierre_ganado').length;
                  const ini = ej.nombre_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <div key={ej.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-cream-50">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #507f50, #315031)' }}>
                        {ini}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-sage-900 truncate">{ej.nombre_completo}</p>
                        <p className="text-xs text-sage-400">{ejActivos} activos · {ejGanados} ganados</p>
                      </div>
                      <span className="text-sm font-bold text-sage-700">{ejLeads.length}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
