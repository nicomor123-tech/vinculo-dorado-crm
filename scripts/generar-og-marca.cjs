// Genera el banner OG de marca (1200x630) para páginas sin foto real y lo
// sube al bucket público hogares-fotos en marca/og-default.webp.
// Uso: node scripts/generar-og-marca.cjs
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
function leerEnv() {
  const env = {};
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  });
  return env;
}
const ENV = leerEnv();

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1a1a"/><stop offset="1" stop-color="#2d2d2d"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e8c66b"/><stop offset="1" stop-color="#c9a84c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="610" width="1200" height="20" fill="url(#gold)"/>
  <circle cx="1050" cy="120" r="220" fill="#c9a84c" opacity="0.07"/>
  <circle cx="120" cy="560" r="180" fill="#c9a84c" opacity="0.05"/>
  <rect x="80" y="170" width="72" height="72" rx="18" fill="url(#gold)"/>
  <text x="116" y="222" font-family="Georgia, serif" font-size="46" font-weight="bold" fill="#1a1a1a" text-anchor="middle">V</text>
  <text x="80" y="320" font-family="Georgia, serif" font-size="64" font-weight="bold" fill="#ffffff">Vínculo Dorado</text>
  <text x="80" y="385" font-family="Arial, sans-serif" font-size="30" fill="url(#gold)">Hogares gerontológicos verificados en Bogotá</text>
  <text x="80" y="470" font-family="Arial, sans-serif" font-size="24" fill="#9a9a9a">Asesoría clínica 100% gratuita · Fotos y precios reales</text>
</svg>`);

(async () => {
  const buf = await sharp(svg).webp({ quality: 85 }).toBuffer();
  const res = await fetch(`${ENV.VITE_SUPABASE_URL}/storage/v1/object/hogares-fotos/marca/og-default.webp`, {
    method: 'POST',
    headers: {
      apikey: ENV.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`Upload falló: ${res.status} ${await res.text()}`);
  console.log('OG de marca subido:', `${ENV.VITE_SUPABASE_URL}/storage/v1/object/public/hogares-fotos/marca/og-default.webp`);
})().catch((e) => { console.error(e); process.exit(1); });
