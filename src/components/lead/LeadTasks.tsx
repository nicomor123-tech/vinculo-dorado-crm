import { useState } from 'react';
import { CheckSquare, Plus, Check, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';

type Task = Database['public']['Tables']['lead_tasks']['Row'];

interface LeadTasksProps {
  leadId: string;
  tasks: Task[];
  onTasksChanged: () => void;
}

function formatDate(dateString: string | null) {
  if (!dateString) return null;
  return new Date(dateString + 'T00:00:00').toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isOverdue(fechaVencimiento: string | null) {
  if (!fechaVencimiento) return false;
  return new Date(fechaVencimiento + 'T23:59:59') < new Date();
}

export function LeadTasks({ leadId, tasks, onTasksChanged }: LeadTasksProps) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titulo: '', descripcion: '', fecha_vencimiento: '' });

  const handleCreate = async () => {
    if (!form.titulo.trim() || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('lead_tasks').insert([
        {
          lead_id: leadId,
          creado_por: user.id,
          titulo: form.titulo,
          descripcion: form.descripcion || null,
          fecha_vencimiento: form.fecha_vencimiento || null,
          estado: 'pendiente',
        },
      ]);
      if (error) throw error;
      setForm({ titulo: '', descripcion: '', fecha_vencimiento: '' });
      setShowForm(false);
      onTasksChanged();
    } catch (err) {
      console.error('Error creating task:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task: Task) => {
    if (!user || user.id !== task.creado_por) return;
    const newEstado = task.estado === 'pendiente' ? 'completada' : 'pendiente';
    try {
      await supabase
        .from('lead_tasks')
        .update({ estado: newEstado, updated_at: new Date().toISOString() })
        .eq('id', task.id);
      onTasksChanged();
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const pending = tasks.filter(t => t.estado === 'pendiente');
  const done = tasks.filter(t => t.estado === 'completada');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-green-600" />
          Tareas de seguimiento
          {pending.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
              {pending.length} pendiente{pending.length > 1 ? 's' : ''}
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva tarea
        </button>
      </div>

      {showForm && (
        <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <input
            type="text"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Título de la tarea *"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <textarea
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Descripción (opcional)..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fecha de vencimiento</label>
            <input
              type="date"
              value={form.fecha_vencimiento}
              onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={saving || !form.titulo.trim()}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 transition"
            >
              {saving ? 'Guardando...' : 'Crear tarea'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-sm text-gray-500 py-4 text-center">No hay tareas creadas</p>
        )}

        {pending.map((task) => {
          const overdue = isOverdue(task.fecha_vencimiento);
          return (
            <div
              key={task.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                overdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <button
                onClick={() => handleToggle(task)}
                className="flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 border-gray-400 hover:border-blue-500 transition flex items-center justify-center"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{task.titulo}</p>
                {task.descripcion && (
                  <p className="text-xs text-gray-600 mt-0.5">{task.descripcion}</p>
                )}
                {task.fecha_vencimiento && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                    {overdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                    {overdue ? 'Vencida: ' : 'Vence: '}
                    {formatDate(task.fecha_vencimiento)}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {done.length > 0 && (
          <>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide pt-2 pb-1">Completadas</p>
            {done.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50 opacity-60"
              >
                <button
                  onClick={() => handleToggle(task)}
                  className="flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 border-green-500 bg-green-500 transition flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-white" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 line-through">{task.titulo}</p>
                  {task.descripcion && (
                    <p className="text-xs text-gray-400 mt-0.5">{task.descripcion}</p>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
