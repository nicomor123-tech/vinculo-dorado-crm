import { useState } from 'react';
import { X, Save, Building2, MapPin, Phone, DollarSign, CheckCircle2, AlertCircle, Percent } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface NewHogarFormProps {
  onClose: () => void;
  onSuccess: (id?: string) => void;
}

const LOCALIDADES = [
  'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito',
  'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos',
  'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda',
  'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar',
];

const SERVICE_CHECKBOXES = [
  { key: 'serv_enfermeria_24h',        label: 'Enfermería 24h',       color: 'teal' },
  { key: 'serv_fisioterapia',          label: 'Fisioterapia',         color: 'teal' },
  { key: 'maneja_oxigeno',             label: 'Maneja oxígeno',       color: 'teal' },
  { key: 'serv_medicina_general',      label: 'Medicina general',     color: 'teal' },
  { key: 'serv_terapia_ocupacional',   label: 'Terapia ocupacional',  color: 'teal' },
  { key: 'serv_actividades_recreativas', label: 'Act. recreativas',   color: 'teal' },
  { key: 'dieta_diabetica',            label: 'Dieta diabética',      color: 'teal' },
  { key: 'dieta_blanda',               label: 'Dieta blanda',         color: 'teal' },
] as const;

type ServiceKey = typeof SERVICE_CHECKBOXES[number]['key'];

const initialForm = {
  nombre: '',
  ciudad: 'Bogotá',
  localidad: '',
  barrio: '',
  direccion: '',
  telefono: '',
  whatsapp: '',
  precio_desde: '',
  precio_hasta: '',
  cupo_disponible: '',
  porcentaje_comision: '40',
};

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-gray-100 mb-4">
      <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-teal-600" />
      </div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</h3>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-gray-900 placeholder-gray-400 bg-white";

export function NewHogarForm({ onClose, onSuccess }: NewHogarFormProps) {
  const { profile } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [services, setServices] = useState<Partial<Record<ServiceKey, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const toggleService = (key: ServiceKey) => {
    setServices(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre del hogar es requerido.'); return; }
    setSaving(true);
    setError('');

    try {
      const { data, error: insertError } = await supabase.from('hogares').insert({
        nombre: form.nombre.trim(),
        ciudad: form.ciudad || 'Bogotá',
        localidad: form.localidad || null,
        barrio: form.barrio || null,
        direccion: form.direccion || null,
        telefono: form.telefono || null,
        whatsapp: form.whatsapp || null,
        precio_desde: form.precio_desde ? Number(form.precio_desde) : null,
        precio_hasta: form.precio_hasta ? Number(form.precio_hasta) : null,
        habitaciones_disponibles: form.cupo_disponible ? Number(form.cupo_disponible) : null,
        porcentaje_comision: form.porcentaje_comision ? Number(form.porcentaje_comision) : 40,
        serv_enfermeria_24h: !!services['serv_enfermeria_24h'],
        serv_fisioterapia: !!services['serv_fisioterapia'],
        maneja_oxigeno: !!services['maneja_oxigeno'],
        serv_medicina_general: !!services['serv_medicina_general'],
        serv_terapia_ocupacional: !!services['serv_terapia_ocupacional'],
        serv_actividades_recreativas: !!services['serv_actividades_recreativas'],
        dieta_diabetica: !!services['dieta_diabetica'],
        dieta_blanda: !!services['dieta_blanda'],
        estado: 'pendiente',
        registrado_por: profile?.id ?? null,
      }).select('id').single();

      if (insertError) throw insertError;
      onSuccess(data?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el hogar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto flex flex-col sm:items-start sm:justify-center sm:p-4">
      <div className="bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl sm:my-8 flex-1 sm:flex-none flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 sticky top-0 bg-white sm:rounded-t-2xl z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}>
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Nuevo Hogar</h2>
              <p className="text-xs text-gray-400 hidden sm:block">Registra una residencia geriátrica</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-gray-100 rounded-xl transition active:scale-95">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 sm:py-6 space-y-7 flex-1 overflow-y-auto">

          {/* Identificación */}
          <section>
            <SectionHeader icon={Building2} label="Identificación" />
            <Field label="Nombre del hogar" required>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                autoFocus
                required
                placeholder="Ej: Hogar Santa Lucía"
                className={inputCls}
              />
            </Field>
          </section>

          {/* Ubicación */}
          <section>
            <SectionHeader icon={MapPin} label="Ubicación" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ciudad">
                <select name="ciudad" value={form.ciudad} onChange={handleChange} className={inputCls}>
                  <option>Bogotá</option>
                  <option>Medellín</option>
                  <option>Cali</option>
                  <option>Barranquilla</option>
                  <option>Otra</option>
                </select>
              </Field>
              <Field label="Localidad">
                <select name="localidad" value={form.localidad} onChange={handleChange} className={inputCls}>
                  <option value="">Seleccionar</option>
                  {LOCALIDADES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Barrio">
                <input type="text" name="barrio" value={form.barrio} onChange={handleChange}
                  placeholder="Ej: Chapinero Alto" className={inputCls} />
              </Field>
              <Field label="Dirección">
                <input type="text" name="direccion" value={form.direccion} onChange={handleChange}
                  placeholder="Cra. 7 # 45-12" className={inputCls} />
              </Field>
            </div>
          </section>

          {/* Contacto */}
          <section>
            <SectionHeader icon={Phone} label="Contacto" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Teléfono">
                <input type="tel" name="telefono" value={form.telefono} onChange={handleChange}
                  placeholder="Ej: 6012345678" className={inputCls} />
              </Field>
              <Field label="WhatsApp">
                <input type="tel" name="whatsapp" value={form.whatsapp} onChange={handleChange}
                  placeholder="Ej: 3001234567" className={inputCls} />
              </Field>
            </div>
          </section>

          {/* Precios */}
          <section>
            <SectionHeader icon={DollarSign} label="Precios y capacidad" />
            <div className="grid grid-cols-3 gap-4">
              <Field label="Precio desde">
                <input type="number" name="precio_desde" value={form.precio_desde} onChange={handleChange}
                  placeholder="2000000" min={0} className={inputCls} />
              </Field>
              <Field label="Precio hasta">
                <input type="number" name="precio_hasta" value={form.precio_hasta} onChange={handleChange}
                  placeholder="4000000" min={0} className={inputCls} />
              </Field>
              <Field label="Cupos disp.">
                <input type="number" name="cupo_disponible" value={form.cupo_disponible} onChange={handleChange}
                  placeholder="0" min={0} className={inputCls} />
              </Field>
            </div>
          </section>

          {/* Comisión */}
          <section>
            <SectionHeader icon={Percent} label="Comisión Vínculo Dorado" />
            <div className="flex items-start gap-4">
              <div className="w-48">
                <Field label="% que cobra VD al hogar">
                  <div className="relative">
                    <input
                      type="number"
                      name="porcentaje_comision"
                      value={form.porcentaje_comision}
                      onChange={handleChange}
                      min={0}
                      max={100}
                      className={inputCls}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">%</span>
                  </div>
                </Field>
              </div>
              <div className="flex-1 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 mt-6 text-xs text-teal-700 space-y-1">
                <p className="font-semibold">Distribución de la comisión:</p>
                {form.porcentaje_comision && (
                  <>
                    <p>Ejecutivo recibe: <strong>30%</strong> del {form.porcentaje_comision}%</p>
                    <p>Vínculo Dorado: <strong>70%</strong> del {form.porcentaje_comision}%</p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Servicios */}
          <section>
            <SectionHeader icon={CheckCircle2} label="Servicios y capacidades" />
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_CHECKBOXES.map(({ key, label }) => {
                const active = !!services[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleService(key)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-sm font-medium transition active:scale-[0.97] text-left ${
                      active
                        ? 'border-teal-500 bg-teal-50 text-teal-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition ${
                      active ? 'bg-teal-600 border-teal-600' : 'border-gray-300'
                    }`}>
                      {active && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-200 sticky bottom-0 bg-white sm:static sm:bg-transparent pb-safe">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-3.5 sm:py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium active:scale-95 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 sm:py-2.5 text-white rounded-xl disabled:opacity-50 text-sm font-semibold shadow-sm active:scale-95 transition"
              style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar hogar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
