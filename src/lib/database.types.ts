export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Nota: supabase-js v2.5x exige que cada tabla declare Relationships y que el
// esquema tenga Views/Functions; sin eso la inferencia degrada todo a `never`.
// DatabaseDef es la definición "a mano"; Database (abajo) le inyecta esos
// campos automáticamente a todas las tablas.
interface DatabaseDef {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nombre_completo: string
          email: string
          rol: string
          activo: boolean
          telefono: string | null
          telegram_chat_id: string | null
          telegram_alias: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nombre_completo: string
          email: string
          rol?: string
          activo?: boolean
          telefono?: string | null
          telegram_chat_id?: string | null
          telegram_alias?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre_completo?: string
          email?: string
          rol?: string
          activo?: boolean
          telefono?: string | null
          telegram_chat_id?: string | null
          telegram_alias?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          nombre_adulto_mayor: string
          edad: number | null
          sexo: string | null
          nombre_contacto: string
          parentesco: string | null
          telefono_principal: string
          telefono_alterno: string | null
          whatsapp: string | null
          correo: string | null
          ciudad: string | null
          zona_localidad: string | null
          presupuesto_mensual: number | null
          urgencia: string
          diagnosticos: string | null
          movilidad: string | null
          deterioro_cognitivo: boolean
          requiere_oxigeno: boolean
          requiere_enfermeria: boolean
          requiere_acompanamiento: boolean
          tipo_habitacion: string | null
          fecha_probable_ingreso: string | null
          como_nos_conocio: string | null
          observaciones: string | null
          estado: string
          etiqueta_caliente: string | null
          asesor_id: string | null
          ejecutivo_id: string | null
          resumen_caso: string | null
          presupuesto_rango: string | null
          requiere_primer_piso: boolean
          ayuda_para_comer: boolean
          ayuda_para_bano: boolean
          ayuda_para_caminar: boolean
          dieta_diabetica: boolean
          dieta_blanda: boolean
          fecha_ingreso_estimada: string | null
          tipo_bano: string | null
          fecha_asignacion: string | null
          intentos_fallidos: number
          ultimo_intento_fallido: string | null
          proxima_contactabilidad: string | null
          proxima_accion: string | null
          recordatorios_enviados: number
          ultimo_recordatorio: string | null
          escalado_supervision: boolean
          recordatorio_ref: string | null
          ultima_gestion: string | null
          cita_avisada_ref: string | null
          motivo_perdida: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre_adulto_mayor: string
          edad?: number | null
          sexo?: string | null
          nombre_contacto: string
          parentesco?: string | null
          telefono_principal: string
          telefono_alterno?: string | null
          whatsapp?: string | null
          correo?: string | null
          ciudad?: string | null
          zona_localidad?: string | null
          presupuesto_mensual?: number | null
          urgencia?: string
          diagnosticos?: string | null
          movilidad?: string | null
          deterioro_cognitivo?: boolean
          requiere_oxigeno?: boolean
          requiere_enfermeria?: boolean
          requiere_acompanamiento?: boolean
          tipo_habitacion?: string | null
          fecha_probable_ingreso?: string | null
          como_nos_conocio?: string | null
          observaciones?: string | null
          estado?: string
          etiqueta_caliente?: string | null
          asesor_id?: string | null
          ejecutivo_id?: string | null
          resumen_caso?: string | null
          presupuesto_rango?: string | null
          requiere_primer_piso?: boolean
          ayuda_para_comer?: boolean
          ayuda_para_bano?: boolean
          ayuda_para_caminar?: boolean
          dieta_diabetica?: boolean
          dieta_blanda?: boolean
          fecha_ingreso_estimada?: string | null
          tipo_bano?: string | null
          fecha_asignacion?: string | null
          intentos_fallidos?: number
          ultimo_intento_fallido?: string | null
          proxima_contactabilidad?: string | null
          proxima_accion?: string | null
          recordatorios_enviados?: number
          ultimo_recordatorio?: string | null
          escalado_supervision?: boolean
          recordatorio_ref?: string | null
          ultima_gestion?: string | null
          cita_avisada_ref?: string | null
          motivo_perdida?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre_adulto_mayor?: string
          edad?: number | null
          sexo?: string | null
          nombre_contacto?: string
          parentesco?: string | null
          telefono_principal?: string
          telefono_alterno?: string | null
          whatsapp?: string | null
          correo?: string | null
          ciudad?: string | null
          zona_localidad?: string | null
          presupuesto_mensual?: number | null
          urgencia?: string
          diagnosticos?: string | null
          movilidad?: string | null
          deterioro_cognitivo?: boolean
          requiere_oxigeno?: boolean
          requiere_enfermeria?: boolean
          requiere_acompanamiento?: boolean
          tipo_habitacion?: string | null
          fecha_probable_ingreso?: string | null
          como_nos_conocio?: string | null
          observaciones?: string | null
          estado?: string
          etiqueta_caliente?: string | null
          asesor_id?: string | null
          ejecutivo_id?: string | null
          resumen_caso?: string | null
          presupuesto_rango?: string | null
          requiere_primer_piso?: boolean
          ayuda_para_comer?: boolean
          ayuda_para_bano?: boolean
          ayuda_para_caminar?: boolean
          dieta_diabetica?: boolean
          dieta_blanda?: boolean
          fecha_ingreso_estimada?: string | null
          tipo_bano?: string | null
          fecha_asignacion?: string | null
          intentos_fallidos?: number
          ultimo_intento_fallido?: string | null
          proxima_contactabilidad?: string | null
          proxima_accion?: string | null
          recordatorios_enviados?: number
          ultimo_recordatorio?: string | null
          escalado_supervision?: boolean
          recordatorio_ref?: string | null
          ultima_gestion?: string | null
          cita_avisada_ref?: string | null
          motivo_perdida?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      intentos_contacto: {
        Row: {
          id: string
          lead_id: string | null
          user_id: string | null
          canal: string
          nota: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          canal?: string
          nota?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          canal?: string
          nota?: string | null
          created_at?: string
        }
      }
      hogares: {
        Row: {
          id: string
          nombre: string
          direccion: string | null
          barrio: string | null
          localidad: string | null
          ciudad: string
          porcentaje_comision: number | null
          nombre_responsable: string | null
          telefono: string | null
          whatsapp: string | null
          correo: string | null
          pagina_web: string | null
          capacidad_total: number | null
          habitaciones_disponibles: number | null
          precio_desde: number | null
          precio_hasta: number | null
          hab_compartida: boolean
          hab_privada_bano_privado: boolean
          hab_privada_bano_compartido: boolean
          serv_enfermeria_24h: boolean
          serv_fisioterapia: boolean
          serv_terapia_ocupacional: boolean
          serv_psicologia: boolean
          serv_nutricion: boolean
          serv_actividades_recreativas: boolean
          serv_transporte: boolean
          serv_medicina_general: boolean
          serv_fonoaudiologia: boolean
          serv_trabajo_social: boolean
          dieta_blanda: boolean
          dieta_diabetica: boolean
          dieta_hiposodica: boolean
          dieta_renal: boolean
          maneja_oxigeno: boolean
          tiene_ascensor: boolean
          solo_escaleras: boolean
          un_solo_nivel: boolean
          maneja_demencia: boolean
          maneja_silla_ruedas: boolean
          descripcion: string | null
          estado: string
          registrado_por: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          direccion?: string | null
          barrio?: string | null
          localidad?: string | null
          ciudad?: string
          porcentaje_comision?: number | null
          nombre_responsable?: string | null
          telefono?: string | null
          whatsapp?: string | null
          correo?: string | null
          pagina_web?: string | null
          capacidad_total?: number | null
          habitaciones_disponibles?: number | null
          precio_desde?: number | null
          precio_hasta?: number | null
          hab_compartida?: boolean
          hab_privada_bano_privado?: boolean
          hab_privada_bano_compartido?: boolean
          serv_enfermeria_24h?: boolean
          serv_fisioterapia?: boolean
          serv_terapia_ocupacional?: boolean
          serv_psicologia?: boolean
          serv_nutricion?: boolean
          serv_actividades_recreativas?: boolean
          serv_transporte?: boolean
          serv_medicina_general?: boolean
          serv_fonoaudiologia?: boolean
          serv_trabajo_social?: boolean
          dieta_blanda?: boolean
          dieta_diabetica?: boolean
          dieta_hiposodica?: boolean
          dieta_renal?: boolean
          maneja_oxigeno?: boolean
          tiene_ascensor?: boolean
          solo_escaleras?: boolean
          un_solo_nivel?: boolean
          maneja_demencia?: boolean
          maneja_silla_ruedas?: boolean
          descripcion?: string | null
          estado?: string
          registrado_por?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          direccion?: string | null
          barrio?: string | null
          localidad?: string | null
          ciudad?: string
          porcentaje_comision?: number | null
          nombre_responsable?: string | null
          telefono?: string | null
          whatsapp?: string | null
          correo?: string | null
          pagina_web?: string | null
          capacidad_total?: number | null
          habitaciones_disponibles?: number | null
          precio_desde?: number | null
          precio_hasta?: number | null
          hab_compartida?: boolean
          hab_privada_bano_privado?: boolean
          hab_privada_bano_compartido?: boolean
          serv_enfermeria_24h?: boolean
          serv_fisioterapia?: boolean
          serv_terapia_ocupacional?: boolean
          serv_psicologia?: boolean
          serv_nutricion?: boolean
          serv_actividades_recreativas?: boolean
          serv_transporte?: boolean
          serv_medicina_general?: boolean
          serv_fonoaudiologia?: boolean
          serv_trabajo_social?: boolean
          dieta_blanda?: boolean
          dieta_diabetica?: boolean
          dieta_hiposodica?: boolean
          dieta_renal?: boolean
          maneja_oxigeno?: boolean
          tiene_ascensor?: boolean
          solo_escaleras?: boolean
          un_solo_nivel?: boolean
          maneja_demencia?: boolean
          maneja_silla_ruedas?: boolean
          descripcion?: string | null
          estado?: string
          registrado_por?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notas_seguimiento: {
        Row: {
          id: string
          lead_id: string
          asesor_id: string
          tipo_seguimiento: string
          descripcion: string
          proxima_accion: string | null
          fecha_proxima_accion: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          asesor_id: string
          tipo_seguimiento?: string
          descripcion: string
          proxima_accion?: string | null
          fecha_proxima_accion?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          asesor_id?: string
          tipo_seguimiento?: string
          descripcion?: string
          proxima_accion?: string | null
          fecha_proxima_accion?: string | null
          created_at?: string
        }
      }
      matching_sugerencias: {
        Row: {
          id: string
          lead_id: string
          hogar_id: string
          match_score: number
          notas: string | null
          estado: string
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          hogar_id: string
          match_score?: number
          notas?: string | null
          estado?: string
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          hogar_id?: string
          match_score?: number
          notas?: string | null
          estado?: string
          created_at?: string
        }
      }
      activity_log: {
        Row: {
          id: string
          lead_id: string
          user_id: string | null
          tipo: string
          descripcion: string
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          user_id?: string | null
          tipo: string
          descripcion: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          user_id?: string | null
          tipo?: string
          descripcion?: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
      }
      lead_tasks: {
        Row: {
          id: string
          lead_id: string
          creado_por: string
          titulo: string
          descripcion: string | null
          fecha_vencimiento: string | null
          estado: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          creado_por: string
          titulo: string
          descripcion?: string | null
          fecha_vencimiento?: string | null
          estado?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          creado_por?: string
          titulo?: string
          descripcion?: string | null
          fecha_vencimiento?: string | null
          estado?: string
          created_at?: string
          updated_at?: string
        }
      }
      propuestas: {
        Row: {
          id: string
          lead_id: string
          creado_por: string
          titulo: string
          mensaje: string | null
          nombre_cliente: string | null
          estado: string
          views: number
          last_opened_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          creado_por: string
          titulo?: string
          mensaje?: string | null
          nombre_cliente?: string | null
          estado?: string
          views?: number
          last_opened_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          creado_por?: string
          titulo?: string
          mensaje?: string | null
          nombre_cliente?: string | null
          estado?: string
          views?: number
          last_opened_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      proposal_events: {
        Row: {
          id: string
          propuesta_id: string
          event_type: string
          hogar_id: string | null
          hogar_nombre: string | null
          created_at: string
        }
        Insert: {
          id?: string
          propuesta_id: string
          event_type: string
          hogar_id?: string | null
          hogar_nombre?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          propuesta_id?: string
          event_type?: string
          hogar_id?: string | null
          hogar_nombre?: string | null
          created_at?: string
        }
      }
      propuesta_hogares: {
        Row: {
          id: string
          propuesta_id: string
          hogar_id: string
          orden: number
          created_at: string
        }
        Insert: {
          id?: string
          propuesta_id: string
          hogar_id: string
          orden?: number
          created_at?: string
        }
        Update: {
          id?: string
          propuesta_id?: string
          hogar_id?: string
          orden?: number
          created_at?: string
        }
      }
      comisiones: {
        Row: {
          id: string
          lead_id: string | null
          hogar_id: string | null
          ejecutivo_id: string | null
          valor_primer_mes: number
          porcentaje_vinculo: number
          valor_comision_total: number
          valor_ejecutivo: number
          valor_vinculo_dorado: number
          estado_cobro: string
          fecha_generacion: string
          fecha_cobro: string | null
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id?: string | null
          hogar_id?: string | null
          ejecutivo_id?: string | null
          valor_primer_mes?: number
          porcentaje_vinculo?: number
          valor_comision_total?: number
          valor_ejecutivo?: number
          valor_vinculo_dorado?: number
          estado_cobro?: string
          fecha_generacion?: string
          fecha_cobro?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string | null
          hogar_id?: string | null
          ejecutivo_id?: string | null
          valor_primer_mes?: number
          porcentaje_vinculo?: number
          valor_comision_total?: number
          valor_ejecutivo?: number
          valor_vinculo_dorado?: number
          estado_cobro?: string
          fecha_generacion?: string
          fecha_cobro?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      adelantos_comision: {
        Row: {
          id: string
          comision_id: string
          ejecutivo_id: string | null
          monto: number
          fecha: string
          aprobado_por: string | null
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          comision_id: string
          ejecutivo_id?: string | null
          monto: number
          fecha?: string
          aprobado_por?: string | null
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          comision_id?: string
          ejecutivo_id?: string | null
          monto?: number
          fecha?: string
          aprobado_por?: string | null
          notas?: string | null
          created_at?: string
        }
      }
      lead_etapa_historial: {
        Row: {
          id: string
          lead_id: string
          etapa_anterior: string | null
          etapa_nueva: string
          changed_at: string
          changed_by: string | null
        }
        Insert: {
          id?: string
          lead_id: string
          etapa_anterior?: string | null
          etapa_nueva: string
          changed_at?: string
          changed_by?: string | null
        }
        Update: {
          id?: string
          lead_id?: string
          etapa_anterior?: string | null
          etapa_nueva?: string
          changed_at?: string
          changed_by?: string | null
        }
      }
      lead_analisis_ia: {
        Row: {
          id: string
          lead_id: string
          generado_por: string | null
          temperatura: string
          probabilidad_cierre_pct: number
          riesgos: Json
          mejor_proxima_accion: string | null
          guion_sugerido: string | null
          modelo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          generado_por?: string | null
          temperatura?: string
          probabilidad_cierre_pct?: number
          riesgos?: Json
          mejor_proxima_accion?: string | null
          guion_sugerido?: string | null
          modelo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          generado_por?: string | null
          temperatura?: string
          probabilidad_cierre_pct?: number
          riesgos?: Json
          mejor_proxima_accion?: string | null
          guion_sugerido?: string | null
          modelo?: string | null
          created_at?: string
        }
      }
      plantillas_propuesta: {
        Row: {
          id: string
          nombre: string
          contenido: string
          activa: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          contenido: string
          activa?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          contenido?: string
          activa?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      telegram_updates: {
        Row: {
          update_id: number
          created_at: string
        }
        Insert: {
          update_id: number
          created_at?: string
        }
        Update: {
          update_id?: number
          created_at?: string
        }
      }
      telegram_pendientes: {
        Row: {
          id: string
          chat_id: string
          profile_id: string | null
          payload: Json
          resolved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          profile_id?: string | null
          payload: Json
          resolved?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          profile_id?: string | null
          payload?: Json
          resolved?: boolean
          created_at?: string
        }
      }
      historial_porcentaje_hogar: {
        Row: {
          id: string
          hogar_id: string
          porcentaje_anterior: number | null
          porcentaje_nuevo: number
          fecha_cambio: string
          cambiado_por: string | null
          motivo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          hogar_id: string
          porcentaje_anterior?: number | null
          porcentaje_nuevo: number
          fecha_cambio?: string
          cambiado_por?: string | null
          motivo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          hogar_id?: string
          porcentaje_anterior?: number | null
          porcentaje_nuevo?: number
          fecha_cambio?: string
          cambiado_por?: string | null
          motivo?: string | null
          created_at?: string
        }
      }
    }
  }
}

export type Database = {
  public: {
    Tables: {
      [K in keyof DatabaseDef['public']['Tables']]: DatabaseDef['public']['Tables'][K] & {
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
