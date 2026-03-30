import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, DollarSign, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronUp, Plus, X, Save, Percent,
  User, Building2, Calendar, FileText, Coins,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdelantoRow {
  id: string;
  comision_id: string;
  ejecutivo_id: string | null;
  monto: number;
  fecha: string;
  notas: string | null;
}

interface ComisionRow {
  id: string;
  lead_id: string | null;
  hogar_id: string | null;
  ejecutivo_id: string | null;
  valor_primer_mes: number;
  porcentaje_vinculo: number;
  valor_comision_total: number;
  valor_ejecutivo: number;
  valor_vinculo_dorado: number;
  estado_cobro: string;
  fecha_generacion: string;
  fecha_cobro: string | null;
  notas: string | null;
  created_at: string;
  // joined / enriched
  lead_nombre?: string;
  lead_contacto?: string;
  hogar_nombre?: string;
  ejecutivo_nombre?: string;
  adelantos: AdelantoRow[];
}

interface PendingLead {
  id: string;
  nombre_adulto_mayor: string;
  presupuesto_mensual: number | null;
  estado: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined) {
  if (v == null || v === 0) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(v);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STAGE_LABELS: Record<string, string> = {
  hogares_propuestos:   'Hogares propuestos',
  visitas_programadas:  'Visitas programadas',
  en_decision_familiar: 'En decisión',
};

const ESTADO_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  pendiente: { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-800 border-amber-200',  dot: 'bg-amber-400' },
  parcial:   { label: 'Parcial',    cls: 'bg-blue-50 text-blue-800 border-blue-200',     dot: 'bg-blue-400' },
  cobrado:   { label: 'Cobrado',    cls: 'bg-green-50 text-green-800 border-green-200',  dot: 'bg-green-500' },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color,
}: { icon: React.ElementType; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-cream-200 p-5 shadow-sm flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-sage-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-sage-900 leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-xs text-sage-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG['pendiente'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Adelanto Modal ───────────────────────────────────────────────────────────

function AdelantoModal({
  comision,
  onClose,
  onSaved,
  userId,
}: {
  comision: ComisionRow;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
}) {
  const totalAdelantos = comision.adelantos.reduce((s, a) => s + a.monto, 0);
  const saldoMax = comision.valor_ejecutivo - totalAdelantos;

  const [form, setForm] = useState({
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
    notas: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const monto = Number(form.monto);
    if (!monto || monto <= 0) { setError('Ingresa un monto válido.'); return; }
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase.from('adelantos_comision').insert({
        comision_id: comision.id,
        ejecutivo_id: comision.ejecutivo_id,
        monto,
        fecha: new Date(form.fecha + 'T12:00:00').toISOString(),
        aprobado_por: userId,
        notas: form.notas || null,
      });
      if (err) throw err;
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Coins className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Registrar adelanto</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Commission info */}
          <div className="bg-sage-50 rounded-xl p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-sage-600">Lead:</span>
              <span className="font-medium text-sage-900">{comision.lead_nombre ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sage-600">Ejecutivo:</span>
              <span className="font-medium text-sage-900">{comision.ejecutivo_nombre ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sage-600">Parte ejecutivo:</span>
              <span className="font-semibold text-blue-700">{fmt(comision.valor_ejecutivo)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sage-600">Adelantos previos:</span>
              <span className="font-medium text-sage-900">{fmt(totalAdelantos)}</span>
            </div>
            <div className="flex justify-between border-t border-sage-200 pt-1 mt-1">
              <span className="text-sage-600 font-medium">Saldo disponible:</span>
              <span className={`font-bold ${saldoMax > 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(saldoMax)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Monto del adelanto *</label>
            <input
              type="number"
              value={form.monto}
              onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
              placeholder="Ej: 500000"
              min={0}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-sage-400 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha</label>
            <input
              type="date"
              value={form.fecha}
              onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-sage-400 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas (opcional)</label>
            <textarea
              value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              rows={2}
              placeholder="Motivo o detalles del adelanto..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-sage-400 focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition"
            style={{ background: 'linear-gradient(135deg, #3d653d, #213521)' }}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Commission Row Card ──────────────────────────────────────────────────────

function ComisionCard({
  c,
  isAdmin,
  onOpenAdelanto,
  onUpdateEstado,
}: {
  c: ComisionRow;
  isAdmin: boolean;
  onOpenAdelanto: (c: ComisionRow) => void;
  onUpdateEstado: (id: string, estado: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalAdelantos = c.adelantos.reduce((s, a) => s + a.monto, 0);
  const saldoPendiente = c.valor_ejecutivo - totalAdelantos;

  return (
    <div className="bg-white rounded-2xl border border-cream-200 shadow-sm overflow-hidden">
      {/* Main row */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sage-900 text-sm leading-tight truncate">{c.lead_nombre ?? 'Lead desvinculado'}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {c.hogar_nombre && (
                <span className="inline-flex items-center gap-1 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
                  <Building2 className="w-3 h-3" />
                  {c.hogar_nombre}
                </span>
              )}
              {c.ejecutivo_nombre && (
                <span className="inline-flex items-center gap-1 text-xs text-sage-600 bg-sage-50 border border-sage-200 rounded-full px-2 py-0.5">
                  <User className="w-3 h-3" />
                  {c.ejecutivo_nombre}
                </span>
              )}
            </div>
          </div>
          <EstadoBadge estado={c.estado_cobro} />
        </div>

        {/* Amounts grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="bg-cream-50 rounded-xl p-2.5">
            <p className="text-xs text-sage-500">1er mes pactado</p>
            <p className="font-semibold text-sage-900 text-sm">{fmt(c.valor_primer_mes)}</p>
          </div>
          <div className="bg-cream-50 rounded-xl p-2.5">
            <p className="text-xs text-sage-500">Comisión total ({c.porcentaje_vinculo}%)</p>
            <p className="font-semibold text-sage-900 text-sm">{fmt(c.valor_comision_total)}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-2.5 border border-blue-100">
            <p className="text-xs text-blue-600">Ejecutivo (30%)</p>
            <p className="font-semibold text-blue-800 text-sm">{fmt(c.valor_ejecutivo)}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-2.5 border border-green-100">
            <p className="text-xs text-green-600">Vínculo Dorado (70%)</p>
            <p className="font-semibold text-green-800 text-sm">{fmt(c.valor_vinculo_dorado)}</p>
          </div>
        </div>

        {/* Adelantos summary */}
        <div className="flex items-center justify-between text-xs text-sage-500 mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {fmtDate(c.fecha_generacion)}
          </span>
          <span>
            Adelantos: <span className="font-semibold text-sage-700">{fmt(totalAdelantos)}</span>
            {' · '}
            Saldo: <span className={`font-semibold ${saldoPendiente > 0 ? 'text-amber-700' : 'text-green-700'}`}>{fmt(Math.max(0, saldoPendiente))}</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && c.estado_cobro !== 'cobrado' && (
            <button
              onClick={() => onOpenAdelanto(c)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
            >
              <Plus className="w-3 h-3" />
              Adelanto
            </button>
          )}
          {isAdmin && c.estado_cobro === 'pendiente' && (
            <button
              onClick={() => onUpdateEstado(c.id, 'parcial')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition"
            >
              Marcar parcial
            </button>
          )}
          {isAdmin && c.estado_cobro !== 'cobrado' && (
            <button
              onClick={() => onUpdateEstado(c.id, 'cobrado')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition"
            >
              <CheckCircle2 className="w-3 h-3" />
              Marcar cobrado
            </button>
          )}
          {isAdmin && c.estado_cobro === 'cobrado' && (
            <button
              onClick={() => onUpdateEstado(c.id, 'pendiente')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
            >
              Reabrir
            </button>
          )}
          {c.adelantos.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-sage-600 bg-sage-50 border border-sage-200 rounded-lg hover:bg-sage-100 transition ml-auto"
            >
              {c.adelantos.length} adelanto{c.adelantos.length > 1 ? 's' : ''}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Notas */}
        {c.notas && (
          <div className="mt-3 flex items-start gap-1.5 text-xs text-sage-500 bg-cream-50 rounded-lg px-3 py-2">
            <FileText className="w-3 h-3 flex-shrink-0 mt-0.5" />
            {c.notas}
          </div>
        )}
      </div>

      {/* Adelantos expanded */}
      {expanded && c.adelantos.length > 0 && (
        <div className="border-t border-cream-200 px-4 sm:px-5 py-3 bg-cream-50 space-y-2">
          <p className="text-xs font-semibold text-sage-600 uppercase tracking-wider mb-2">Adelantos registrados</p>
          {c.adelantos.map(a => (
            <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-sage-500 text-xs">{fmtDate(a.fecha)}</span>
              <span className="font-semibold text-blue-700">{fmt(a.monto)}</span>
              {a.notas && <span className="text-sage-400 text-xs flex-1 text-right truncate">{a.notas}</span>}
            </div>
          ))}
          <div className="flex justify-between text-xs font-semibold border-t border-sage-200 pt-2 mt-2">
            <span className="text-sage-600">Total adelantado:</span>
            <span className="text-blue-700">{fmt(totalAdelantos)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ComisionesModule() {
  const { profile, isAdmin, user } = useAuth();

  const [comisiones, setComisiones] = useState<ComisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('');
  const [filterEjecutivo, setFilterEjecutivo] = useState('');
  const [ejecutivos, setEjecutivos] = useState<Array<{ id: string; nombre_completo: string }>>([]);
  const [pendingLeads, setPendingLeads] = useState<PendingLead[]>([]);
  const [adelantoTarget, setAdelantoTarget] = useState<ComisionRow | null>(null);

  useEffect(() => {
    loadData();
    if (isAdmin) loadEjecutivos();
    if (!isAdmin && profile) loadPendingLeads();
  }, [profile]);

  const loadEjecutivos = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nombre_completo')
      .eq('rol', 'ejecutivo_comercial')
      .eq('activo', true)
      .order('nombre_completo');
    setEjecutivos(data || []);
  };

  const loadPendingLeads = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('leads')
      .select('id, nombre_adulto_mayor, presupuesto_mensual, estado')
      .eq('ejecutivo_id', profile.id)
      .in('estado', ['hogares_propuestos', 'visitas_programadas', 'en_decision_familiar'])
      .order('updated_at', { ascending: false });
    setPendingLeads(data || []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load comisiones
      let q = supabase.from('comisiones').select('*, adelantos_comision(id, comision_id, ejecutivo_id, monto, fecha, notas)').order('fecha_generacion', { ascending: false });
      if (!isAdmin && profile) q = q.eq('ejecutivo_id', profile.id);

      const { data: rawComisiones } = await q;

      if (!rawComisiones) { setLoading(false); return; }

      // Load lookup data
      const leadIds   = [...new Set(rawComisiones.map(c => c.lead_id).filter(Boolean))] as string[];
      const hogarIds  = [...new Set(rawComisiones.map(c => c.hogar_id).filter(Boolean))] as string[];
      const execIds   = [...new Set(rawComisiones.map(c => c.ejecutivo_id).filter(Boolean))] as string[];

      const [leadsRes, hogaresRes, profilesRes] = await Promise.all([
        leadIds.length  ? supabase.from('leads').select('id, nombre_adulto_mayor, nombre_contacto').in('id', leadIds) : { data: [] },
        hogarIds.length ? supabase.from('hogares').select('id, nombre').in('id', hogarIds) : { data: [] },
        execIds.length  ? supabase.from('profiles').select('id, nombre_completo').in('id', execIds) : { data: [] },
      ]);

      const leadsMap:   Record<string, { nombre_adulto_mayor: string; nombre_contacto: string }> = {};
      const hogaresMap: Record<string, string> = {};
      const profilesMap: Record<string, string> = {};

      (leadsRes.data || []).forEach((l: { id: string; nombre_adulto_mayor: string; nombre_contacto: string }) => { leadsMap[l.id] = l; });
      (hogaresRes.data || []).forEach((h: { id: string; nombre: string }) => { hogaresMap[h.id] = h.nombre; });
      (profilesRes.data || []).forEach((p: { id: string; nombre_completo: string }) => { profilesMap[p.id] = p.nombre_completo; });

      const enriched: ComisionRow[] = rawComisiones.map(c => ({
        ...c,
        lead_nombre:      c.lead_id    ? leadsMap[c.lead_id]?.nombre_adulto_mayor  : undefined,
        lead_contacto:    c.lead_id    ? leadsMap[c.lead_id]?.nombre_contacto      : undefined,
        hogar_nombre:     c.hogar_id   ? hogaresMap[c.hogar_id]                    : undefined,
        ejecutivo_nombre: c.ejecutivo_id ? profilesMap[c.ejecutivo_id]             : undefined,
        adelantos:        (c.adelantos_comision ?? []) as AdelantoRow[],
      }));

      setComisiones(enriched);
    } catch (err) {
      console.error('Error loading comisiones:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateEstado = async (id: string, estado: string) => {
    await supabase.from('comisiones').update({
      estado_cobro: estado,
      updated_at: new Date().toISOString(),
      ...(estado === 'cobrado' ? { fecha_cobro: new Date().toISOString() } : {}),
    }).eq('id', id);
    loadData();
  };

  // ── Filtered list ──
  const filtered = useMemo(() => {
    return comisiones.filter(c => {
      if (filterEstado && c.estado_cobro !== filterEstado) return false;
      if (filterEjecutivo && c.ejecutivo_id !== filterEjecutivo) return false;
      return true;
    });
  }, [comisiones, filterEstado, filterEjecutivo]);

  // ── Stats ──
  const stats = useMemo(() => {
    const all = comisiones;
    const myComisiones = isAdmin ? all : all.filter(c => c.ejecutivo_id === profile?.id);

    const totalCount       = myComisiones.length;
    const totalVD          = myComisiones.reduce((s, c) => s + c.valor_vinculo_dorado, 0);
    const totalEjecutivo   = myComisiones.reduce((s, c) => s + c.valor_ejecutivo, 0);
    const totalCobrado     = myComisiones.filter(c => c.estado_cobro === 'cobrado').reduce((s, c) => s + (isAdmin ? c.valor_vinculo_dorado : c.valor_ejecutivo), 0);
    const totalPendiente   = myComisiones.filter(c => c.estado_cobro !== 'cobrado').reduce((s, c) => s + (isAdmin ? c.valor_vinculo_dorado : c.valor_ejecutivo), 0);
    const totalAdelantos   = myComisiones.flatMap(c => c.adelantos).reduce((s, a) => s + a.monto, 0);
    const saldo            = totalEjecutivo - totalCobrado - totalAdelantos;

    return { totalCount, totalVD, totalEjecutivo, totalCobrado, totalPendiente, totalAdelantos, saldo };
  }, [comisiones, isAdmin, profile]);

  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sage-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-sage-900">Comisiones</h1>
        <p className="text-sage-500 mt-1 text-sm">
          {isAdmin ? 'Gestión de comisiones y adelantos del equipo' : 'Tus comisiones generadas y saldos'}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isAdmin ? (
          <>
            <StatCard icon={TrendingUp}   label="Comisiones generadas" value={String(stats.totalCount)}  sub="cierres totales"                      color="bg-sage-600" />
            <StatCard icon={DollarSign}   label="Total VD (70%)"       value={fmt(stats.totalVD)}        sub="ingresos Vínculo Dorado"               color="bg-green-600" />
            <StatCard icon={CheckCircle2} label="Cobrado"              value={fmt(stats.totalCobrado)}   sub="comisiones VD cobradas"                color="bg-teal-600" />
            <StatCard icon={Clock}        label="Pendiente cobro"      value={fmt(stats.totalPendiente)} sub="comisiones VD por cobrar"              color="bg-amber-500" />
          </>
        ) : (
          <>
            <StatCard icon={TrendingUp}   label="Mis comisiones"       value={String(stats.totalCount)}  sub="leads cerrados"                        color="bg-sage-600" />
            <StatCard icon={DollarSign}   label="Total ganado"         value={fmt(stats.totalEjecutivo)} sub="mi parte (30%)"                        color="bg-blue-600" />
            <StatCard icon={Coins}        label="Adelantos recibidos"  value={fmt(stats.totalAdelantos)} sub="adelantos acumulados"                  color="bg-purple-500" />
            <StatCard icon={CheckCircle2} label="Saldo pendiente"      value={fmt(Math.max(0, stats.saldo))} sub="por cobrar"                        color="bg-green-600" />
          </>
        )}
      </div>

      {/* Filters (admin only) */}
      {isAdmin && (
        <div className="flex flex-wrap gap-3">
          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="px-3 py-2 border border-cream-300 rounded-xl text-sm bg-white text-sage-700 focus:ring-2 focus:ring-sage-400 focus:border-transparent"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="parcial">Parcial</option>
            <option value="cobrado">Cobrado</option>
          </select>
          <select
            value={filterEjecutivo}
            onChange={e => setFilterEjecutivo(e.target.value)}
            className="px-3 py-2 border border-cream-300 rounded-xl text-sm bg-white text-sage-700 focus:ring-2 focus:ring-sage-400 focus:border-transparent"
          >
            <option value="">Todos los ejecutivos</option>
            {ejecutivos.map(e => (
              <option key={e.id} value={e.id}>{e.nombre_completo}</option>
            ))}
          </select>
          {(filterEstado || filterEjecutivo) && (
            <button
              onClick={() => { setFilterEstado(''); setFilterEjecutivo(''); }}
              className="px-3 py-2 text-sm text-sage-600 hover:text-sage-900 flex items-center gap-1 transition"
            >
              <X className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* Commissions list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-sage-800">
            {filtered.length} comisión{filtered.length !== 1 ? 'es' : ''}
            {(filterEstado || filterEjecutivo) ? ' (filtradas)' : ''}
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-sage-50 flex items-center justify-center mx-auto mb-3">
              <DollarSign className="w-7 h-7 text-sage-300" />
            </div>
            <p className="text-sage-600 font-medium">No hay comisiones registradas</p>
            <p className="text-sage-400 text-sm mt-1">
              {isAdmin ? 'Se generan automáticamente al cerrar un lead.' : 'Las comisiones aparecen cuando cierras un lead.'}
            </p>
          </div>
        ) : (
          filtered.map(c => (
            <ComisionCard
              key={c.id}
              c={c}
              isAdmin={isAdmin}
              onOpenAdelanto={setAdelantoTarget}
              onUpdateEstado={updateEstado}
            />
          ))
        )}
      </div>

      {/* Projection section — ejecutivo only */}
      {!isAdmin && pendingLeads.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-sage-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            Proyección — leads en proceso
          </h2>
          <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
            <div className="divide-y divide-cream-100">
              {pendingLeads.map(lead => {
                const estimado = lead.presupuesto_mensual
                  ? lead.presupuesto_mensual * 0.40 * 0.30
                  : null;
                return (
                  <div key={lead.id} className="flex items-center justify-between px-5 py-3 hover:bg-cream-50 transition">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-sage-900 truncate">{lead.nombre_adulto_mayor}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200 mt-1">
                        {STAGE_LABELS[lead.estado] ?? lead.estado}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-xs text-sage-400">Comisión estimada</p>
                      <p className="text-sm font-semibold text-blue-700">{estimado ? fmt(estimado) : '—'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 bg-cream-50 border-t border-cream-200">
              <p className="text-xs text-sage-400">
                Estimado = presupuesto × 40% × 30% · sujeto al % negociado con el hogar
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hogar % history (admin only — full history view) */}
      {isAdmin && (
        <HogarPctHistory />
      )}

      {/* Adelanto modal */}
      {adelantoTarget && user && (
        <AdelantoModal
          comision={adelantoTarget}
          onClose={() => setAdelantoTarget(null)}
          onSaved={loadData}
          userId={user.id}
        />
      )}
    </div>
  );
}

// ─── Hogar % History Section (admin) ─────────────────────────────────────────

function HogarPctHistory() {
  const [historial, setHistorial] = useState<Array<{
    id: string;
    hogar_id: string;
    porcentaje_anterior: number | null;
    porcentaje_nuevo: number;
    fecha_cambio: string;
    motivo: string | null;
    cambiado_por: string | null;
    hogar_nombre?: string;
    cambiado_por_nombre?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && historial.length === 0) loadHistorial();
  }, [open]);

  const loadHistorial = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('historial_porcentaje_hogar')
      .select('*')
      .order('fecha_cambio', { ascending: false })
      .limit(50);

    if (!data) { setLoading(false); return; }

    const hogarIds  = [...new Set(data.map(h => h.hogar_id))];
    const userIds   = [...new Set(data.map(h => h.cambiado_por).filter(Boolean))] as string[];

    const [hRes, uRes] = await Promise.all([
      supabase.from('hogares').select('id, nombre').in('id', hogarIds),
      userIds.length ? supabase.from('profiles').select('id, nombre_completo').in('id', userIds) : { data: [] },
    ]);

    const hogarMap: Record<string, string> = {};
    const userMap:  Record<string, string> = {};
    (hRes.data || []).forEach((h: { id: string; nombre: string }) => { hogarMap[h.id] = h.nombre; });
    (uRes.data || []).forEach((u: { id: string; nombre_completo: string }) => { userMap[u.id] = u.nombre_completo; });

    setHistorial(data.map(h => ({
      ...h,
      hogar_nombre:        hogarMap[h.hogar_id],
      cambiado_por_nombre: h.cambiado_por ? userMap[h.cambiado_por] : undefined,
    })));
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream-50 transition"
      >
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-sage-500" />
          <span className="text-sm font-semibold text-sage-800">Historial de % por hogar</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-sage-400" /> : <ChevronDown className="w-4 h-4 text-sage-400" />}
      </button>

      {open && (
        <div className="border-t border-cream-200">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-sage-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : historial.length === 0 ? (
            <p className="text-sage-400 text-sm text-center py-8">Sin cambios de porcentaje registrados.</p>
          ) : (
            <div className="divide-y divide-cream-100">
              {historial.map(h => (
                <div key={h.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sage-800 truncate">{h.hogar_nombre ?? 'Hogar eliminado'}</p>
                    {h.motivo && <p className="text-xs text-sage-400 truncate">{h.motivo}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs line-through">
                      {h.porcentaje_anterior ?? '—'}%
                    </span>
                    <span className="text-sage-400">→</span>
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-semibold">
                      {h.porcentaje_nuevo}%
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-xs text-sage-400">{fmtDate(h.fecha_cambio)}</p>
                    {h.cambiado_por_nombre && <p className="text-xs text-sage-500">{h.cambiado_por_nombre}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
