// Genera la web pública de hogares (estática) desde Supabase — VERSIÓN
// ANONIMIZADA: protege la comisión del negocio. En el HTML público NUNCA
// aparecen el nombre real del hogar, dirección, barrio, teléfono, correo,
// web del hogar ni links de Drive. Cada hogar se muestra como
// "Hogar en {localidad} #{N}" (N = hogares.codigo_publico, estable).
//
//   web-dist/index.html                  -> HOME nueva (hero, buscador vivo,
//                                           destacados, pasos, testimonios, FAQ)
//   web-dist/hogares/index.html          -> listado con filtros en vivo
//   web-dist/hogar/{localidad}-{N}.html  -> página anónima por hogar
//   web-dist/hogares/zona/{slug}.html    -> página por localidad
//   web-dist/sitemap.xml + robots-PARA-FUSIONAR.txt
//
// Regenerar: node scripts/generar-web.cjs  -> subir web-dist/ a cPanel.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'web-dist');
const SITE = 'https://hogaresgerontologicos.com';

// ÚNICO lugar donde vive el WhatsApp del negocio. Cuando el número nuevo
// (322...) esté activo en WhatsApp Business, se cambia AQUÍ y se regenera.
const WHATSAPP_NEGOCIO = '573105577095';

const ANIO = new Date().getFullYear();
const OG_MARCA = 'https://aprydldykaikaftxqpwq.supabase.co/storage/v1/object/public/hogares-fotos/marca/og-default.webp';

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
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'bogota';
const cop = (v) => v ? `$${Number(v).toLocaleString('es-CO')}` : null;
const normTxt = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ---------------------------------------------------------------------------
// ANONIMIZACIÓN
// ---------------------------------------------------------------------------

const GENERICAS = new Set(['hogar', 'casa', 'geriatrico', 'gerontologico', 'centro', 'club', 'vital', 'senior', 'living', 'adulto', 'mayor', 'para', 'los', 'las', 'del', 'mi', 'en', 'de', 'la', 'el']);

function zonaPublica(h) {
  return (h.localidad && h.localidad.trim()) ? h.localidad.trim() : 'Bogotá';
}
function nombrePublico(h) {
  return `Hogar en ${zonaPublica(h)} #${h.codigo_publico}`;
}
function slugPublico(h) {
  return `${slug(zonaPublica(h))}-${h.codigo_publico}`;
}

// Limpia la descripción para la web pública: fuera URLs, fuera el nombre real
// (y sus palabras identificables), teléfonos y correos. Defensa en código
// además de la limpieza ya hecha en SQL.
function descripcionPublica(h) {
  let d = String(h.descripcion ?? '');
  if (!d.trim()) return null;
  d = d.replace(/Fotos:\s*https?:\/\/\S+/gi, ' ');
  d = d.replace(/https?:\/\/\S+/gi, ' ');
  d = d.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ');
  d = d.replace(/(\+?57)?[\s.-]?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/g, ' ');
  // Tokens identificables del nombre real Y del barrio (>=4 letras, no genéricos):
  // si la descripción dice "estamos en {barrio}", también delata.
  const tokens = `${normTxt(h.nombre)} ${normTxt(h.barrio)} ${normTxt(h.direccion)}`
    .split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !GENERICAS.has(t));
  for (const t of [...new Set(tokens)]) {
    d = d.replace(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), 'la zona');
  }
  d = d.replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim();
  if (d.length < 25) return null;
  return d.slice(0, 600);
}

function serviciosDe(h) {
  const s = [];
  if (h.serv_enfermeria_24h) s.push('Enfermería 24h');
  if (h.serv_medicina_general) s.push('Medicina general');
  if (h.serv_fisioterapia) s.push('Fisioterapia');
  if (h.serv_terapia_ocupacional) s.push('Terapia ocupacional');
  if (h.serv_psicologia) s.push('Psicología');
  if (h.serv_nutricion) s.push('Nutrición');
  if (h.serv_actividades_recreativas) s.push('Actividades recreativas');
  if (h.serv_fonoaudiologia) s.push('Fonoaudiología');
  if (h.serv_trabajo_social) s.push('Trabajo social');
  if (h.serv_transporte) s.push('Transporte');
  if (h.maneja_oxigeno) s.push('Oxígeno domiciliario');
  return s;
}
function dietasDe(h) {
  const d = [];
  if (h.dieta_blanda) d.push('blanda');
  if (h.dieta_diabetica) d.push('para diabéticos');
  if (h.dieta_hiposodica) d.push('hiposódica');
  if (h.dieta_renal) d.push('renal');
  return d;
}
function accesibilidadDe(h) {
  const a = [];
  if (h.un_solo_nivel) a.push('Un solo nivel (sin escaleras)');
  if (h.tiene_ascensor) a.push('Ascensor');
  if (h.solo_escaleras) a.push('Acceso por escaleras');
  if (h.maneja_silla_ruedas) a.push('Apto silla de ruedas');
  return a;
}
function tipoLabel(h) {
  return (h.tipo_servicio === 'centro_dia') ? 'Centro día' : 'Hogar gerontológico';
}
function rangoPresupuesto(h) {
  const p = h.precio_desde ?? 0;
  if (!p) return 'sin-precio';
  if (p < 2_500_000) return 'bajo';
  if (p < 4_000_000) return 'medio';
  if (p < 6_000_000) return 'alto';
  return 'premium';
}
function waLink(mensaje) {
  return `https://wa.me/${WHATSAPP_NEGOCIO}?text=${encodeURIComponent(mensaje)}`;
}

// ---------------------------------------------------------------------------
// CSS compartido
// ---------------------------------------------------------------------------
const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{--negro:#1a1a1a;--gold:#c9a84c;--gold-claro:#e8c66b;--gold-suave:#f5edda;--gris:#6b7280;--crema:#faf8f5;--radius:16px}
html{scroll-behavior:smooth}
body{font-family:'DM Sans',system-ui,sans-serif;color:#1a2b3c;background:var(--crema);line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit}
.nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.97);backdrop-filter:blur(10px);box-shadow:0 2px 16px rgba(26,26,26,.06);padding:14px 20px}
.nav-in{max-width:1140px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:700;font-size:17px;color:var(--negro)}
.logo .mk{width:34px;height:34px;background:var(--negro);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Playfair Display',serif}
.nav-cta{background:var(--gold);color:var(--negro);padding:9px 18px;border-radius:100px;font-weight:700;font-size:13px;text-decoration:none;white-space:nowrap}
.wrap{max-width:1140px;margin:0 auto;padding:28px 20px 60px}
h1{font-family:'Playfair Display',serif;font-size:clamp(26px,4.5vw,42px);color:var(--negro);line-height:1.16;margin-bottom:10px}
h1 em,h2 em{font-style:italic;color:var(--gold)}
.sub{color:var(--gris);font-size:15px;max-width:640px;margin-bottom:22px}
.filtros{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 10px}
.filtros select{padding:11px 14px;border:2px solid #e8e4dc;border-radius:12px;background:#fff;font-size:14px;font-family:inherit;color:var(--negro);min-width:150px;flex:1}
.contador{font-size:13.5px;color:var(--gris);font-weight:600;margin:0 0 18px}
.contador b{color:var(--gold);font-size:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.card{background:#fff;border-radius:var(--radius);overflow:hidden;box-shadow:0 4px 20px rgba(26,26,26,.06);border:1px solid rgba(26,26,26,.05);display:flex;flex-direction:column;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-4px);box-shadow:0 12px 34px rgba(26,26,26,.13)}
.card .ph{position:relative;height:190px;background:#eee}
.card .ph img{width:100%;height:100%;object-fit:cover;display:block}
.sinfoto{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#23282e,#1a1a1a);color:var(--gold-claro)}
.sinfoto svg{width:42px;height:42px;opacity:.9}
.sinfoto span{font-size:11.5px;font-weight:600;letter-spacing:.4px;color:rgba(232,198,107,.85)}
.card .precio{position:absolute;top:10px;right:10px;background:rgba(255,255,255,.95);border-radius:10px;padding:5px 10px;font-size:12px;font-weight:700;color:var(--negro)}
.card .precio small{display:block;font-weight:500;color:var(--gris);font-size:9px;text-transform:uppercase;letter-spacing:.5px}
.card .verificado{position:absolute;top:10px;left:10px;background:var(--gold);color:var(--negro);border-radius:100px;padding:4px 10px;font-size:10.5px;font-weight:800;letter-spacing:.3px}
.card .bd{padding:16px;display:flex;flex-direction:column;gap:8px;flex:1}
.card h3{font-size:16.5px;color:var(--negro);line-height:1.3;font-family:'Playfair Display',serif}
.card .zona{font-size:13px;color:var(--gris)}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chip{background:var(--gold-suave);color:#7a6020;font-size:11px;font-weight:600;padding:3px 9px;border-radius:100px}
.card .ver{margin-top:auto;text-align:center;background:var(--negro);color:#fff;padding:11px;border-radius:11px;font-size:13.5px;font-weight:700;text-decoration:none;transition:background .2s}
.card .ver:hover{background:#000}
.btn-wa{display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;padding:14px 26px;border-radius:100px;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 6px 18px rgba(37,211,102,.3);transition:transform .2s}
.btn-wa:hover{transform:translateY(-2px)}
.btn-sec{display:inline-flex;align-items:center;gap:8px;background:#fff;color:var(--negro);padding:14px 26px;border-radius:100px;font-weight:700;font-size:15px;text-decoration:none;border:2px solid var(--negro);transition:all .2s}
.btn-sec:hover{background:var(--negro);color:#fff}
.gal{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}
.gal img{width:100%;height:90px;object-fit:cover;border-radius:10px;cursor:pointer;border:2px solid transparent}
.gal img.on{border-color:var(--gold)}
.hero-img{width:100%;height:clamp(220px,40vw,420px);object-fit:cover;border-radius:18px;background:#eee}
.hero-sinfoto{width:100%;height:clamp(200px,32vw,320px);border-radius:18px}
.ficha{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:20px 0}
.dato{background:#fff;border-radius:14px;padding:14px;border:1px solid rgba(26,26,26,.06)}
.dato b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--gris);font-weight:600;margin-bottom:3px}
.dato span{font-size:15px;font-weight:700;color:var(--negro)}
.sec{background:#fff;border-radius:18px;padding:22px;margin:16px 0;border:1px solid rgba(26,26,26,.05)}
.sec h2{font-family:'Playfair Display',serif;font-size:21px;color:var(--negro);margin-bottom:12px}
.privacidad{background:var(--gold-suave);border:1.5px dashed var(--gold);border-radius:14px;padding:14px 16px;font-size:13.5px;color:#6d5618;margin:14px 0}
.cta-final{background:var(--negro);border-radius:20px;padding:36px 24px;text-align:center;color:#fff;margin-top:28px}
.cta-final h2{font-family:'Playfair Display',serif;font-size:25px;margin-bottom:8px}
.cta-final p{color:rgba(255,255,255,.65);font-size:14px;margin-bottom:18px}
.migas{font-size:12.5px;color:var(--gris);margin-bottom:14px}
.migas a{color:var(--gris);text-decoration:none}
.migas a:hover{color:var(--negro)}
.footer{background:var(--negro);color:rgba(255,255,255,.55);padding:34px 20px;margin-top:40px}
.footer-in{max-width:1140px;margin:0 auto;display:flex;flex-wrap:wrap;gap:18px;justify-content:space-between;align-items:center;font-size:13.5px}
.footer a{color:var(--gold-claro);text-decoration:none}
.vacio{text-align:center;color:var(--gris);padding:50px 0;display:none}
.fade{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease}
.fade.in{opacity:1;transform:none}
@media(max-width:560px){.gal{grid-template-columns:repeat(3,1fr)}.gal img{height:74px}}
@media(prefers-reduced-motion:reduce){.fade{opacity:1;transform:none;transition:none}}
`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">`;

const SVG_CASA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>`;

function bloqueSinFoto(extraClase = '') {
  return `<div class="sinfoto ${extraClase}">${SVG_CASA}<span>Fotos disponibles en la asesoría</span></div>`;
}

function nav() {
  return `<nav class="nav"><div class="nav-in">
  <a class="logo" href="${SITE}/"><span class="mk">V</span>Vínculo Dorado</a>
  <div style="display:flex;gap:10px;align-items:center">
    <a href="${SITE}/hogares/" style="font-size:13.5px;font-weight:600;color:var(--gris);text-decoration:none">Hogares</a>
    <a class="nav-cta" href="${SITE}/contacto-familias.html">Asesoría gratuita →</a>
  </div>
</div></nav>`;
}

function footer() {
  return `<div class="footer"><div class="footer-in">
  <div><strong style="color:#fff;font-family:'Playfair Display',serif;font-size:16px">Vínculo Dorado</strong><br>Red de hogares gerontológicos verificados en Bogotá · © ${ANIO}</div>
  <div><a href="${waLink('Hola, busco un hogar geriátrico en Bogotá y quiero asesoría')}">💬 WhatsApp: 310 557 7095</a><br><a href="${SITE}/hogares/">Ver hogares</a> · <a href="${SITE}/contacto-familias.html">Asesoría gratuita</a></div>
</div></div>`;
}

const FADE_JS = `<script>
(function(){
  if(!('IntersectionObserver' in window))return;
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
  document.querySelectorAll('.fade').forEach(function(el){io.observe(el);});
})();
</script>`;

function pagina({ titulo, descripcion, canonical, ogImage, jsonLd, cuerpo, extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Vínculo Dorado">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
<style>${CSS}</style>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
${extraHead}
</head>
<body>
${nav()}
${cuerpo}
${footer()}
${FADE_JS}
</body>
</html>`;
}

function cardHogar(h, fotos) {
  const portada = fotos.find((f) => f.es_portada)?.url ?? fotos[0]?.url ?? null;
  const np = nombrePublico(h);
  const servs = serviciosDe(h).slice(0, 3);
  const cupos = (h.habitaciones_disponibles ?? 0) > 0 ? `${h.habitaciones_disponibles} cupo${h.habitaciones_disponibles !== 1 ? 's' : ''}` : null;
  return `<article class="card fade" data-zona="${esc(slug(zonaPublica(h)))}" data-presupuesto="${rangoPresupuesto(h)}" data-tipo="${h.tipo_servicio === 'centro_dia' ? 'centro_dia' : 'gerontologico'}" data-foto="${portada ? '1' : '0'}">
  <div class="ph">${portada
    ? `<img src="${portada}" alt="${esc(np)} — ${tipoLabel(h).toLowerCase()} verificado" loading="lazy">`
    : bloqueSinFoto()}
    <div class="verificado">✓ VERIFICADO</div>
    ${h.precio_desde ? `<div class="precio"><small>Desde</small>${cop(h.precio_desde)}/mes</div>` : ''}</div>
  <div class="bd">
    <h3>${esc(np)}</h3>
    <p class="zona">📍 ${esc(zonaPublica(h))} · ${tipoLabel(h)}${cupos ? ` · ${cupos}` : ''}</p>
    ${servs.length ? `<div class="chips">${servs.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>` : ''}
    <a class="ver" href="${SITE}/hogar/${slugPublico(h)}.html">Ver este hogar →</a>
  </div>
</article>`;
}

// Orden público: con foto real primero; luego más cupos; luego menor precio.
function ordenPublico(a, b, fotosPor) {
  const fa = (fotosPor.get(a.id) ?? []).length > 0 ? 1 : 0;
  const fb = (fotosPor.get(b.id) ?? []).length > 0 ? 1 : 0;
  if (fa !== fb) return fb - fa;
  const ca = a.habitaciones_disponibles ?? 0, cb = b.habitaciones_disponibles ?? 0;
  if (ca !== cb) return cb - ca;
  return (a.precio_desde ?? 99e6) - (b.precio_desde ?? 99e6);
}

// ---------------------------------------------------------------------------

(async () => {
  const [hogaresRes, fotosRes] = await Promise.all([
    fetch(`${URL_BASE}/rest/v1/hogares?estado=in.(activo,aprobado)&select=*&limit=1000`, { headers: H }),
    fetch(`${URL_BASE}/rest/v1/hogar_fotos?select=hogar_id,url,orden,es_portada&order=orden.asc&limit=5000`, { headers: H }),
  ]);
  const hogaresRaw = await hogaresRes.json();
  let fotosAll = await fotosRes.json();
  if (!Array.isArray(hogaresRaw)) { console.error('Error hogares:', hogaresRaw); process.exit(1); }
  if (!Array.isArray(fotosAll)) fotosAll = [];

  const sinCodigo = hogaresRaw.filter((h) => h.codigo_publico == null);
  if (sinCodigo.length) {
    console.error(`ABORTADO: ${sinCodigo.length} hogares sin codigo_publico — correr SQL3 primero.`);
    process.exit(1);
  }

  const fotosPor = new Map();
  fotosAll.forEach((f) => {
    const arr = fotosPor.get(f.hogar_id) ?? [];
    arr.push(f);
    fotosPor.set(f.hogar_id, arr);
  });

  const hogares = [...hogaresRaw].sort((a, b) => ordenPublico(a, b, fotosPor));
  const conFoto = hogares.filter((h) => (fotosPor.get(h.id) ?? []).length > 0);

  // Vaciar el contenido sin borrar la carpeta raíz (en Windows puede tener
  // un handle abierto por el explorador/preview y rmSync de la raíz falla).
  if (fs.existsSync(OUT)) {
    for (const e of fs.readdirSync(OUT)) {
      fs.rmSync(path.join(OUT, e), { recursive: true, force: true });
    }
  }
  fs.mkdirSync(path.join(OUT, 'hogares', 'zona'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'hogar'), { recursive: true });

  const urls = [];
  const localidades = [...new Set(hogares.map((h) => h.localidad).filter((l) => l && l.trim()))].sort();

  // ----------------- HOME (web-dist/index.html) -----------------
  const datosBuscador = hogares.map((h) => ({
    z: slug(zonaPublica(h)), p: rangoPresupuesto(h),
    t: h.tipo_servicio === 'centro_dia' ? 'centro_dia' : 'gerontologico',
  }));
  const portadasHero = conFoto.slice(0, 6).map((h) => (fotosPor.get(h.id) ?? []).find((f) => f.es_portada)?.url).filter(Boolean);
  const destacados = conFoto.slice(0, 8);

  const PASOS = [
    { n: '01', t: 'Contáctenos', d: 'Escríbanos por WhatsApp o llámenos. Un asesor clínico entiende las necesidades específicas de su familiar.', i: '💬' },
    { n: '02', t: 'Preselección', d: 'Seleccionamos 2-3 hogares verificados que se ajustan al perfil clínico, ubicación y presupuesto de su familia.', i: '🎯' },
    { n: '03', t: 'Visita presencial', d: 'Lo acompañamos a conocer cada hogar. Evaluamos juntos instalaciones, equipo humano y calidad del cuidado.', i: '🏡' },
    { n: '04', t: 'Seguimiento', d: 'Una vez ingresa su familiar, hacemos seguimiento durante la adaptación para garantizar su bienestar.', i: '🤝' },
  ];
  const TESTIMONIOS = [
    { txt: 'Estábamos perdidos buscando un lugar para mi mamá. Vínculo Dorado nos llevó de la mano hasta encontrar el hogar perfecto. En una semana teníamos todo resuelto.', quien: 'Carolina M.', det: 'Hija · Suba' },
    { txt: 'Lo que más nos gustó fue la transparencia. Nos mostraron todo: precios reales, fotos del lugar, nos acompañaron a la visita. Cero presión, pura asesoría.', quien: 'Roberto L.', det: 'Hijo · Usaquén' },
    { txt: 'Mi papá necesitaba un centro día con fisioterapia. Nos recomendaron tres opciones y las tres eran excelentes. Se nota que conocen cada hogar personalmente.', quien: 'Andrea P.', det: 'Hija · Chapinero' },
  ];
  const FAQS = [
    { p: '¿El servicio realmente es gratuito?', r: 'Sí, 100% gratuito para las familias. Nuestro servicio de asesoría, acompañamiento a visitas y seguimiento no tiene ningún costo. Nos financiamos a través de acuerdos comerciales con los hogares de nuestra red.' },
    { p: '¿Cómo verifican los hogares?', r: 'Nuestro equipo clínico (enfermeros y neuropsicólogos) visita cada hogar personalmente. Evaluamos instalaciones, protocolos de seguridad, calidad del personal, alimentación y estado de habilitación ante la Secretaría de Salud.' },
    { p: '¿Cuánto cuesta en promedio un hogar geriátrico en Bogotá?', r: `Los precios varían según la zona, servicios y nivel de dependencia. En promedio, un hogar geriátrico en Bogotá va desde $2.500.000 hasta $8.000.000 mensuales. Nosotros le ayudamos a encontrar opciones dentro de su presupuesto.` },
    { p: '¿Cuánto tiempo toma el proceso?', r: 'Depende de cada familia. Normalmente, desde el primer contacto hasta la decisión final pasan entre 3 y 10 días. En casos urgentes podemos agilizar el proceso en 24-48 horas.' },
    { p: '¿Qué diferencia hay entre un hogar geriátrico y un centro día?', r: 'Un hogar geriátrico es residencial: el adulto mayor vive allí 24/7 con atención integral. Un centro día es para personas que solo necesitan acompañamiento durante el día (generalmente 7am-5pm) y regresan a casa en la noche.' },
    { p: '¿Puedo visitar el hogar antes de decidir?', r: 'Por supuesto, es lo que recomendamos. Nosotros coordinamos la visita y lo acompañamos. Así puede ver las instalaciones, conocer al equipo y resolver todas sus dudas presencialmente.' },
    { p: '¿Por qué no aparece el nombre del hogar en la página?', r: 'Para garantizar un proceso ordenado y seguro: cada hogar de la red se presenta con su código. En la asesoría gratuita le entregamos el nombre, la dirección y coordinamos la visita con acompañamiento de nuestro equipo clínico.' },
  ];

  const CSS_HOME = `
.hero{position:relative;overflow:hidden;background:var(--negro);color:#fff}
.hero-bg{position:absolute;inset:0}
.hero-bg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.4s ease}
.hero-bg img.on{opacity:.34}
.hero-grad{position:absolute;inset:0;background:linear-gradient(110deg,rgba(20,20,20,.94) 35%,rgba(20,20,20,.55))}
.hero-in{position:relative;max-width:1140px;margin:0 auto;padding:clamp(54px,9vw,110px) 20px}
.hero h1{color:#fff;max-width:640px;font-size:clamp(30px,5.2vw,52px)}
.hero p{color:rgba(255,255,255,.75);max-width:520px;font-size:clamp(15px,2vw,17.5px);margin:14px 0 26px}
.hero .ctas{display:flex;gap:12px;flex-wrap:wrap}
.badge-hero{display:inline-flex;align-items:center;gap:8px;background:rgba(201,168,76,.16);border:1px solid rgba(201,168,76,.45);color:var(--gold-claro);padding:7px 16px;border-radius:100px;font-size:12.5px;font-weight:700;letter-spacing:.4px;margin-bottom:18px}
.buscador{background:#fff;border-radius:20px;box-shadow:0 18px 50px rgba(26,26,26,.16);padding:20px;max-width:1140px;margin:-44px auto 0;position:relative;z-index:5}
.buscador .fila{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.buscador select{padding:13px 14px;border:2px solid #ece7dd;border-radius:12px;font-size:14px;font-family:inherit;color:var(--negro);background:#fdfcf9}
.buscador .go{background:var(--negro);color:#fff;border:none;border-radius:12px;font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .2s}
.buscador .go:hover{background:#000}
.buscador .nres{margin-top:10px;font-size:13px;color:var(--gris);text-align:center}
.buscador .nres b{color:var(--gold);font-size:15px}
.seccion{max-width:1140px;margin:0 auto;padding:56px 20px 0}
.seccion h2{font-family:'Playfair Display',serif;font-size:clamp(23px,3.4vw,32px);color:var(--negro);margin-bottom:8px}
.seccion .lead{color:var(--gris);font-size:14.5px;max-width:560px;margin-bottom:26px}
.pasos{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.paso{background:#fff;border-radius:16px;padding:22px;border:1px solid rgba(26,26,26,.05);position:relative}
.paso .num{font-family:'Playfair Display',serif;font-size:38px;color:var(--gold-suave);position:absolute;top:12px;right:18px;font-weight:700}
.paso .ico{font-size:26px;margin-bottom:10px}
.paso h3{font-size:16px;color:var(--negro);margin-bottom:6px}
.paso p{font-size:13.5px;color:var(--gris)}
.porque{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.pq{background:linear-gradient(160deg,#fff,#fdf9ef);border:1px solid rgba(201,168,76,.25);border-radius:16px;padding:20px}
.pq h3{font-size:15.5px;margin-bottom:6px;color:var(--negro)}
.pq p{font-size:13.5px;color:var(--gris)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;background:var(--negro);border-radius:20px;padding:28px 22px}
.stat{text-align:center;color:#fff}
.stat b{display:block;font-family:'Playfair Display',serif;font-size:clamp(30px,4.5vw,44px);color:var(--gold-claro)}
.stat span{font-size:12.5px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.6px}
.testis{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.testi{background:#fff;border-radius:16px;padding:22px;border:1px solid rgba(26,26,26,.05)}
.testi .stars{color:var(--gold);letter-spacing:2px;margin-bottom:10px}
.testi p{font-size:14px;color:#374151;font-style:italic}
.testi .quien{margin-top:12px;font-size:13px;font-weight:700;color:var(--negro)}
.testi .quien small{display:block;color:var(--gris);font-weight:500}
.faq details{background:#fff;border:1px solid rgba(26,26,26,.07);border-radius:14px;padding:16px 18px;margin-bottom:10px}
.faq summary{font-weight:700;font-size:14.5px;color:var(--negro);cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px}
.faq summary::after{content:'+';font-size:20px;color:var(--gold);transition:transform .2s}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq details p{margin-top:10px;font-size:13.5px;color:var(--gris)}
`;

  const homeBody = `
<header class="hero">
  <div class="hero-bg" id="heroBg">${portadasHero.map((u, i) => `<img src="${u}" alt="" ${i === 0 ? 'class="on"' : 'loading="lazy"'}>`).join('')}</div>
  <div class="hero-grad"></div>
  <div class="hero-in">
    <span class="badge-hero">✓ ${hogares.length} hogares verificados en persona</span>
    <h1>Encontramos el hogar gerontológico <em>ideal</em> para tu ser querido</h1>
    <p>Asesoría clínica 100% gratuita en Bogotá: te recomendamos hogares verificados según salud, zona y presupuesto, te acompañamos a la visita y hacemos seguimiento.</p>
    <div class="ctas">
      <a class="btn-wa" href="${waLink('Hola, busco un hogar geriátrico para mi familiar y quiero asesoría gratuita')}">💬 Hablar con un asesor</a>
      <a class="btn-sec" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.5)" href="${SITE}/hogares/">Ver hogares →</a>
    </div>
  </div>
</header>

<div style="padding:0 20px">
<div class="buscador">
  <div class="fila">
    <select id="bZona" aria-label="Zona"><option value="">¿En qué zona?</option>${localidades.map((l) => `<option value="${slug(l)}">${esc(l)}</option>`).join('')}</select>
    <select id="bPres" aria-label="Presupuesto"><option value="">¿Qué presupuesto?</option><option value="bajo">Menos de $2.5M</option><option value="medio">$2.5M – $4M</option><option value="alto">$4M – $6M</option><option value="premium">Más de $6M</option></select>
    <select id="bTipo" aria-label="Tipo"><option value="">¿Residencial o día?</option><option value="gerontologico">Hogar gerontológico</option><option value="centro_dia">Centro día</option></select>
    <button class="go" id="bGo">Buscar hogares →</button>
  </div>
  <p class="nres">Hay <b id="bN">${hogares.length}</b> hogares verificados que encajan</p>
</div>
</div>

<section class="seccion fade">
  <h2>Hogares <em>destacados</em></h2>
  <p class="lead">Una muestra de la red — todos visitados y verificados por nuestro equipo clínico. El nombre y la dirección se entregan en la asesoría.</p>
  <div class="grid">
  ${destacados.map((h) => cardHogar(h, fotosPor.get(h.id) ?? [])).join('\n')}
  </div>
  <p style="text-align:center;margin-top:24px"><a class="btn-sec" href="${SITE}/hogares/">Ver los ${hogares.length} hogares →</a></p>
</section>

<section class="seccion fade">
  <h2>Cómo <em>funciona</em></h2>
  <p class="lead">Cuatro pasos, cero costo, acompañamiento real.</p>
  <div class="pasos">
  ${PASOS.map((p) => `<div class="paso"><span class="num">${p.n}</span><div class="ico">${p.i}</div><h3>${esc(p.t)}</h3><p>${esc(p.d)}</p></div>`).join('')}
  </div>
</section>

<section class="seccion fade">
  <h2>Por qué <em>Vínculo Dorado</em></h2>
  <div class="porque">
    <div class="pq"><h3>🩺 Equipo clínico real</h3><p>Enfermeros y neuropsicólogos evalúan cada caso y cada hogar — no somos un directorio, somos asesores.</p></div>
    <div class="pq"><h3>🏡 Verificación presencial</h3><p>Visitamos cada hogar: instalaciones, personal, alimentación y habilitación ante la Secretaría de Salud.</p></div>
    <div class="pq"><h3>💛 100% gratis para tu familia</h3><p>La asesoría, las visitas acompañadas y el seguimiento no cuestan nada — nos financian los hogares de la red.</p></div>
    <div class="pq"><h3>🔍 Transparencia total</h3><p>Precios reales, fotos reales y cero presión. Tú decides con toda la información en la mano.</p></div>
  </div>
</section>

<section class="seccion fade">
  <div class="stats">
    <div class="stat"><b>${hogares.length}</b><span>Hogares verificados</span></div>
    <div class="stat"><b>${localidades.length}</b><span>Zonas cubiertas</span></div>
    <div class="stat"><b>$0</b><span>Costo de la asesoría</span></div>
    <div class="stat"><b>24-48h</b><span>Casos urgentes</span></div>
  </div>
</section>

<section class="seccion fade">
  <h2>Familias que ya <em>encontraron</em> su hogar</h2>
  <div class="testis">
  ${TESTIMONIOS.map((t) => `<div class="testi"><div class="stars">★★★★★</div><p>"${esc(t.txt)}"</p><div class="quien">${esc(t.quien)}<small>${esc(t.det)}</small></div></div>`).join('')}
  </div>
</section>

<section class="seccion fade faq">
  <h2>Preguntas <em>frecuentes</em></h2>
  ${FAQS.map((f) => `<details><summary>${esc(f.p)}</summary><p>${esc(f.r)}</p></details>`).join('\n')}
</section>

<section class="seccion fade" style="padding-bottom:50px">
  <div class="cta-final">
    <h2>Empieza hoy — es gratis</h2>
    <p>Cuéntanos qué necesita tu familiar y en menos de 2 horas un asesor clínico te contacta con opciones reales.</p>
    <p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <a class="btn-wa" href="${waLink('Hola, busco un hogar geriátrico para mi familiar y quiero asesoría gratuita')}">💬 Hablar por WhatsApp</a>
      <a class="btn-sec" style="background:#fff" href="${SITE}/contacto-familias.html">Llenar el formulario</a>
    </p>
  </div>
</section>

<script>
(function(){
  var DATA=${JSON.stringify(datosBuscador)};
  function contar(){
    var z=document.getElementById('bZona').value,p=document.getElementById('bPres').value,t=document.getElementById('bTipo').value;
    var n=DATA.filter(function(d){return(!z||d.z===z)&&(!p||d.p===p)&&(!t||d.t===t);}).length;
    document.getElementById('bN').textContent=n;
  }
  ['bZona','bPres','bTipo'].forEach(function(id){document.getElementById(id).addEventListener('change',contar);});
  document.getElementById('bGo').addEventListener('click',function(){
    var q=new URLSearchParams();
    var z=document.getElementById('bZona').value,p=document.getElementById('bPres').value,t=document.getElementById('bTipo').value;
    if(z)q.set('zona',z);if(p)q.set('presupuesto',p);if(t)q.set('tipo',t);
    location.href='${SITE}/hogares/'+(q.toString()?'?'+q.toString():'');
  });
  var imgs=document.querySelectorAll('#heroBg img');
  if(imgs.length>1){var i=0;setInterval(function(){imgs[i].classList.remove('on');i=(i+1)%imgs.length;imgs[i].classList.add('on');},5000);}
})();
</script>`;

  fs.writeFileSync(path.join(OUT, 'index.html'), pagina({
    titulo: `Hogares gerontológicos en Bogotá — asesoría gratuita | Vínculo Dorado ${ANIO}`,
    descripcion: `Encontramos el hogar geriátrico ideal para tu ser querido en Bogotá: ${hogares.length} hogares verificados en persona, precios reales y asesoría clínica 100% gratis. Respuesta en menos de 2 horas.`,
    canonical: `${SITE}/`,
    ogImage: portadasHero[0] ?? OG_MARCA,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Vínculo Dorado',
      url: SITE,
      description: 'Red de hogares gerontológicos verificados en Bogotá. Asesoría clínica gratuita para familias.',
      areaServed: { '@type': 'City', name: 'Bogotá' },
      contactPoint: { '@type': 'ContactPoint', telephone: '+57 310 557 7095', contactType: 'customer service', availableLanguage: 'es' },
    },
    cuerpo: homeBody,
    extraHead: `<style>${CSS_HOME}</style>`,
  }), 'utf8');
  urls.push(`${SITE}/`);

  // ----------------- /hogares/index.html -----------------
  const cards = hogares.map((h) => cardHogar(h, fotosPor.get(h.id) ?? [])).join('\n');
  const ogIndex = portadasHero[0] ?? OG_MARCA;

  const indexBody = `<div class="wrap">
<p class="migas"><a href="${SITE}/">Inicio</a> › Hogares</p>
<h1>Hogares geriátricos <em>verificados</em> en Bogotá</h1>
<p class="sub">${hogares.length} hogares gerontológicos visitados y verificados por nuestro equipo clínico. Cada hogar se presenta con su código de la red — el nombre y la dirección se entregan en la asesoría gratuita, junto con la visita acompañada.</p>
<div class="filtros">
  <select id="fZona" aria-label="Filtrar por zona"><option value="">Todas las zonas</option>${localidades.map((l) => `<option value="${slug(l)}">${esc(l)}</option>`).join('')}</select>
  <select id="fPres" aria-label="Filtrar por presupuesto"><option value="">Todo presupuesto</option><option value="bajo">Menos de $2.5M</option><option value="medio">$2.5M – $4M</option><option value="alto">$4M – $6M</option><option value="premium">Más de $6M</option></select>
  <select id="fTipo" aria-label="Filtrar por tipo"><option value="">Hogares y centros día</option><option value="gerontologico">Hogar gerontológico</option><option value="centro_dia">Centro día</option></select>
</div>
<p class="contador">Mostrando <b id="nRes">${hogares.length}</b> hogares verificados</p>
<div class="grid" id="grid">
${cards}
</div>
<p class="vacio" id="vacio">No hay hogares con esos filtros todavía. <a href="${SITE}/contacto-familias.html" style="color:var(--gold);font-weight:700">Cuéntanos qué buscas</a> y lo encontramos contigo.</p>
<div class="cta-final">
  <h2>¿No sabes cuál elegir?</h2>
  <p>Nuestro equipo clínico te recomienda el hogar ideal según salud, zona y presupuesto. Gratis.</p>
  <a class="btn-wa" href="${waLink('Hola, busco un hogar geriátrico en Bogotá y quiero asesoría')}">💬 Hablar por WhatsApp</a>
</div>
</div>
<script>
(function(){
  var g=document.getElementById('grid'),v=document.getElementById('vacio'),n=document.getElementById('nRes');
  function aplicar(){
    var z=document.getElementById('fZona').value,p=document.getElementById('fPres').value,t=document.getElementById('fTipo').value,c=0;
    g.querySelectorAll('.card').forEach(function(el){
      var ok=(!z||el.dataset.zona===z)&&(!p||el.dataset.presupuesto===p)&&(!t||el.dataset.tipo===t);
      el.style.display=ok?'':'none';if(ok)c++;
    });
    n.textContent=c;
    v.style.display=c?'none':'block';
  }
  ['fZona','fPres','fTipo'].forEach(function(id){document.getElementById(id).addEventListener('change',aplicar);});
  // Filtros llegados desde el buscador de la home (?zona=&presupuesto=&tipo=)
  var q=new URLSearchParams(location.search);
  if(q.get('zona'))document.getElementById('fZona').value=q.get('zona');
  if(q.get('presupuesto'))document.getElementById('fPres').value=q.get('presupuesto');
  if(q.get('tipo'))document.getElementById('fTipo').value=q.get('tipo');
  if(q.toString())aplicar();
})();
</script>`;

  fs.writeFileSync(path.join(OUT, 'hogares', 'index.html'), pagina({
    titulo: `Hogares geriátricos en Bogotá — ${hogares.length} verificados | precios ${ANIO} | Vínculo Dorado`,
    descripcion: `Directorio de hogares gerontológicos verificados en Bogotá: precios ${ANIO}, fotos reales, zonas y servicios. Asesoría gratuita para elegir la residencia ideal para tu adulto mayor.`,
    canonical: `${SITE}/hogares/`,
    ogImage: ogIndex,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Hogares geriátricos verificados en Bogotá (${ANIO})`,
      numberOfItems: hogares.length,
      itemListElement: hogares.map((h, i) => ({
        '@type': 'ListItem', position: i + 1, name: nombrePublico(h), url: `${SITE}/hogar/${slugPublico(h)}.html`,
      })),
    },
    cuerpo: indexBody,
  }), 'utf8');
  urls.push(`${SITE}/hogares/`);

  // ----------------- /hogar/{localidad}-{N}.html -----------------
  for (const h of hogares) {
    const fotos = fotosPor.get(h.id) ?? [];
    const portada = fotos.find((f) => f.es_portada)?.url ?? fotos[0]?.url ?? null;
    const np = nombrePublico(h);
    const sp = slugPublico(h);
    const servs = serviciosDe(h);
    const dietas = dietasDe(h);
    const acces = accesibilidadDe(h);
    const desc = descripcionPublica(h);
    const waMsg = `Hola, me interesa el ${np} que vi en su página. ¿Me dan más información?`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${SITE}/hogar/${sp}.html`,
      name: np,
      serviceType: tipoLabel(h),
      description: (desc || `${tipoLabel(h)} verificado en ${zonaPublica(h)}, Bogotá. Cuidado integral del adulto mayor con asesoría gratuita de Vínculo Dorado.`).slice(0, 300),
      url: `${SITE}/hogar/${sp}.html`,
      image: portada ?? OG_MARCA,
      areaServed: { '@type': 'Place', name: `${zonaPublica(h)}, Bogotá` },
      provider: { '@type': 'Organization', name: 'Vínculo Dorado', url: SITE, telephone: '+57 310 557 7095' },
      ...(h.precio_desde ? {
        offers: {
          '@type': 'Offer',
          priceCurrency: 'COP',
          price: h.precio_desde,
          description: `Mensualidad desde ${cop(h.precio_desde)}`,
        },
      } : {}),
    };

    const cuerpo = `<div class="wrap">
<p class="migas"><a href="${SITE}/">Inicio</a> › <a href="${SITE}/hogares/">Hogares</a>${h.localidad ? ` › <a href="${SITE}/hogares/zona/${slug(h.localidad)}.html">${esc(h.localidad)}</a>` : ''} › ${esc(np)}</p>
<h1>${esc(np)}</h1>
<p class="sub">${tipoLabel(h)} <strong>verificado en persona</strong> por el equipo clínico de Vínculo Dorado · ${esc(zonaPublica(h))}</p>
${portada
  ? `<img class="hero-img" id="heroImg" src="${portada}" alt="${esc(np)}, ${tipoLabel(h).toLowerCase()} verificado en Bogotá">`
  : `<div class="hero-sinfoto">${bloqueSinFoto()}</div>`}
${fotos.length > 1 ? `<div class="gal">${fotos.slice(0, 8).map((f, i) => `<img src="${f.url}" alt="Foto ${i + 1} del ${esc(np)}" loading="lazy" onclick="document.getElementById('heroImg').src=this.src;document.querySelectorAll('.gal img').forEach(x=>x.classList.remove('on'));this.classList.add('on')" class="${i === 0 ? 'on' : ''}">`).join('')}</div>` : ''}
<div class="ficha">
  ${h.precio_desde ? `<div class="dato"><b>Precio desde</b><span>${cop(h.precio_desde)}/mes</span></div>` : ''}
  ${h.habitaciones_disponibles != null ? `<div class="dato"><b>Cupos disponibles</b><span>${h.habitaciones_disponibles}</span></div>` : ''}
  ${h.capacidad_total ? `<div class="dato"><b>Capacidad</b><span>${h.capacidad_total} residentes</span></div>` : ''}
  <div class="dato"><b>Oxígeno domiciliario</b><span>${h.maneja_oxigeno ? 'Sí maneja' : 'Consultar'}</span></div>
  <div class="dato"><b>Zona</b><span>${esc(zonaPublica(h))}</span></div>
</div>
<div class="privacidad">🔒 El nombre, la dirección exacta y el contacto de este hogar se entregan en la <strong>asesoría gratuita</strong>, junto con la visita acompañada por nuestro equipo clínico. Así garantizamos un proceso verificado y seguro para tu familia.</div>
${desc ? `<div class="sec"><h2>Sobre este hogar</h2><p style="font-size:14.5px;color:#374151;white-space:pre-line">${esc(desc)}</p></div>` : ''}
${servs.length ? `<div class="sec"><h2>Servicios</h2><div class="chips">${servs.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div></div>` : ''}
${dietas.length ? `<div class="sec"><h2>Dietas especiales</h2><p style="font-size:14.5px;color:#374151">Manejan dieta ${dietas.join(', dieta ')}.</p></div>` : ''}
${acces.length ? `<div class="sec"><h2>Accesibilidad</h2><div class="chips">${acces.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div></div>` : ''}
<div class="cta-final">
  <h2>¿Te interesa el ${esc(np)}?</h2>
  <p>Te contamos cuál es, coordinamos la visita gratis y te acompañamos en todo el proceso.</p>
  <p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
    <a class="btn-wa" href="${waLink(waMsg)}">💬 Solicitar información de este hogar</a>
    <a class="btn-sec" style="background:#fff" href="${SITE}/contacto-familias.html">Asesoría gratuita</a>
  </p>
</div>
</div>`;

    fs.writeFileSync(path.join(OUT, 'hogar', `${sp}.html`), pagina({
      titulo: `${np} — ${tipoLabel(h).toLowerCase()} verificado | precios ${ANIO} | Vínculo Dorado`,
      descripcion: `${np}: ${tipoLabel(h).toLowerCase()} verificado en ${zonaPublica(h)}, Bogotá.${h.precio_desde ? ` Precios desde ${cop(h.precio_desde)}/mes.` : ''}${servs.length ? ` ${servs.slice(0, 3).join(', ')}.` : ''} Fotos reales y visita gratuita con Vínculo Dorado.`.slice(0, 158),
      canonical: `${SITE}/hogar/${sp}.html`,
      ogImage: portada ?? OG_MARCA,
      jsonLd,
      cuerpo,
    }), 'utf8');
    urls.push(`${SITE}/hogar/${sp}.html`);
  }

  // ----------------- /hogares/zona/{localidad}.html -----------------
  for (const loc of localidades) {
    const deLoc = hogares.filter((h) => h.localidad === loc);
    const ogZona = deLoc.map((h) => (fotosPor.get(h.id) ?? []).find((f) => f.es_portada)?.url).find(Boolean) ?? OG_MARCA;
    const cuerpo = `<div class="wrap">
<p class="migas"><a href="${SITE}/">Inicio</a> › <a href="${SITE}/hogares/">Hogares</a> › ${esc(loc)}</p>
<h1>Hogares geriátricos en <em>${esc(loc)}</em></h1>
<p class="sub">${deLoc.length} residencia${deLoc.length !== 1 ? 's' : ''} para adultos mayores verificada${deLoc.length !== 1 ? 's' : ''} en ${esc(loc)} — precios ${ANIO}, fotos y cupos al día. El nombre de cada hogar se entrega en la asesoría gratuita.</p>
<div class="grid">
${deLoc.map((h) => cardHogar(h, fotosPor.get(h.id) ?? [])).join('\n')}
</div>
<div class="cta-final">
  <h2>¿Buscas en ${esc(loc)}?</h2>
  <p>Te ayudamos a elegir y coordinamos las visitas sin costo.</p>
  <a class="btn-wa" href="${waLink(`Hola, busco un hogar geriátrico en ${loc} y quiero asesoría`)}">💬 Hablar por WhatsApp</a>
</div>
</div>`;
    fs.writeFileSync(path.join(OUT, 'hogares', 'zona', `${slug(loc)}.html`), pagina({
      titulo: `Hogares geriátricos en ${loc}, Bogotá — ${deLoc.length} verificados | precios ${ANIO}`,
      descripcion: `Hogares gerontológicos en ${loc} (Bogotá) verificados por Vínculo Dorado: precios ${ANIO}, fotos reales, servicios y cupos. Asesoría gratuita y visita acompañada.`,
      canonical: `${SITE}/hogares/zona/${slug(loc)}.html`,
      ogImage: ogZona,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: `Hogares geriátricos en ${loc}, Bogotá`,
        numberOfItems: deLoc.length,
        itemListElement: deLoc.map((h, i) => ({ '@type': 'ListItem', position: i + 1, name: nombrePublico(h), url: `${SITE}/hogar/${slugPublico(h)}.html` })),
      },
      cuerpo,
    }), 'utf8');
    urls.push(`${SITE}/hogares/zona/${slug(loc)}.html`);
  }

  // ----------------- sitemap + robots -----------------
  const hoy = new Date().toISOString().split('T')[0];
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc><lastmod>${hoy}</lastmod><changefreq>weekly</changefreq></url>`).join('\n') +
    `\n</urlset>\n`, 'utf8');

  fs.writeFileSync(path.join(OUT, 'robots-PARA-FUSIONAR.txt'),
    `# NO subir este archivo tal cual.\n` +
    `# WordPress ya genera su propio robots.txt. Estas líneas se AÑADEN al robots\n` +
    `# existente (o en Yoast/Rank Math -> editor de robots.txt):\n\n` +
    `Sitemap: ${SITE}/sitemap.xml\n`, 'utf8');

  // ----------------- VERIFICACIÓN DE ANONIMATO -----------------
  console.log(`OK: ${urls.length} páginas (${hogares.length} hogares: ${conFoto.length} con foto real, ${hogares.length - conFoto.length} sin foto; ${localidades.length} zonas).`);
  const archivos = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) archivos.push(p);
    }
  })(OUT);

  let fugas = 0;
  const nombresReales = hogaresRaw.map((h) => normTxt(h.nombre).trim()).filter((n) => {
    const tokens = n.split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !GENERICAS.has(t));
    return tokens.length > 0; // solo nombres con palabras identificables
  });
  for (const f of archivos) {
    const html = normTxt(fs.readFileSync(f, 'utf8'));
    if (html.includes('drive.google.com') || html.includes('docs.google.com')) {
      console.error(`FUGA DRIVE en ${path.relative(OUT, f)}`);
      fugas++;
    }
    for (const n of nombresReales) {
      if (n.length >= 8 && html.includes(n)) {
        console.error(`FUGA NOMBRE "${n}" en ${path.relative(OUT, f)}`);
        fugas++;
      }
    }
  }
  if (fugas > 0) {
    console.error(`\n⛔ ${fugas} FUGAS DETECTADAS — revisar antes de publicar.`);
    process.exit(1);
  }
  console.log('✅ Verificación de anonimato: 0 fugas (sin drive.google ni nombres reales en ningún HTML).');
})().catch((e) => { console.error(e); process.exit(1); });
