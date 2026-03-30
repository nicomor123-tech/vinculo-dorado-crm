import { useState, useEffect } from 'react';
import { ClipboardList, Save, Phone, Mail, MessageSquare, Eye, MoreHorizontal, ArrowRight, Calendar, CheckCircle2, Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PIPELINE_STAGES, getStageLabel, getStageStrongColor } from '../../lib/pipeline';
import { createStageTask } from '../../lib/stageTaskAutomation';

interface GestionPanelProps {
  leadId: string;
  estadoActual: string;
  onSaved: () => void;
  leadData?: {
    ejecutivo_id: string | null;
    presupuesto_mensual: number | null;
  };
}

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);
}

const TIPO_OPTIONS = [
  { value: 'llamada', label: 'Llamada', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'visita', label: 'Visita', icon: Eye },
  { value: 'otro', label: 'Otro', icon: MoreHorizontal },
];

export function GestionPanel({ leadId, estadoActual, onSaved, leadData }: GestionPanelProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    nuevaEtapa: estadoActual,
    tipoSeguimiento: 'llamada',
    nota: '',
    proximaFecha: '',
    proximaAccion: '',
  });

  // Commission form — shown when cierre_ganado is selected
  const [comisionForm, setComisionForm] = useState({
    valor_primer_mes: '',
    porcentaje_vinculo: '40',
    hogar_id: '',
  });
  const [hogaresList, setHogaresList] = useState<Array<{ id: string; nombre: string; porcentaje_comision: number | null }>>([]);

  const showComisionPanel = form.nuevaEtapa === 'cierre_ganado';

  useEffect(() => {
    if (showComisionPanel) {
      // Load hogares for dropdown
      supabase
        .from('hogares')
        .select('id, nombre, porcentaje_comision')
        .eq('estado', 'aprobado')
        .order('nombre')
        .then(({ data }) => { if (data) setHogaresList(data); });

      // Pre-populate with lead's budget
      if (leadData?.presupuesto_mensual && !comisionForm.valor_primer_mes) {
        setComisionForm(prev => ({ ...prev, valor_primer_mes: String(leadData.presupuesto_mensual) }));
      }
    }
  }, [showComisionPanel]);

  const handleHogarSelect = (hogarId: string) => {
    const hogar = hogaresList.find(h => h.id === hogarId);
    setComisionForm(prev => ({
      ...prev,
      hogar_id: hogarId,
      porcentaje_vinculo: hogar?.porcentaje_comision != null ? String(hogar.porcentaje_comision) : '40',
    }));
  };

  // Calculated commission amounts (live preview)
  const calcBase       = Number(comisionForm.valor_primer_mes) || 0;
  const calcPct        = Number(comisionForm.porcentaje_vinculo) || 40;
  const calcTotal      = calcBase * calcPct / 100;
  const calcEjecutivo  = calcTotal * 0.30;
  const calcVD         = calcTotal * 0.70;

  const etapaCambiada = form.nuevaEtapa !== estadoActual;

  const handleSave = async () => {
    if (!user) return;
    if (!form.nota.trim() && !etapaCambiada) return;

    setSaving(true);
    try {
      const ops: Promise<unknown>[] = [];

      if (etapaCambiada) {
        const oldLabel = getStageLabel(estadoActual);
        const newLabel = getStageLabel(form.nuevaEtapa);

        ops.push(
          supabase
            .from('leads')
            .update({ estado: form.nuevaEtapa, updated_at: new Date().toISOString() })
            .eq('id', leadId)
        );

        ops.push(
          supabase.from('activity_log').insert({
            lead_id: leadId,
            user_id: user.id,
            tipo: 'etapa_cambiada',
            descripcion: `Etapa cambiada: ${oldLabel} → ${newLabel}`,
            metadata: { old: estadoActual, new: form.nuevaEtapa },
          })
        );

        ops.push(createStageTask(leadId, user.id, form.nuevaEtapa));
      }

      if (form.nota.trim()) {
        ops.push(
          supabase.from('notas_seguimiento').insert({
            lead_id: leadId,
            asesor_id: user.id,
            tipo_seguimiento: form.tipoSeguimiento,
            descripcion: form.nota,
            proxima_accion: form.proximaAccion || null,
            fecha_proxima_accion: form.proximaFecha || null,
          })
        );

        ops.push(
          supabase.from('activity_log').insert({
            lead_id: leadId,
            user_id: user.id,
            tipo: 'nota_agregada',
            descripcion: `Nota de seguimiento agregada (${form.tipoSeguimiento})`,
          })
        );

        if (form.proximaFecha) {
          ops.push(
            supabase.from('lead_tasks').insert({
              lead_id: leadId,
              creado_por: user.id,
              titulo: form.proximaAccion
                ? form.proximaAccion
                : `Próximo contacto – ${form.tipoSeguimiento}`,
              descripcion: form.nota.slice(0, 160) || null,
              fecha_vencimiento: form.proximaFecha,
              estado: 'pendiente',
            })
          );
        }
      }

      // Auto-generate commission when closing as won
      if (form.nuevaEtapa === 'cierre_ganado' && calcBase > 0) {
        ops.push(
          supabase.from('comisiones').insert({
            lead_id: leadId,
            hogar_id: comisionForm.hogar_id || null,
            ejecutivo_id: leadData?.ejecutivo_id || null,
            valor_primer_mes: calcBase,
            porcentaje_vinculo: calcPct,
            valor_comision_total: calcTotal,
            valor_ejecutivo: calcEjecutivo,
            valor_vinculo_dorado: calcVD,
            estado_cobro: 'pendiente',
          })
        );
      }

      await Promise.all(ops);

      setForm({
        nuevaEtapa: form.nuevaEtapa,
        tipoSeguimiento: 'llamada',
        nota: '',
        proximaFecha: '',
        proximaAccion: '',
      });
      setComisionForm({ valor_primer_mes: '', porcentaje_vinculo: '40', hogar_id: '' });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (err) {
      console.error('Error saving gestión:', err);
    } finally {
      setSaving(false);
    }
  };

  const canSave = form.nota.trim().length > 0 || etapaCambiada;
  const newStageStrong = getStageStrongColor(form.nuevaEtapa);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50">
        <ClipboardList className="w-5 h-5 text-blue-600" />
        <h2 className="text-base font-semibold text-gray-900">Registrar gestión</h2>
        <span className="ml-auto text-xs text-gray-400">Todo en un solo paso</span>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Cambiar etapa del pipeline
            </label>
            <select
              value={form.nuevaEtapa}
              onChange={(e) => setForm({ ...form, nuevaEtapa: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {etapaCambiada && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full border ${newStageStrong.bg} ${newStageStrong.text} ${newStageStrong.border}`}>
                  {getStageLabel(form.nuevaEtapa)}
                </span>
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-blue-600 font-semibold">se guardará al registrar</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Tipo de contacto
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TIPO_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, tipoSeguimiento: value })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                    form.tipoSeguimiento === value
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Nota de gestión
          </label>
          <textarea
            value={form.nota}
            onChange={(e) => setForm({ ...form, nota: e.target.value })}
            placeholder="¿Qué se habló o acordó con la familia?..."
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Commission panel — shown when cierre_ganado selected */}
        {showComisionPanel && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-600" />
              <span className="text-xs font-semibold text-yellow-800 uppercase tracking-wide">🏆 Registrar comisión</span>
              <span className="ml-auto text-xs text-yellow-600">Opcional · editable después</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-yellow-800 mb-1">Valor 1er mes pactado</label>
                <input
                  type="number"
                  value={comisionForm.valor_primer_mes}
                  onChange={e => setComisionForm(prev => ({ ...prev, valor_primer_mes: e.target.value }))}
                  placeholder={leadData?.presupuesto_mensual ? String(leadData.presupuesto_mensual) : 'Ej: 3000000'}
                  min={0}
                  className="w-full px-3 py-2 border border-yellow-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-yellow-800 mb-1">% Vínculo Dorado</label>
                <input
                  type="number"
                  value={comisionForm.porcentaje_vinculo}
                  onChange={e => setComisionForm(prev => ({ ...prev, porcentaje_vinculo: e.target.value }))}
                  min={0}
                  max={100}
                  className="w-full px-3 py-2 border border-yellow-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-yellow-800 mb-1">Hogar seleccionado</label>
              <select
                value={comisionForm.hogar_id}
                onChange={e => handleHogarSelect(e.target.value)}
                className="w-full px-3 py-2 border border-yellow-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              >
                <option value="">Sin hogar asignado</option>
                {hogaresList.map(h => (
                  <option key={h.id} value={h.id}>{h.nombre}{h.porcentaje_comision != null ? ` (${h.porcentaje_comision}%)` : ''}</option>
                ))}
              </select>
            </div>

            {calcBase > 0 && (
              <div className="bg-white rounded-lg border border-yellow-200 p-3 grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <p className="text-gray-500">Comisión total ({calcPct}%)</p>
                  <p className="font-bold text-gray-900 mt-0.5">{formatCOP(calcTotal)}</p>
                </div>
                <div className="text-center border-l border-r border-yellow-100">
                  <p className="text-blue-600">Ejecutivo (30%)</p>
                  <p className="font-bold text-blue-800 mt-0.5">{formatCOP(calcEjecutivo)}</p>
                </div>
                <div className="text-center">
                  <p className="text-green-600">Vínculo Dorado (70%)</p>
                  <p className="font-bold text-green-800 mt-0.5">{formatCOP(calcVD)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Próxima contactabilidad</span>
            <span className="ml-auto text-xs text-blue-500">La tarea se creará automáticamente</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">
                Acción a realizar
              </label>
              <input
                type="text"
                value={form.proximaAccion}
                onChange={(e) => setForm({ ...form, proximaAccion: e.target.value })}
                placeholder="Ej: Llamar para confirmar visita"
                className="w-full px-3 py-2 border border-blue-200 bg-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">
                Fecha de próximo contacto
              </label>
              <input
                type="date"
                value={form.proximaFecha}
                onChange={(e) => setForm({ ...form, proximaFecha: e.target.value })}
                className="w-full px-3 py-2 border border-blue-200 bg-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Registrar gestión'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Gestión registrada
            </span>
          )}
          {!canSave && (
            <span className="text-xs text-gray-400">Escribe una nota o cambia la etapa para registrar</span>
          )}
        </div>
      </div>
    </div>
  );
}
