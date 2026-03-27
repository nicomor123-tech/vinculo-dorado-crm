import { useEffect, useState, useMemo } from 'react';
import {
  Home, Search, CheckSquare, Square, Send, Link, X, ChevronDown, ChevronUp,
  ExternalLink, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Hogar = Database['public']['Tables']['hogares']['Row'];
type Propuesta = Database['public']['Tables']['propuestas']['Row'];

interface ProposalBuilderProps {
  leadId: string;
  leadPhone: string;
  leadContactName: string;
  userId: string;
  leadBudget?: number | null;
  onProposalCreated: () => void;
}

function formatPrecio(v: number | null) {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${v.toLocaleString('es-CO')}`;
}

function buildWhatsAppUrl(rawPhone: string, message: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  const normalized = digits.startsWith('57') ? digits : `57${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function ProposalBuilder({
  leadId,
  leadPhone,
  leadContactName,
  userId,
  leadBudget,
  onProposalCreated,
}: ProposalBuilderProps) {
  const [hogares, setHogares] = useState<Hogar[]>([]);
  const [loadingHogares, setLoadingHogares] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [existingProposals, setExistingProposals] = useState<Propuesta[]>([]);
  const [guardrailVisible, setGuardrailVisible] = useState(false);

  useEffect(() => {
    loadHogares();
    loadExistingProposals();
  }, [leadId]);

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
      .eq('lead_id', leadId)
      .eq('estado', 'activa')
      .order('created_at', { ascending: false });
    setExistingProposals(data || []);
  };

  const budgetResult = useMemo(() => {
    if (!leadBudget) return { source: hogares, noMatch: false };
    const matches = hogares.filter(h => {
      const desde = h.precio_desde ?? 0;
      const hasta = h.precio_hasta ?? Number.MAX_SAFE_INTEGER;
      return leadBudget >= desde && leadBudget <= hasta;
    });
    if (matches.length > 0) return { source: matches, noMatch: false };
    // No exact matches — return all sorted by closeness to budget
    const sorted = [...hogares].sort((a, b) => {
      const distA = Math.min(
        Math.abs((a.precio_desde ?? 0) - leadBudget),
        Math.abs((a.precio_hasta ?? a.precio_desde ?? 0) - leadBudget)
      );
      const distB = Math.min(
        Math.abs((b.precio_desde ?? 0) - leadBudget),
        Math.abs((b.precio_hasta ?? b.precio_desde ?? 0) - leadBudget)
      );
      return distA - distB;
    });
    return { source: sorted, noMatch: true };
  }, [hogares, leadBudget]);

  const filtered = useMemo(() => {
    const source = budgetResult.source;
    if (!search.trim()) return source;
    const t = search.toLowerCase();
    return source.filter(
      (h) =>
        h.nombre.toLowerCase().includes(t) ||
        (h.localidad ?? '').toLowerCase().includes(t) ||
        (h.ciudad ?? '').toLowerCase().includes(t)
    );
  }, [budgetResult, search]);

  const toggleHogar = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          lead_id: leadId,
          creado_por: userId,
          titulo: 'Opciones de hogares recomendados',
          estado: 'activa',
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

      await supabase.from('activity_log').insert({
        lead_id: leadId,
        user_id: userId,
        tipo: 'propuesta_enviada',
        descripcion: `Propuesta de hogares generada con ${selected.size} hogar${selected.size !== 1 ? 'es' : ''}`,
        metadata: { propuesta_id: propuesta.id, hogares_count: selected.size },
      });

      const link = `${window.location.origin}/propuesta/${propuesta.id}`;
      setGeneratedLink(link);
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

  const handleSendWhatsApp = (link: string) => {
    const msg = `Hola ${leadContactName}, te comparto algunas opciones de hogares geriátricos que podrían ajustarse a lo que hablamos. Puedes verlos aquí: ${link}`;
    window.open(buildWhatsAppUrl(leadPhone, msg), '_blank', 'noopener,noreferrer');
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
                    <button
                      onClick={() => handleCopy(link)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0"
                    >
                      Copiar
                    </button>
                    <button
                      onClick={() => handleSendWhatsApp(link)}
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

          {generatedLink && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-green-800">Propuesta generada</p>
              <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                <Link className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-xs text-gray-700 flex-1 truncate">{generatedLink}</span>
                <button
                  onClick={() => handleCopy(generatedLink)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 flex-shrink-0"
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSendWhatsApp(generatedLink)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition"
                >
                  <Send className="w-4 h-4" />
                  Enviar por WhatsApp
                </button>
                <button
                  onClick={() => setGeneratedLink(null)}
                  className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Seleccionar hogares
              {selected.size > 0 && (
                <span className="ml-2 text-blue-600 text-xs">({selected.size} seleccionado{selected.size !== 1 ? 's' : ''})</span>
              )}
              {leadBudget && !budgetResult.noMatch && (
                <span className="ml-2 text-teal-600 text-xs">· Filtrados por presupuesto</span>
              )}
            </p>
            {budgetResult.noMatch && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <span className="text-amber-500 font-bold">!</span>
                Sin hogares en rango de presupuesto. Mostrando opciones más cercanas.
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
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {filtered.map((hogar) => {
                  const isSelected = selected.has(hogar.id);
                  return (
                    <button
                      key={hogar.id}
                      onClick={() => toggleHogar(hogar.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition ${
                        isSelected
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{hogar.nombre}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {[hogar.localidad, hogar.ciudad].filter(Boolean).join(', ')}
                          {(hogar.precio_desde || hogar.precio_hasta) && (
                            <span className="ml-2 text-gray-700 font-medium">
                              {formatPrecio(hogar.precio_desde)}
                              {hogar.precio_hasta && ` – ${formatPrecio(hogar.precio_hasta)}`}
                            </span>
                          )}
                        </p>
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
