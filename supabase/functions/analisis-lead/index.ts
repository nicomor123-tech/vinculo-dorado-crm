// Edge Function: analisis-lead
// Análisis comercial de un lead con IA (Gemini) para el Centro de Inteligencia.
//
// POST { lead_id: string }
// Header: Authorization: Bearer <access_token del usuario logueado en el CRM>
//
// Seguridad: se despliega con --no-verify-jwt (patrón del proyecto), pero
// valida el access_token contra GoTrue (/auth/v1/user): solo usuarios reales
// del CRM pueden pedir análisis. Los datos se leen con el service role.
//
// Flujo: arma el contexto completo del lead (datos + gestiones + intentos +
// cronología + tiempos) -> Gemini -> JSON estricto -> se cachea en la tabla
// lead_analisis_ia y se devuelve al frontend.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function restHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
  };
}

async function sbGet(pathAndQuery: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers: restHeaders() });
  const rows = await res.json().catch(() => []);
  if (!res.ok) {
    console.error(`GET ${pathAndQuery} falló:`, res.status, rows);
    return [];
  }
  return Array.isArray(rows) ? rows : [];
}

// Valida el JWT del usuario contra GoTrue. Devuelve el user id o null.
async function validarUsuario(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (!token || token === ANON_KEY || token === SERVICE_ROLE) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY || SERVICE_ROLE, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json().catch(() => null);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function fmtCO(iso: string | null): string {
  if (!iso) return "sin fecha";
  try {
    return new Date(iso).toLocaleString("es-CO", {
      timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  return isNaN(ms) ? null : Math.floor(ms / 86_400_000);
}

const ETAPA_LABELS: Record<string, string> = {
  lead_nuevo: "Lead nuevo", lead_calificado: "Lead calificado", no_contesta: "No contesta",
  hogares_propuestos: "Hogares propuestos", visitas_programadas: "Visitas programadas",
  en_decision_familiar: "En decisión familiar", escalado_nico: "Escalado a Nicolás",
  cierre_ganado: "Cierre ganado", cierre_perdido: "Cierre perdido", fallecido: "Fallecido",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  // Seguridad: solo usuarios autenticados del CRM.
  const userId = await validarUsuario(req.headers.get("Authorization"));
  if (!userId) return json({ error: "No autorizado" }, 401);

  if (!GEMINI_API_KEY) {
    return json({ error: "GEMINI_API_KEY no configurada en los secrets de Supabase" }, 500);
  }

  let leadId = "";
  try {
    const body = await req.json();
    leadId = String(body?.lead_id ?? "");
  } catch { /* body inválido */ }
  if (!leadId) return json({ error: "lead_id requerido" }, 400);

  try {
    // ---- Contexto completo del lead ----
    const [leadRows, notas, intentos, actividad, tareas, historial] = await Promise.all([
      sbGet(`leads?id=eq.${leadId}&select=*`),
      sbGet(`notas_seguimiento?lead_id=eq.${leadId}&select=tipo_seguimiento,descripcion,proxima_accion,fecha_proxima_accion,created_at&order=created_at.asc&limit=60`),
      sbGet(`intentos_contacto?lead_id=eq.${leadId}&select=canal,nota,created_at&order=created_at.asc&limit=40`),
      sbGet(`activity_log?lead_id=eq.${leadId}&select=tipo,descripcion,created_at&order=created_at.asc&limit=80`),
      sbGet(`lead_tasks?lead_id=eq.${leadId}&select=titulo,estado,fecha_vencimiento&order=created_at.asc&limit=30`),
      sbGet(`lead_etapa_historial?lead_id=eq.${leadId}&select=etapa_anterior,etapa_nueva,changed_at&order=changed_at.asc&limit=40`),
    ]);

    const lead = leadRows[0];
    if (!lead) return json({ error: "Lead no encontrado" }, 404);

    const necesidades: string[] = [];
    if (lead.deterioro_cognitivo) necesidades.push("deterioro cognitivo");
    if (lead.requiere_oxigeno) necesidades.push("requiere oxígeno");
    if (lead.requiere_enfermeria) necesidades.push("enfermería 24h");
    if (lead.requiere_acompanamiento) necesidades.push("acompañamiento");
    if (lead.ayuda_para_comer) necesidades.push("ayuda para comer");
    if (lead.ayuda_para_bano) necesidades.push("ayuda para baño");
    if (lead.ayuda_para_caminar) necesidades.push("ayuda para caminar");
    if (lead.requiere_primer_piso) necesidades.push("primer piso");
    if (lead.dieta_diabetica) necesidades.push("dieta diabética");
    if (lead.dieta_blanda) necesidades.push("dieta blanda");

    const contexto = `
=== DATOS DEL CASO ===
Adulto mayor: ${lead.nombre_adulto_mayor} (${lead.edad ?? "edad desconocida"} años, ${lead.sexo ?? "sexo n/d"})
Contacto familiar: ${lead.nombre_contacto} (${lead.parentesco ?? "parentesco n/d"})
Ciudad/zona: ${lead.ciudad ?? "n/d"} / ${lead.zona_localidad ?? "n/d"}
Presupuesto mensual: ${lead.presupuesto_mensual ? `$${Number(lead.presupuesto_mensual).toLocaleString("es-CO")} COP` : lead.presupuesto_rango ?? "n/d"}
Urgencia declarada: ${lead.urgencia ?? "n/d"} · Fecha probable de ingreso: ${lead.fecha_ingreso_estimada ?? lead.fecha_probable_ingreso ?? "n/d"}
Diagnósticos: ${lead.diagnosticos ?? "n/d"}
Necesidades: ${necesidades.length ? necesidades.join(", ") : "ninguna marcada"}
Cómo nos conoció: ${lead.como_nos_conocio ?? "n/d"}
Observaciones: ${lead.observaciones ?? "—"}

=== ESTADO COMERCIAL ===
Etapa actual: ${ETAPA_LABELS[lead.estado] ?? lead.estado}
Días desde el registro: ${diasDesde(lead.created_at) ?? "n/d"}
Días desde la última actualización: ${diasDesde(lead.updated_at) ?? "n/d"}
Próximo contacto programado: ${fmtCO(lead.proxima_contactabilidad)} (${lead.proxima_accion ?? "sin acción definida"})
Intentos fallidos de contacto: ${lead.intentos_fallidos ?? 0}
Recordatorios sin atender: ${lead.recordatorios_enviados ?? 0}${lead.escalado_supervision ? " (ESCALADO a supervisión)" : ""}

=== HISTORIAL DE ETAPAS ===
${historial.length ? historial.map((h: any) => `- ${fmtCO(h.changed_at)}: ${ETAPA_LABELS[h.etapa_anterior] ?? h.etapa_anterior ?? "(creación)"} → ${ETAPA_LABELS[h.etapa_nueva] ?? h.etapa_nueva}`).join("\n") : "(sin historial de etapas registrado)"}

=== GESTIONES (${notas.length}) ===
${notas.length ? notas.map((n: any) => `- ${fmtCO(n.created_at)} [${n.tipo_seguimiento}]: ${n.descripcion}${n.proxima_accion ? ` | Próx: ${n.proxima_accion} (${fmtCO(n.fecha_proxima_accion)})` : ""}`).join("\n") : "(sin gestiones registradas)"}

=== INTENTOS DE CONTACTO FALLIDOS (${intentos.length}) ===
${intentos.length ? intentos.map((i: any) => `- ${fmtCO(i.created_at)} [${i.canal}]: ${i.nota ?? "sin nota"}`).join("\n") : "(ninguno)"}

=== CRONOLOGÍA (${actividad.length}) ===
${actividad.map((a: any) => `- ${fmtCO(a.created_at)} [${a.tipo}]: ${a.descripcion}`).join("\n")}

=== TAREAS ===
${tareas.length ? tareas.map((t: any) => `- [${t.estado}] ${t.titulo} (vence ${fmtCO(t.fecha_vencimiento)})`).join("\n") : "(sin tareas)"}
`.trim();

    const prompt = `Eres el director comercial experto de Vínculo Dorado, empresa colombiana que ubica adultos mayores en hogares gerontológicos. El modelo de negocio: la familia contacta, se le proponen hogares acordes (presupuesto, zona, necesidades de cuidado), visitan, deciden, y al ingresar se cobra una comisión al hogar. La venta es consultiva, emocional y sensible: hablamos con familias en momentos difíciles.

Hoy es ${new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", year: "numeric", month: "long", day: "numeric" })}.

Analiza este caso REAL del CRM y responde SOLO un JSON con EXACTAMENTE estos campos:
{
  "temperatura": "caliente" | "tibio" | "frio",
  "probabilidad_cierre_pct": number,        // 0 a 100, entero, realista
  "riesgos": string[],                      // 2 a 4 riesgos concretos de perder el caso, en español
  "mejor_proxima_accion": string,           // LA acción más inteligente a ejecutar ya, específica para este caso (1-2 frases)
  "guion_sugerido": string                  // guion corto y natural en español colombiano cálido-profesional para el próximo contacto (3-6 frases, listo para leer en llamada o WhatsApp), usando los nombres reales del caso
}

Criterios: urgencia declarada y fecha de ingreso cercana suben temperatura; muchos días sin gestión, intentos fallidos o recordatorios sin atender la bajan; visitas programadas/decisión familiar son señales fuertes de cierre; presupuesto definido es buena señal. Sé honesto: si el caso está frío, dilo.

${contexto}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
        }),
      },
    );
    const geminiBody = await geminiRes.json().catch(() => null);
    if (!geminiRes.ok) {
      console.error("Gemini falló:", geminiRes.status, JSON.stringify(geminiBody).slice(0, 400));
      return json({ error: "La IA no está disponible en este momento, inténtalo en unos minutos." }, 502);
    }
    let raw: string = geminiBody?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    raw = raw.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();

    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {
      const i = raw.indexOf("{"), j = raw.lastIndexOf("}");
      if (i >= 0 && j > i) { try { parsed = JSON.parse(raw.slice(i, j + 1)); } catch { /* nada */ } }
    }
    if (!parsed || typeof parsed !== "object") {
      return json({ error: "La IA devolvió una respuesta inválida, vuelve a intentar." }, 502);
    }

    const analisis = {
      temperatura: ["caliente", "tibio", "frio"].includes(parsed.temperatura) ? parsed.temperatura : "tibio",
      probabilidad_cierre_pct: Math.max(0, Math.min(100, Math.round(Number(parsed.probabilidad_cierre_pct) || 0))),
      riesgos: Array.isArray(parsed.riesgos) ? parsed.riesgos.map(String).slice(0, 6) : [],
      mejor_proxima_accion: String(parsed.mejor_proxima_accion ?? "").trim() || "Contactar a la familia para retomar el caso.",
      guion_sugerido: String(parsed.guion_sugerido ?? "").trim(),
    };

    // ---- Cache en lead_analisis_ia ----
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/lead_analisis_ia`, {
      method: "POST",
      headers: { ...restHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        lead_id: leadId,
        generado_por: userId,
        temperatura: analisis.temperatura,
        probabilidad_cierre_pct: analisis.probabilidad_cierre_pct,
        riesgos: analisis.riesgos,
        mejor_proxima_accion: analisis.mejor_proxima_accion,
        guion_sugerido: analisis.guion_sugerido,
        modelo: GEMINI_MODEL,
      }),
    });
    const inserted = await insertRes.json().catch(() => []);
    const row = Array.isArray(inserted) ? inserted[0] : null;
    if (!insertRes.ok) console.error("No se pudo cachear el análisis:", insertRes.status, inserted);

    return json({ ok: true, analisis: row ?? { ...analisis, lead_id: leadId, created_at: new Date().toISOString() } });
  } catch (err) {
    console.error("Error en analisis-lead:", err);
    return json({ error: "Error interno generando el análisis" }, 500);
  }
});
