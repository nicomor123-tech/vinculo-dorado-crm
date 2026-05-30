import { supabase } from './supabase';

interface CrearComisionParams {
  leadId: string;
  hogarId?: string | null;
  ejecutivoId?: string | null;
  valorPrimerMes: number;
  porcentaje?: number;
}

// Crea la comisión del lead al cerrarlo como ganado, repartiendo
// 30% ejecutivo / 70% Vínculo Dorado. Idempotente: si el lead ya tiene
// una comisión registrada, no crea otra (evita duplicados al re-guardar
// o al cerrar desde el Kanban).
export async function crearComisionSiNoExiste(params: CrearComisionParams): Promise<void> {
  const { leadId, valorPrimerMes } = params;
  const hogarId = params.hogarId ?? null;
  const ejecutivoId = params.ejecutivoId ?? null;

  if (!valorPrimerMes || valorPrimerMes <= 0) return;
  const pct = params.porcentaje && params.porcentaje > 0 ? params.porcentaje : 40;

  const { data: existing } = await supabase
    .from('comisiones')
    .select('id')
    .eq('lead_id', leadId)
    .limit(1);
  if (existing && existing.length > 0) return;

  const total = (valorPrimerMes * pct) / 100;

  await supabase.from('comisiones').insert({
    lead_id: leadId,
    hogar_id: hogarId,
    ejecutivo_id: ejecutivoId,
    valor_primer_mes: valorPrimerMes,
    porcentaje_vinculo: pct,
    valor_comision_total: total,
    valor_ejecutivo: total * 0.30,
    valor_vinculo_dorado: total * 0.70,
    estado_cobro: 'pendiente',
  });
}
