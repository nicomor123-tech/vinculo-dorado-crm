// Genera la web pública de hogares (estática) desde Supabase:
//   web-dist/hogares/index.html          -> todos los hogares + filtros JS
//   web-dist/hogar/{slug}.html           -> página SEO por hogar
//   web-dist/hogares/zona/{slug}.html    -> página por localidad
//   web-dist/sitemap.xml                 -> todas las URLs nuevas
//   web-dist/robots-PARA-FUSIONAR.txt    -> líneas a añadir al robots de WP
//
// Regenerar: cambiar el hogar en el CRM -> node scripts/generar-web.cjs
//            -> subir web-dist/ a cPanel (ver DEPLOY2.md).
//
// Solo publica hogares VERIFICADOS (estado activo/aprobado). Mobile-first,
// paleta de la web actual (negro/dorado), webp + lazyload, CSS inline.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'web-dist');
const SITE = 'https://hogaresgerontologicos.com';
const WA = '573105577095';
const ANIO = new Date().getFullYear();

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
const slug = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'hogar';
const cop = (v) => v ? `$${Number(v).toLocaleString('es-CO')}` : null;

const PLACEHOLDER = 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200';

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

// ---------------------------------------------------------------------------
// CSS compartido (inline en cada página — pequeño y sin requests extra)
// ---------------------------------------------------------------------------
const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{--negro:#1a1a1a;--gold:#c9a84c;--gold-suave:#f5edda;--gris:#6b7280;--crema:#faf8f5;--blanco:#fff;--radius:16px}
body{font-family:'DM Sans',system-ui,sans-serif;color:#1a2b3c;background:var(--crema);line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit}
.nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.97);backdrop-filter:blur(10px);box-shadow:0 2px 16px rgba(26,26,26,.06);padding:14px 20px}
.nav-in{max-width:1140px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:700;font-size:17px;color:var(--negro)}
.logo .mk{width:34px;height:34px;background:var(--negro);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Playfair Display',serif}
.nav-cta{background:var(--gold);color:var(--negro);padding:9px 18px;border-radius:100px;font-weight:700;font-size:13px;text-decoration:none;white-space:nowrap}
.wrap{max-width:1140px;margin:0 auto;padding:28px 20px 60px}
h1{font-family:'Playfair Display',serif;font-size:clamp(26px,4.5vw,40px);color:var(--negro);line-height:1.18;margin-bottom:10px}
h1 em{font-style:italic;color:var(--gold)}
.sub{color:var(--gris);font-size:15px;max-width:640px;margin-bottom:22px}
.filtros{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 26px}
.filtros select{padding:11px 14px;border:2px solid #e8e4dc;border-radius:12px;background:#fff;font-size:14px;font-family:inherit;color:var(--negro);min-width:150px;flex:1}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.card{background:#fff;border-radius:var(--radius);overflow:hidden;box-shadow:0 4px 20px rgba(26,26,26,.06);border:1px solid rgba(26,26,26,.05);display:flex;flex-direction:column;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(26,26,26,.12)}
.card .ph{position:relative;height:190px;background:#eee}
.card .ph img{width:100%;height:100%;object-fit:cover;display:block}
.card .precio{position:absolute;top:10px;right:10px;background:rgba(255,255,255,.95);border-radius:10px;padding:5px 10px;font-size:12px;font-weight:700;color:var(--negro)}
.card .precio small{display:block;font-weight:500;color:var(--gris);font-size:9px;text-transform:uppercase;letter-spacing:.5px}
.card .bd{padding:16px;display:flex;flex-direction:column;gap:8px;flex:1}
.card h3{font-size:16px;color:var(--negro);line-height:1.3}
.card .zona{font-size:13px;color:var(--gris)}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chip{background:var(--gold-suave);color:#7a6020;font-size:11px;font-weight:600;padding:3px 9px;border-radius:100px}
.card .ver{margin-top:auto;text-align:center;background:var(--negro);color:#fff;padding:11px;border-radius:11px;font-size:13.5px;font-weight:700;text-decoration:none}
.btn-wa{display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;padding:13px 24px;border-radius:100px;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 6px 18px rgba(37,211,102,.3)}
.btn-sec{display:inline-flex;align-items:center;gap:8px;background:#fff;color:var(--negro);padding:13px 24px;border-radius:100px;font-weight:700;font-size:15px;text-decoration:none;border:2px solid var(--negro)}
.gal{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}
.gal img{width:100%;height:90px;object-fit:cover;border-radius:10px;cursor:pointer;border:2px solid transparent}
.gal img.on{border-color:var(--gold)}
.hero-img{width:100%;height:clamp(220px,40vw,420px);object-fit:cover;border-radius:18px;background:#eee}
.ficha{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:20px 0}
.dato{background:#fff;border-radius:14px;padding:14px;border:1px solid rgba(26,26,26,.06)}
.dato b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--gris);font-weight:600;margin-bottom:3px}
.dato span{font-size:15px;font-weight:700;color:var(--negro)}
.sec{background:#fff;border-radius:18px;padding:22px;margin:16px 0;border:1px solid rgba(26,26,26,.05)}
.sec h2{font-family:'Playfair Display',serif;font-size:21px;color:var(--negro);margin-bottom:12px}
.cta-final{background:var(--negro);border-radius:20px;padding:34px 24px;text-align:center;color:#fff;margin-top:28px}
.cta-final h2{font-family:'Playfair Display',serif;font-size:24px;margin-bottom:8px}
.cta-final p{color:rgba(255,255,255,.65);font-size:14px;margin-bottom:18px}
.migas{font-size:12.5px;color:var(--gris);margin-bottom:14px}
.migas a{color:var(--gris);text-decoration:none}
.migas a:hover{color:var(--negro)}
.footer{text-align:center;padding:28px 20px;font-size:13px;color:var(--gris)}
.vacio{text-align:center;color:var(--gris);padding:50px 0;display:none}
@media(max-width:560px){.gal{grid-template-columns:repeat(3,1fr)}.gal img{height:74px}}
`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">`;

function nav() {
  return `<nav class="nav"><div class="nav-in">
  <a class="logo" href="${SITE}"><span class="mk">V</span>Vínculo Dorado</a>
  <a class="nav-cta" href="${SITE}/contacto-familias.html">Asesoría gratuita →</a>
</div></nav>`;
}
function footer() {
  return `<div class="footer"><a href="${SITE}" style="color:var(--negro);font-weight:700;text-decoration:none">Vínculo Dorado</a> © ${ANIO} · Red de hogares geriátricos verificados en Bogotá · <a href="${SITE}/hogares/" style="text-decoration:none">Ver hogares</a></div>`;
}

function pagina({ titulo, descripcion, canonical, ogImage, jsonLd, cuerpo }) {
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
</head>
<body>
${nav()}
${cuerpo}
${footer()}
</body>
</html>`;
}

function cardHogar(h, fotos) {
  const portada = fotos.find((f) => f.es_portada)?.url ?? fotos[0]?.url ?? PLACEHOLDER;
  const zona = [h.barrio, h.localidad].filter(Boolean).join(', ') || h.ciudad || 'Bogotá';
  const servs = serviciosDe(h).slice(0, 3);
  return `<article class="card" data-zona="${esc(slug(h.localidad || 'otros'))}" data-presupuesto="${rangoPresupuesto(h)}" data-tipo="${h.tipo_servicio === 'centro_dia' ? 'centro_dia' : 'gerontologico'}">
  <div class="ph"><img src="${portada}" alt="${esc(h.nombre)} — hogar geriátrico en ${esc(zona)}" loading="lazy">
    ${h.precio_desde ? `<div class="precio"><small>Desde</small>${cop(h.precio_desde)}/mes</div>` : ''}</div>
  <div class="bd">
    <h3>${esc(h.nombre)}</h3>
    <p class="zona">📍 ${esc(zona)} · ${tipoLabel(h)}</p>
    ${servs.length ? `<div class="chips">${servs.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>` : ''}
    <a class="ver" href="${SITE}/hogar/${slug(h.nombre)}.html">Ver hogar →</a>
  </div>
</article>`;
}

// ---------------------------------------------------------------------------

(async () => {
  const [hogaresRes, fotosRes] = await Promise.all([
    fetch(`${URL_BASE}/rest/v1/hogares?estado=in.(activo,aprobado)&select=*&order=precio_desde.desc.nullslast&limit=1000`, { headers: H }),
    fetch(`${URL_BASE}/rest/v1/hogar_fotos?select=hogar_id,url,orden,es_portada&order=orden.asc&limit=5000`, { headers: H }),
  ]);
  const hogares = await hogaresRes.json();
  let fotosAll = await fotosRes.json();
  if (!Array.isArray(hogares)) { console.error('Error hogares:', hogares); process.exit(1); }
  if (!Array.isArray(fotosAll)) {
    console.warn('Tabla hogar_fotos no disponible aún — la web sale con placeholders.');
    fotosAll = [];
  }
  const fotosPor = new Map();
  fotosAll.forEach((f) => {
    const arr = fotosPor.get(f.hogar_id) ?? [];
    arr.push(f);
    fotosPor.set(f.hogar_id, arr);
  });

  // Dedup de slugs.
  const slugVisto = new Map();
  hogares.forEach((h) => {
    let s = slug(h.nombre);
    if (slugVisto.has(s)) s = `${s}-${slugVisto.get(s) + 1}`;
    slugVisto.set(slug(h.nombre), (slugVisto.get(slug(h.nombre)) ?? 0) + 1);
    h._slug = s;
  });

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'hogares', 'zona'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'hogar'), { recursive: true });

  const urls = [];

  // ----------------- /hogares/index.html -----------------
  const localidades = [...new Set(hogares.map((h) => h.localidad).filter(Boolean))].sort();
  const cards = hogares.map((h) => cardHogar(h, fotosPor.get(h.id) ?? [])).join('\n');
  const ogIndex = hogares.map((h) => (fotosPor.get(h.id) ?? []).find((f) => f.es_portada)?.url).find(Boolean) ?? PLACEHOLDER;

  const indexBody = `<div class="wrap">
<p class="migas"><a href="${SITE}">Inicio</a> › Hogares</p>
<h1>Hogares geriátricos <em>verificados</em> en Bogotá</h1>
<p class="sub">${hogares.length} hogares gerontológicos visitados y verificados por nuestro equipo clínico. Filtra por zona y presupuesto, o pide asesoría gratuita y te recomendamos el ideal para tu familiar.</p>
<div class="filtros">
  <select id="fZona" aria-label="Filtrar por zona"><option value="">Todas las zonas</option>${localidades.map((l) => `<option value="${slug(l)}">${esc(l)}</option>`).join('')}</select>
  <select id="fPres" aria-label="Filtrar por presupuesto"><option value="">Todo presupuesto</option><option value="bajo">Menos de $2.5M</option><option value="medio">$2.5M – $4M</option><option value="alto">$4M – $6M</option><option value="premium">Más de $6M</option></select>
  <select id="fTipo" aria-label="Filtrar por tipo"><option value="">Hogares y centros día</option><option value="gerontologico">Hogar gerontológico</option><option value="centro_dia">Centro día</option></select>
</div>
<div class="grid" id="grid">
${cards}
</div>
<p class="vacio" id="vacio">No hay hogares con esos filtros todavía. <a href="${SITE}/contacto-familias.html" style="color:var(--gold);font-weight:700">Cuéntanos qué buscas</a> y lo encontramos contigo.</p>
<div class="cta-final">
  <h2>¿No sabes cuál elegir?</h2>
  <p>Nuestro equipo clínico te recomienda el hogar ideal según salud, zona y presupuesto. Gratis.</p>
  <a class="btn-wa" href="https://wa.me/${WA}?text=${encodeURIComponent('Hola, busco un hogar geriátrico en Bogotá y quiero asesoría')}">💬 Hablar por WhatsApp</a>
</div>
</div>
<script>
(function(){
  var g=document.getElementById('grid'),v=document.getElementById('vacio');
  function aplicar(){
    var z=document.getElementById('fZona').value,p=document.getElementById('fPres').value,t=document.getElementById('fTipo').value,n=0;
    g.querySelectorAll('.card').forEach(function(c){
      var ok=(!z||c.dataset.zona===z)&&(!p||c.dataset.presupuesto===p)&&(!t||c.dataset.tipo===t);
      c.style.display=ok?'':'none';if(ok)n++;
    });
    v.style.display=n?'none':'block';
  }
  ['fZona','fPres','fTipo'].forEach(function(id){document.getElementById(id).addEventListener('change',aplicar);});
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
        '@type': 'ListItem', position: i + 1, name: h.nombre, url: `${SITE}/hogar/${h._slug}.html`,
      })),
    },
    cuerpo: indexBody,
  }), 'utf8');
  urls.push(`${SITE}/hogares/`);

  // ----------------- /hogar/{slug}.html -----------------
  for (const h of hogares) {
    const fotos = fotosPor.get(h.id) ?? [];
    const portada = fotos.find((f) => f.es_portada)?.url ?? fotos[0]?.url ?? PLACEHOLDER;
    const zona = [h.barrio, h.localidad].filter(Boolean).join(', ') || 'Bogotá';
    const servs = serviciosDe(h);
    const dietas = dietasDe(h);
    const acces = accesibilidadDe(h);
    const waMsg = encodeURIComponent(`Hola, vi el hogar "${h.nombre}" en su página y me interesa para mi familiar. ¿Me dan más información?`);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `${SITE}/hogar/${h._slug}.html`,
      name: h.nombre,
      description: (h.descripcion || `${tipoLabel(h)} en ${zona}, Bogotá. Cuidado integral del adulto mayor.`).slice(0, 300),
      url: `${SITE}/hogar/${h._slug}.html`,
      image: portada,
      telephone: h.telefono || undefined,
      priceRange: h.precio_desde ? `${cop(h.precio_desde)}${h.precio_hasta ? ` - ${cop(h.precio_hasta)}` : '+'} COP/mes` : undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: h.direccion || undefined,
        addressLocality: h.localidad ? `${h.localidad}, Bogotá` : 'Bogotá',
        addressRegion: 'Cundinamarca',
        addressCountry: 'CO',
      },
    };

    const cuerpo = `<div class="wrap">
<p class="migas"><a href="${SITE}">Inicio</a> › <a href="${SITE}/hogares/">Hogares</a>${h.localidad ? ` › <a href="${SITE}/hogares/zona/${slug(h.localidad)}.html">${esc(h.localidad)}</a>` : ''} › ${esc(h.nombre)}</p>
<h1>${esc(h.nombre)}</h1>
<p class="sub">${tipoLabel(h)} en <strong>${esc(zona)}</strong> · verificado por Vínculo Dorado</p>
<img class="hero-img" id="heroImg" src="${portada}" alt="${esc(h.nombre)}, hogar geriátrico en ${esc(zona)}, Bogotá">
${fotos.length > 1 ? `<div class="gal">${fotos.slice(0, 8).map((f, i) => `<img src="${f.url}" alt="Foto ${i + 1} de ${esc(h.nombre)}" loading="lazy" onclick="document.getElementById('heroImg').src=this.src;document.querySelectorAll('.gal img').forEach(x=>x.classList.remove('on'));this.classList.add('on')" class="${i === 0 ? 'on' : ''}">`).join('')}</div>` : ''}
<div class="ficha">
  ${h.precio_desde ? `<div class="dato"><b>Precio desde</b><span>${cop(h.precio_desde)}/mes</span></div>` : ''}
  ${h.habitaciones_disponibles != null ? `<div class="dato"><b>Cupos disponibles</b><span>${h.habitaciones_disponibles}</span></div>` : ''}
  ${h.capacidad_total ? `<div class="dato"><b>Capacidad</b><span>${h.capacidad_total} residentes</span></div>` : ''}
  <div class="dato"><b>Oxígeno domiciliario</b><span>${h.maneja_oxigeno ? 'Sí maneja' : 'Consultar'}</span></div>
  ${h.localidad ? `<div class="dato"><b>Zona</b><span>${esc(h.localidad)}</span></div>` : ''}
</div>
${h.descripcion ? `<div class="sec"><h2>Sobre este hogar</h2><p style="font-size:14.5px;color:#374151;white-space:pre-line">${esc(h.descripcion)}</p></div>` : ''}
${servs.length ? `<div class="sec"><h2>Servicios</h2><div class="chips">${servs.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div></div>` : ''}
${dietas.length ? `<div class="sec"><h2>Dietas especiales</h2><p style="font-size:14.5px;color:#374151">Manejan dieta ${dietas.join(', dieta ')}.</p></div>` : ''}
${acces.length ? `<div class="sec"><h2>Accesibilidad</h2><div class="chips">${acces.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div></div>` : ''}
<div class="cta-final">
  <h2>¿Te interesa ${esc(h.nombre)}?</h2>
  <p>Coordinamos la visita gratis y te acompañamos en todo el proceso de admisión.</p>
  <p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
    <a class="btn-wa" href="https://wa.me/${WA}?text=${waMsg}">💬 Me interesa este hogar</a>
    <a class="btn-sec" style="background:#fff" href="${SITE}/contacto-familias.html">Asesoría gratuita</a>
  </p>
</div>
</div>`;

    fs.writeFileSync(path.join(OUT, 'hogar', `${h._slug}.html`), pagina({
      titulo: `Hogar geriátrico ${h.nombre} en ${h.barrio || h.localidad || 'Bogotá'}${h.localidad ? `, ${h.localidad}` : ''} | precios ${ANIO}`,
      descripcion: `${h.nombre}: ${tipoLabel(h).toLowerCase()} en ${zona}, Bogotá.${h.precio_desde ? ` Precios desde ${cop(h.precio_desde)}/mes.` : ''}${servs.length ? ` ${servs.slice(0, 3).join(', ')}.` : ''} Fotos, cupos y visita gratuita con Vínculo Dorado.`.slice(0, 158),
      canonical: `${SITE}/hogar/${h._slug}.html`,
      ogImage: portada,
      jsonLd,
      cuerpo,
    }), 'utf8');
    urls.push(`${SITE}/hogar/${h._slug}.html`);
  }

  // ----------------- /hogares/zona/{localidad}.html -----------------
  for (const loc of localidades) {
    const deLoc = hogares.filter((h) => h.localidad === loc);
    const ogZona = deLoc.map((h) => (fotosPor.get(h.id) ?? []).find((f) => f.es_portada)?.url).find(Boolean) ?? PLACEHOLDER;
    const cuerpo = `<div class="wrap">
<p class="migas"><a href="${SITE}">Inicio</a> › <a href="${SITE}/hogares/">Hogares</a> › ${esc(loc)}</p>
<h1>Hogares geriátricos en <em>${esc(loc)}</em></h1>
<p class="sub">${deLoc.length} residencia${deLoc.length !== 1 ? 's' : ''} para adultos mayores verificada${deLoc.length !== 1 ? 's' : ''} en ${esc(loc)}, Bogotá — con precios ${ANIO}, fotos y cupos al día.</p>
<div class="grid">
${deLoc.map((h) => cardHogar(h, fotosPor.get(h.id) ?? [])).join('\n')}
</div>
<div class="cta-final">
  <h2>¿Buscas en ${esc(loc)}?</h2>
  <p>Te ayudamos a elegir y coordinamos las visitas sin costo.</p>
  <a class="btn-wa" href="https://wa.me/${WA}?text=${encodeURIComponent(`Hola, busco un hogar geriátrico en ${loc} y quiero asesoría`)}">💬 Hablar por WhatsApp</a>
</div>
</div>`;
    fs.writeFileSync(path.join(OUT, 'hogares', 'zona', `${slug(loc)}.html`), pagina({
      titulo: `Hogares geriátricos en ${loc}, Bogotá — ${deLoc.length} verificados | precios ${ANIO}`,
      descripcion: `Hogares gerontológicos en ${loc} (Bogotá) verificados por Vínculo Dorado: precios ${ANIO}, fotos reales, servicios y cupos disponibles. Asesoría gratuita.`,
      canonical: `${SITE}/hogares/zona/${slug(loc)}.html`,
      ogImage: ogZona,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: `Hogares geriátricos en ${loc}, Bogotá`,
        numberOfItems: deLoc.length,
        itemListElement: deLoc.map((h, i) => ({ '@type': 'ListItem', position: i + 1, name: h.nombre, url: `${SITE}/hogar/${h._slug}.html` })),
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

  console.log(`OK: ${urls.length} páginas en web-dist/ (${hogares.length} hogares, ${localidades.length} zonas).`);
})().catch((e) => { console.error(e); process.exit(1); });
