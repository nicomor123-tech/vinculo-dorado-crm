import { Fragment, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import {
  BrainCircuit, TrendingUp, Clock, DollarSign, AlertTriangle, Users,
  Printer, Filter, Flame, CalendarRange, Target, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid, Cell, PieChart, Pie,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getStageLabel } from '../../lib/pipeline';

// ---------------------------------------------------------------------------
// Centro de Inteligencia Comercial — /inteligencia
// Dark elegante, KPIs duros arriba, gráficas accionables abajo.
// Admins ven todo; el ejecutivo comercial ve SOLO sus métricas.
// ---------------------------------------------------------------------------

const ETAPAS_TERMINALES = ['cierre_ganado', 'cierre_perdido', 'fallecido'];

// Flujo "feliz" del embudo, en orden.
const FUNNEL_STAGES = [
  'lead_nuevo', 'lead_calificado', 'hogares_propuestos',
  'visitas_programadas', 'en_decision_familiar', 'cierre_ganado',
];

const FUNNEL_COLORS = ['#e4ae3a', '#d4951f', '#4ab8ad', '#2e9d93', '#739f73', '#22c55e'];

const TIPO_COLORS: Record<string, string> = {
  llamada: '#e4ae3a',
  whatsapp: '#22c55e',
  visita: '#4ab8ad',
  email: '#a78bfa',
  propuesta_enviada: '#f472b6',
  otro: '#94a3b8',
};

const MOTIVO_LABELS: Record<string, string> = {
  precio: 'Precio',
  eligio_otro_hogar: 'Eligió otro hogar',
  familia_desistio: 'Familia desistió',
  fallecido: 'Fallecido',
  no_contesta: 'No contesta',
  otro: 'Otro',
};

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HORAS_HEATMAP = Array.from({ length: 15 }, (_, i) => i + 7); // 7am .. 9pm

interface LeadRow {
  id: string;
  estado: string;
  ejecutivo_id: string | null;
  como_nos_conocio: string | null;
  motivo_perdida: string | null;
  created_at: string;
  updated_at: string;
  ultima_gestion: string | null;
  nombre_contacto: string;
  presupuesto_mensual: number | null;
}

interface NotaRow {
  id: string;
  lead_id: string;
  asesor_id: string;
  tipo_seguimiento: string;
  created_at: string;
}

interface HistRow {
  lead_id: string;
  etapa_anterior: string | null;
  etapa_nueva: string;
  changed_at: string;
}

interface ComisionRow {
  ejecutivo_id: string | null;
  valor_comision_total: number;
  valor_ejecutivo: number;
  valor_vinculo_dorado: number;
  fecha_generacion: string;
}

interface PerfilRow {
  id: string;
  nombre_completo: string;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatCOP(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(v).toLocaleString('es-CO')}`;
}

function semanaKey(iso: string): string {
  // Lunes de la semana correspondiente (hora Bogotá aprox por fecha local).
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  const lunes = new Date(d);
  lunes.setDate(d.getDate() - day);
  return isoDate(lunes);
}

function diaBogota(iso: string): { diaSemana: number; hora: number } {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  return { diaSemana: (d.getDay() + 6) % 7, hora: d.getHours() };
}

// ---------------------------------------------------------------------------

export function InteligenciaModule() {
  const { profile, isAdmin } = useAuth();

  const hoy = new Date();
  const hace60 = new Date(hoy.getTime() - 60 * 86_400_000);

  const [desde, setDesde] = useState(isoDate(hace60));
  const [hasta, setHasta] = useState(isoDate(hoy));
  const [filtroEjecutivo, setFiltroEjecutivo] = useState<string>('todos');
  const [filtroOrigen, setFiltroOrigen] = useState<string>('todos');
  const [agrupacion, setAgrupacion] = useState<'dia' | 'semana'>('dia');

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [historial, setHistorial] = useState<HistRow[]>([]);
  const [comisiones, setComisiones] = useState<ComisionRow[]>([]);
  const [ejecutivos, setEjecutivos] = useState<PerfilRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sinHistorial, setSinHistorial] = useState(false);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [leadsRes, notasRes, histRes, comRes, perfRes] = await Promise.all([
        supabase.from('leads').select('id, estado, ejecutivo_id, como_nos_conocio, motivo_perdida, created_at, updated_at, ultima_gestion, nombre_contacto, presupuesto_mensual'),
        supabase.from('notas_seguimiento').select('id, lead_id, asesor_id, tipo_seguimiento, created_at'),
        supabase.from('lead_etapa_historial').select('lead_id, etapa_anterior, etapa_nueva, changed_at'),
        supabase.from('comisiones').select('ejecutivo_id, valor_comision_total, valor_ejecutivo, valor_vinculo_dorado, fecha_generacion'),
        supabase.from('profiles').select('id, nombre_completo').eq('rol', 'ejecutivo_comercial').eq('activo', true),
      ]);
      setLeads((leadsRes.data as LeadRow[]) ?? []);
      setNotas((notasRes.data as NotaRow[]) ?? []);
      if (histRes.error) {
        // La tabla aún no existe (SQL pendiente de correr): degradar sin romper.
        setSinHistorial(true);
        setHistorial([]);
      } else {
        setHistorial((histRes.data as HistRow[]) ?? []);
        setSinHistorial(false);
      }
      setComisiones((comRes.data as ComisionRow[]) ?? []);
      setEjecutivos((perfRes.data as PerfilRow[]) ?? []);
    } catch (e) {
      console.error('Error cargando inteligencia:', e);
    } finally {
      setLoading(false);
    }
  };

  // --- Filtros efectivos (el ejecutivo SOLO se ve a sí mismo) ---
  const ejecutivoEfectivo = isAdmin ? filtroEjecutivo : (profile?.id ?? 'todos');

  const desdeMs = useMemo(() => new Date(desde + 'T00:00:00-05:00').getTime(), [desde]);
  const hastaMs = useMemo(() => new Date(hasta + 'T23:59:59-05:00').getTime(), [hasta]);

  const origenes = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.como_nos_conocio) set.add(l.como_nos_conocio); });
    return [...set].sort();
  }, [leads]);

  // Leads tras filtros de ejecutivo + origen (sin filtro temporal — base de KPIs de estado).
  const leadsFiltrados = useMemo(() => {
    return leads.filter(l => {
      if (ejecutivoEfectivo !== 'todos' && l.ejecutivo_id !== ejecutivoEfectivo) return false;
      if (filtroOrigen !== 'todos' && l.como_nos_conocio !== filtroOrigen) return false;
      return true;
    });
  }, [leads, ejecutivoEfectivo, filtroOrigen]);

  const leadIdsFiltrados = useMemo(() => new Set(leadsFiltrados.map(l => l.id)), [leadsFiltrados]);

  // Leads CREADOS dentro del rango (base del embudo y de "nuevos por semana").
  const leadsEnRango = useMemo(
    () => leadsFiltrados.filter(l => {
      const t = Date.parse(l.created_at);
      return t >= desdeMs && t <= hastaMs;
    }),
    [leadsFiltrados, desdeMs, hastaMs],
  );

  // Gestiones dentro del rango (y del ejecutivo / leads filtrados).
  const notasEnRango = useMemo(
    () => notas.filter(n => {
      const t = Date.parse(n.created_at);
      if (t < desdeMs || t > hastaMs) return false;
      if (ejecutivoEfectivo !== 'todos' && n.asesor_id !== ejecutivoEfectivo) return false;
      if (filtroOrigen !== 'todos' && !leadIdsFiltrados.has(n.lead_id)) return false;
      return true;
    }),
    [notas, desdeMs, hastaMs, ejecutivoEfectivo, filtroOrigen, leadIdsFiltrados],
  );

  const histFiltrado = useMemo(
    () => historial.filter(h => leadIdsFiltrados.has(h.lead_id)),
    [historial, leadIdsFiltrados],
  );

  // ------------------------------------------------------------------
  // KPIs duros
  // ------------------------------------------------------------------
  const kpis = useMemo(() => {
    const ahora = Date.now();
    const ganados = leadsFiltrados.filter(l => l.estado === 'cierre_ganado');
    const perdidos = leadsFiltrados.filter(l => l.estado === 'cierre_perdido' || l.estado === 'fallecido');
    const cerrados = ganados.length + perdidos.length;
    const tasaCierre = cerrados > 0 ? Math.round((ganados.length / cerrados) * 100) : 0;

    // Tiempo promedio lead -> cierre ganado (usa el historial si existe).
    const cierreEventos = histFiltrado.filter(h => h.etapa_nueva === 'cierre_ganado');
    const cierrePorLead = new Map<string, string>();
    cierreEventos.forEach(h => { if (!cierrePorLead.has(h.lead_id)) cierrePorLead.set(h.lead_id, h.changed_at); });
    let sumaDias = 0, nDias = 0;
    ganados.forEach(l => {
      const fechaCierre = cierrePorLead.get(l.id) ?? l.updated_at;
      const dias = (Date.parse(fechaCierre) - Date.parse(l.created_at)) / 86_400_000;
      if (isFinite(dias) && dias >= 0) { sumaDias += dias; nDias++; }
    });
    const diasPromedioCierre = nDias > 0 ? Math.round(sumaDias / nDias) : null;

    // Comisiones del periodo (regla 40% / 30-70).
    const comPeriodo = comisiones.filter(c => {
      const t = Date.parse(c.fecha_generacion);
      if (t < desdeMs || t > hastaMs) return false;
      if (ejecutivoEfectivo !== 'todos' && c.ejecutivo_id !== ejecutivoEfectivo) return false;
      return true;
    });
    const comisionTotal = comPeriodo.reduce((s, c) => s + (Number(c.valor_comision_total) || 0), 0);
    const comisionVD = comPeriodo.reduce((s, c) => s + (Number(c.valor_vinculo_dorado) || 0), 0);
    const comisionEjecutivo = comPeriodo.reduce((s, c) => s + (Number(c.valor_ejecutivo) || 0), 0);

    // Leads activos sin gestión > 48h.
    const activos = leadsFiltrados.filter(l => !ETAPAS_TERMINALES.includes(l.estado));
    const sinGestion48 = activos.filter(l => {
      const ref = l.ultima_gestion ?? l.created_at;
      return ahora - Date.parse(ref) > 48 * 3600_000;
    });

    // Activos por ejecutivo (solo admins lo ven desglosado).
    const porEjecutivo = ejecutivos.map(e => ({
      nombre: e.nombre_completo.split(' ')[0],
      activos: leads.filter(l => l.ejecutivo_id === e.id && !ETAPAS_TERMINALES.includes(l.estado)).length,
    }));

    return {
      tasaCierre, ganados: ganados.length, perdidos: perdidos.length,
      diasPromedioCierre, comisionTotal, comisionVD, comisionEjecutivo,
      sinGestion48: sinGestion48.length, activos: activos.length, porEjecutivo,
    };
  }, [leadsFiltrados, histFiltrado, comisiones, desdeMs, hastaMs, ejecutivoEfectivo, ejecutivos, leads]);

  // ------------------------------------------------------------------
  // Embudo: leads creados en el rango que ALCANZARON cada etapa
  // ------------------------------------------------------------------
  const embudo = useMemo(() => {
    const idsRango = new Set(leadsEnRango.map(l => l.id));
    const alcanzo = new Map<string, Set<string>>();
    FUNNEL_STAGES.forEach(s => alcanzo.set(s, new Set()));

    // estado actual cuenta como alcanzado (y todas las etapas previas del flujo).
    leadsEnRango.forEach(l => {
      const idx = FUNNEL_STAGES.indexOf(l.estado);
      if (idx >= 0) {
        for (let i = 0; i <= idx; i++) alcanzo.get(FUNNEL_STAGES[i])!.add(l.id);
      } else {
        // Etapas fuera del flujo feliz (no_contesta, escalado, perdido…) cuentan como lead_nuevo.
        alcanzo.get('lead_nuevo')!.add(l.id);
      }
    });
    // El historial suma alcances reales aunque el lead haya retrocedido o cerrado.
    histFiltrado.forEach(h => {
      if (!idsRango.has(h.lead_id)) return;
      const idx = FUNNEL_STAGES.indexOf(h.etapa_nueva);
      if (idx >= 0) {
        for (let i = 0; i <= idx; i++) alcanzo.get(FUNNEL_STAGES[i])!.add(h.lead_id);
      }
    });

    const counts = FUNNEL_STAGES.map(s => alcanzo.get(s)!.size);
    return FUNNEL_STAGES.map((s, i) => ({
      etapa: getStageLabel(s),
      count: counts[i],
      pctDelTotal: counts[0] > 0 ? Math.round((counts[i] / counts[0]) * 100) : 0,
      convDesdeAnterior: i === 0 ? 100 : (counts[i - 1] > 0 ? Math.round((counts[i] / counts[i - 1]) * 100) : 0),
      color: FUNNEL_COLORS[i],
    }));
  }, [leadsEnRango, histFiltrado]);

  // ------------------------------------------------------------------
  // Permanencia promedio por etapa (días) — desde lead_etapa_historial
  // ------------------------------------------------------------------
  const permanencia = useMemo(() => {
    const porLead = new Map<string, HistRow[]>();
    histFiltrado.forEach(h => {
      const arr = porLead.get(h.lead_id) ?? [];
      arr.push(h);
      porLead.set(h.lead_id, arr);
    });
    const acum = new Map<string, { suma: number; n: number }>();
    const ahora = Date.now();
    const leadById = new Map(leadsFiltrados.map(l => [l.id, l]));

    porLead.forEach((evs, leadId) => {
      const orden = [...evs].sort((a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at));
      for (let i = 0; i < orden.length; i++) {
        const etapa = orden[i].etapa_nueva;
        const inicio = Date.parse(orden[i].changed_at);
        const fin = i + 1 < orden.length ? Date.parse(orden[i + 1].changed_at) : (
          // etapa actual: cuenta hasta hoy SOLO si el lead sigue en esa etapa y no es terminal
          leadById.get(leadId)?.estado === etapa && !ETAPAS_TERMINALES.includes(etapa) ? ahora : NaN
        );
        if (!isFinite(fin)) continue;
        const dias = (fin - inicio) / 86_400_000;
        if (dias < 0) continue;
        const a = acum.get(etapa) ?? { suma: 0, n: 0 };
        a.suma += dias; a.n++;
        acum.set(etapa, a);
      }
    });

    return [...acum.entries()]
      .filter(([etapa]) => !ETAPAS_TERMINALES.includes(etapa))
      .map(([etapa, { suma, n }]) => ({ etapa: getStageLabel(etapa), dias: Math.round((suma / n) * 10) / 10 }))
      .sort((a, b) => b.dias - a.dias);
  }, [histFiltrado, leadsFiltrados]);

  // ------------------------------------------------------------------
  // Curvas de gestiones por día/semana y por tipo
  // ------------------------------------------------------------------
  const tiposPresentes = useMemo(() => {
    const set = new Set<string>();
    notasEnRango.forEach(n => set.add(n.tipo_seguimiento || 'otro'));
    return [...set];
  }, [notasEnRango]);

  const serieGestiones = useMemo(() => {
    const buckets = new Map<string, Record<string, number>>();
    notasEnRango.forEach(n => {
      const key = agrupacion === 'dia'
        ? isoDate(new Date(new Date(n.created_at).toLocaleString('en-US', { timeZone: 'America/Bogota' })))
        : semanaKey(n.created_at);
      const b = buckets.get(key) ?? {};
      const tipo = n.tipo_seguimiento || 'otro';
      b[tipo] = (b[tipo] ?? 0) + 1;
      buckets.set(key, b);
    });
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, tipos]) => ({
        fecha: agrupacion === 'dia'
          ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
          : `Sem ${new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}`,
        ...tipos,
      }));
  }, [notasEnRango, agrupacion]);

  // Gestiones por ejecutivo (apilado por semana) — solo admins.
  const seriePorEjecutivo = useMemo(() => {
    if (!isAdmin) return [];
    const nombrePorId = new Map(ejecutivos.map(e => [e.id, e.nombre_completo.split(' ')[0]]));
    const buckets = new Map<string, Record<string, number>>();
    notas.forEach(n => {
      const t = Date.parse(n.created_at);
      if (t < desdeMs || t > hastaMs) return;
      const key = semanaKey(n.created_at);
      const nombre = nombrePorId.get(n.asesor_id) ?? 'Admins';
      const b = buckets.get(key) ?? {};
      b[nombre] = (b[nombre] ?? 0) + 1;
      buckets.set(key, b);
    });
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, m]) => ({
        fecha: `Sem ${new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}`,
        ...m,
      }));
  }, [notas, isAdmin, ejecutivos, desdeMs, hastaMs]);

  const nombresEjecutivosSerie = useMemo(() => {
    const set = new Set<string>();
    seriePorEjecutivo.forEach(row => Object.keys(row).forEach(k => { if (k !== 'fecha') set.add(k); }));
    return [...set];
  }, [seriePorEjecutivo]);

  // ------------------------------------------------------------------
  // Leads nuevos vs cierres por semana
  // ------------------------------------------------------------------
  const nuevosVsCierres = useMemo(() => {
    const buckets = new Map<string, { nuevos: number; ganados: number; perdidos: number }>();
    const touch = (key: string) => {
      const b = buckets.get(key) ?? { nuevos: 0, ganados: 0, perdidos: 0 };
      buckets.set(key, b);
      return b;
    };
    leadsEnRango.forEach(l => { touch(semanaKey(l.created_at)).nuevos++; });

    // Cierres por la fecha del evento (historial); fallback estado actual + updated_at.
    const vistos = new Set<string>();
    histFiltrado.forEach(h => {
      const t = Date.parse(h.changed_at);
      if (t < desdeMs || t > hastaMs) return;
      if (h.etapa_nueva === 'cierre_ganado' && !vistos.has(h.lead_id + 'g')) {
        vistos.add(h.lead_id + 'g');
        touch(semanaKey(h.changed_at)).ganados++;
      }
      if ((h.etapa_nueva === 'cierre_perdido' || h.etapa_nueva === 'fallecido') && !vistos.has(h.lead_id + 'p')) {
        vistos.add(h.lead_id + 'p');
        touch(semanaKey(h.changed_at)).perdidos++;
      }
    });
    leadsFiltrados.forEach(l => {
      const t = Date.parse(l.updated_at);
      if (t < desdeMs || t > hastaMs) return;
      if (l.estado === 'cierre_ganado' && !vistos.has(l.id + 'g')) touch(semanaKey(l.updated_at)).ganados++;
      if ((l.estado === 'cierre_perdido' || l.estado === 'fallecido') && !vistos.has(l.id + 'p')) touch(semanaKey(l.updated_at)).perdidos++;
    });

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, v]) => ({
        fecha: new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
        Nuevos: v.nuevos, Ganados: v.ganados, Perdidos: v.perdidos,
      }));
  }, [leadsEnRango, histFiltrado, leadsFiltrados, desdeMs, hastaMs]);

  // ------------------------------------------------------------------
  // Motivos de cierre perdido
  // ------------------------------------------------------------------
  const motivosPerdida = useMemo(() => {
    const counts = new Map<string, number>();
    leadsFiltrados
      .filter(l => l.estado === 'cierre_perdido')
      .forEach(l => {
        const m = l.motivo_perdida || 'sin_motivo';
        counts.set(m, (counts.get(m) ?? 0) + 1);
      });
    return [...counts.entries()]
      .map(([motivo, count]) => ({
        motivo: MOTIVO_LABELS[motivo] ?? (motivo === 'sin_motivo' ? 'Sin registrar' : motivo),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [leadsFiltrados]);

  const MOTIVO_COLORS = ['#e4ae3a', '#4ab8ad', '#a78bfa', '#f472b6', '#94a3b8', '#fb923c', '#64748b'];

  // ------------------------------------------------------------------
  // Heatmap día × hora de gestiones (cuándo SÍ se gestiona / contesta)
  // ------------------------------------------------------------------
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(HORAS_HEATMAP.length).fill(0));
    let max = 0;
    notasEnRango.forEach(n => {
      const { diaSemana, hora } = diaBogota(n.created_at);
      const hIdx = HORAS_HEATMAP.indexOf(hora);
      if (hIdx >= 0) {
        grid[diaSemana][hIdx]++;
        if (grid[diaSemana][hIdx] > max) max = grid[diaSemana][hIdx];
      }
    });
    return { grid, max };
  }, [notasEnRango]);

  // ------------------------------------------------------------------
  // Origen del lead y conversión por origen
  // ------------------------------------------------------------------
  const porOrigen = useMemo(() => {
    const m = new Map<string, { total: number; ganados: number }>();
    leadsFiltrados.forEach(l => {
      const o = l.como_nos_conocio || 'Sin origen';
      const e = m.get(o) ?? { total: 0, ganados: 0 };
      e.total++;
      if (l.estado === 'cierre_ganado') e.ganados++;
      m.set(o, e);
    });
    return [...m.entries()]
      .map(([origen, v]) => ({
        origen,
        total: v.total,
        ganados: v.ganados,
        conversion: v.total > 0 ? Math.round((v.ganados / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [leadsFiltrados]);

  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-sage-500">Cargando inteligencia comercial...</p>
        </div>
      </div>
    );
  }

  const tooltipStyle = {
    background: '#1c2a22', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, color: '#f4f7f4', fontSize: 12,
  };

  return (
    <div
      className="-m-4 sm:-m-5 lg:-m-6 min-h-[calc(100vh-3.5rem)] p-4 sm:p-6 lg:p-8 print:bg-white print:text-black print:m-0 print:p-0"
      style={{ background: 'linear-gradient(160deg, #0d1410 0%, #14201a 45%, #182721 100%)' }}
    >
      <div className="max-w-7xl mx-auto space-y-6 print:space-y-4">

        {/* ---------- Header + filtros ---------- */}
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #e4ae3a, #b87616)', boxShadow: '0 8px 24px rgba(228,174,58,0.35)' }}>
                <BrainCircuit className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl text-white leading-tight">Inteligencia Comercial</h1>
                <p className="text-white/40 text-xs sm:text-sm">
                  {isAdmin ? 'Visión total del negocio · Vínculo Dorado' : `Tu desempeño, ${profile?.nombre_completo?.split(' ')[0]}`}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/90 border border-white/15 hover:bg-white/10 transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            Exportar informe
          </button>
        </div>

        {/* Título solo para impresión */}
        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">Informe de Inteligencia Comercial — Vínculo Dorado</h1>
          <p className="text-sm text-gray-600">Periodo: {desde} a {hasta} · Generado el {new Date().toLocaleDateString('es-CO')}</p>
        </div>

        {/* ---------- Barra de filtros ---------- */}
        <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl border border-white/10 print:hidden"
          style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2 text-white/50 text-xs font-semibold uppercase tracking-wider mr-1">
            <Filter className="w-3.5 h-3.5" /> Filtros
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="bg-white/10 border border-white/15 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-gold-400 [color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="bg-white/10 border border-white/15 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-gold-400 [color-scheme:dark]" />
          </div>
          {isAdmin && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Ejecutivo</label>
              <select value={filtroEjecutivo} onChange={e => setFiltroEjecutivo(e.target.value)}
                className="bg-white/10 border border-white/15 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-gold-400 [&>option]:text-gray-900">
                <option value="todos">Todos</option>
                {ejecutivos.map(e => <option key={e.id} value={e.id}>{e.nombre_completo}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Origen</label>
            <select value={filtroOrigen} onChange={e => setFiltroOrigen(e.target.value)}
              className="bg-white/10 border border-white/15 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-gold-400 max-w-[180px] [&>option]:text-gray-900">
              <option value="todos">Todos</option>
              {origenes.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {sinHistorial && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-200 text-xs print:hidden">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>El historial de etapas aún no está activo en la base de datos (falta correr el SQL). Permanencia por etapa y conversiones finas se activarán desde hoy una vez se ejecute.</span>
          </div>
        )}

        {/* ---------- KPIs ---------- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {[
            {
              icon: Target, label: 'Tasa de cierre', color: '#e4ae3a',
              value: `${kpis.tasaCierre}%`,
              desc: `${kpis.ganados} ganados · ${kpis.perdidos} perdidos`,
            },
            {
              icon: Clock, label: 'Lead → cierre ganado', color: '#4ab8ad',
              value: kpis.diasPromedioCierre != null ? `${kpis.diasPromedioCierre} días` : '—',
              desc: 'tiempo promedio',
            },
            {
              icon: DollarSign, label: 'Comisiones del periodo', color: '#22c55e',
              value: formatCOP(isAdmin ? kpis.comisionTotal : kpis.comisionEjecutivo),
              desc: isAdmin ? `VD ${formatCOP(kpis.comisionVD)} · Ejec ${formatCOP(kpis.comisionEjecutivo)}` : 'tu 30% del periodo',
            },
            {
              icon: AlertTriangle, label: 'Sin gestión +48h', color: '#fb7185',
              value: String(kpis.sinGestion48),
              desc: 'leads activos desatendidos',
            },
            {
              icon: Users, label: 'Leads activos', color: '#a78bfa',
              value: String(kpis.activos),
              desc: isAdmin && kpis.porEjecutivo.length > 0
                ? kpis.porEjecutivo.map(p => `${p.nombre} ${p.activos}`).join(' · ')
                : 'en tu pipeline',
            },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i}
                className="rounded-2xl p-4 sm:p-5 border border-white/10 hover:border-white/20 transition-colors duration-300 print:border-gray-300"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: `${k.color}22` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: k.color, width: 18, height: 18 }} />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white print:text-black leading-none">{k.value}</p>
                <p className="text-xs font-semibold text-white/70 print:text-gray-800 mt-1.5">{k.label}</p>
                <p className="text-[11px] text-white/35 print:text-gray-500 mt-0.5 leading-tight">{k.desc}</p>
              </div>
            );
          })}
        </div>

        {/* ---------- Embudo + permanencia ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <Panel icon={TrendingUp} title="Embudo del pipeline" subtitle={`Leads creados en el periodo (${leadsEnRango.length})`}>
            <div className="space-y-1.5 mt-1">
              {embudo.map((e, i) => (
                <div key={e.etapa}>
                  {i > 0 && (
                    <div className="flex justify-center my-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color: e.convDesdeAnterior >= 50 ? '#86efac' : e.convDesdeAnterior >= 25 ? '#fde68a' : '#fda4af', background: 'rgba(255,255,255,0.06)' }}>
                        ↓ {e.convDesdeAnterior}%
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex justify-center">
                      <div
                        className="h-9 rounded-lg flex items-center justify-between px-3 transition-all duration-500"
                        style={{
                          width: `${Math.max(e.pctDelTotal, 14)}%`,
                          background: `linear-gradient(90deg, ${e.color}cc, ${e.color}88)`,
                          boxShadow: `0 2px 12px ${e.color}33`,
                        }}
                      >
                        <span className="text-[11px] sm:text-xs font-bold text-white whitespace-nowrap drop-shadow">{e.etapa}</span>
                        <span className="text-xs sm:text-sm font-bold text-white ml-2 drop-shadow">{e.count}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-white/40 w-9 text-right">{e.pctDelTotal}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel icon={Clock} title="Permanencia promedio por etapa" subtitle="Días que un lead pasa en cada etapa (historial real)">
            {permanencia.length === 0 ? (
              <EmptyChart msg="Aún no hay historial de etapas suficiente. Se llena automáticamente con cada cambio de etapa." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={permanencia} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} unit="d" axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="etapa" width={130} tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} días`, 'Promedio']} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="dias" radius={[0, 8, 8, 0]} barSize={18}>
                    {permanencia.map((_, i) => (
                      <Cell key={i} fill={['#e4ae3a', '#4ab8ad', '#a78bfa', '#f472b6', '#739f73', '#fb923c'][i % 6]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        {/* ---------- Curvas de gestiones ---------- */}
        <Panel
          icon={Activity}
          title="Actividad comercial — tipificaciones"
          subtitle="Gestiones registradas por tipo"
          action={
            <div className="flex rounded-lg overflow-hidden border border-white/15 print:hidden">
              {(['dia', 'semana'] as const).map(g => (
                <button key={g} onClick={() => setAgrupacion(g)}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${agrupacion === g ? 'bg-gold-500 text-white' : 'text-white/50 hover:text-white'}`}>
                  {g === 'dia' ? 'Por día' : 'Por semana'}
                </button>
              ))}
            </div>
          }
        >
          {serieGestiones.length === 0 ? (
            <EmptyChart msg="Sin gestiones registradas en el periodo seleccionado." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={serieGestiones} margin={{ left: -18, right: 8, top: 8 }}>
                <defs>
                  {tiposPresentes.map(t => (
                    <linearGradient key={t} id={`grad-${t}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TIPO_COLORS[t] ?? '#94a3b8'} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={TIPO_COLORS[t] ?? '#94a3b8'} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="fecha" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }} />
                {tiposPresentes.map(t => (
                  <Area key={t} type="monotone" dataKey={t} stackId="1"
                    stroke={TIPO_COLORS[t] ?? '#94a3b8'} strokeWidth={2}
                    fill={`url(#grad-${t})`} name={t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* ---------- Por ejecutivo + nuevos vs cierres ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {isAdmin && (
            <Panel icon={Users} title="Trabajo por ejecutivo" subtitle="Gestiones por semana, por persona">
              {seriePorEjecutivo.length === 0 ? (
                <EmptyChart msg="Sin datos en el periodo." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={seriePorEjecutivo} margin={{ left: -18, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="fecha" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {nombresEjecutivosSerie.map((n, i) => (
                      <Bar key={n} dataKey={n} stackId="a" fill={['#e4ae3a', '#4ab8ad', '#a78bfa', '#f472b6'][i % 4]} radius={i === nombresEjecutivosSerie.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          )}

          <Panel icon={CalendarRange} title="Leads nuevos vs cierres" subtitle="Por semana: entrada de leads contra resultados">
            {nuevosVsCierres.length === 0 ? (
              <EmptyChart msg="Sin movimientos en el periodo." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={nuevosVsCierres} margin={{ left: -18, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="fecha" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Nuevos" fill="#e4ae3a" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Ganados" fill="#22c55e" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Perdidos" fill="#fb7185" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          {!isAdmin && (
            <Panel icon={Flame} title="Motivos de cierre perdido" subtitle="Por qué se pierden los casos">
              <MotivosChart data={motivosPerdida} colors={MOTIVO_COLORS} tooltipStyle={tooltipStyle} />
            </Panel>
          )}
        </div>

        {/* ---------- Motivos + heatmap ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {isAdmin && (
            <Panel icon={Flame} title="Motivos de cierre perdido" subtitle="Por qué se pierden los casos">
              <MotivosChart data={motivosPerdida} colors={MOTIVO_COLORS} tooltipStyle={tooltipStyle} />
            </Panel>
          )}

          <Panel icon={Clock} title="Cuándo SÍ contestan" subtitle="Heatmap de gestiones efectivas por día y hora — úsalo para telemercadeo">
            <div className="mt-2 overflow-x-auto">
              <div className="min-w-[460px]">
                <div className="grid gap-[3px]" style={{ gridTemplateColumns: `34px repeat(${HORAS_HEATMAP.length}, 1fr)` }}>
                  <div />
                  {HORAS_HEATMAP.map(h => (
                    <div key={h} className="text-center text-[9px] text-white/35 print:text-gray-500">
                      {h <= 12 ? `${h}a` : `${h - 12}p`}
                    </div>
                  ))}
                  {DIAS_SEMANA.map((dia, dIdx) => (
                    <Fragment key={dia}>
                      <div className="text-[10px] text-white/45 print:text-gray-600 flex items-center">{dia}</div>
                      {HORAS_HEATMAP.map((h, hIdx) => {
                        const v = heatmap.grid[dIdx][hIdx];
                        const intensidad = heatmap.max > 0 ? v / heatmap.max : 0;
                        return (
                          <div
                            key={h}
                            title={`${dia} ${h}:00 — ${v} gestión${v !== 1 ? 'es' : ''}`}
                            className="aspect-square rounded-[4px] transition-colors"
                            style={{
                              background: v === 0
                                ? 'rgba(255,255,255,0.05)'
                                : `rgba(228,174,58,${0.18 + intensidad * 0.82})`,
                              boxShadow: intensidad > 0.6 ? '0 0 8px rgba(228,174,58,0.4)' : 'none',
                            }}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-2 text-[10px] text-white/35">
                  Menos
                  {[0.1, 0.35, 0.6, 0.85].map(o => (
                    <span key={o} className="w-3 h-3 rounded-[3px]" style={{ background: `rgba(228,174,58,${o})` }} />
                  ))}
                  Más
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* ---------- Origen ---------- */}
        <Panel icon={Target} title="Origen del lead y conversión" subtitle="De dónde llegan los clientes y cuáles cierran">
          {porOrigen.length === 0 ? (
            <EmptyChart msg="Sin leads con los filtros actuales." />
          ) : (
            <div className="space-y-2 mt-1">
              {porOrigen.map((o) => {
                const maxTotal = porOrigen[0].total;
                return (
                  <div key={o.origen} className="flex items-center gap-3">
                    <span className="w-32 sm:w-44 text-xs text-white/65 print:text-gray-700 truncate" title={o.origen}>{o.origen}</span>
                    <div className="flex-1 h-6 rounded-lg overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="h-full flex items-center pl-2" style={{
                        width: `${Math.max((o.total / maxTotal) * 100, 6)}%`,
                        background: 'linear-gradient(90deg, rgba(74,184,173,0.8), rgba(74,184,173,0.4))',
                      }}>
                        <span className="text-[10px] font-bold text-white">{o.total}</span>
                      </div>
                    </div>
                    <span className={`w-20 text-right text-xs font-bold ${o.conversion >= 30 ? 'text-emerald-300' : o.conversion > 0 ? 'text-gold-300' : 'text-white/30'} print:text-gray-800`}>
                      {o.ganados} 🏆 · {o.conversion}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <p className="text-center text-[10px] text-white/20 pb-2 print:text-gray-400">
          Centro de Inteligencia Comercial · Vínculo Dorado · datos en vivo del CRM
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function Panel({
  icon: Icon, title, subtitle, action, children,
}: {
  icon: ElementType;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 border border-white/10 print:border-gray-300 print:break-inside-avoid"
      style={{ background: 'rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(228,174,58,0.15)' }}>
            <Icon className="w-4 h-4 text-gold-300" style={{ color: '#ecc76a' }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white print:text-black leading-tight">{title}</h2>
            {subtitle && <p className="text-[11px] text-white/35 print:text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div className="h-40 flex items-center justify-center">
      <p className="text-xs text-white/30 text-center px-6">{msg}</p>
    </div>
  );
}

function MotivosChart({
  data, colors, tooltipStyle,
}: {
  data: { motivo: string; count: number }[];
  colors: string[];
  tooltipStyle: CSSProperties;
}) {
  if (data.length === 0) {
    return <EmptyChart msg="Sin cierres perdidos en el periodo (¡buena señal!) o sin motivo registrado." />;
  }
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <ResponsiveContainer width="100%" height={210} className="sm:max-w-[220px]">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="motivo" innerRadius={48} outerRadius={80} paddingAngle={3} strokeWidth={0}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`${Number(v)} (${Math.round((Number(v) / total) * 100)}%)`, String(name)]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 w-full space-y-1.5">
        {data.map((d, i) => (
          <div key={d.motivo} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="text-white/70 print:text-gray-700 flex-1">{d.motivo}</span>
            <span className="text-white font-bold print:text-black">{d.count}</span>
            <span className="text-white/35 w-10 text-right">{Math.round((d.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
