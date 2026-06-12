// Enriquece la tabla `hogares` de Supabase con los datos del Excel original
// del Drive ("HOGARES VINVULO DORADO.xlsx", viene dentro del zip de fotos).
// SOLO llena campos vacíos en la BD (no pisa datos ya curados en el CRM).
//
// Uso:  node scripts/enriquecer-hogares.cjs
// Lee SUPABASE_SERVICE_ROLE_KEY y VITE_SUPABASE_URL del .env del proyecto.

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const EXCEL = path.join(ROOT, 'fotos-hogares', 'HOGARES VINVULO DORADO.xlsx');

function leerEnv() {
  const env = {};
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  });
  return env;
}
const ENV = leerEnv();
const URL_BASE = ENV.VITE_SUPABASE_URL;
const KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Filas del Excel que son pruebas/basura.
const BASURA = ['prueba', 'prubea', 'vitalprueba', 'vital prueba', 'nicolasito', '12312', 'error de servicio drive', 'neurovital'];
// (Neurovital se excluye: su fila tiene las columnas corridas en el Excel.)

// Normalización de zonas del Excel a localidades reales.
const ZONAS = {
  'suba': 'Suba', 'niza': 'Suba', 'niza antigua': 'Suba', 'nizq': 'Suba', 'pasadena': 'Suba',
  'cedritos': 'Usaquén', 'usaquen': 'Usaquén',
  'salitre': 'Teusaquillo', '12 barrios unidos': 'Barrios Unidos', 'barrios unidos': 'Barrios Unidos',
  'kennedy': 'Kennedy', 'chia cund': 'Chía', 'chia': 'Chía', 'sesquile': 'Sesquilé',
  'bogota': null, // demasiado genérico: inferir del barrio
};
const BARRIO_A_LOCALIDAD = {
  'lisboa': 'Usaquén', 'prado veraniego': 'Suba', 'santa barbara': 'Usaquén',
  'mandalay': 'Kennedy', 'san martin norte': 'Barrios Unidos', 'ilarco': 'Suba',
  'las villas': 'Suba', 'tierra linda': 'Suba', 'salitre greco': 'Teusaquillo',
};

function localidadDe(zonaRaw, barrioRaw) {
  const z = norm(zonaRaw);
  if (z && Object.prototype.hasOwnProperty.call(ZONAS, z) && ZONAS[z]) return ZONAS[z];
  if (z && !Object.prototype.hasOwnProperty.call(ZONAS, z) && z.length >= 3) {
    return String(zonaRaw).trim().replace(/^./, (c) => c.toUpperCase());
  }
  const b = norm(barrioRaw);
  for (const [k, v] of Object.entries(BARRIO_A_LOCALIDAD)) if (b.includes(k)) return v;
  return null;
}

function filasReales() {
  const wb = XLSX.readFile(EXCEL);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const reales = rows.filter((r) => {
    const n = norm(r['Nombre Hogar']);
    if (!n || n.length < 4) return false;
    if (BASURA.some((b) => n.includes(b))) return false;
    const precio = Number(r['Precio Desde']);
    if (!precio || precio < 800_000 || precio > 30_000_000) return false;
    return true;
  });
  // Dedup por nombre: la ÚLTIMA fila gana (suele ser la corrección).
  const porNombre = new Map();
  reales.forEach((r) => porNombre.set(norm(r['Nombre Hogar']), r));
  return [...porNombre.values()];
}

function scoreNombre(a, b) {
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const ta = new Set(a.split(' ').filter((t) => t.length >= 3));
  const tb = new Set(b.split(' ').filter((t) => t.length >= 3));
  if (!ta.size || !tb.size) return 0;
  let comunes = 0;
  ta.forEach((t) => { if (tb.has(t)) comunes++; });
  return Math.round((comunes / Math.max(ta.size, tb.size)) * 70);
}

const SERV_MAP = {
  'enfermeria 24h': 'serv_enfermeria_24h', 'fisioterapia': 'serv_fisioterapia',
  'terapia ocupacional': 'serv_terapia_ocupacional', 'nutricion': 'serv_nutricion',
  'psicologia': 'serv_psicologia', 'actividades recreativas': 'serv_actividades_recreativas',
  'transporte': 'serv_transporte', 'medicina general': 'serv_medicina_general',
  'fonoaudiologia': 'serv_fonoaudiologia', 'trabajo social': 'serv_trabajo_social',
};

(async () => {
  if (!fs.existsSync(EXCEL)) {
    console.error('No está el Excel en', EXCEL, '— extrae primero el zip de fotos.');
    process.exit(1);
  }
  const excel = filasReales();
  console.log(`Filas reales del Excel (dedup): ${excel.length}`);

  const res = await fetch(`${URL_BASE}/rest/v1/hogares?select=*&limit=1000`, { headers: HEADERS });
  const hogares = await res.json();
  if (!Array.isArray(hogares)) { console.error('Error leyendo hogares:', hogares); process.exit(1); }
  console.log(`Hogares en BD: ${hogares.length}`);

  const reporte = { actualizados: [], sinMatch: [] };

  for (const fila of excel) {
    const nombreExcel = norm(fila['Nombre Hogar']);
    let mejor = null, mejorScore = 0;
    for (const h of hogares) {
      const s = scoreNombre(nombreExcel, norm(h.nombre));
      if (s > mejorScore) { mejorScore = s; mejor = h; }
    }
    if (!mejor || mejorScore < 45) {
      reporte.sinMatch.push(String(fila['Nombre Hogar']).trim());
      continue;
    }

    const patch = {};
    const precioDesde = Number(fila['Precio Desde']) || null;
    const precioHasta = Number(fila['Precio Hasta']) || null;
    if (!mejor.precio_desde && precioDesde) patch.precio_desde = precioDesde;
    if (!mejor.precio_hasta && precioHasta && precioHasta >= (precioDesde ?? 0)) patch.precio_hasta = precioHasta;

    const loc = localidadDe(fila['Zona / Localidad'], fila['Barrio']);
    if ((!mejor.localidad || !mejor.localidad.trim()) && loc) patch.localidad = loc;
    if ((!mejor.barrio || !mejor.barrio.trim()) && String(fila['Barrio'] ?? '').trim()) patch.barrio = String(fila['Barrio']).trim();

    const cupos = parseInt(fila['Hab. Disponibles']);
    if (mejor.habitaciones_disponibles == null && Number.isFinite(cupos)) patch.habitaciones_disponibles = cupos;
    const cap = parseInt(fila['Capacidad Total']);
    if (mejor.capacidad_total == null && Number.isFinite(cap)) patch.capacidad_total = cap;

    const servicios = norm(fila['Servicios']);
    for (const [token, col] of Object.entries(SERV_MAP)) {
      if (servicios.includes(token) && !mejor[col]) patch[col] = true;
    }
    if (norm(fila['Oxígeno Domiciliario']) === 'si' && !mejor.maneja_oxigeno) patch.maneja_oxigeno = true;

    const acc = norm(fila['Accesibilidad']);
    if (acc.includes('ascensor') && !mejor.tiene_ascensor) patch.tiene_ascensor = true;
    if (acc.includes('solo escaleras') && !mejor.solo_escaleras) patch.solo_escaleras = true;
    if (acc.includes('un solo nivel') && !mejor.un_solo_nivel) patch.un_solo_nivel = true;

    const dietas = norm(fila['Dietas Especiales']);
    if (dietas.includes('blanda') && !mejor.dieta_blanda) patch.dieta_blanda = true;
    if ((dietas.includes('hipogluc') || dietas.includes('diabet')) && !mejor.dieta_diabetica) patch.dieta_diabetica = true;
    if (dietas.includes('hiposod') && !mejor.dieta_hiposodica) patch.dieta_hiposodica = true;
    if (dietas.includes('renal') && !mejor.dieta_renal) patch.dieta_renal = true;

    const desc = String(fila['Descripción'] ?? '').trim();
    if ((!mejor.descripcion || mejor.descripcion.trim().length < 20) && desc.length >= 20) patch.descripcion = desc.slice(0, 1200);
    const wa = String(fila['WhatsApp'] ?? '').replace(/\D/g, '');
    if (!mejor.whatsapp && wa.length >= 7) patch.whatsapp = wa;
    const correo = String(fila['Email'] ?? '').trim();
    if (!mejor.correo && correo.includes('@')) patch.correo = correo;
    const respo = String(fila['Contacto'] ?? '').trim();
    if (!mejor.nombre_responsable && respo.length >= 3 && !respo.includes('@')) patch.nombre_responsable = respo;
    const web = String(fila['Website'] ?? '').trim();
    if (!mejor.pagina_web && web.startsWith('http')) patch.pagina_web = web;

    if (Object.keys(patch).length === 0) {
      reporte.actualizados.push({ excel: String(fila['Nombre Hogar']).trim(), bd: mejor.nombre, score: mejorScore, campos: '(ya completo)' });
      continue;
    }
    patch.updated_at = new Date().toISOString();

    const up = await fetch(`${URL_BASE}/rest/v1/hogares?id=eq.${mejor.id}`, {
      method: 'PATCH', headers: { ...HEADERS, Prefer: 'return=minimal' }, body: JSON.stringify(patch),
    });
    if (!up.ok) {
      console.error(`PATCH falló para ${mejor.nombre}:`, up.status, await up.text());
      continue;
    }
    reporte.actualizados.push({ excel: String(fila['Nombre Hogar']).trim(), bd: mejor.nombre, score: mejorScore, campos: Object.keys(patch).filter(k => k !== 'updated_at').join(',') });
  }

  console.log('\n=== ACTUALIZADOS ===');
  reporte.actualizados.forEach((a) => console.log(`✓ [${a.score}] "${a.excel}" -> "${a.bd}" :: ${a.campos}`));
  console.log('\n=== SIN MATCH EN BD ===');
  reporte.sinMatch.forEach((s) => console.log(`✗ ${s}`));
  console.log(`\nTotal: ${reporte.actualizados.length} actualizados, ${reporte.sinMatch.length} sin match.`);
})().catch((e) => { console.error(e); process.exit(1); });
