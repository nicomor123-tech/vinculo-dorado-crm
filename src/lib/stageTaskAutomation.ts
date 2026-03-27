import { supabase } from './supabase';

interface AutoTask {
  titulo: string;
  descripcion: string | null;
  daysFromNow: number;
}

const STAGE_TASKS: Partial<Record<string, AutoTask>> = {
  lead_calificado: {
    titulo: 'Enviar lista de hogares recomendados',
    descripcion: 'Preparar y enviar al contacto la lista de hogares que se ajustan al perfil del adulto mayor.',
    daysFromNow: 0,
  },
  hogares_propuestos: {
    titulo: 'Confirmar si la familia revisó las opciones',
    descripcion: 'Contactar a la familia para verificar si revisaron los hogares propuestos y resolver dudas.',
    daysFromNow: 2,
  },
  visitas_programadas: {
    titulo: 'Confirmar asistencia a visitas programadas',
    descripcion: 'Confirmar con la familia la asistencia a las visitas agendadas a los hogares.',
    daysFromNow: 1,
  },
  en_decision_familiar: {
    titulo: 'Seguimiento de decisión familiar',
    descripcion: 'Contactar a la familia para conocer el avance en su proceso de decisión.',
    daysFromNow: 2,
  },
};

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export async function createStageTask(
  leadId: string,
  userId: string,
  newStage: string
): Promise<void> {
  const rule = STAGE_TASKS[newStage];
  if (!rule) return;

  const { error } = await supabase.from('lead_tasks').insert([
    {
      lead_id: leadId,
      creado_por: userId,
      titulo: rule.titulo,
      descripcion: rule.descripcion,
      fecha_vencimiento: addDays(rule.daysFromNow),
      estado: 'pendiente',
    },
  ]);

  if (error) {
    console.error('Error creating stage task:', error);
  }
}
