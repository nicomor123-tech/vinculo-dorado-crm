import { useEffect, useRef, useState } from 'react';
import { MapPin, DollarSign, Phone, Mail, Building2, Heart, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Hogar = Database['public']['Tables']['hogares']['Row'];
type Propuesta = Database['public']['Tables']['propuestas']['Row'];

interface ProposalPageProps {
  propuestaId: string;
}

const PEXELS_HOMES = [
  'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1029599/pexels-photo-1029599.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/2102587/pexels-photo-2102587.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1876045/pexels-photo-1876045.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg?auto=compress&cs=tinysrgb&w=800',
];

function getHogarPhoto(index: number) {
  return PEXELS_HOMES[index % PEXELS_HOMES.length];
}

function formatPrecio(v: number | null) {
  if (!v) return null;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v);
}

function ServiceTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
      {label}
    </span>
  );
}

interface HogarCardProps {
  hogar: Hogar;
  index: number;
  onView: (hogar: Hogar) => void;
}

function HogarCard({ hogar, index, onView }: HogarCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const logged = useRef(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !logged.current) {
          logged.current = true;
          onView(hogar);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hogar, onView]);

  const servicios: string[] = [];
  if (hogar.serv_enfermeria_24h) servicios.push('Enfermería 24h');
  if (hogar.serv_fisioterapia) servicios.push('Fisioterapia');
  if (hogar.serv_psicologia) servicios.push('Psicología');
  if (hogar.serv_medicina_general) servicios.push('Medicina general');
  if (hogar.serv_terapia_ocupacional) servicios.push('Terapia ocupacional');
  if (hogar.serv_actividades_recreativas) servicios.push('Act. recreativas');
  if (hogar.serv_nutricion) servicios.push('Nutrición');
  if (hogar.maneja_oxigeno) servicios.push('Oxígeno domiciliario');
  if (hogar.serv_transporte) servicios.push('Transporte');

  const precioDesde = formatPrecio(hogar.precio_desde);
  const precioHasta = formatPrecio(hogar.precio_hasta);
  const location = [hogar.barrio, hogar.localidad, hogar.ciudad].filter(Boolean).join(', ');

  return (
    <div
      ref={cardRef}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
    >
      <div className="relative h-52 overflow-hidden">
        <img
          src={getHogarPhoto(index)}
          alt={hogar.nombre}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-white text-lg font-bold leading-tight drop-shadow">{hogar.nombre}</h3>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {location && (
          <div className="flex items-start gap-2 text-gray-600">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{location}</span>
          </div>
        )}

        {(precioDesde || precioHasta) && (
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Precio mensual</p>
              <p className="text-sm font-semibold text-gray-900">
                {precioDesde && precioHasta
                  ? `${precioDesde} – ${precioHasta}`
                  : precioDesde || precioHasta}
              </p>
            </div>
          </div>
        )}

        {hogar.descripcion && (
          <p className="text-sm text-gray-600 leading-relaxed">{hogar.descripcion}</p>
        )}

        {servicios.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicios</p>
            <div className="flex flex-wrap gap-1.5">
              {servicios.map((s) => (
                <ServiceTag key={s} label={s} />
              ))}
            </div>
          </div>
        )}

        {(hogar.telefono || hogar.whatsapp || hogar.correo) && (
          <div className="pt-3 border-t border-gray-100 space-y-1.5">
            {(hogar.telefono || hogar.whatsapp) && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span>{hogar.whatsapp || hogar.telefono}</span>
              </div>
            )}
            {hogar.correo && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <span>{hogar.correo}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProposalPage({ propuestaId }: ProposalPageProps) {
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [hogares, setHogares] = useState<Hogar[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const openTracked = useRef(false);

  useEffect(() => {
    loadProposal();
  }, [propuestaId]);

  const trackOpen = async (p: Propuesta) => {
    if (openTracked.current) return;
    openTracked.current = true;

    await Promise.all([
      supabase
        .from('propuestas')
        .update({ views: (p.views ?? 0) + 1, last_opened_at: new Date().toISOString() })
        .eq('id', p.id),

      supabase.from('proposal_events').insert({
        propuesta_id: p.id,
        event_type: 'proposal_opened',
      }),

      supabase.from('activity_log').insert({
        lead_id: p.lead_id,
        user_id: p.creado_por,
        tipo: 'propuesta_abierta',
        descripcion: 'Cliente abrió propuesta de hogares',
        metadata: { propuesta_id: p.id, views: (p.views ?? 0) + 1 },
      }),
    ]);

    const newViews = (p.views ?? 0) + 1;
    if (newViews > 3) {
      await supabase
        .from('leads')
        .update({ etiqueta_caliente: 'interesado_activo' })
        .eq('id', p.lead_id);
    }
  };

  const trackHomeView = async (propuestaId: string, hogar: Hogar, leadId: string, creadoPor: string) => {
    await Promise.all([
      supabase.from('proposal_events').insert({
        propuesta_id: propuestaId,
        event_type: 'home_viewed',
        hogar_id: hogar.id,
        hogar_nombre: hogar.nombre,
      }),
      supabase.from('activity_log').insert({
        lead_id: leadId,
        user_id: creadoPor,
        tipo: 'hogar_revisado',
        descripcion: `Cliente revisó hogar: ${hogar.nombre}`,
        metadata: { propuesta_id: propuestaId, hogar_id: hogar.id, hogar_nombre: hogar.nombre },
      }),
    ]);
  };

  const loadProposal = async () => {
    setLoading(true);
    try {
      const { data: propData } = await supabase
        .from('propuestas')
        .select('*')
        .eq('id', propuestaId)
        .maybeSingle();

      if (!propData) {
        setNotFound(true);
        return;
      }

      setPropuesta(propData);
      trackOpen(propData);

      const { data: itemsData } = await supabase
        .from('propuesta_hogares')
        .select('hogar_id, orden')
        .eq('propuesta_id', propuestaId)
        .order('orden');

      if (!itemsData || itemsData.length === 0) {
        setHogares([]);
        return;
      }

      const hogarIds = itemsData.map((i) => i.hogar_id);
      const { data: hogaresData } = await supabase
        .from('hogares')
        .select('*')
        .in('id', hogarIds);

      if (hogaresData) {
        const ordered = itemsData
          .map((item) => hogaresData.find((h) => h.id === item.hogar_id))
          .filter((h): h is Hogar => Boolean(h));
        setHogares(ordered);
      }
    } catch (e) {
      console.error('Error loading proposal:', e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleHogarView = (hogar: Hogar) => {
    if (!propuesta) return;
    trackHomeView(propuesta.id, hogar, propuesta.lead_id, propuesta.creado_por);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando propuesta...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Propuesta no disponible</h2>
          <p className="text-gray-500 text-sm">
            Este enlace no existe o ha sido desactivado. Por favor comunícate con el equipo de Vínculo Dorado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 leading-none">Presentado por</p>
            <p className="font-bold text-gray-900 leading-tight">Vínculo Dorado</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Opciones seleccionadas
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">
            {propuesta?.titulo || 'Opciones de hogares recomendados'}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Hemos seleccionado {hogares.length} hogar{hogares.length !== 1 ? 'es' : ''} que podrían ajustarse a sus necesidades.
            Por favor revíselos con calma y contáctenos para coordinar visitas.
          </p>
        </div>

        {hogares.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay hogares en esta propuesta</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {hogares.map((hogar, i) => (
              <HogarCard key={hogar.id} hogar={hogar} index={i} onView={handleHogarView} />
            ))}
          </div>
        )}

        <div className="mt-12 bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
          <Heart className="w-8 h-8 text-blue-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">¿Le interesa alguna opción?</h3>
          <p className="text-sm text-gray-600">
            Contáctenos para coordinar una visita o recibir más información sobre cualquiera de estos hogares.
          </p>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-5 text-center">
          <p className="text-xs text-gray-400">
            Propuesta generada por Vínculo Dorado &middot; Conectando familias con hogares geriátricos de calidad
          </p>
        </div>
      </footer>
    </div>
  );
}
