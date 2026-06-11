import { useEffect, useState } from 'react';
import {
  BrainCircuit, Sparkles, RefreshCw, AlertTriangle, MessageSquareQuote,
  Copy, Check, Loader2, Target,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Tarjeta "Análisis IA" del detalle del lead.
// Muestra el último análisis cacheado (tabla lead_analisis_ia) y permite
// generar/regenerar uno nuevo vía la Edge Function analisis-lead (Gemini).

interface Analisis {
  id?: string;
  temperatura: 'caliente' | 'tibio' | 'frio' | string;
  probabilidad_cierre_pct: number;
  riesgos: string[];
  mejor_proxima_accion: string;
  guion_sugerido: string;
  created_at: string;
}

const TEMP_CONFIG: Record<string, { label: string; emoji: string; cls: string; bar: string }> = {
  caliente: { label: 'Caliente', emoji: '🔥', cls: 'bg-red-50 text-red-700 border-red-200', bar: '#ef4444' },
  tibio:    { label: 'Tibio',    emoji: '🌤️', cls: 'bg-amber-50 text-amber-700 border-amber-200', bar: '#e4ae3a' },
  frio:     { label: 'Frío',     emoji: '🧊', cls: 'bg-sky-50 text-sky-700 border-sky-200', bar: '#38bdf8' },
};

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function AnalisisIA({ leadId }: { leadId: string }) {
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [cargandoCache, setCargandoCache] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    cargarUltimo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const cargarUltimo = async () => {
    setCargandoCache(true);
    try {
      const { data, error: err } = await supabase
        .from('lead_analisis_ia')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!err && data) {
        setAnalisis({
          ...data,
          riesgos: Array.isArray(data.riesgos) ? data.riesgos : [],
        } as Analisis);
      } else {
        setAnalisis(null);
      }
    } catch {
      setAnalisis(null); // tabla aún sin crear: la tarjeta sigue funcionando
    } finally {
      setCargandoCache(false);
    }
  };

  const generar = async () => {
    setGenerando(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('Sesión expirada. Recarga la página e inicia sesión de nuevo.');
        return;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analisis-lead`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lead_id: leadId }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.analisis) {
        setError(body?.error ?? 'No se pudo generar el análisis. Inténtalo en unos minutos.');
        return;
      }
      setAnalisis({
        ...body.analisis,
        riesgos: Array.isArray(body.analisis.riesgos) ? body.analisis.riesgos : [],
      });
    } catch (e) {
      console.error('Error generando análisis IA:', e);
      setError('Error de conexión generando el análisis.');
    } finally {
      setGenerando(false);
    }
  };

  const copiarGuion = async () => {
    if (!analisis?.guion_sugerido) return;
    try {
      await navigator.clipboard.writeText(analisis.guion_sugerido);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* clipboard no disponible */ }
  };

  const temp = analisis ? (TEMP_CONFIG[analisis.temperatura] ?? TEMP_CONFIG.tibio) : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-violet-100 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-violet-100"
        style={{ background: 'linear-gradient(135deg, #f5f3ff, #faf5ff)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
          <BrainCircuit className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-sm font-bold text-gray-900">Análisis IA</h2>
        {analisis && (
          <span className="ml-auto text-[10px] text-violet-400 font-medium">
            {fmtFecha(analisis.created_at)}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {cargandoCache ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-violet-300" />
          </div>
        ) : !analisis ? (
          <div className="text-center py-2">
            <Sparkles className="w-8 h-8 text-violet-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500 mb-4 px-2">
              La IA analiza todo el caso (datos, gestiones, tiempos e intentos) y te dice qué tan
              cerca está de cerrar, los riesgos y el mejor próximo paso.
            </p>
          </div>
        ) : (
          <>
            {/* Temperatura + probabilidad */}
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${temp!.cls}`}>
                {temp!.emoji} {temp!.label}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Prob. de cierre</span>
                  <span className="text-sm font-bold text-gray-900">{analisis.probabilidad_cierre_pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${analisis.probabilidad_cierre_pct}%`, background: temp!.bar }} />
                </div>
              </div>
            </div>

            {/* Mejor próxima acción */}
            <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wide text-violet-500 font-bold mb-1 flex items-center gap-1">
                <Target className="w-3 h-3" /> Mejor próxima acción
              </p>
              <p className="text-sm text-gray-800 leading-snug font-medium">{analisis.mejor_proxima_accion}</p>
            </div>

            {/* Riesgos */}
            {analisis.riesgos.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" /> Riesgos
                </p>
                <ul className="space-y-1">
                  {analisis.riesgos.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600 leading-snug">
                      <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Guion sugerido */}
            {analisis.guion_sugerido && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 font-bold flex items-center gap-1">
                    <MessageSquareQuote className="w-3 h-3" /> Guion para el próximo contacto
                  </p>
                  <button onClick={copiarGuion}
                    className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 hover:text-violet-800 transition">
                    {copiado ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className="px-3 py-2.5 text-xs text-gray-700 leading-relaxed whitespace-pre-line italic">
                  "{analisis.guion_sugerido}"
                </p>
              </div>
            )}
          </>
        )}

        {error && (
          <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        {!cargandoCache && (
          <button
            onClick={generar}
            disabled={generando}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
          >
            {generando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analizando el caso…</>
            ) : analisis ? (
              <><RefreshCw className="w-4 h-4" /> Regenerar análisis</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Analizar con IA</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
