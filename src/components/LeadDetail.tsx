import { useEffect, useState } from 'react';
import {
  ArrowLeft, User, Phone, Mail, MapPin, AlertCircle, Calendar, Clock,
  CircleUser as UserCircle, CheckCircle2, Home, Flame, Zap, AlertTriangle,
  Minus, ChevronDown, Pencil,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  getStageLabel,
  getStageAccentColor,
  getStageBorderColor,
  getStageStrongColor,
  getStageDotColor,
  getStageGroup,
} from '../lib/pipeline';
import { GestionPanel } from './lead/GestionPanel';
import { LeadNotes } from './lead/LeadNotes';
import { WhatsAppButton } from './lead/WhatsAppButton';
import { ProposalBuilder } from './lead/ProposalBuilder';
import { ActivityTimeline } from './lead/ActivityTimeline';
import { LeadTasks } from './lead/LeadTasks';
import type { Database } from '../lib/database.types';

type Lead = Database['public']['Tables']['leads']['Row'];
type Nota = Database['public']['Tables']['notas_seguimiento']['Row'];
type ActivityEvent = Database['public']['Tables']['activity_log']['Row'];
type Task = Database['public']['Tables']['lead_tasks']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface LeadDetailProps {
  leadId: string;
  onBack: () => void;
}

const URGENCIA_CONFIG: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  inmediato:        { label: 'Inmediato',     color: 'text-red-700 bg-red-50 border-red-300',          icon: Zap },
  urgente:          { label: 'Urgente',       color: 'text-red-700 bg-red-50 border-red-300',          icon: Zap },
  alta:             { label: 'Alta',          color: 'text-orange-700 bg-orange-50 border-orange-200', icon: AlertTriangle },
  semana_siguiente: { label: 'Esta semana',   color: 'text-orange-700 bg-orange-50 border-orange-200', icon: AlertTriangle },
  media:            { label: 'Media',         color: 'text-amber-700 bg-amber-50 border-amber-200',    icon: Clock },
  este_mes:         { label: 'Este mes',      color: 'text-amber-700 bg-amber-50 border-amber-200',    icon: Clock },
  baja:             { label: 'Baja',          color: 'text-gray-600 bg-gray-50 border-gray-200',       icon: Minus },
  mas_de_un_mes:    { label: 'Más de un mes', color: 'text-gray-600 bg-gray-50 border-gray-200',       icon: Minus },
};

const INGRESO_URGENCIA: Record<string, { color: string; label: string; highlight: boolean }> = {
  inmediato:        { color: 'text-red-700 bg-red-50 border-red-300',          label: 'Inmediato',    highlight: true },
  urgente:          { color: 'text-red-700 bg-red-50 border-red-300',          label: 'Urgente',      highlight: true },
  alta:             { color: 'text-orange-700 bg-orange-50 border-orange-200', label: 'Alta',         highlight: true },
  semana_siguiente: { color: 'text-orange-700 bg-orange-50 border-orange-200', label: 'Esta semana',  highlight: true },
  media:            { color: 'text-amber-700 bg-amber-50 border-amber-200',    label: 'Este mes',     highlight: false },
  este_mes:         { color: 'text-amber-700 bg-amber-50 border-amber-200',    label: 'Este mes',     highlight: false },
  baja:             { color: 'text-gray-700 bg-gray-50 border-gray-200',       label: 'Más de un mes',highlight: false },
  mas_de_un_mes:    { color: 'text-gray-700 bg-gray-50 border-gray-200',       label: 'Más de un mes',highlight: false },
};

function getUrgenciaConfig(urgencia: string) {
  const key = (urgencia ?? '').toLowerCase().replace(/ /g, '_');
  return URGENCIA_CONFIG[key] ?? { label: urgencia ?? 'N/A', color: 'text-gray-700 bg-gray-50 border-gray-200', icon: Minus };
}

function getContactabilityStatus(date: string | null): 'overdue' | 'today' | 'future' | null {
  if (!date) return null;
  const todayStr = new Date().toISOString().split('T')[0];
  if (date < todayStr) return 'overdue';
  if (date === todayStr) return 'today';
  return 'future';
}

function formatDate(dateString: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!dateString) return 'Fecha no disponible';
  const iso = dateString.includes('T') ? dateString : dateString + 'T00:00:00';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Fecha no disponible';
  return d.toLocaleDateString('es-CO', opts ?? {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatCurrency(value: number | null) {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
}

function getNextContactDate(tasks: Task[]): string | null {
  const pending = tasks
    .filter((t) => t.estado === 'pendiente' && t.fecha_vencimiento)
    .sort((a, b) => (a.fecha_vencimiento! > b.fecha_vencimiento! ? 1 : -1));
  return pending[0]?.fecha_vencimiento ?? null;
}

const CAMPO_LABELS: Record<string, string> = {
  diagnosticos: 'Diagnósticos',
  presupuesto_mensual: 'Presupuesto mensual',
  ciudad: 'Ciudad',
  zona_localidad: 'Zona / Localidad',
  tipo_habitacion: 'Tipo de habitación',
  edad: 'Edad',
  movilidad: 'Movilidad',
  deterioro_cognitivo: 'Deterioro cognitivo',
  requiere_oxigeno: 'Requiere oxígeno',
  requiere_enfermeria: 'Enfermería 24h',
  requiere_acompanamiento: 'Acompañamiento',
  ayuda_para_comer: 'Ayuda para comer',
  ayuda_para_bano: 'Ayuda para baño',
  ayuda_para_caminar: 'Ayuda para caminar',
  requiere_primer_piso: 'Primer piso',
  dieta_diabetica: 'Dieta diabética',
  dieta_blanda: 'Dieta blanda',
};

function InlineEditField({
  label,
  value,
  onSave,
  type = 'text',
  formatDisplay,
}: {
  label: string;
  value: string | number | null;
  onSave: (val: string) => Promise<void>;
  type?: 'text' | 'number' | 'textarea';
  formatDisplay?: (v: string | number | null) => string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const start = () => { setDraft(value != null ? String(value) : ''); setEditing(true); };
  const save = async () => {
    if (draft === String(value ?? '')) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); setEditing(false); }
  };
  const kd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); save(); }
    if (e.key === 'Escape') setEditing(false);
  };

  const display = formatDisplay ? formatDisplay(value) : (value != null ? String(value) : null);

  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      {editing ? (
        type === 'textarea'
          ? <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={save} onKeyDown={kd}
              className="mt-0.5 w-full text-sm border border-blue-400 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none font-medium resize-none" rows={3} />
          : <input autoFocus type={type} value={draft} onChange={e => setDraft(e.target.value)} onBlur={save} onKeyDown={kd}
              className="mt-0.5 w-full text-sm border border-blue-400 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
      ) : (
        <button onClick={start} disabled={saving} className="group flex items-center gap-1.5 w-full text-left mt-0.5">
          <span className="font-medium text-gray-900 text-sm">
            {saving
              ? <span className="text-blue-500 animate-pulse text-xs">Guardando...</span>
              : (display || <span className="text-gray-400">N/A</span>)
            }
          </span>
          {!saving && <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition" />}
        </button>
      )}
    </div>
  );
}

export function LeadDetail({ leadId, onBack }: LeadDetailProps) {
  const { user, isAdmin } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ejecutivos, setEjecutivos] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningEjecutivo, setAssigningEjecutivo] = useState(false);
  const [ejecutivoNombre, setEjecutivoNombre] = useState<string | null>(null);
  const [showEjecutivoDropdown, setShowEjecutivoDropdown] = useState(false);

  const saveLeadField = async (campo: string, valor: string | number | boolean | null) => {
    if (!lead || !user) return;
    const valorAnterior = (lead as Record<string, unknown>)[campo];
    await supabase.from('leads').update({ [campo]: valor, updated_at: new Date().toISOString() }).eq('id', lead.id);
    await supabase.from('activity_log').insert({
      lead_id: lead.id,
      user_id: user.id,
      tipo: 'campo_editado',
      descripcion: `Campo "${CAMPO_LABELS[campo] || campo}" actualizado`,
      metadata: { campo, valor_anterior: valorAnterior, valor_nuevo: valor },
    });
    setLead(prev => prev ? { ...prev, [campo]: valor } as Lead : null);
    const { data } = await supabase.from('activity_log').select('*').eq('lead_id', lead.id).order('created_at', { ascending: true });
    if (data) setActivityLog(data);
  };

  useEffect(() => {
    loadLeadData();
    if (isAdmin) loadEjecutivos();
  }, [leadId]);

  const loadLeadData = async () => {
    try {
      const [leadData, notasData, activityData, tasksData] = await Promise.all([
        supabase.from('leads').select('*').eq('id', leadId).maybeSingle(),
        supabase.from('notas_seguimiento').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
        supabase.from('activity_log').select('*').eq('lead_id', leadId).order('created_at', { ascending: true }),
        supabase.from('lead_tasks').select('*').eq('lead_id', leadId).order('created_at', { ascending: true }),
      ]);

      if (leadData.data) {
        setLead(leadData.data);
        if (leadData.data.ejecutivo_id) {
          loadEjecutivoNombre(leadData.data.ejecutivo_id);
        } else {
          setEjecutivoNombre(null);
        }
      }
      if (notasData.data) setNotas(notasData.data);
      if (activityData.data) setActivityLog(activityData.data);
      if (tasksData.data) setTasks(tasksData.data);
    } catch (error) {
      console.error('Error loading lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEjecutivos = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('activo', true)
      .eq('rol', 'ejecutivo_comercial')
      .order('nombre_completo');
    setEjecutivos(data || []);
  };

  const loadEjecutivoNombre = async (id: string) => {
    const { data } = await supabase.from('profiles').select('nombre_completo').eq('id', id).maybeSingle();
    setEjecutivoNombre(data?.nombre_completo ?? null);
  };

  const handleAssignEjecutivo = async (ejecutivoId: string) => {
    if (!lead || !user) return;
    setAssigningEjecutivo(true);
    setShowEjecutivoDropdown(false);
    try {
      await supabase
        .from('leads')
        .update({ ejecutivo_id: ejecutivoId || null, updated_at: new Date().toISOString() })
        .eq('id', leadId);

      const ejec = ejecutivos.find((e) => e.id === ejecutivoId);
      await supabase.from('activity_log').insert({
        lead_id: leadId,
        user_id: user.id,
        tipo: 'ejecutivo_asignado',
        descripcion: ejec
          ? `Ejecutivo asignado: ${ejec.nombre_completo}`
          : 'Ejecutivo desasignado',
        metadata: { ejecutivo_id: ejecutivoId },
      });

      loadLeadData();
    } catch (err) {
      console.error('Error assigning ejecutivo:', err);
    } finally {
      setAssigningEjecutivo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando detalle del lead...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Lead no encontrado</p>
        <button onClick={onBack} className="mt-4 text-blue-600 hover:text-blue-700">
          Volver
        </button>
      </div>
    );
  }

  const stageStrong = getStageStrongColor(lead.estado);
  const stageAccent = getStageAccentColor(lead.estado);
  const stageBorder = getStageBorderColor(lead.estado);
  const stageDot = getStageDotColor(lead.estado);
  const stageGroup = getStageGroup(lead.estado);
  const urgenciaCfg = getUrgenciaConfig(lead.urgencia ?? '');
  const UrgIcon = urgenciaCfg.icon;
  const nextContact = getNextContactDate(tasks);
  const contactStatus = getContactabilityStatus(nextContact);

  const contactDateColor =
    contactStatus === 'overdue'
      ? 'text-red-700 bg-red-50 border-red-200'
      : contactStatus === 'today'
      ? 'text-orange-700 bg-orange-50 border-orange-200'
      : 'text-blue-700 bg-blue-50 border-blue-100';

  const ingresoFecha = lead.fecha_ingreso_estimada || lead.fecha_probable_ingreso;
  const ingresoUrgCfg = INGRESO_URGENCIA[lead.urgencia ?? ''] ?? { color: 'text-gray-600 bg-gray-50 border-gray-200', label: '', highlight: false };

  const lightDot = stageDot.replace('-400', '-200').replace('-500', '-200').replace('-600', '-200');

  void stageGroup;

  return (
    <div className="space-y-0 -mx-0">
      <div className={`h-1.5 w-full ${stageAccent} rounded-sm mb-5`} />

      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition mt-0.5 flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{lead.nombre_adulto_mayor}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${stageStrong.bg} ${stageStrong.text} ${stageStrong.border}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 opacity-70 ${lightDot}`} />
                {getStageLabel(lead.estado)}
              </span>
              {lead.etiqueta_caliente === 'interesado_activo' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                  <Flame className="w-3 h-3" />
                  Interesado activo
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {lead.nombre_contacto}
              {lead.parentesco ? ` · ${lead.parentesco}` : ''}
              {' · '}Registrado {formatDate(lead.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className={`rounded-xl border px-4 py-3 ${urgenciaCfg.color}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Urgencia</p>
            <div className="flex items-center gap-2">
              <UrgIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-sm font-bold leading-tight">{urgenciaCfg.label}</span>
            </div>
          </div>

          <div className={`rounded-xl border px-4 py-3 ${nextContact ? contactDateColor : 'text-gray-500 bg-gray-50 border-gray-200'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Próxima contactabilidad</p>
            {nextContact ? (
              <div className="flex items-center gap-1.5">
                {contactStatus === 'overdue' && <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                {contactStatus === 'today' && <Clock className="w-3.5 h-3.5 flex-shrink-0" />}
                {contactStatus === 'future' && <Calendar className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="text-sm font-bold leading-tight">
                  {contactStatus === 'overdue' ? 'Vencido · ' : ''}
                  {contactStatus === 'today' ? 'Hoy · ' : ''}
                  {formatDate(nextContact, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ) : (
              <span className="text-sm font-medium text-gray-400">Sin definir</span>
            )}
          </div>

          <div className={`rounded-xl border px-4 py-3 ${ingresoFecha ? ingresoUrgCfg.color : 'text-gray-500 bg-gray-50 border-gray-200'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Fecha probable de ingreso</p>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
              <span className="text-sm font-bold leading-tight">
                {ingresoFecha
                  ? formatDate(ingresoFecha, { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Sin definir'}
              </span>
            </div>
            {ingresoFecha && ingresoUrgCfg.label && (
              <p className="text-xs mt-1 opacity-75 font-semibold">{ingresoUrgCfg.label}</p>
            )}
          </div>

          <div className={`rounded-xl border px-4 py-3 col-span-2 relative ${stageStrong.bg} ${stageStrong.text} ${stageStrong.border}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Etapa · Ejecutivo asignado</p>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 opacity-70 ${lightDot}`} />
                <span className="text-sm font-bold leading-tight">{getStageLabel(lead.estado)}</span>
              </div>

              {isAdmin ? (
                <div className="relative">
                  <button
                    onClick={() => setShowEjecutivoDropdown(v => !v)}
                    disabled={assigningEjecutivo}
                    className="flex items-center gap-1 text-xs opacity-80 hover:opacity-100 transition px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 disabled:opacity-40"
                  >
                    <UserCircle className="w-3.5 h-3.5" />
                    <span className="font-medium max-w-[100px] truncate">
                      {assigningEjecutivo ? 'Asignando...' : (ejecutivoNombre ?? 'Sin asignar')}
                    </span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showEjecutivoDropdown && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 min-w-[200px] py-1">
                      <p className="text-xs font-semibold text-gray-500 px-3 py-2 border-b border-gray-100 uppercase tracking-wide">
                        Asignar ejecutivo
                      </p>
                      <button
                        onClick={() => handleAssignEjecutivo('')}
                        className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 transition italic"
                      >
                        — Sin asignar —
                      </button>
                      {ejecutivos.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => handleAssignEjecutivo(e.id)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition ${lead.ejecutivo_id === e.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-800'}`}
                        >
                          {e.nombre_completo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs opacity-80">
                  {ejecutivoNombre ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 opacity-70" />
                      <span className="font-medium max-w-[120px] truncate">{ejecutivoNombre}</span>
                    </>
                  ) : (
                    <span className="italic opacity-60">Sin asignar</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <GestionPanel
              leadId={leadId}
              estadoActual={lead.estado}
              onSaved={loadLeadData}
              leadData={{ ejecutivo_id: lead.ejecutivo_id, presupuesto_mensual: lead.presupuesto_mensual, urgencia: lead.urgencia }}
            />

            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${stageBorder} p-6`}>
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Datos del adulto mayor y contacto
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Nombre</p>
                  <p className="font-medium text-gray-900">{lead.nombre_adulto_mayor}</p>
                </div>
                <InlineEditField
                  label="Edad"
                  value={lead.edad}
                  type="number"
                  formatDisplay={(v) => v != null && v !== '' ? `${v} años` : null}
                  onSave={(val) => saveLeadField('edad', val ? parseInt(val) : null)}
                />
                <div>
                  <p className="text-xs text-gray-500">Sexo</p>
                  <p className="font-medium text-gray-900">{lead.sexo || 'N/A'}</p>
                </div>
                <InlineEditField
                  label="Movilidad"
                  value={lead.movilidad}
                  onSave={(val) => saveLeadField('movilidad', val || null)}
                />
                <div className="col-span-2 border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 mb-1">Contacto familiar</p>
                  <p className="font-medium text-gray-900">{lead.nombre_contacto} · {lead.parentesco || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Teléfono
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{lead.telefono_principal}</p>
                    <WhatsAppButton
                      phone={lead.whatsapp || lead.telefono_principal}
                      contactName={lead.nombre_contacto}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Correo
                  </p>
                  <p className="font-medium text-gray-900">{lead.correo || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Información médica y necesidades
              </h2>
              <div className="space-y-3 text-sm">
                <InlineEditField
                  label="Diagnósticos"
                  value={lead.diagnosticos}
                  type="textarea"
                  onSave={(val) => saveLeadField('diagnosticos', val || null)}
                />
                {lead.resumen_caso && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Resumen del caso</p>
                    <p className="text-gray-800 leading-relaxed text-xs">{lead.resumen_caso}</p>
                  </div>
                )}
                <p className="text-xs text-gray-400 pt-1">Clic para activar / desactivar</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Deterioro cognitivo', campo: 'deterioro_cognitivo', value: lead.deterioro_cognitivo },
                    { label: 'Requiere oxígeno',    campo: 'requiere_oxigeno',    value: lead.requiere_oxigeno },
                    { label: 'Enfermería 24h',       campo: 'requiere_enfermeria', value: lead.requiere_enfermeria },
                    { label: 'Acompañamiento',       campo: 'requiere_acompanamiento', value: lead.requiere_acompanamiento },
                    { label: 'Ayuda para comer',     campo: 'ayuda_para_comer',   value: lead.ayuda_para_comer },
                    { label: 'Ayuda para baño',      campo: 'ayuda_para_bano',    value: lead.ayuda_para_bano },
                    { label: 'Ayuda para caminar',   campo: 'ayuda_para_caminar', value: lead.ayuda_para_caminar },
                    { label: 'Primer piso',          campo: 'requiere_primer_piso', value: lead.requiere_primer_piso },
                    { label: 'Dieta diabética',      campo: 'dieta_diabetica',    value: lead.dieta_diabetica },
                    { label: 'Dieta blanda',         campo: 'dieta_blanda',       value: lead.dieta_blanda },
                  ].map(({ label, campo, value }) => (
                    <button
                      key={campo}
                      type="button"
                      onClick={() => saveLeadField(campo, !value)}
                      title="Clic para cambiar"
                      className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border transition-all active:scale-95 ${
                        value
                          ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
                          : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${value ? 'bg-red-500' : 'bg-gray-300'}`} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-500" />
                Ubicación y presupuesto
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <InlineEditField
                  label="Ciudad"
                  value={lead.ciudad}
                  onSave={(val) => saveLeadField('ciudad', val || null)}
                />
                <InlineEditField
                  label="Zona / Localidad"
                  value={lead.zona_localidad}
                  onSave={(val) => saveLeadField('zona_localidad', val || null)}
                />
                <InlineEditField
                  label="Presupuesto mensual"
                  value={lead.presupuesto_mensual}
                  type="number"
                  formatDisplay={(v) => v != null && v !== '' ? formatCurrency(Number(v)) : null}
                  onSave={(val) => saveLeadField('presupuesto_mensual', val ? parseInt(val) : null)}
                />
                <div>
                  <p className="text-xs text-gray-500">Rango de presupuesto</p>
                  <p className="font-medium text-gray-900">{lead.presupuesto_rango || 'N/A'}</p>
                </div>
                <InlineEditField
                  label="Tipo de habitación"
                  value={lead.tipo_habitacion}
                  onSave={(val) => saveLeadField('tipo_habitacion', val || null)}
                />
                <div>
                  <p className="text-xs text-gray-500">Tipo de baño</p>
                  <p className="font-medium text-gray-900">{lead.tipo_bano || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border-2 border-blue-100 overflow-hidden">
              <div className="flex items-center gap-2 px-6 py-4 bg-blue-50 border-b border-blue-100">
                <Home className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-900">Hogares sugeridos y propuesta</h2>
                <span className="ml-auto text-xs text-blue-600 font-semibold bg-white px-2.5 py-1 rounded-full border border-blue-200">
                  Selecciona y genera propuesta
                </span>
              </div>
              <div className="p-6">
                {user && (
                  <ProposalBuilder
                    leadId={leadId}
                    leadPhone={lead.whatsapp || lead.telefono_principal}
                    leadContactName={lead.nombre_contacto}
                    userId={user.id}
                    leadBudget={lead.presupuesto_mensual}
                    onProposalCreated={loadLeadData}
                  />
                )}
              </div>
            </div>

            <LeadNotes leadId={leadId} notas={notas} onNoteAdded={loadLeadData} />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Información adicional</p>
              <div className="space-y-2.5 text-sm">
                <div>
                  <p className="text-xs text-gray-500">¿Cómo nos conoció?</p>
                  <p className="font-medium text-gray-900">{lead.como_nos_conocio || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fecha de registro</p>
                  <p className="font-medium text-gray-900">{formatDate(lead.created_at)}</p>
                </div>
                {lead.observaciones && (
                  <div>
                    <p className="text-xs text-gray-500">Observaciones</p>
                    <p className="text-gray-900 text-xs leading-relaxed">{lead.observaciones}</p>
                  </div>
                )}
              </div>
            </div>

            <LeadTasks leadId={leadId} tasks={tasks} onTasksChanged={loadLeadData} />
            <ActivityTimeline events={activityLog} />
          </div>
        </div>
      </div>

      {showEjecutivoDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowEjecutivoDropdown(false)} />
      )}
    </div>
  );
}
