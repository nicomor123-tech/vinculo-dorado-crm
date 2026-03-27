import { useEffect, useState } from 'react';
import { MapPin, BedDouble, Banknote, Sparkles, Building2, BadgeCheck, Clock, XCircle, MessageCircle, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Hogar = Database['public']['Tables']['hogares']['Row'];

export interface MatchCriteria {
  ciudad: string;
  zona_localidad: string;
  presupuesto_rango: string;
  requiere_oxigeno: boolean;
  requiere_primer_piso: boolean;
  tipo_habitacion: string;
  ayuda_para_caminar?: boolean;
  ayuda_para_bano?: boolean;
  ayuda_para_comer?: boolean;
  fecha_ingreso_estimada?: string;
}

interface HogaresRecomendadosProps {
  criteria: MatchCriteria;
  onViewDetail: (id: string) => void;
}

const PRESUPUESTO_MAP: Record<string, { min: number; max: number }> = {
  'Menor a 2 millones': { min: 0, max: 2_000_000 },
  'Entre 2 y 4 millones': { min: 2_000_000, max: 4_000_000 },
  'Entre 4 y 6 millones': { min: 4_000_000, max: 6_000_000 },
  'Entre 6 y 8 millones': { min: 6_000_000, max: 8_000_000 },
  'Más de 8 millones': { min: 8_000_000, max: Infinity },
};

function formatPrecio(v: number | null) {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${v.toLocaleString('es-CO')}`;
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    aprobado: { label: 'Aprobado', cls: 'bg-green-100 text-green-800 border-green-200', icon: BadgeCheck },
    pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
    rechazado: { label: 'Rechazado', cls: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
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

function hasAnyCriteria(c: MatchCriteria) {
  return c.ciudad || c.zona_localidad || c.presupuesto_rango || c.requiere_oxigeno || c.requiere_primer_piso;
}

function matchScore(hogar: Hogar, c: MatchCriteria): number {
  let score = 0;

  if (c.ciudad && hogar.ciudad) {
    const ciudadQuery = c.ciudad.toLowerCase();
    const ciudadHogar = hogar.ciudad.toLowerCase();
    if (ciudadHogar.includes(ciudadQuery) || ciudadQuery.includes(ciudadHogar)) score += 3;
  }

  if (c.zona_localidad && hogar.localidad) {
    const zonaQuery = c.zona_localidad.toLowerCase();
    const localidadHogar = hogar.localidad.toLowerCase();
    if (localidadHogar.includes(zonaQuery) || zonaQuery.includes(localidadHogar)) score += 3;
  }

  if (c.presupuesto_rango) {
    const rango = PRESUPUESTO_MAP[c.presupuesto_rango];
    if (rango) {
      const desde = hogar.precio_desde ?? 0;
      const hasta = hogar.precio_hasta ?? Infinity;
      const overlaps = hasta >= rango.min && desde <= rango.max;
      if (overlaps) score += 2;
    }
  }

  if (c.requiere_oxigeno && hogar.maneja_oxigeno) score += 2;
  if (c.requiere_primer_piso && hogar.un_solo_nivel) score += 1;

  if (c.tipo_habitacion === 'Compartida' && hogar.hab_compartida) score += 1;
  if (c.tipo_habitacion === 'Independiente' && (hogar.hab_privada_bano_privado || hogar.hab_privada_bano_compartido)) score += 1;

  return score;
}

function filterHogares(hogares: Hogar[], c: MatchCriteria): { hogares: Hogar[]; level: 'exact' | 'partial' | 'fallback' } {
  const candidates = hogares.filter((h) => h.estado !== 'rechazado');
  const scored = candidates.map((h) => ({ hogar: h, score: matchScore(h, c) }));

  const exact = scored.filter(({ score }) => score >= 3).sort((a, b) => b.score - a.score).slice(0, 6).map(({ hogar }) => hogar);
  if (exact.length > 0) return { hogares: exact, level: 'exact' };

  const partial = scored.filter(({ score }) => score >= 1).sort((a, b) => b.score - a.score).slice(0, 6).map(({ hogar }) => hogar);
  if (partial.length > 0) return { hogares: partial, level: 'partial' };

  if (c.ciudad) {
    const ciudadLower = c.ciudad.toLowerCase();
    const fallback = candidates
      .filter((h) => h.ciudad && h.ciudad.toLowerCase().includes(ciudadLower))
      .slice(0, 6);
    if (fallback.length > 0) return { hogares: fallback, level: 'fallback' };
  }

  const general = candidates.slice(0, 6);
  return { hogares: general, level: 'fallback' };
}

function buildWhatsAppMessage(criteria: MatchCriteria): string {
  const zona = criteria.zona_localidad || criteria.ciudad || 'No especificada';
  const presupuesto = criteria.presupuesto_rango || 'No especificado';
  const tipoHabitacion = criteria.tipo_habitacion || 'No especificado';
  const primerPiso = criteria.requiere_primer_piso ? 'Sí' : 'No';
  const oxigeno = criteria.requiere_oxigeno ? 'Sí' : 'No';
  const fecha = criteria.fecha_ingreso_estimada || 'Por definir';

  const asistencias: string[] = [];
  if (criteria.ayuda_para_caminar) asistencias.push('caminar');
  if (criteria.ayuda_para_bano) asistencias.push('baño');
  if (criteria.ayuda_para_comer) asistencias.push('comer');
  const asistencia = asistencias.length > 0 ? asistencias.join(', ') : 'Ninguna';

  return `Hola, buen día. Te consulto disponibilidad para posible ingreso.

Perfil del caso:
Zona: ${zona}
Presupuesto aproximado: ${presupuesto}
Tipo de habitación: ${tipoHabitacion}
Requiere primer piso: ${primerPiso}
Oxígeno domiciliario: ${oxigeno}
Asistencia requerida: ${asistencia}
Fecha probable de ingreso: ${fecha}

¿Tienen disponibilidad para un residente con estas características?`;
}

function getWhatsAppPhone(hogar: Hogar): string | null {
  const raw = hogar.whatsapp || hogar.telefono;
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('57')) return digits;
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

function openWhatsAppSequentially(hogares: Hogar[], message: string, index = 0) {
  if (index >= hogares.length) return;
  const hogar = hogares[index];
  const phone = getWhatsAppPhone(hogar);

  if (phone) {
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  }

  if (index + 1 < hogares.length) {
    setTimeout(() => openWhatsAppSequentially(hogares, message, index + 1), 800);
  }
}

export function HogaresRecomendados({ criteria, onViewDetail }: HogaresRecomendadosProps) {
  const [allHogares, setAllHogares] = useState<Hogar[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [noPhoneWarning, setNoPhoneWarning] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('hogares')
      .select('*')
      .order('nombre')
      .then(({ data }) => {
        setAllHogares(data || []);
        setLoaded(true);
      });
  }, []);

  if (!loaded) return null;
  if (!hasAnyCriteria(criteria)) return null;

  const { hogares: matches, level: matchLevel } = filterHogares(allHogares, criteria);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setNoPhoneWarning([]);
  };

  const selectedCount = selectedIds.size;

  const handleConsultar = () => {
    const selected = matches.filter((h) => selectedIds.has(h.id));
    const sinTelefono = selected.filter((h) => !getWhatsAppPhone(h)).map((h) => h.nombre);

    if (sinTelefono.length > 0) {
      setNoPhoneWarning(sinTelefono);
    }

    const conTelefono = selected.filter((h) => getWhatsAppPhone(h));
    if (conTelefono.length === 0) return;

    const message = buildWhatsAppMessage(criteria);
    openWhatsAppSequentially(conTelefono, message);
  };

  return (
    <section className="border-t-2 border-dashed border-blue-200 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Hogares recomendados</h3>
          <p className="text-xs text-gray-400">Resultados en tiempo real según los criterios del lead</p>
        </div>
        {matches.length > 0 && (
          <span className={`ml-auto px-2.5 py-1 text-xs font-semibold rounded-full ${
            matchLevel === 'exact' ? 'bg-blue-100 text-blue-800' :
            matchLevel === 'partial' ? 'bg-amber-100 text-amber-800' :
            'bg-gray-100 text-gray-600'
          }`}>
            {matches.length} {matchLevel === 'exact' ? 'coincidencia' : matchLevel === 'partial' ? 'coincidencia parcial' : 'sugerencia'}{matches.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {matchLevel !== 'exact' && matches.length > 0 && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <Building2 className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            {matchLevel === 'partial'
              ? 'No hay coincidencias exactas — mostrando hogares con criterios similares.'
              : 'Sin coincidencias de criterios — mostrando hogares disponibles en la zona.'}
          </p>
        </div>
      )}

      {matches.length === 0 ? (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
          <Building2 className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Sin hogares disponibles</p>
            <p className="text-sm text-amber-700 mt-0.5">
              No se encontraron hogares registrados. Verifica que existan hogares en el sistema.
            </p>
          </div>
        </div>
      ) : (
        <>
          {selectedCount > 0 && (
            <div className="flex items-center justify-between mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-medium text-blue-800">
                {selectedCount} hogar{selectedCount !== 1 ? 'es' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={handleConsultar}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition shadow-sm"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Consultar disponibilidad
              </button>
            </div>
          )}

          {noPhoneWarning.length > 0 && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Sin teléfono registrado:</span>{' '}
                {noPhoneWarning.join(', ')}. No se pudo abrir WhatsApp para {noPhoneWarning.length === 1 ? 'este hogar' : 'estos hogares'}.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.map((hogar) => (
              <RecommendedCard
                key={hogar.id}
                hogar={hogar}
                selected={selectedIds.has(hogar.id)}
                onToggleSelect={toggleSelect}
                onViewDetail={onViewDetail}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

interface RecommendedCardProps {
  hogar: Hogar;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onViewDetail: (id: string) => void;
}

function RecommendedCard({ hogar, selected, onToggleSelect, onViewDetail }: RecommendedCardProps) {
  return (
    <div
      className={`bg-white border rounded-xl p-4 flex flex-col gap-3 transition ${
        selected
          ? 'border-blue-500 shadow-sm bg-blue-50/30'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => onViewDetail(hogar.id)}
            className="font-semibold text-blue-700 text-sm leading-tight hover:underline text-left truncate block w-full"
          >
            {hogar.nombre}
          </button>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {[hogar.barrio, hogar.localidad, hogar.ciudad].filter(Boolean).join(', ') || 'Ubicación no especificada'}
            </span>
          </div>
        </div>
        <EstadoBadge estado={hogar.estado} />
      </div>

      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1 text-gray-600">
          <Banknote className="w-3.5 h-3.5 text-gray-400" />
          <span>
            {hogar.precio_desde || hogar.precio_hasta
              ? `${formatPrecio(hogar.precio_desde)} – ${formatPrecio(hogar.precio_hasta)}`
              : 'Precio no especificado'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-gray-600 ml-auto">
          <BedDouble className="w-3.5 h-3.5 text-gray-400" />
          <span>
            {hogar.habitaciones_disponibles ?? '—'} disponible{hogar.habitaciones_disponibles !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggleSelect(hogar.id)}
        className={`flex items-center gap-2 w-full py-1.5 px-3 rounded-lg border text-xs font-medium transition ${
          selected
            ? 'border-blue-500 bg-blue-600 text-white hover:bg-blue-700'
            : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50'
        }`}
      >
        {selected ? (
          <CheckSquare className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <Square className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        {selected ? 'Seleccionado' : 'Seleccionar hogar'}
      </button>
    </div>
  );
}
