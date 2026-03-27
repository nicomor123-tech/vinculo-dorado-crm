import { useEffect, useState } from 'react';
import {
  Users, Plus, ShieldCheck, Briefcase, X, Check,
  Activity, TrendingUp, ToggleLeft, ToggleRight, Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

const ROL_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  administrador:       { label: 'Administrador',        cls: 'bg-purple-100 text-purple-800 border-purple-200', icon: ShieldCheck },
  ejecutivo_comercial: { label: 'Ejecutivo comercial',  cls: 'bg-blue-100 text-blue-800 border-blue-200',       icon: Briefcase },
};

function RolBadge({ rol }: { rol: string }) {
  const cfg = ROL_CONFIG[rol] ?? { label: rol, cls: 'bg-gray-100 text-gray-700 border-gray-200', icon: Briefcase };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #507f50, #315031)' }}
    >
      {initials}
    </div>
  );
}

export function UserManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [activityCounts, setActivityCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [newUser, setNewUser] = useState({
    nombre_completo: '',
    email: '',
    rol: 'ejecutivo_comercial',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profilesRes, leadsRes, actRes] = await Promise.all([
        supabase.from('profiles').select('*').order('nombre_completo'),
        supabase.from('leads').select('ejecutivo_id'),
        supabase.from('activity_log').select('user_id'),
      ]);

      setProfiles(profilesRes.data || []);

      const lc: Record<string, number> = {};
      for (const l of (leadsRes.data || [])) {
        if (l.ejecutivo_id) lc[l.ejecutivo_id] = (lc[l.ejecutivo_id] || 0) + 1;
      }
      setLeadCounts(lc);

      const ac: Record<string, number> = {};
      for (const a of (actRes.data || [])) {
        if (a.user_id) ac[a.user_id] = (ac[a.user_id] || 0) + 1;
      }
      setActivityCounts(ac);
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleActivo = async (profile: Profile) => {
    await supabase.from('profiles').update({ activo: !profile.activo }).eq('id', profile.id);
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, activo: !p.activo } : p));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.nombre_completo.trim() || !newUser.email.trim()) {
      setFormError('Nombre y correo son requeridos.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const { error } = await supabase.from('profiles').insert({
        id: crypto.randomUUID(),
        nombre_completo: newUser.nombre_completo.trim(),
        email: newUser.email.trim().toLowerCase(),
        rol: newUser.rol,
        activo: true,
      });
      if (error) throw error;
      setNewUser({ nombre_completo: '', email: '', rol: 'ejecutivo_comercial' });
      setShowForm(false);
      loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al crear el usuario.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sage-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-sage-900">Usuarios</h1>
          <p className="text-sage-500 mt-1 text-sm">Gestión del equipo · {profiles.length} perfiles</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-sm active:scale-95"
          style={{ background: 'linear-gradient(135deg, #3d653d, #315031)' }}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Nuevo usuario'}
        </button>
      </div>

      {/* Create user form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card border border-cream-200 p-6">
          <h2 className="text-base font-semibold text-sage-900 mb-1">Crear nuevo usuario</h2>
          <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              El perfil se creará en el sistema. Para acceso real al CRM, configura la autenticación desde el Panel de Supabase (Authentication → Users).
            </span>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-sage-600 mb-1.5">Nombre completo *</label>
              <input
                type="text"
                value={newUser.nombre_completo}
                onChange={e => setNewUser(p => ({ ...p, nombre_completo: e.target.value }))}
                placeholder="Ej: María García López"
                className="w-full px-3 py-2 rounded-xl border border-cream-300 text-sm text-sage-900 placeholder-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400 bg-cream-50"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sage-600 mb-1.5">Correo electrónico *</label>
              <input
                type="email"
                value={newUser.email}
                onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                placeholder="correo@ejemplo.com"
                className="w-full px-3 py-2 rounded-xl border border-cream-300 text-sm text-sage-900 placeholder-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400 bg-cream-50"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sage-600 mb-1.5">Rol</label>
              <select
                value={newUser.rol}
                onChange={e => setNewUser(p => ({ ...p, rol: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-cream-300 text-sm text-sage-800 focus:outline-none focus:ring-2 focus:ring-sage-400 bg-cream-50"
              >
                <option value="ejecutivo_comercial">Ejecutivo comercial</option>
                <option value="administrador">Administrador</option>
              </select>
            </div>
            {formError && (
              <div className="sm:col-span-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {formError}
              </div>
            )}
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3d653d, #315031)' }}
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-2xl shadow-card border border-cream-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50 rounded-tl-2xl">Usuario</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50">Correo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50">Rol</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Leads
                  </div>
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50">
                  <div className="flex items-center justify-center gap-1">
                    <Activity className="w-3.5 h-3.5" />
                    Actividad
                  </div>
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-sage-500 uppercase tracking-wide bg-cream-50 rounded-tr-2xl">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {profiles.map(profile => {
                const leads = leadCounts[profile.id] || 0;
                const activity = activityCounts[profile.id] || 0;
                return (
                  <tr key={profile.id} className={`hover:bg-cream-50 transition-colors ${!profile.activo ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={profile.nombre_completo} />
                        <div>
                          <p className="text-sm font-semibold text-sage-900 leading-tight">{profile.nombre_completo}</p>
                          <p className="text-xs text-sage-400 mt-0.5">
                            {new Date(profile.created_at).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-sage-700">{profile.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <RolBadge rol={profile.rol} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      {leads > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold bg-sage-100 text-sage-700">
                          {leads}
                        </span>
                      ) : (
                        <span className="text-sage-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {activity > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-100">
                          {activity}
                        </span>
                      ) : (
                        <span className="text-sage-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleActivo(profile)}
                        title={profile.activo ? 'Desactivar usuario' : 'Activar usuario'}
                        className="inline-flex items-center gap-1.5 text-xs font-medium transition-all"
                      >
                        {profile.activo ? (
                          <>
                            <ToggleRight className="w-5 h-5 text-green-500" />
                            <span className="text-green-700 hidden sm:inline">Activo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                            <span className="text-gray-500 hidden sm:inline">Inactivo</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {profiles.length === 0 && (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-sage-200 mx-auto mb-3" />
              <p className="text-sage-500 font-medium">Sin perfiles registrados</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total usuarios', value: profiles.length, color: 'text-sage-900' },
          { label: 'Activos', value: profiles.filter(p => p.activo).length, color: 'text-green-700' },
          { label: 'Ejecutivos comerciales', value: profiles.filter(p => p.rol === 'ejecutivo_comercial').length, color: 'text-blue-700' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-card border border-cream-200 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-sage-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
