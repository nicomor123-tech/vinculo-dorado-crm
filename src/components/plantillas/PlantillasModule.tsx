import { useEffect, useState } from 'react';
import {
  FileText, Plus, Pencil, Trash2, Save, X, Loader2, MessageSquareText, Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// CRUD simple de plantillas de mensaje para propuestas (solo admins).
// Placeholders soportados: {{nombre}} (contacto), {{ejecutivo}}, {{link}}.

export interface Plantilla {
  id: string;
  nombre: string;
  contenido: string;
  activa: boolean;
  created_at: string;
}

const PLACEHOLDERS = [
  { tag: '{{nombre}}', desc: 'Nombre del contacto del lead' },
  { tag: '{{ejecutivo}}', desc: 'Nombre de quien envía' },
  { tag: '{{link}}', desc: 'Link de la propuesta' },
];

export function PlantillasModule() {
  const { isAdmin } = useAuth();
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<string | 'nueva' | null>(null);
  const [form, setForm] = useState({ nombre: '', contenido: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('plantillas_propuesta')
      .select('*')
      .order('created_at', { ascending: true });
    if (err) {
      setError('No se pudieron cargar las plantillas. ¿Ya se corrió el SQL de la Fase 3?');
    } else {
      setPlantillas((data as Plantilla[]) ?? []);
      setError('');
    }
    setLoading(false);
  };

  const empezarEdicion = (p?: Plantilla) => {
    if (p) {
      setEditando(p.id);
      setForm({ nombre: p.nombre, contenido: p.contenido });
    } else {
      setEditando('nueva');
      setForm({ nombre: '', contenido: '' });
    }
    setError('');
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.contenido.trim()) {
      setError('Nombre y contenido son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      if (editando === 'nueva') {
        const { error: err } = await supabase
          .from('plantillas_propuesta')
          .insert({ nombre: form.nombre.trim(), contenido: form.contenido.trim(), activa: true });
        if (err) throw err;
      } else if (editando) {
        const { error: err } = await supabase
          .from('plantillas_propuesta')
          .update({ nombre: form.nombre.trim(), contenido: form.contenido.trim(), updated_at: new Date().toISOString() })
          .eq('id', editando);
        if (err) throw err;
      }
      setEditando(null);
      await cargar();
    } catch (e) {
      console.error('Error guardando plantilla:', e);
      setError('No se pudo guardar (¿tienes rol de administrador?).');
    } finally {
      setGuardando(false);
    }
  };

  const toggleActiva = async (p: Plantilla) => {
    await supabase
      .from('plantillas_propuesta')
      .update({ activa: !p.activa, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    cargar();
  };

  const eliminar = async (p: Plantilla) => {
    if (!window.confirm(`¿Eliminar la plantilla "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error: err } = await supabase.from('plantillas_propuesta').delete().eq('id', p.id);
    if (err) {
      setError('No se pudo eliminar la plantilla.');
      return;
    }
    cargar();
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-16">
        <FileText className="w-10 h-10 text-sage-300 mx-auto mb-3" />
        <p className="text-sage-500">Solo los administradores gestionan las plantillas.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-sage-900">Plantillas de propuesta</h1>
          <p className="text-sage-500 mt-1 text-xs sm:text-sm">
            Mensajes que se envían por WhatsApp junto al link de la propuesta de hogares.
          </p>
        </div>
        <button onClick={() => empezarEdicion()} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nueva plantilla
        </button>
      </div>

      <div className="flex items-start gap-2 px-4 py-3 bg-teal-50 border border-teal-100 rounded-xl text-xs text-teal-800">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Variables disponibles:{' '}
          {PLACEHOLDERS.map((p) => (
            <code key={p.tag} className="bg-white border border-teal-200 rounded px-1 py-0.5 mx-0.5" title={p.desc}>{p.tag}</code>
          ))}
          — se reemplazan automáticamente al enviar.
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-sage-300" /></div>
      ) : (
        <div className="space-y-3">
          {editando === 'nueva' && (
            <EditorPlantilla form={form} setForm={setForm} onSave={guardar} onCancel={() => setEditando(null)} saving={guardando} titulo="Nueva plantilla" />
          )}

          {plantillas.length === 0 && editando !== 'nueva' && (
            <div className="text-center py-12 card">
              <MessageSquareText className="w-8 h-8 text-sage-300 mx-auto mb-2" />
              <p className="text-sm text-sage-500">No hay plantillas. Crea la primera o corre el SQL con las semillas.</p>
            </div>
          )}

          {plantillas.map((p) =>
            editando === p.id ? (
              <EditorPlantilla key={p.id} form={form} setForm={setForm} onSave={guardar} onCancel={() => setEditando(null)} saving={guardando} titulo={`Editando: ${p.nombre}`} />
            ) : (
              <div key={p.id} className={`card p-4 ${!p.activa ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquareText className="w-4 h-4 text-gold-500 flex-shrink-0" />
                  <h3 className="font-semibold text-sage-900 text-sm flex-1">{p.nombre}</h3>
                  <button
                    onClick={() => toggleActiva(p)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-full border transition ${
                      p.activa
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {p.activa ? 'ACTIVA' : 'INACTIVA'}
                  </button>
                  <button onClick={() => empezarEdicion(p)} className="p-1.5 text-sage-400 hover:text-sage-700 hover:bg-cream-100 rounded-lg transition">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => eliminar(p)} className="p-1.5 text-sage-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-sage-600 leading-relaxed whitespace-pre-line bg-cream-50 border border-cream-200 rounded-lg p-3">
                  {p.contenido}
                </p>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function EditorPlantilla({
  form, setForm, onSave, onCancel, saving, titulo,
}: {
  form: { nombre: string; contenido: string };
  setForm: (f: { nombre: string; contenido: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  titulo: string;
}) {
  return (
    <div className="card p-4 border-2 border-gold-300 space-y-3">
      <p className="text-xs font-bold text-gold-700 uppercase tracking-wide">{titulo}</p>
      <input
        type="text"
        value={form.nombre}
        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        placeholder="Nombre de la plantilla (ej: Presentación cálida)"
        className="input-field"
      />
      <textarea
        value={form.contenido}
        onChange={(e) => setForm({ ...form, contenido: e.target.value })}
        placeholder={'Hola {{nombre}}, soy {{ejecutivo}} de Vínculo Dorado…\n\n{{link}}'}
        rows={7}
        className="input-field resize-none font-mono text-xs leading-relaxed"
      />
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving} className="btn-gold flex items-center gap-2 text-sm disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </button>
        <button onClick={onCancel} className="btn-secondary flex items-center gap-2 text-sm">
          <X className="w-4 h-4" /> Cancelar
        </button>
      </div>
    </div>
  );
}
