import { useEffect, useState } from 'react';
import {
  ArrowLeft, MapPin, Phone, Mail, Globe, BedDouble, Heart, Utensils,
  Building2, CheckCircle2, XCircle, BadgeCheck, Clock, MessageCircle, Pencil, History,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Hogar = Database['public']['Tables']['hogares']['Row'];

interface HogarDetailProps {
  hogarId: string;
  onBack: () => void;
}

interface EditRecord {
  campo: string;
  valorAnterior: string;
  valorNuevo: string;
  fecha: string;
}

function formatPrecio(v: number | null) {
  if (!v) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-blue-600" />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{label}</h3>
      <div className="flex-1 h-px bg-gray-200 ml-1" />
    </div>
  );
}

function InlineField({
  value,
  onSave,
  type = 'text',
  className = 'text-sm font-medium text-gray-900',
  multiline = false,
  placeholder = '—',
}: {
  value: string | number | null | undefined;
  onSave: (val: string) => Promise<void>;
  type?: string;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const start = () => {
    setDraft(value != null ? String(value) : '');
    setEditing(true);
  };
  const save = async () => {
    if (draft === String(value ?? '')) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); setEditing(false); }
  };
  const kd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); save(); }
    if (e.key === 'Escape') setEditing(false);
  };

  if (editing) {
    const base = `border border-blue-400 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none ${className} bg-white`;
    return multiline
      ? <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={save} onKeyDown={kd} className={`${base} resize-none w-full`} rows={3} />
      : <input autoFocus type={type} value={draft} onChange={e => setDraft(e.target.value)} onBlur={save} onKeyDown={kd} className={`${base} w-full`} />;
  }

  return (
    <button type="button" onClick={start} disabled={saving} className="group inline-flex items-center gap-1.5 text-left max-w-full">
      <span className={className}>
        {saving
          ? <span className="text-blue-500 animate-pulse text-xs">...</span>
          : (value != null && value !== '' ? String(value) : <span className="text-gray-400 italic text-sm">{placeholder}</span>)
        }
      </span>
      {!saving && <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />}
    </button>
  );
}

function BooleanTag({ active, label, onToggle }: { active: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? 'Clic para desactivar' : 'Clic para activar'}
      className={`inline-flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm font-medium transition-all active:scale-95 ${
        active
          ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
          : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 hover:text-gray-600'
      }`}
    >
      {active ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

export function HogarDetail({ hogarId, onBack }: HogarDetailProps) {
  const [hogar, setHogar] = useState<Hogar | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingEstado, setUpdatingEstado] = useState(false);
  const [editHistory, setEditHistory] = useState<EditRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { loadHogar(); }, [hogarId]);

  const loadHogar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hogares')
        .select('*')
        .eq('id', hogarId)
        .maybeSingle();
      if (error) throw error;
      setHogar(data);
    } catch (e) {
      console.error('Error loading hogar:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveField = async (campo: string, valor: string | number | boolean | null) => {
    if (!hogar) return;
    const valorAnterior = (hogar as Record<string, unknown>)[campo];
    const { error } = await supabase
      .from('hogares')
      .update({ [campo]: valor, updated_at: new Date().toISOString() })
      .eq('id', hogar.id);
    if (error) { console.error('Error saving field:', error); return; }
    setHogar(prev => prev ? { ...prev, [campo]: valor } as Hogar : null);
    setEditHistory(prev => [{
      campo,
      valorAnterior: String(valorAnterior ?? ''),
      valorNuevo: String(valor ?? ''),
      fecha: new Date().toISOString(),
    }, ...prev]);
  };

  const updateEstado = async (nuevoEstado: string) => {
    if (!hogar) return;
    setUpdatingEstado(true);
    try {
      const { error } = await supabase
        .from('hogares')
        .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
        .eq('id', hogar.id);
      if (error) throw error;
      setHogar({ ...hogar, estado: nuevoEstado });
    } catch (e) {
      console.error('Error updating estado:', e);
    } finally {
      setUpdatingEstado(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hogar) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500">No se encontró el hogar.</p>
        <button onClick={onBack} className="mt-4 text-blue-600 hover:underline text-sm">Volver</button>
      </div>
    );
  }

  const estadoConfig: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    aprobado: { label: 'Activo',      cls: 'border-green-500 bg-green-50 text-green-800', icon: BadgeCheck },
    pendiente: { label: 'En revisión', cls: 'border-amber-400 bg-amber-50 text-amber-800',  icon: Clock },
    rechazado: { label: 'Inactivo',   cls: 'border-red-400 bg-red-50 text-red-700',         icon: XCircle },
  };
  const estadoCfg = estadoConfig[hogar.estado] ?? estadoConfig['pendiente'];
  const EstadoIcon = estadoCfg.icon;

  const servicios = [
    { key: 'serv_enfermeria_24h',        label: 'Enfermería 24h' },
    { key: 'serv_fisioterapia',          label: 'Fisioterapia' },
    { key: 'serv_terapia_ocupacional',   label: 'Terapia ocupacional' },
    { key: 'serv_psicologia',            label: 'Psicología' },
    { key: 'serv_nutricion',             label: 'Nutrición' },
    { key: 'serv_actividades_recreativas', label: 'Act. recreativas' },
    { key: 'serv_medicina_general',      label: 'Medicina general' },
  ] as const;

  const dietas = [
    { key: 'dieta_blanda',     label: 'Dieta blanda' },
    { key: 'dieta_diabetica',  label: 'Dieta diabética' },
  ] as const;

  const habitaciones = [
    { key: 'hab_compartida',              label: 'Habitación compartida' },
    { key: 'hab_privada_bano_privado',    label: 'Privada con baño privado' },
    { key: 'hab_privada_bano_compartido', label: 'Privada con baño compartido' },
  ] as const;

  const infraestructura = [
    { key: 'tiene_ascensor',    label: 'Tiene ascensor' },
    { key: 'un_solo_nivel',     label: 'Un solo nivel' },
    { key: 'maneja_oxigeno',    label: 'Oxígeno domiciliario' },
    { key: 'maneja_demencia',   label: 'Maneja demencia' },
    { key: 'maneja_silla_ruedas', label: 'Silla de ruedas' },
  ] as const;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">Hogares · <span className="italic text-gray-300">clic en cualquier campo para editar</span></p>
          <InlineField
            value={hogar.nombre}
            onSave={v => saveField('nombre', v)}
            className="text-xl font-bold text-gray-900"
          />
        </div>
        {editHistory.length > 0 && (
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition flex-shrink-0"
          >
            <History className="w-3.5 h-3.5" />
            {editHistory.length} cambio{editHistory.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Main info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-start gap-1.5 text-gray-500 text-sm">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                {[hogar.direccion, hogar.localidad, hogar.ciudad].filter(Boolean).join(', ') || 'Dirección no especificada'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Dirección</p>
                <InlineField value={hogar.direccion} onSave={v => saveField('direccion', v || null)} className="text-sm text-gray-800" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Ciudad</p>
                <InlineField value={hogar.ciudad} onSave={v => saveField('ciudad', v || null)} className="text-sm text-gray-800" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Localidad / Zona</p>
                <InlineField value={hogar.localidad} onSave={v => saveField('localidad', v || null)} className="text-sm text-gray-800" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${estadoCfg.cls}`}>
              <EstadoIcon className="w-4 h-4" />
              {estadoCfg.label}
            </span>
            {hogar.estado !== 'aprobado' && (
              <button onClick={() => updateEstado('aprobado')} disabled={updatingEstado}
                className="px-3 py-1.5 text-xs font-medium text-green-700 border border-green-300 bg-green-50 rounded-lg hover:bg-green-100 transition disabled:opacity-50">
                Marcar activo
              </button>
            )}
            {hogar.estado !== 'rechazado' && (
              <button onClick={() => updateEstado('rechazado')} disabled={updatingEstado}
                className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-300 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-50">
                Marcar inactivo
              </button>
            )}
            {hogar.estado !== 'pendiente' && (
              <button onClick={() => updateEstado('pendiente')} disabled={updatingEstado}
                className="px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 bg-amber-50 rounded-lg hover:bg-amber-100 transition disabled:opacity-50">
                En revisión
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 mb-1">Descripción</p>
          <InlineField
            value={hogar.descripcion}
            onSave={v => saveField('descripcion', v || null)}
            multiline
            className="text-gray-600 text-sm leading-relaxed"
            placeholder="Sin descripción · clic para agregar"
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Precio desde</p>
          <InlineField
            value={hogar.precio_desde}
            onSave={v => saveField('precio_desde', v ? Number(v) : null)}
            type="number"
            className="text-xl font-bold text-gray-900"
          />
          {(hogar.precio_hasta && hogar.precio_hasta !== hogar.precio_desde) && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <span>hasta</span>
              <InlineField
                value={hogar.precio_hasta}
                onSave={v => saveField('precio_hasta', v ? Number(v) : null)}
                type="number"
                className="text-sm text-gray-600"
              />
            </div>
          )}
          <p className="text-xs text-gray-400">COP / mes · {formatPrecio(hogar.precio_desde)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Capacidad total</p>
          <InlineField
            value={hogar.capacidad_total}
            onSave={v => saveField('capacidad_total', v ? Number(v) : null)}
            type="number"
            className="text-xl font-bold text-gray-900"
            placeholder="—"
          />
          <p className="text-sm text-gray-500">residentes en total</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Disponibilidad</p>
          <InlineField
            value={hogar.habitaciones_disponibles}
            onSave={v => saveField('habitaciones_disponibles', v ? Number(v) : null)}
            type="number"
            className="text-xl font-bold text-gray-900"
            placeholder="—"
          />
          <p className="text-sm text-gray-500">habitaciones disponibles</p>
        </div>
      </div>

      {/* Contacto + Habitaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <SectionTitle icon={Phone} label="Contacto" />
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <InlineField value={hogar.telefono} onSave={v => saveField('telefono', v || null)} type="tel" className="text-sm text-blue-600" placeholder="Sin teléfono" />
            </div>
            <div className="flex items-center gap-3">
              <MessageCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <InlineField value={hogar.whatsapp} onSave={v => saveField('whatsapp', v || null)} type="tel" className="text-sm text-blue-600" placeholder="Sin WhatsApp" />
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <InlineField value={hogar.correo} onSave={v => saveField('correo', v || null)} type="email" className="text-sm text-blue-600" placeholder="Sin correo" />
            </div>
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <InlineField value={hogar.pagina_web} onSave={v => saveField('pagina_web', v || null)} type="url" className="text-sm text-blue-600 truncate" placeholder="Sin página web" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <SectionTitle icon={BedDouble} label="Tipos de habitación" />
          <div className="flex flex-wrap gap-2">
            {habitaciones.map(({ key, label }) => (
              <BooleanTag
                key={key}
                active={!!hogar[key]}
                label={label}
                onToggle={() => saveField(key, !hogar[key])}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Servicios */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <SectionTitle icon={Heart} label="Servicios" />
        <div className="flex flex-wrap gap-2">
          {servicios.map(({ key, label }) => (
            <BooleanTag
              key={key}
              active={!!hogar[key]}
              label={label}
              onToggle={() => saveField(key, !hogar[key])}
            />
          ))}
        </div>
      </div>

      {/* Dietas + Infraestructura */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <SectionTitle icon={Utensils} label="Dietas especiales" />
          <div className="flex flex-wrap gap-2">
            {dietas.map(({ key, label }) => (
              <BooleanTag
                key={key}
                active={!!hogar[key]}
                label={label}
                onToggle={() => saveField(key, !hogar[key])}
              />
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <SectionTitle icon={Building2} label="Infraestructura y soporte clínico" />
          <div className="flex flex-wrap gap-2">
            {infraestructura.map(({ key, label }) => (
              <BooleanTag
                key={key}
                active={!!hogar[key]}
                label={label}
                onToggle={() => saveField(key, !hogar[key])}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Edit history */}
      {showHistory && editHistory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            Historial de ediciones (sesión actual)
          </h3>
          <div className="space-y-1.5">
            {editHistory.map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0">
                <span className="font-medium text-gray-700 w-28 flex-shrink-0 truncate">{h.campo}</span>
                <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded line-through max-w-[110px] truncate">{h.valorAnterior || '—'}</span>
                <span className="text-gray-400">→</span>
                <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded max-w-[110px] truncate">{h.valorNuevo || '—'}</span>
                <span className="text-gray-400 ml-auto flex-shrink-0">
                  {new Date(h.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs text-gray-400">
          Registrado el {new Date(hogar.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
          {hogar.updated_at && hogar.updated_at !== hogar.created_at
            ? ` · Actualizado el ${new Date(hogar.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}`
            : ''}
        </p>
      </div>
    </div>
  );
}
