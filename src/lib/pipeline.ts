export const PIPELINE_STAGES = [
  { value: 'lead_nuevo', label: 'Lead nuevo' },
  { value: 'lead_calificado', label: 'Lead calificado' },
  { value: 'hogares_propuestos', label: 'Hogares propuestos' },
  { value: 'visitas_programadas', label: 'Visitas programadas' },
  { value: 'en_decision_familiar', label: 'En decisión familiar' },
  { value: 'cierre_ganado', label: 'Cierre ganado' },
  { value: 'cierre_perdido', label: 'Cierre perdido' },
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number]['value'];

export const STAGE_COLORS: Record<string, string> = {
  lead_nuevo:           'bg-orange-100 text-orange-800',
  lead_calificado:      'bg-amber-100 text-amber-800',
  hogares_propuestos:   'bg-blue-100 text-blue-800',
  visitas_programadas:  'bg-sky-100 text-sky-800',
  en_decision_familiar: 'bg-violet-100 text-violet-800',
  cierre_ganado:        'bg-emerald-100 text-emerald-800',
  cierre_perdido:       'bg-gray-100 text-gray-500',
};

export const STAGE_BORDER_COLORS: Record<string, string> = {
  lead_nuevo:           'border-orange-400',
  lead_calificado:      'border-amber-400',
  hogares_propuestos:   'border-blue-500',
  visitas_programadas:  'border-sky-500',
  en_decision_familiar: 'border-violet-400',
  cierre_ganado:        'border-emerald-500',
  cierre_perdido:       'border-gray-400',
};

export const STAGE_ACCENT_COLORS: Record<string, string> = {
  lead_nuevo:           'bg-orange-400',
  lead_calificado:      'bg-amber-400',
  hogares_propuestos:   'bg-blue-500',
  visitas_programadas:  'bg-sky-500',
  en_decision_familiar: 'bg-violet-500',
  cierre_ganado:        'bg-emerald-500',
  cierre_perdido:       'bg-gray-400',
};

export const STAGE_DOT_COLORS: Record<string, string> = {
  lead_nuevo:           'bg-orange-400',
  lead_calificado:      'bg-amber-500',
  hogares_propuestos:   'bg-blue-500',
  visitas_programadas:  'bg-sky-500',
  en_decision_familiar: 'bg-violet-500',
  cierre_ganado:        'bg-emerald-500',
  cierre_perdido:       'bg-gray-400',
};

export const STAGE_STRONG_COLORS: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  lead_nuevo:           { bg: 'bg-orange-500',  text: 'text-white', border: 'border-orange-600',  ring: 'ring-orange-300' },
  lead_calificado:      { bg: 'bg-amber-500',   text: 'text-white', border: 'border-amber-600',   ring: 'ring-amber-300' },
  hogares_propuestos:   { bg: 'bg-blue-600',    text: 'text-white', border: 'border-blue-700',    ring: 'ring-blue-300' },
  visitas_programadas:  { bg: 'bg-sky-500',     text: 'text-white', border: 'border-sky-600',     ring: 'ring-sky-300' },
  en_decision_familiar: { bg: 'bg-violet-500',  text: 'text-white', border: 'border-violet-600',  ring: 'ring-violet-300' },
  cierre_ganado:        { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-700', ring: 'ring-emerald-300' },
  cierre_perdido:       { bg: 'bg-gray-500',    text: 'text-white', border: 'border-gray-600',    ring: 'ring-gray-300' },
};

export const STAGE_GROUP: Record<string, 'followup' | 'active' | 'decision' | 'won' | 'lost'> = {
  lead_nuevo:           'followup',
  lead_calificado:      'followup',
  hogares_propuestos:   'active',
  visitas_programadas:  'active',
  en_decision_familiar: 'decision',
  cierre_ganado:        'won',
  cierre_perdido:       'lost',
};

export function getStageLabel(estado: string): string {
  return PIPELINE_STAGES.find(s => s.value === estado)?.label ?? estado.replace(/_/g, ' ');
}

export function getStageBadgeColor(estado: string): string {
  return STAGE_COLORS[estado] ?? 'bg-gray-100 text-gray-700';
}

export function getStageBorderColor(estado: string): string {
  return STAGE_BORDER_COLORS[estado] ?? 'border-gray-400';
}

export function getStageAccentColor(estado: string): string {
  return STAGE_ACCENT_COLORS[estado] ?? 'bg-gray-400';
}

export function getStageDotColor(estado: string): string {
  return STAGE_DOT_COLORS[estado] ?? 'bg-gray-400';
}

export function getStageStrongColor(estado: string) {
  return STAGE_STRONG_COLORS[estado] ?? { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-600', ring: 'ring-gray-300' };
}

export function getStageGroup(estado: string) {
  return STAGE_GROUP[estado] ?? 'followup';
}
