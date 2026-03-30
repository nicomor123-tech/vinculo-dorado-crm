import { useEffect, useState, useMemo } from 'react';
import {
  Search, SlidersHorizontal, Plus, Eye, MapPin, Phone,
  BedDouble, ChevronDown, X, Building2, BadgeCheck, Clock, XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Hogar = Database['public']['Tables']['hogares']['Row'];

interface HogaresModuleProps {
  onViewDetail: (id: string) => void;
  onCreateNew?: () => void;
}

const LOCALIDADES = [
  'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito',
  'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos',
  'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda',
  'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar',
];

const PRECIO_RANGOS = [
  { label: 'Todos los precios', min: null, max: null },
  { label: 'Menor a 2 millones', min: 0, max: 2_000_000 },
  { label: '2 a 4 millones', min: 2_000_000, max: 4_000_000 },
  { label: '4 a 6 millones', min: 4_000_000, max: 6_000_000 },
  { label: '6 a 8 millones', min: 6_000_000, max: 8_000_000 },
  { label: 'Más de 8 millones', min: 8_000_000, max: null },
];

const SERVICIOS_FILTRO = [
  { key: 'serv_enfermeria_24h', label: 'Enfermería 24h' },
  { key: 'serv_fisioterapia', label: 'Fisioterapia' },
  { key: 'serv_psicologia', label: 'Psicología' },
  { key: 'serv_medicina_general', label: 'Medicina general' },
  { key: 'serv_terapia_ocupacional', label: 'Terapia ocupacional' },
  { key: 'serv_actividades_recreativas', label: 'Act. recreativas' },
  { key: 'maneja_oxigeno', label: 'Oxígeno domiciliario' },
] as const;

function formatPrecio(v: number | null) {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${v.toLocaleString('es-CO')}`;
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    aprobado: { label: 'Activo', icon: BadgeCheck, cls: 'bg-green-100 text-green-800 border-green-200' },
    pendiente: { label: 'En revisión', icon: Clock, cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    rechazado: { label: 'Inactivo', icon: XCircle, cls: 'bg-red-100 text-red-700 border-red-200' },
  };
  const cfg = map[estado] ?? map['pendiente'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export function HogaresModule({ onViewDetail, onCreateNew }: HogaresModuleProps) {
  const [hogares, setHogares] = useState<Hogar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLocalidad, setFilterLocalidad] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterPrecioIdx, setFilterPrecioIdx] = useState(0);
  const [activeServicios, setActiveServicios] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadHogares();
  }, []);

  const loadHogares = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hogares')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHogares(data || []);
    } catch (e) {
      console.error('Error loading hogares:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleServicio = (key: string) => {
    setActiveServicios((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const filtered = useMemo(() => {
    let list = [...hogares];

    if (search.trim()) {
      const t = search.toLowerCase();
      list = list.filter(
        (h) =>
          h.nombre.toLowerCase().includes(t) ||
          (h.barrio ?? '').toLowerCase().includes(t) ||
          (h.localidad ?? '').toLowerCase().includes(t) ||
          (h.ciudad ?? '').toLowerCase().includes(t)
      );
    }

    if (filterLocalidad) {
      list = list.filter((h) => h.localidad === filterLocalidad);
    }

    if (filterEstado !== 'todos') {
      list = list.filter((h) => h.estado === filterEstado);
    }

    const rango = PRECIO_RANGOS[filterPrecioIdx];
    if (rango.min !== null || rango.max !== null) {
      list = list.filter((h) => {
        const desde = h.precio_desde ?? 0;
        const hasta = h.precio_hasta ?? Infinity;
        const withinMin = rango.min === null || hasta >= rango.min;
        const withinMax = rango.max === null || desde <= rango.max;
        return withinMin && withinMax;
      });
    }

    for (const key of activeServicios) {
      list = list.filter((h) => (h as Record<string, unknown>)[key] === true);
    }

    return list;
  }, [hogares, search, filterLocalidad, filterEstado, filterPrecioIdx, activeServicios]);

  const activeFilterCount =
    (filterLocalidad ? 1 : 0) +
    (filterEstado !== 'todos' ? 1 : 0) +
    (filterPrecioIdx !== 0 ? 1 : 0) +
    activeServicios.length;

  const clearFilters = () => {
    setFilterLocalidad('');
    setFilterEstado('todos');
    setFilterPrecioIdx(0);
    setActiveServicios([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hogares</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} hogar{filtered.length !== 1 ? 'es' : ''} registrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2.5 sm:px-5 text-white rounded-xl transition text-sm font-semibold shadow-sm active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo hogar</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, barrio o localidad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition ${
            activeFilterCount > 0
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="ml-1 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Filtrar hogares</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-600 hover:underline">
                <X className="w-3 h-3" />
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Localidad</label>
              <select
                value={filterLocalidad}
                onChange={(e) => setFilterLocalidad(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todas las localidades</option>
                {LOCALIDADES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Estado</label>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos los estados</option>
                <option value="aprobado">Aprobado</option>
                <option value="pendiente">Pendiente</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Precio mensual</label>
              <select
                value={filterPrecioIdx}
                onChange={(e) => setFilterPrecioIdx(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {PRECIO_RANGOS.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Servicios</label>
            <div className="flex flex-wrap gap-2">
              {SERVICIOS_FILTRO.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleServicio(key)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                    activeServicios.includes(key)
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium">No se encontraron hogares</p>
          <p className="text-gray-400 text-sm mt-1">Intenta ajustar los filtros de búsqueda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((hogar) => (
            <HogarCard key={hogar.id} hogar={hogar} onViewDetail={onViewDetail} />
          ))}
        </div>
      )}
    </div>
  );
}

function HogarCard({ hogar, onViewDetail }: { hogar: Hogar; onViewDetail: (id: string) => void }) {
  const servicios: string[] = [];
  if (hogar.serv_enfermeria_24h) servicios.push('Enfermería 24h');
  if (hogar.serv_fisioterapia) servicios.push('Fisioterapia');
  if (hogar.serv_psicologia) servicios.push('Psicología');
  if (hogar.serv_medicina_general) servicios.push('Medicina');
  if (hogar.serv_terapia_ocupacional) servicios.push('T. Ocupacional');
  if (hogar.serv_actividades_recreativas) servicios.push('Recreativas');
  if (hogar.serv_nutricion) servicios.push('Nutrición');
  if (hogar.serv_transporte) servicios.push('Transporte');
  if (hogar.maneja_oxigeno) servicios.push('Oxígeno');

  const habitaciones: string[] = [];
  if (hogar.hab_compartida) habitaciones.push('Compartida');
  if (hogar.hab_privada_bano_privado) habitaciones.push('Privada c/ baño privado');
  if (hogar.hab_privada_bano_compartido) habitaciones.push('Privada c/ baño compartido');

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition group flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base leading-tight truncate">{hogar.nombre}</h3>
          <div className="flex items-center gap-1 mt-1 text-gray-500 text-xs">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {[hogar.barrio, hogar.localidad, hogar.ciudad].filter(Boolean).join(', ') || 'Ubicación no especificada'}
            </span>
          </div>
        </div>
        <EstadoBadge estado={hogar.estado} />
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex-1">
          <p className="text-xs text-gray-400">Precio mensual</p>
          <p className="font-semibold text-gray-900">
            {hogar.precio_desde || hogar.precio_hasta
              ? `${formatPrecio(hogar.precio_desde)} – ${formatPrecio(hogar.precio_hasta)}`
              : 'No especificado'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Disponible</p>
          <div className="flex items-center gap-1 justify-end">
            <BedDouble className="w-3.5 h-3.5 text-gray-400" />
            <p className="font-semibold text-gray-900">
              {hogar.habitaciones_disponibles ?? '—'}
              {hogar.capacidad_total ? <span className="text-gray-400 font-normal"> / {hogar.capacidad_total}</span> : ''}
            </p>
          </div>
        </div>
      </div>

      {habitaciones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {habitaciones.map((h) => (
            <span key={h} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">{h}</span>
          ))}
        </div>
      )}

      {servicios.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {servicios.slice(0, 4).map((s) => (
            <span key={s} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md">{s}</span>
          ))}
          {servicios.length > 4 && (
            <span className="px-2 py-1 bg-gray-50 text-gray-500 text-xs rounded-md">+{servicios.length - 4} más</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {hogar.telefono ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Phone className="w-3 h-3" />
            <span>{hogar.telefono}</span>
          </div>
        ) : <span />}
        <button
          onClick={() => onViewDetail(hogar.id)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition"
        >
          <Eye className="w-3.5 h-3.5" />
          Ver perfil
        </button>
      </div>
    </div>
  );
}
