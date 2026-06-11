import { useEffect, useState, useMemo } from 'react';
import {
  Home, Search, CheckSquare, Square, Send, Link, X, ChevronDown, ChevronUp,
  ExternalLink, Loader2, Sparkles, MessageSquareText, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { buildWaLink } from '../../lib/business';
import type { Database } from '../../lib/database.types';

type Hogar = Database['public']['Tables']['hogares']['Row'];
type Lead = Database['public']['Tables']['leads']['Row'];
type Propuesta = Database['public']['Tables']['propuestas']['Row'];

interface PlantillaLite {
  id: string;
  nombre: string;
  contenido: string;
}

interface ProposalBuilderProps {
  lead: Lead;
  userId: string;
  onProposalCreated: () => void;
}

const MAX_SUGERIDOS = 5;

const MENSAJE_FALLBACK =
  'Hola {{nombre}}, soy {{ejecutivo}} de Vínculo Dorado 💛.\n\n' +
  'Preparé una propuesta con hogares gerontológicos seleccionados especialmente ' +
  'según lo que conversamos. La puedes ver aquí:\n{{link}}\n\n' +
  'Cuando la revises me cuentas cuál te gustaría visitar y coordinamos todo. ¡Quedo pendiente!';

function formatPrecio(v: number | null) {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${v.toLocaleString('es-CO')}`;
}

const PRESUPUESTO_MAP: Record<string, { min: number; max: number }> = {
  'Menor a 2 millones': { min: 0, max: 2_000_000 },
  'Entre 2 y 4 millones': { min: 2_000_000, max: 4_000_000 },
  'Entre 4 y 6 millones': { min: 4_000_000, max: 6_000_000 },
  'Entre 6 y 8 millones': { min: 6_000_000, max: 8_000_000 },
  'Más de 8 millones': { min: 8_000_000, max: Infinity },
};

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Score de afinidad hogar↔lead con razones visibles (presupuesto, zona,
// necesidades de cuidado y disponibilidad/frescura del hogar).
function scoreHogar(h: Hogar, lead: Lead): { score: number; razones: string[] } {
  let score = 0;
  const razones: string[] = [];

  // --- Presupuesto ---
  let presMin: number | null = null, presMax: number | null = null;
  if (lead.presupuesto_mensual) {
    presMin = lead.presupuesto_mensual; presMax = lead.presupuesto_mensual;
  } else if (lead.presupuesto_rango && PRESUPUESTO_MAP[lead.presupuesto_rango]) {
    presMin = PRESUPUESTO_MAP[lead.presupuesto_rango].min;
    presMax = PRESUPUESTO_MAP[lead.presupuesto_rango].max;
  }
  if (presMin != null && presMax != null) {
    const desde = h.precio_desde ?? 0;
    const hasta = h.precio_hasta ?? Number.MAX_SAFE_INTEGER;
    if (hasta >= presMin && desde <= presMax) {
      score += 3;
      razones.push('Presupuesto');
    }
  }

  // --- Zona ---
  const zonaLead = norm(lead.zona_localidad);
  if (zonaLead) {
    const zonaHogar = `${norm(h.localidad)} ${norm(h.barrio)}`;
    if (zonaHogar.includes(zonaLead) || zonaLead.split(' ').some(t => t.length >= 4 && zonaHogar.includes(t))) {
      score += 3;
      razones.push('Zona');
    }
  }
  const ciudadLead = norm(lead.ciudad);
  if (ciudadLead && norm(h.ciudad).includes(ciudadLead)) score += 1;

  // --- Necesidades de cuidado ---
  if (lead.requiere_oxigeno && h.maneja_oxigeno) { score += 2; razones.push('Oxígeno'); }
  if (lead.requiere_enfermeria && h.serv_enfermeria_24h) { score += 2; razones.push('Enfermería 24h'); }
  if (lead.dieta_diabetica && h.dieta_diabetica) { score += 1; razones.push('Dieta diabética'); }
  if (lead.dieta_blanda && h.dieta_blanda) { score += 1; razones.push('Dieta blanda'); }
  if (lead.requiere_primer_piso && (h.un_solo_nivel || h.tiene_ascensor)) { score += 2; razones.push('Sin escaleras'); }
  if (lead.tipo_habitacion === 'Compartida' && h.hab_compartida) score += 1;
  if (lead.tipo_habitacion === 'Independiente' && (h.hab_privada_bano_privado || h.hab_privada_bano_compartido)) score += 1;

  // --- Disponibilidad y frescura del hogar ---
  if ((h.habitaciones_disponibles ?? 0) > 0) { score += 2; razones.push('Cupo disponible'); }
  if (h.estado === 'aprobado') score += 1;
  const dias = (Date.now() - Date.parse(h.updated_at)) / 86_400_000;
  if (isFinite(dias) && dias <= 30) score += 1; // info fresca (sistema de frescura)

  return { score, razones };
}

export function ProposalBuilder({ lead, userId, onProposalCreated }: ProposalBuilderProps) {
  const { profile } = useAuth();
  const [hogares, setHogares] = useState<Hogar[]>([]);
  const [loadingHogares, setLoadingHogares] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{ link: string; mensaje: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [existingProposals, setExistingProposals] = useState<Propuesta[]>([]);
  const [guardrailVisible, setGuardrailVisible] = useState(false);
  const [plantillas, setPlantillas] = useState<PlantillaLite[]>([]);
  const [plantillaId, setPlantillaId] = useState<string>('');
  const [preseleccionado, setPreseleccionado] = useState(false);

  const leadPhone = lead.whatsapp || lead.telefono_principal;
  const ejecutivoNombre = profile?.nombre_completo?.split(' ')[0] ?? 'tu asesor';

  useEffect(() => {
    loadHogares();
    loadExistingProposals();
    loadPlantillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const loadHogares = async () => {
    setLoadingHogares(true);
    const { data } = await supabase
      .from('hogares')
      .select('*')
      .neq('estado', 'rechazado')
      .order('nombre');
    setHogares(data || []);
    setLoadingHogares(false);
  };

  const loadExistingProposals = async () => {
    const { data } = await supabase
      .from('propuestas')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('estado', 'activa')
      .order('created_at', { ascending: false });
    setExistingProposals(data || []);
  };

  const loadPlantillas = async () => {
    const { data, error } = await supabase
      .from('plantillas_propuesta')
      .select('id, nombre, contenido')
      .eq('activa', true)
      .order('created_at', { ascending: true });
    if (!error && data && data.length > 0) {
      setPlantillas(data as PlantillaLite[]);
      setPlantillaId((data[0] as PlantillaLite).id);
    }
  };

  // Hogares con score, ordenados: pre-filtrado automático según el cliente.
  const rankeados = useMemo(() => {
    return hogares
      .map(h => ({ hogar: h, ...scoreHogar(h, lead) }))
      .sort((a, b) => b.score - a.score);
  }, [hogares, lead]);

  const sugeridosIds = useMemo(
    () => new Set(rankeados.filter(r => r.score >= 4).slice(0, MAX_SUGERIDOS).map(r => r.hogar.id)),
    [rankeados],
  );

  // Pre-selección automática (top 3) la primera vez que se expande.
  useEffect(() => {
    if (expanded && !preseleccionado && rankeados.length > 0) {
      const top = rankeados.filter(r => r.score >= 4).slice(0, 3).map(r => r.hogar.id);
      if (top.length > 0) setSelected(new Set(top));
      setPreseleccionado(true);
    }
  }, [expanded, preseleccionado, rankeados]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rankeados;
    const t = norm(search);
    return rankeados.filter(({ hogar: h }) =>
      norm(h.nombre).includes(t) || norm(h.localidad).includes(t) || norm(h.ciudad).includes(t) || norm(h.barrio).includes(t),
    );
  }, [rankeados, search]);

  const toggleHogar = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resolverMensaje = (link: string): string => {
    const plantilla = plantillas.find(p => p.id === plantillaId)?.contenido ?? MENSAJE_FALLBACK;
    return plantilla
      .replace(/\{\{nombre\}\}/g, lead.nombre_contacto || 'familia')
      .replace(/\{\{ejecutivo\}\}/g, ejecutivoNombre)
      .replace(/\{\{link\}\}/g, link);
  };

  const handleGenerate = async () => {
    if (selected.size === 0) {
      setGuardrailVisible(true);
      setTimeout(() => setGuardrailVisible(false), 4000);
      return;
    }
    setGuardrailVisible(false);
    setGenerating(true);
    try {
      const { data: propuesta, error: propErr } = await supabase
        .from('propuestas')
        .insert({
          lead_id: lead.id,
          creado_por: userId,
          titulo: 'Opciones de hogares recomendados',
          estado: 'activa',
          nombre_cliente: lead.nombre_contacto || null,
        })
        .select()
        .single();

      if (propErr || !propuesta) throw propErr;

      const items = Array.from(selected).map((hogarId, i) => ({
        propuesta_id: propuesta.id,
        hogar_id: hogarId,
        orden: i,
      }));
      const { error: itemErr } = await supabase.from('propuesta_hogares').insert(items);
      if (itemErr) throw itemErr;

      const link = `${window.location.origin}/propuesta/${propuesta.id}`;
      const mensaje = resolverMensaje(link);

      // Guardar el mensaje final en la propuesta (queda como registro).
      await supabase.from('propuestas').update({ mensaje }).eq('id', propuesta.id);

      await supabase.from('activity_log').insert({
        lead_id: lead.id,
        user_id: userId,
        tipo: 'propuesta_creada',
        descripcion: `Propuesta de hogares generada con ${selected.size} hogar${selected.size !== 1 ? 'es' : ''}`,
        metadata: { propuesta_id: propuesta.id, hogares_count: selected.size },
      });

      setGenerated({ link, mensaje });
      setSelected(new Set());
      setSearch('');
      loadExistingProposals();
      onProposalCreated();
    } catch (e) {
      console.error('Error generating proposal:', e);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Enviar por WhatsApp = evento comercial real: abre el chat con la plantilla
  // resuelta Y registra la gestión `propuesta_enviada` en el CRM (cronología,
  // tabla de gestiones y ultima_gestion del lead).
  const handleSendWhatsApp = async (link: string, mensaje?: string | null) => {
    const texto = mensaje || resolverMensaje(link);
    window.open(buildWaLink(leadPhone, texto), '_blank', 'noopener,noreferrer');

    const nowIso = new Date().toISOString();
    try {
      await Promise.all([
        supabase.from('notas_seguimiento').insert({
          lead_id: lead.id,
          asesor_id: userId,
          tipo_seguimiento: 'propuesta_enviada',
          descripcion: `Propuesta de hogares enviada por WhatsApp.\n${link}`,
        }),
        supabase.from('activity_log').insert({
          lead_id: lead.id,
          user_id: userId,
          tipo: 'propuesta_enviada',
          descripcion: 'Propuesta enviada al cliente por WhatsApp',
          metadata: { link },
        }),
        supabase.from('leads').update({ ultima_gestion: nowIso, updated_at: nowIso }).eq('id', lead.id),
      ]);
      onProposalCreated();
    } catch (e) {
      console.error('Error registrando envío de propuesta:', e);
    }
  };

  const proposalUrl = (id: string) => `${window.location.origin}/propuesta/${id}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Home className="w-5 h-5 text-blue-700" />
          Propuesta de Hogares
        </h2>
        <div className="flex items-center gap-2">
          {existingProposals.length > 0 && (
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {existingProposals.length} propuesta{existingProposals.length !== 1 ? 's' : ''}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-5 border-t border-gray-100 pt-4">
          {existingProposals.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Propuestas anteriores</p>
              {existingProposals.map((p) => {
                const link = proposalUrl(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <Link className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 flex-1 truncate">{link}</span>
                    {(p.views ?? 0) > 0 && (
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {p.views} vista{(p.views ?? 0) !== 1 ? 's' : ''}
                      </span>
                    )}
                    <button
                      onClick={() => handleCopy(link)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0"
                    >
                      Copiar
                    </button>
                    <button
                      onClick={() => handleSendWhatsApp(link, p.mensaje)}
                      className="text-xs text-green-600 hover:text-green-800 font-medium flex-shrink-0"
                    >
                      WhatsApp
                    </button>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {generated && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-green-800">Propuesta generada</p>
              <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                <Link className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-xs text-gray-700 flex-1 truncate">{generated.link}</span>
                <button
                  onClick={() => handleCopy(generated.link)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 flex-shrink-0"
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-gray-600 bg-white border border-green-100 rounded-lg p-2.5 whitespace-pre-line leading-relaxed max-h-28 overflow-y-auto">
                {generated.mensaje}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSendWhatsApp(generated.link, generated.mensaje)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition"
                >
                  <Send className="w-4 h-4" />
                  Enviar por WhatsApp
                </button>
                <button
                  onClick={() => setGenerated(null)}
                  className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-green-700">
                Al enviarlo se registra automáticamente la gestión "propuesta enviada" en la cronología.
              </p>
            </div>
          )}

          {/* Selector de plantilla */}
          {plantillas.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <MessageSquareText className="w-4 h-4 text-gray-400" />
                Plantilla del mensaje
              </p>
              <select
                value={plantillaId}
                onChange={(e) => setPlantillaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {plantillas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2 flex-wrap">
              Seleccionar hogares
              {selected.size > 0 && (
                <span className="text-blue-600 text-xs">({selected.size} seleccionado{selected.size !== 1 ? 's' : ''})</span>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                Pre-filtrados según presupuesto, zona y necesidades
              </span>
            </p>

            {selected.size > MAX_SUGERIDOS && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Recomendado máximo {MAX_SUGERIDOS} hogares por propuesta: muchas opciones confunden a la familia.
              </div>
            )}

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar hogares..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {loadingHogares ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No hay hogares disponibles</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {filtered.map(({ hogar, razones }) => {
                  const isSelected = selected.has(hogar.id);
                  const esSugerido = sugeridosIds.has(hogar.id);
                  return (
                    <button
                      key={hogar.id}
                      onClick={() => toggleHogar(hogar.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition ${
                        isSelected
                          ? 'border-blue-400 bg-blue-50'
                          : esSugerido
                          ? 'border-teal-200 bg-teal-50/40 hover:border-teal-300'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                          {hogar.nombre}
                          {esSugerido && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              <Sparkles className="w-2.5 h-2.5" /> Sugerido
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {[hogar.localidad, hogar.ciudad].filter(Boolean).join(', ')}
                          {(hogar.precio_desde || hogar.precio_hasta) && (
                            <span className="ml-2 text-gray-700 font-medium">
                              {formatPrecio(hogar.precio_desde)}
                              {hogar.precio_hasta && ` – ${formatPrecio(hogar.precio_hasta)}`}
                            </span>
                          )}
                        </p>
                        {razones.length > 0 && (
                          <p className="text-[10px] text-teal-600 truncate mt-0.5">✓ {razones.join(' · ')}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {guardrailVisible && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800 font-medium">
              <span className="text-amber-500 text-base">!</span>
              Debes seleccionar al menos un hogar antes de generar la propuesta.
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link className="w-4 h-4" />
            )}
            {generating ? 'Generando...' : 'Generar propuesta de hogares'}
          </button>
        </div>
      )}
    </div>
  );
}
