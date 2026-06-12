// Genera los íconos de la PWA del CRM desde un SVG de marca (sage + gold).
// Uso: node scripts/generar-iconos.cjs
const sharp = require('sharp');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'icons');

function svg(maskable) {
  const rx = maskable ? 0 : 96;
  const scale = maskable ? 7 : 8.6;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#315031"/><stop offset="1" stop-color="#213521"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e4ae3a"/><stop offset="1" stop-color="#d4951f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>
  <text x="256" y="208" font-family="Georgia, serif" font-size="170" font-weight="bold" fill="url(#gold)" text-anchor="middle">V</text>
  <path transform="translate(256 330) scale(${scale}) translate(-12 -11)" fill="url(#gold)" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
</svg>`);
}

(async () => {
  await sharp(svg(false)).resize(192, 192).png().toFile(path.join(OUT, 'icon-192.png'));
  await sharp(svg(false)).resize(512, 512).png().toFile(path.join(OUT, 'icon-512.png'));
  await sharp(svg(true)).resize(512, 512).png().toFile(path.join(OUT, 'icon-maskable-512.png'));
  await sharp(svg(false)).resize(180, 180).png().toFile(path.join(OUT, 'apple-touch-icon.png'));
  console.log('ICONOS OK');
})().catch((e) => { console.error(e); process.exit(1); });
