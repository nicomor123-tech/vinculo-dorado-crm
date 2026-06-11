import { useEffect, useRef, useState } from 'react';
import {
  MapPin, Phone, Building2, AlertCircle, HeartHandshake,
  MessageCircle, BadgeCheck, CalendarCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BUSINESS_WHATSAPP, buildWaLink } from '../lib/business';
import type { Database } from '../lib/database.types';

type Hogar = Database['public']['Tables']['hogares']['Row'];
type Propuesta = Database['public']['Tables']['propuestas']['Row'];

interface ProposalPageProps {
  propuestaId: string;
}

// La familia abre este link desde WhatsApp en el celular: mobile-first SIEMPRE.

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
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-sage-50 text-sage-700 border border-sage-200">
      {label}
    </span>
  );
}

interface HogarCardProps {
  hogar: Hogar;
  index: number;
  onView: (hogar: Hogar) => void;
  onInterested: (hogar: Hogar) => void;
}

function HogarCard({ hogar, index, onView, onInterested }: HogarCardProps) {
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
  const location = [hogar.barrio, hogar.localidad, hogar.ciudad].filter(Boolean).join(', ');

  return (
    <div
      ref={cardRef}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200 hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="relative h-48 sm:h-52 overflow-hidden">
        <img
          src={getHogarPhoto(index)}
          alt={hogar.nombre}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-white text-lg font-bold leading-tight drop-shadow">{hogar.nombre}</h3>
        </div>
        {precioDesde && (
          <div className="absolute top-3 right-3 bg-white/95 rounded-xl px-3 py-1.5 shadow">
            <p className="text-[9px] uppercase tracking-wide text-sage-500 leading-none">Desde</p>
            <p className="text-sm font-bold text-sage-900 leading-tight">{precioDesde}<span className="text-[10px] font-medium text-sage-500">/mes</span></p>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col">
        {location && (
          <div className="flex items-start gap-2 text-sage-600">
            <MapPin className="w-4 h-4 text-gold-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{location}</span>
          </div>
        )}

        {hogar.descripcion && (
          <p className="text-sm text-sage-600 leading-relaxed">{hogar.descripcion}</p>
        )}

        {servicios.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-sage-400 uppercase tracking-wide">Servicios</p>
            <div className="flex flex-wrap gap-1.5">
              {servicios.slice(0, 6).map((s) => (
                <ServiceTag key={s} label={s} />
              ))}
              {servicios.length > 6 && (
                <span className="text-xs text-sage-400 self-center">+{servicios.length - 6} más</span>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 mt-auto">
          <button
            onClick={() => onInterested(hogar)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition active:scale-[0.98] shadow-sm"
            style={{ background: 'linear-gradient(135deg, #25D366, #1faa52)' }}
          >
            <MessageCircle className="w-4 h-4" />
            Me interesa este hogar
          </button>
        </div>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const trackHomeView = async (propId: string, hogar: Hogar, leadId: string, creadoPor: string) => {
    await Promise.all([
      supabase.from('proposal_events').insert({
        propuesta_id: propId,
        event_type: 'home_viewed',
        hogar_id: hogar.id,
        hogar_nombre: hogar.nombre,
      }),
      supabase.from('activity_log').insert({
        lead_id: leadId,
        user_id: creadoPor,
        tipo: 'hogar_revisado',
        descripcion: `Cliente revisó hogar: ${hogar.nombre}`,
        metadata: { propuesta_id: propId, hogar_id: hogar.id, hogar_nombre: hogar.nombre },
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

  // "Me interesa este" — abre el WhatsApp DEL NEGOCIO con mensaje prellenado
  // y deja registro del interés en la cronología del lead.
  const handleInterested = (hogar: Hogar) => {
    if (propuesta) {
      // Fire-and-forget: el registro no debe frenar la apertura de WhatsApp.
      supabase.from('proposal_events').insert({
        propuesta_id: propuesta.id,
        event_type: 'home_interested',
        hogar_id: hogar.id,
        hogar_nombre: hogar.nombre,
      }).then(() => {});
      supabase.from('activity_log').insert({
        lead_id: propuesta.lead_id,
        user_id: propuesta.creado_por,
        tipo: 'hogar_interesado',
        descripcion: `💚 Cliente marcó "Me interesa": ${hogar.nombre}`,
        metadata: { propuesta_id: propuesta.id, hogar_id: hogar.id, hogar_nombre: hogar.nombre },
      }).then(() => {});
    }
    const nombre = propuesta?.nombre_cliente ? ` Soy ${propuesta.nombre_cliente}.` : '';
    const msg = `Hola, Vínculo Dorado 👋${nombre} Vi la propuesta de hogares y me interesa "${hogar.nombre}". ¿Podemos coordinar una visita?`;
    window.open(buildWaLink(BUSINESS_WHATSAPP, msg), '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sage-500 text-sm">Cargando propuesta...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-sage-900 mb-2">Propuesta no disponible</h2>
          <p className="text-sage-500 text-sm">
            Este enlace no existe o ha sido desactivado. Por favor comunícate con el equipo de Vínculo Dorado.
          </p>
        </div>
      </div>
    );
  }

  const nombreCliente = propuesta?.nombre_cliente?.split(' ')[0] ?? null;

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header con logo */}
      <header className="bg-white border-b border-cream-200 sticky top-0 z-10" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #e4ae3a, #d4951f)' }}>
            <HeartHandshake className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display text-sage-900 leading-tight text-lg">Vínculo Dorado</p>
            <p className="text-[11px] text-sage-500 leading-none">Hogares gerontológicos de confianza</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-7 sm:py-10">
        {/* Saludo personalizado */}
        <div className="mb-7">
          <h1 className="font-display text-2xl sm:text-3xl text-sage-900 leading-tight">
            {nombreCliente ? `Hola ${nombreCliente} 👋` : 'Hola 👋'}
          </h1>
          <p className="text-sage-600 mt-2 text-sm sm:text-base leading-relaxed">
            {propuesta?.mensaje
              ? 'Estas son las opciones que seleccionamos especialmente para tu familia:'
              : `Seleccionamos ${hogares.length} hogar${hogares.length !== 1 ? 'es' : ''} pensando en las necesidades de tu familia. Revísalos con calma — en cada uno puedes tocar "Me interesa" y coordinamos la visita.`}
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs text-sage-500">
            <BadgeCheck className="w-4 h-4 text-gold-500" />
            Hogares verificados por nuestro equipo
          </div>
        </div>

        {hogares.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-12 h-12 text-sage-300 mx-auto mb-3" />
            <p className="text-sage-500">No hay hogares en esta propuesta</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {hogares.map((hogar, i) => (
              <HogarCard
                key={hogar.id}
                hogar={hogar}
                index={i}
                onView={handleHogarView}
                onInterested={handleInterested}
              />
            ))}
          </div>
        )}

        {/* CTA final */}
        <div className="mt-10 rounded-2xl p-6 text-center text-white"
          style={{ background: 'linear-gradient(135deg, #315031, #213521)' }}>
          <CalendarCheck className="w-8 h-8 mx-auto mb-3 text-gold-300" />
          <h3 className="font-display text-xl mb-1">¿Quieres visitar alguno?</h3>
          <p className="text-sm text-white/70 mb-4">
            Escríbenos y coordinamos la visita sin costo. Te acompañamos en todo el proceso.
          </p>
          <button
            onClick={() => {
              const nombre = propuesta?.nombre_cliente ? ` Soy ${propuesta.nombre_cliente}.` : '';
              window.open(
                buildWaLink(BUSINESS_WHATSAPP, `Hola, Vínculo Dorado 👋${nombre} Vi la propuesta de hogares y quiero coordinar una visita.`),
                '_blank',
                'noopener,noreferrer',
              );
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition active:scale-95 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #25D366, #1faa52)' }}
          >
            <Phone className="w-4 h-4" />
            Hablar por WhatsApp
          </button>
        </div>
      </main>

      <footer className="border-t border-cream-200 bg-white mt-10">
        <div className="max-w-4xl mx-auto px-4 py-5 text-center">
          <p className="text-xs text-sage-400">
            Propuesta preparada por Vínculo Dorado &middot; Conectamos familias con hogares gerontológicos de calidad
          </p>
        </div>
      </footer>
    </div>
  );
}
