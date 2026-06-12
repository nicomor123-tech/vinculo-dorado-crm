// Procesa el export del Drive "Hogares Vinculo Dorado - Fotos":
//   redimensiona (~1200px lado mayor) -> webp comprimido -> bucket público
//   `hogares-fotos` de Supabase Storage -> filas en la tabla `hogar_fotos`
//   (primera foto de cada hogar = portada). Asocia carpeta<->hogar por
//   matching difuso de nombres y reporta las no matcheadas.
//
// Idempotente: re-ejecutarlo reemplaza las fotos y filas del hogar.
// Uso: node scripts/procesar-fotos.cjs
// Requiere: zip extraído en fotos-hogares/ y la tabla hogar_fotos creada (SQL2).

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const FOTOS_DIR = path.join(ROOT, 'fotos-hogares', 'Vínculo Dorado - Fotos Hogares');
const BUCKET = 'hogares-fotos';
const EXCLUIR_CARPETAS = ['vital prueba'];

// Asignaciones manuales carpeta -> hogar_id (clave: nombre de carpeta
// normalizado). Para casos donde el matching difuso empata entre sedes.
const OVERRIDES = {
  'huellas en la arena hogar gerontologico sede 134': '992c013f-34ca-4bcd-8d60-d0be7939a0dd', // Sede 134 (Lisboa, Usaquén)
  'huellas en la arena': '96134282-bb89-4974-a4de-70c346deebd3', // Sede Cedritos
};

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
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const HJ = { ...H, 'Content-Type': 'application/json' };

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

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

async function asegurarBucket() {
  const res = await fetch(`${URL_BASE}/storage/v1/bucket/${BUCKET}`, { headers: H });
  if (res.ok) { console.log(`Bucket ${BUCKET} ya existe.`); return; }
  const crear = await fetch(`${URL_BASE}/storage/v1/bucket`, {
    method: 'POST', headers: HJ,
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 10485760 }),
  });
  if (!crear.ok) throw new Error(`No se pudo crear el bucket: ${crear.status} ${await crear.text()}`);
  console.log(`Bucket ${BUCKET} creado (público).`);
}

(async () => {
  if (!fs.existsSync(FOTOS_DIR)) {
    console.error('No existe', FOTOS_DIR, '— extrae el zip de fotos primero.');
    process.exit(1);
  }
  await asegurarBucket();

  const res = await fetch(`${URL_BASE}/rest/v1/hogares?select=id,nombre&limit=1000`, { headers: HJ });
  const hogares = await res.json();
  if (!Array.isArray(hogares)) { console.error('Error leyendo hogares:', hogares); process.exit(1); }

  const carpetas = fs.readdirSync(FOTOS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !EXCLUIR_CARPETAS.includes(norm(n)));

  const sinMatch = [];
  let totalSubidas = 0;

  for (const carpeta of carpetas) {
    const nombreCarpeta = norm(carpeta);
    let mejor = null, mejorScore = 0;
    if (OVERRIDES[nombreCarpeta]) {
      mejor = hogares.find((h) => h.id === OVERRIDES[nombreCarpeta]) ?? null;
      mejorScore = mejor ? 100 : 0;
    } else {
      for (const h of hogares) {
        const s = scoreNombre(nombreCarpeta, norm(h.nombre));
        if (s > mejorScore) { mejorScore = s; mejor = h; }
      }
    }
    if (!mejor || mejorScore < 45) {
      sinMatch.push(carpeta);
      console.log(`✗ SIN MATCH [${mejorScore}] "${carpeta}"${mejor ? ` (lo más cercano: ${mejor.nombre})` : ''}`);
      continue;
    }

    const archivos = fs.readdirSync(path.join(FOTOS_DIR, carpeta))
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort();
    if (archivos.length === 0) { console.log(`— "${carpeta}": sin imágenes`); continue; }

    console.log(`✓ [${mejorScore}] "${carpeta}" -> "${mejor.nombre}" (${archivos.length} fotos)`);

    // Idempotencia: limpiar filas previas del hogar.
    await fetch(`${URL_BASE}/rest/v1/hogar_fotos?hogar_id=eq.${mejor.id}`, { method: 'DELETE', headers: HJ });

    const filas = [];
    for (let i = 0; i < archivos.length; i++) {
      const src = path.join(FOTOS_DIR, carpeta, archivos[i]);
      try {
        const buf = await sharp(src)
          .rotate()
          .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer();
        const objPath = `${mejor.id}/${i}.webp`;
        const up = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${objPath}`, {
          method: 'POST',
          headers: { ...H, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
          body: buf,
        });
        if (!up.ok) {
          console.error(`   foto ${archivos[i]} falló al subir: ${up.status} ${await up.text()}`);
          continue;
        }
        filas.push({
          hogar_id: mejor.id,
          url: `${URL_BASE}/storage/v1/object/public/${BUCKET}/${objPath}`,
          orden: i,
          es_portada: filas.length === 0,
        });
        totalSubidas++;
      } catch (e) {
        console.error(`   foto ${archivos[i]} no se pudo procesar:`, e.message);
      }
    }

    if (filas.length) {
      const ins = await fetch(`${URL_BASE}/rest/v1/hogar_fotos`, {
        method: 'POST', headers: { ...HJ, Prefer: 'return=minimal' }, body: JSON.stringify(filas),
      });
      if (!ins.ok) console.error(`   INSERT hogar_fotos falló: ${ins.status} ${await ins.text()}`);
      else console.log(`   ${filas.length} fotos en Storage + BD (portada: foto 0)`);
    }
  }

  console.log(`\nTOTAL: ${totalSubidas} fotos subidas. Carpetas sin match: ${sinMatch.length}`);
  if (sinMatch.length) sinMatch.forEach((c) => console.log(`  - ${c}`));
})().catch((e) => { console.error(e); process.exit(1); });
