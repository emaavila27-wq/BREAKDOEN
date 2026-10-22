// Genera el logo estilo deathcore a partir del nombre de la marca:
// letra gótica (New Rocker, licencia OFL) + púas + bordes erosionados.
//   npm run logo
// Crea public/logo.svg (rojo), logo-white.svg, logo-email.png y favicon.svg.
// Para otra versión del logo cambiá brand.logoSeed en lib/config.js.
import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import { brand } from '../lib/config.js';

const font = opentype.loadSync(new URL('../assets/fonts/NewRocker-Regular.ttf', import.meta.url).pathname);

function generate(text, seedValue) {
  let seed = seedValue;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rr = (a, b) => a + (b - a) * rnd();

  const SIZE = 200, STRETCH = 1.6, GAP = -4;
  // 1) Contornos de cada letra, aplanados a polígonos
  function flatten(cmds) {
    const contours = []; let cur = null, x = 0, y = 0;
    const push = (px, py) => cur.push([px, py]);
    for (const c of cmds) {
      if (c.type === 'M') { cur = []; contours.push(cur); x = c.x; y = c.y; push(x, y); }
      else if (c.type === 'L') { x = c.x; y = c.y; push(x, y); }
      else if (c.type === 'Q') { for (let t = 0.1; t <= 1.0001; t += 0.1) { const u = 1 - t; push(u*u*x + 2*u*t*c.x1 + t*t*c.x, u*u*y + 2*u*t*c.y1 + t*t*c.y); } x = c.x; y = c.y; }
      else if (c.type === 'C') { for (let t = 0.1; t <= 1.0001; t += 0.1) { const u = 1 - t; push(u*u*u*x + 3*u*u*t*c.x1 + 3*u*t*t*c.x2 + t*t*t*c.x, u*u*u*y + 3*u*u*t*c.y1 + 3*u*t*t*c.y2 + t*t*t*c.y); } x = c.x; y = c.y; }
    }
    return contours.filter((k) => k.length > 2);
  }
  function subdivide(poly, step) {
    const o = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / step));
      for (let k = 0; k < n; k++) o.push([a[0] + (b[0]-a[0]) * k / n, a[1] + (b[1]-a[1]) * k / n]);
    }
    return o;
  }
  function wind(contours, px, py) {
    let w = 0;
    for (const c of contours) for (let i = 0; i < c.length; i++) {
      const [x1, y1] = c[i], [x2, y2] = c[(i + 1) % c.length];
      if (y1 <= py) { if (y2 > py && (x2-x1)*(py-y1) - (px-x1)*(y2-y1) > 0) w++; }
      else if (y2 <= py && (x2-x1)*(py-y1) - (px-x1)*(y2-y1) < 0) w--;
    }
    return w !== 0;
  }

  const glyphs = font.stringToGlyphs(text);
  let penX = 0; const letters = [];
  for (const g of glyphs) {
    const p = g.getPath(penX, 0, SIZE);
    const bb = p.getBoundingBox();
    letters.push({ contours: flatten(p.commands), bb });
    penX += g.advanceWidth * SIZE / font.unitsPerEm + GAP;
  }
  const totalW = penX, mid = totalW / 2;

  const shapes = [];
  letters.forEach((L, i) => {
    // Letras de los extremos más altas: silueta de "alas" típica del deathcore
    const cx = (L.bb.x1 + L.bb.x2) / 2;
    const d = Math.abs(cx - mid) / mid;
    const sy = STRETCH * (1 + 0.45 * d * d);
    const cy = (L.bb.y1 + L.bb.y2) / 2;
    const contours = L.contours.map((c) => subdivide(c, 3).map(([x, y]) => [x, cy + (y - cy) * sy]));
    const top = cy + (L.bb.y1 - cy) * sy, bot = cy + (L.bb.y2 - cy) * sy, h = bot - top;
    // bordes erosionados
    const rough = contours.map((c) => c.map(([x, y]) => [x + rr(-1.4, 1.4), y + rr(-1.4, 1.4)]));
    shapes.push(...rough);

    const spikeScale = 0.85 + 1.9 * d * d * d;
    const all = contours.flat();
    // 2) púas arriba y abajo en los extremos de cada trazo
    const BIN = 14;
    for (const dir of [-1, 1]) {
      const bins = new Map();
      for (const [x, y] of all) {
        const k = Math.floor(x / BIN);
        const b = bins.get(k);
        if (!b || (dir < 0 ? y < b[1] : y > b[1])) bins.set(k, [x, y]);
      }
      for (const [x, y] of bins.values()) {
        const edge = dir < 0 ? (y - top) / h : (bot - y) / h;
        if (edge > 0.14 || rnd() < 0.25) continue;
        const len = rr(0.12, 0.42) * h * spikeScale * (dir > 0 ? 0.8 : 1);
        const w = rr(5, 9.5);
        const lean = rr(-0.25, 0.25) * len + (x - mid) / mid * len * 0.5; // se abren hacia afuera
        const tip = [x + lean, y + dir * len];
        const c1 = [x + lean * 0.3 + rr(-3, 3), y + dir * len * 0.55];
        const spike = [];
        for (let t = 0; t <= 1.0001; t += 0.1) { // dos curvas cuadráticas que se afinan hasta la punta
          const u = 1 - t; spike.push([u*u*(x - w) + 2*u*t*(c1[0] - w*0.35) + t*t*tip[0], u*u*(y - dir*6) + 2*u*t*c1[1] + t*t*tip[1]]);
        }
        for (let t = 1; t >= -0.0001; t -= 0.1) {
          const u = 1 - t; spike.push([u*u*(x + w) + 2*u*t*(c1[0] + w*0.35) + t*t*tip[0], u*u*(y - dir*6) + 2*u*t*c1[1] + t*t*tip[1]]);
        }
        shapes.push(spike);
      }
    }
    // 3) espinas laterales a lo largo del contorno
    for (const c of contours) {
      for (let k = 0; k < c.length; k += 1) {
        if (rnd() > 0.035) continue;
        const [x, y] = c[k], a = c[(k - 2 + c.length) % c.length], b = c[(k + 2) % c.length];
        let nx = b[1] - a[1], ny = -(b[0] - a[0]); const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        if (wind(contours, x + nx * 2, y + ny * 2)) { nx = -nx; ny = -ny; }
        if (wind(contours, x + nx * 2, y + ny * 2)) continue;
        const len = rr(6, 16) * (1 + d), w = rr(1.5, 3);
        const vy = (y < cy ? -1 : 1) * 0.7; // las espinas apuntan hacia el borde más cercano
        let tx = nx + 0, ty = ny + vy; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
        shapes.push([[x - ny * w - nx * 2, y + nx * w - ny * 2], [x + tx * len, y + ty * len], [x + ny * w - nx * 2, y - nx * w - ny * 2]]);
      }
    }
  });

  // encuadre
  const pts = shapes.flat();
  const minX = Math.min(...pts.map((p) => p[0])) - 6, maxX = Math.max(...pts.map((p) => p[0])) + 6;
  const minY = Math.min(...pts.map((p) => p[1])) - 6, maxY = Math.max(...pts.map((p) => p[1])) + 6;
  const dAttr = shapes.map((s) => 'M' + s.map(([x, y]) => `${Math.round(x - minX)} ${Math.round(y - minY)}`).join('L') + 'Z').join('');
  const W = (maxX - minX).toFixed(0), H = (maxY - minY).toFixed(0);
  return { d: dAttr, W, H };
}

const svg = ({ d, W, H }, fill, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}"><title>${label}</title><path fill="${fill}" d="${d}"/></svg>\n`;
const out = (f) => new URL(`../public/${f}`, import.meta.url).pathname;

const logo = generate(brand.name.toUpperCase(), brand.logoSeed);
fs.writeFileSync(out('logo.svg'), svg(logo, '#c4161c', brand.name));
fs.writeFileSync(out('logo-white.svg'), svg(logo, '#ece8e1', brand.name));
const png = new Resvg(svg(logo, '#c4161c', brand.name), { fitTo: { mode: 'width', value: 1120 } }).render().asPng();
fs.writeFileSync(out('logo-email.png'), png);

const icon = generate(brand.name[0].toUpperCase(), brand.logoSeed);
const side = Math.max(icon.W, icon.H);
fs.writeFileSync(out('favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(icon.W - side) / 2} ${(icon.H - side) / 2} ${side} ${side}"><rect x="${(icon.W - side) / 2}" y="${(icon.H - side) / 2}" width="${side}" height="${side}" fill="#121212"/><path fill="#c4161c" d="${icon.d}"/></svg>\n`);
console.log(`Logo "${brand.name}" (semilla ${brand.logoSeed}) generado en public/`);
