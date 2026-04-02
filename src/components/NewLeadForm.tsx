import { useState } from 'react';
import {
  X, Save, Sparkles, CheckCircle2, ClipboardList,
  MapPin, Phone, User, Heart, Home, Calendar, Banknote, Search, Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { HogaresRecomendados } from './HogaresRecomendados';

interface NewLeadFormProps {
  onClose: () => void;
  onSuccess: () => void;
  onViewHogar?: (id: string) => void;
}

const PRESUPUESTO_OPCIONES = [
  { label: 'Menor a 2 millones', valor: 1500000 },
  { label: 'Entre 2 y 4 millones', valor: 3000000 },
  { label: 'Entre 4 y 6 millones', valor: 5000000 },
  { label: 'Entre 6 y 8 millones', valor: 7000000 },
  { label: 'Más de 8 millones', valor: 9000000 },
];

const FECHA_OPCIONES = ['Inmediato', 'Semana siguiente', 'En este mes', 'Más de un mes'];

const ZONAS_BOGOTA = [
  'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito',
  'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos',
  'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda',
  'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz',
];

const initialForm = {
  ciudad_opcion: '',
  ciudad_otra: '',
  zona_localidad: '',
  nombre_contacto: '',
  parentesco: '',
  telefono_principal: '',
  telefono_alterno: '',
  whatsapp: '',
  nombre_adulto_mayor: '',
  edad: '',
  sexo: '',
  deterioro_cognitivo: false,
  diagnosticos: '',
  requiere_primer_piso: false,
  requiere_oxigeno: false,
  ayuda_para_comer: false,
  ayuda_para_bano: false,
  ayuda_para_caminar: false,
  dieta_diabetica: false,
  dieta_blanda: false,
  tipo_habitacion: '',
  tipo_bano: '',
  fecha_ingreso_estimada: '',
  presupuesto_rango: '',
  resumen_caso: '',
  como_nos_conocio: '',
  correo: '',
  urgencia: 'media',
  movilidad: '',
  observaciones: '',
  requiere_enfermeria: false,
  requiere_acompanamiento: false,
};

type FormData = typeof initialForm;

interface SectionHeaderProps {
  icon: React.ElementType;
  number: number;
  label: string;
  subtitle?: string;
}

function SectionHeader({ icon: Icon, number, label, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">{label}</h3>
        </div>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 h-px bg-gray-200 self-center ml-2 mt-1" />
    </div>
  );
}

function CheckCard({
  name, label, checked, onChange,
}: {
  name: string; label: string; checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition select-none ${
        checked
          ? 'border-blue-500 bg-blue-50 text-blue-800'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-sm font-medium leading-tight">{label}</span>
    </label>
  );
}

function YesNoCard({
  name, label, value, onChange,
}: {
  name: string; label: string; value: boolean;
  onChange: (name: string, val: boolean) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex gap-2">
        {[{ val: true, txt: 'Sí' }, { val: false, txt: 'No' }].map(({ val, txt }) => (
          <button
            key={txt}
            type="button"
            onClick={() => onChange(name, val)}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
              value === val
                ? val
                  ? 'border-amber-500 bg-amber-50 text-amber-800'
                  : 'border-gray-400 bg-gray-100 text-gray-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            {txt}
          </button>
        ))}
      </div>
    </div>
  );
}

function buildSummary(f: FormData): string {
  const nombre = f.nombre_adulto_mayor || 'el adulto mayor';
  const edad = f.edad ? ` de ${f.edad} años` : '';
  const ciudad = f.ciudad_opcion === 'Otra' ? (f.ciudad_otra || 'otra ciudad') : f.ciudad_opcion || 'ciudad no especificada';
  const zona = f.zona_localidad ? `, zona ${f.zona_localidad}` : '';
  const presupuesto = f.presupuesto_rango || 'no especificado';
  const fecha = f.fecha_ingreso_estimada || 'por definir';

  const asistencias: string[] = [];
  if (f.ayuda_para_comer) asistencias.push('comer');
  if (f.ayuda_para_bano) asistencias.push('el baño');
  if (f.ayuda_para_caminar) asistencias.push('caminar');

  const clinico: string[] = [];
  if (f.deterioro_cognitivo) clinico.push('deterioro cognitivo');
  if (f.requiere_oxigeno) clinico.push('oxígeno dependiente');
  if (f.dieta_diabetica) clinico.push('dieta diabética');
  if (f.dieta_blanda) clinico.push('dieta blanda');
  if (f.requiere_primer_piso) clinico.push('requiere primer piso');
  if (f.diagnosticos) clinico.push(f.diagnosticos);

  let habitacion = f.tipo_habitacion || 'no especificada';
  if (f.tipo_habitacion === 'Independiente' && f.tipo_bano) {
    habitacion += ` con ${f.tipo_bano.toLowerCase()}`;
  }

  let text = `El caso corresponde a ${nombre}${edad}, ubicado en ${ciudad}${zona}.`;
  text += ` Busca una habitación ${habitacion}.`;
  text += ` El presupuesto mensual disponible es ${presupuesto}.`;
  if (asistencias.length > 0) {
    text += ` Necesita asistencia para ${asistencias.join(', ')}.`;
  } else {
    text += ` No requiere asistencia funcional especial.`;
  }
  if (clinico.length > 0) {
    text += ` Aspectos clínicos a tener en cuenta: ${clinico.join(', ')}.`;
  }
  text += ` El ingreso es ${fecha.toLowerCase()}.`;

  return text;
}

export function NewLeadForm({ onClose, onSuccess, onViewHogar }: NewLeadFormProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<FormData>(initialForm);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleBoolChange = (name: string, val: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const toggleSource = (op: string) => {
    setFormData(prev => {
      const current = prev.como_nos_conocio
        ? prev.como_nos_conocio.split(', ').filter(Boolean)
        : [];
      const idx = current.indexOf(op);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(op);
      return { ...prev, como_nos_conocio: current.join(', ') };
    });
  };

  const getCiudad = () => {
    if (formData.ciudad_opcion === 'Otra') return formData.ciudad_otra.trim() || 'Otra';
    return formData.ciudad_opcion;
  };

  const getPresupuestoValor = () => {
    const match = PRESUPUESTO_OPCIONES.find((o) => o.label === formData.presupuesto_rango);
    return match ? match.valor : null;
  };

  const isValidUUID = (id: string | undefined) =>
    !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre_contacto.trim()) {
      setError('El nombre del contacto es requerido.');
      return;
    }
    if (!formData.telefono_principal.trim()) {
      setError('El teléfono principal es requerido.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const asesorId = isValidUUID(profile?.id) ? profile!.id : null;

      // Auto-assign first active ejecutivo_comercial
      let ejecutivoId: string | null = null;
      const { data: primerEjecutivo } = await supabase
        .from('profiles')
        .select('id')
        .eq('rol', 'ejecutivo_comercial')
        .eq('activo', true)
        .order('nombre_completo')
        .limit(1)
        .maybeSingle();
      if (primerEjecutivo?.id) ejecutivoId = primerEjecutivo.id;

      const { error: insertError } = await supabase.from('leads').insert([{
        nombre_adulto_mayor: formData.nombre_adulto_mayor || null,
        edad: formData.edad ? parseInt(formData.edad) : null,
        sexo: formData.sexo || null,
        nombre_contacto: formData.nombre_contacto,
        parentesco: formData.parentesco || null,
        telefono_principal: formData.telefono_principal,
        telefono_alterno: formData.telefono_alterno || null,
        whatsapp: formData.whatsapp || null,
        correo: formData.correo || null,
        ciudad: getCiudad() || null,
        zona_localidad: formData.zona_localidad || null,
        presupuesto_rango: formData.presupuesto_rango || null,
        presupuesto_mensual: getPresupuestoValor(),
        urgencia: formData.urgencia,
        tipo_habitacion: formData.tipo_habitacion || null,
        tipo_bano: formData.tipo_bano || null,
        fecha_ingreso_estimada: formData.fecha_ingreso_estimada || null,
        deterioro_cognitivo: formData.deterioro_cognitivo,
        requiere_oxigeno: formData.requiere_oxigeno,
        requiere_primer_piso: formData.requiere_primer_piso,
        ayuda_para_comer: formData.ayuda_para_comer,
        ayuda_para_bano: formData.ayuda_para_bano,
        ayuda_para_caminar: formData.ayuda_para_caminar,
        dieta_diabetica: formData.dieta_diabetica,
        dieta_blanda: formData.dieta_blanda,
        movilidad: formData.movilidad || null,
        diagnosticos: formData.diagnosticos || null,
        observaciones: formData.observaciones || null,
        como_nos_conocio: formData.como_nos_conocio || null,
        resumen_caso: formData.resumen_caso || null,
        requiere_enfermeria: formData.requiere_enfermeria,
        requiere_acompanamiento: formData.requiere_acompanamiento,
        estado: 'lead_nuevo',
        asesor_id: asesorId,
        ejecutivo_id: ejecutivoId,
      }]);
      if (insertError) throw insertError;
      setSavedSummary(buildSummary(formData));
    } catch (err: unknown) {
      console.error('Error creating lead:', err);
      const pgErr = err as { message?: string; details?: string; hint?: string; code?: string };
      const msg = pgErr?.message || (err instanceof Error ? err.message : '');
      const detail = pgErr?.details ? ` (${pgErr.details})` : '';
      setError(msg ? `Error: ${msg}${detail}` : 'Error al crear el lead. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (savedSummary !== null) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-0 sm:p-4">
        <div className="bg-white sm:rounded-xl shadow-2xl w-full sm:max-w-2xl sm:my-8">
          <div className="px-6 pt-6 pb-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Lead guardado exitosamente</h2>
              <p className="text-sm text-gray-500">Resumen del caso para confirmar con el familiar</p>
            </div>
          </div>

          <div className="mx-6 my-4 bg-blue-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Resumen del caso</p>
            </div>
            <p className="text-gray-800 leading-relaxed text-sm">{savedSummary}</p>
          </div>

          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-3 text-sm mb-5">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Adulto mayor</p>
                <p className="font-medium text-gray-900">
                  {formData.nombre_adulto_mayor || 'No especificado'}
                  {formData.edad ? `, ${formData.edad} años` : ''}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Contacto</p>
                <p className="font-medium text-gray-900">{formData.nombre_contacto}</p>
                <p className="text-gray-500 text-xs">{formData.telefono_principal}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Ubicación</p>
                <p className="font-medium text-gray-900">
                  {formData.ciudad_opcion === 'Otra' ? formData.ciudad_otra : formData.ciudad_opcion || '—'}
                  {formData.zona_localidad ? ` · ${formData.zona_localidad}` : ''}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Presupuesto</p>
                <p className="font-medium text-gray-900">{formData.presupuesto_rango || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Habitación</p>
                <p className="font-medium text-gray-900">
                  {formData.tipo_habitacion || '—'}
                  {formData.tipo_habitacion === 'Independiente' && formData.tipo_bano ? ` · ${formData.tipo_bano}` : ''}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Ingreso estimado</p>
                <p className="font-medium text-gray-900">{formData.fecha_ingreso_estimada || '—'}</p>
              </div>
            </div>
            <button
              onClick={onSuccess}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm"
            >
              Ir a la lista de leads
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-0 sm:p-4">
      <div className="bg-white sm:rounded-xl shadow-2xl w-full sm:max-w-3xl sm:my-4 min-h-full sm:min-h-0 sm:max-h-[calc(100vh-2rem)] flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 sm:rounded-t-xl bg-white flex-shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Nuevo Lead</h2>
            <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">Sigue el guión de ventas para capturar la información</p>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-gray-100 rounded-xl transition active:scale-95">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 sm:py-6 space-y-7 sm:space-y-8 flex-1 overflow-y-auto">

          {/* SECCIÓN 1 – DATOS DEL CONTACTO */}
          <section>
            <SectionHeader
              icon={Phone}
              number={1}
              label="Datos del contacto"
              subtitle="¿Quién nos está contactando?"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del contacto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nombre_contacto"
                  value={formData.nombre_contacto}
                  onChange={handleChange}
                  required
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Nombre completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parentesco</label>
                <select
                  name="parentesco"
                  value={formData.parentesco}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Seleccionar</option>
                  <option value="Hijo/a">Hijo/a</option>
                  <option value="Nieto/a">Nieto/a</option>
                  <option value="Sobrino/a">Sobrino/a</option>
                  <option value="Hermano/a">Hermano/a</option>
                  <option value="Cónyuge">Cónyuge</option>
                  <option value="Otro familiar">Otro familiar</option>
                  <option value="Amigo/a">Amigo/a</option>
                  <option value="Cuidador/a">Cuidador/a</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono principal <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="telefono_principal"
                  value={formData.telefono_principal}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Ej: 3001234567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Si es diferente al principal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono alterno</label>
                <input
                  type="tel"
                  name="telefono_alterno"
                  value={formData.telefono_alterno}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </section>

          {/* SECCIÓN 2 – CONTEXTO DE LA BÚSQUEDA */}
          <section>
            <SectionHeader
              icon={MapPin}
              number={2}
              label="Contexto de la búsqueda"
              subtitle="¿Dónde están buscando?"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                <select
                  name="ciudad_opcion"
                  value={formData.ciudad_opcion}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Seleccionar</option>
                  <option value="Bogotá">Bogotá</option>
                  <option value="Otra">Otra ciudad</option>
                </select>
              </div>

              {formData.ciudad_opcion === 'Otra' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">¿Cuál ciudad?</label>
                  <input
                    type="text"
                    name="ciudad_otra"
                    value={formData.ciudad_otra}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Ej: Medellín"
                  />
                </div>
              )}

              <div className={formData.ciudad_opcion === 'Otra' ? '' : 'md:col-span-1'}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona o localidad preferida</label>
                <input
                  type="text"
                  name="zona_localidad"
                  value={formData.zona_localidad}
                  onChange={handleChange}
                  list="zonas-list"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Ej: Chapinero, Suba, Usaquén..."
                />
                <datalist id="zonas-list">
                  {ZONAS_BOGOTA.map((z) => <option key={z} value={z} />)}
                </datalist>
              </div>
            </div>
          </section>

          {/* SECCIÓN 3 – INFORMACIÓN DEL ADULTO MAYOR */}
          <section>
            <SectionHeader
              icon={User}
              number={3}
              label="Información del adulto mayor"
              subtitle="Cuéntame un poco sobre él o ella"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del adulto mayor
                  <span className="ml-2 text-xs text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  name="nombre_adulto_mayor"
                  value={formData.nombre_adulto_mayor}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Nombre completo (si lo saben)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Edad aproximada</label>
                <input
                  type="number"
                  name="edad"
                  value={formData.edad}
                  onChange={handleChange}
                  min={50}
                  max={115}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Ej: 82"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                <select
                  name="sexo"
                  value={formData.sexo}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Seleccionar</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                </select>
              </div>
            </div>
          </section>

          {/* SECCIÓN 4 – SITUACIÓN MÉDICA GENERAL */}
          <section>
            <SectionHeader
              icon={Heart}
              number={4}
              label="Situación médica general"
              subtitle="Información rápida para entender el caso"
            />
            <div className="space-y-4">
              <YesNoCard
                name="deterioro_cognitivo"
                label="¿Presenta deterioro cognitivo (Alzheimer, demencia u otros)?"
                value={formData.deterioro_cognitivo}
                onChange={handleBoolChange}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Otros diagnósticos relevantes</label>
                <input
                  type="text"
                  name="diagnosticos"
                  value={formData.diagnosticos}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Ej: Parkinson, insuficiencia renal, ACV previo..."
                />
              </div>
            </div>
          </section>

          {/* SECCIÓN 5 – NIVEL DE ASISTENCIA */}
          <section>
            <SectionHeader
              icon={Stethoscope}
              number={5}
              label="Nivel de asistencia"
              subtitle="Marca lo que aplica"
            />
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Infraestructura</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <CheckCard name="requiere_primer_piso" label="Requiere primer piso" checked={formData.requiere_primer_piso} onChange={handleChange} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Soporte clínico</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <CheckCard name="requiere_oxigeno" label="Oxígeno dependiente" checked={formData.requiere_oxigeno} onChange={handleChange} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Asistencia funcional</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <CheckCard name="ayuda_para_comer" label="Necesita ayuda para comer" checked={formData.ayuda_para_comer} onChange={handleChange} />
                  <CheckCard name="ayuda_para_bano" label="Necesita ayuda para baño" checked={formData.ayuda_para_bano} onChange={handleChange} />
                  <CheckCard name="ayuda_para_caminar" label="Necesita ayuda para caminar" checked={formData.ayuda_para_caminar} onChange={handleChange} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dieta</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <CheckCard name="dieta_diabetica" label="Dieta diabética" checked={formData.dieta_diabetica} onChange={handleChange} />
                  <CheckCard name="dieta_blanda" label="Dieta blanda" checked={formData.dieta_blanda} onChange={handleChange} />
                </div>
              </div>
            </div>
          </section>

          {/* SECCIÓN 6 – PREFERENCIAS DEL HOGAR */}
          <section>
            <SectionHeader
              icon={Home}
              number={6}
              label="Preferencias del hogar"
              subtitle="¿Qué tipo de espacio prefieren?"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de habitación preferida</label>
                <select
                  name="tipo_habitacion"
                  value={formData.tipo_habitacion}
                  onChange={(e) => {
                    handleChange(e);
                    if (e.target.value !== 'Independiente') {
                      setFormData((prev) => ({ ...prev, tipo_bano: '' }));
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Seleccionar</option>
                  <option value="Compartida">Compartida</option>
                  <option value="Independiente">Independiente</option>
                  <option value="Suite">Suite</option>
                </select>
              </div>

              {formData.tipo_habitacion === 'Independiente' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de baño</label>
                  <select
                    name="tipo_bano"
                    value={formData.tipo_bano}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">Seleccionar</option>
                    <option value="Baño privado">Baño privado</option>
                    <option value="Baño compartido">Baño compartido</option>
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* SECCIÓN 7 – TIEMPO DE INGRESO */}
          <section>
            <SectionHeader
              icon={Calendar}
              number={7}
              label="Tiempo de ingreso"
              subtitle="¿Para cuándo necesitan el cupo?"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FECHA_OPCIONES.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, fecha_ingreso_estimada: op }))}
                  className={`py-3 px-3 rounded-lg border text-sm font-medium transition text-center leading-tight ${
                    formData.fecha_ingreso_estimada === op
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </section>

          {/* SECCIÓN 8 – PRESUPUESTO MENSUAL */}
          <section>
            <SectionHeader
              icon={Banknote}
              number={8}
              label="Presupuesto mensual"
              subtitle="¿Con qué rango cuentan para el hogar?"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {PRESUPUESTO_OPCIONES.map((op) => (
                <button
                  key={op.label}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, presupuesto_rango: op.label }))}
                  className={`py-3 px-4 rounded-lg border text-sm font-medium transition text-left ${
                    formData.presupuesto_rango === op.label
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </section>

          {/* SECCIÓN 9 – INFORMACIÓN COMPLEMENTARIA */}
          <section>
            <SectionHeader
              icon={ClipboardList}
              number={9}
              label="Información complementaria"
              subtitle="Contexto adicional del caso"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resumen del caso
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-blue-500 font-normal">
                  <Sparkles className="w-3 h-3" />
                  Autorrelleno inteligente — v2
                </span>
              </label>
              <textarea
                name="resumen_caso"
                value={formData.resumen_caso}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                placeholder="Pega aquí el texto del WhatsApp, correo del familiar, nota de consulta..."
              />
            </div>
          </section>

          <HogaresRecomendados
            criteria={{
              ciudad: formData.ciudad_opcion === 'Otra' ? formData.ciudad_otra : formData.ciudad_opcion,
              zona_localidad: formData.zona_localidad,
              presupuesto_rango: formData.presupuesto_rango,
              requiere_oxigeno: formData.requiere_oxigeno,
              requiere_primer_piso: formData.requiere_primer_piso,
              tipo_habitacion: formData.tipo_habitacion,
              ayuda_para_caminar: formData.ayuda_para_caminar,
              ayuda_para_bano: formData.ayuda_para_bano,
              ayuda_para_comer: formData.ayuda_para_comer,
              fecha_ingreso_estimada: formData.fecha_ingreso_estimada,
            }}
            onViewDetail={(id) => {
              if (onViewHogar) onViewHogar(id);
            }}
          />

          {/* SECCIÓN 10 – ¿CÓMO NOS CONOCIÓ? (opcional) */}
          <section>
            <SectionHeader
              icon={Search}
              number={10}
              label="¿Cómo nos conoció?"
              subtitle="Canal de origen del lead (opcional)"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {['Redes sociales', 'Google', 'Recomendación', 'Publicidad', 'Otro'].map((op) => {
                const selected = formData.como_nos_conocio.split(', ').filter(Boolean).includes(op);
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => toggleSource(op)}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition text-center flex items-center justify-center gap-1.5 ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {selected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                    {op}
                  </button>
                );
              })}
            </div>
          </section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

        </form>

        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-t border-gray-200 bg-white sm:rounded-b-xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-5 py-3.5 sm:py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition text-sm font-medium active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={(e) => {
              const form = (e.target as HTMLElement).closest('.flex.flex-col')?.querySelector('form');
              if (form) form.requestSubmit();
            }}
            disabled={loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 sm:py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold shadow-sm active:scale-95"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stethoscope(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}
