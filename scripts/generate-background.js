// Genera el fondo de la portada: un árbol seco simétrico, con espinas y
// chorreaduras de pintura, en gris oscuro (detrás del logo).
//   npm run background
// Crea public/bg-tree.svg. Cambiá SEED para otra variante.
import fs from 'node:fs';

const SEED = 5;
const W = 1600, H = 1100, CX = W / 2;

let seed = SEED;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const rr = (a, b) => a + (b - a) * rnd();

const shapes = []; // [puntos, capa]

// Rama: camino curvo que se afina hasta la punta, con bordes irregulares.
function branch(x, y, angle, len, width, depth, layer) {
  const steps = Math.max(6, Math.round(len / 10));
  const left = [], right = [], spine = [];
  let a = angle, px = x, py = y;
  const bend = rr(-0.012, 0.012);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const w = width * (1 - t) ** 0.9 + 0.6;
    const nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
    left.push([px + nx * w + rr(-1.2, 1.2), py + ny * w + rr(-1.2, 1.2)]);
    right.push([px - nx * w + rr(-1.2, 1.2), py - ny * w + rr(-1.2, 1.2)]);
    spine.push([px, py, a, w]);
    a += bend + rr(-0.06, 0.06);
    px += Math.cos(a) * len / steps;
    py += Math.sin(a) * len / steps;
  }
  shapes.push([[...left, ...right.reverse()], layer]);

  for (const [sx, sy, sa, sw] of spine) {
    // espinas cortas
    if (rnd() < 0.18 && sw > 1.5) {
      const side = rnd() < 0.5 ? 1 : -1;
      const ta = sa + side * rr(0.5, 1.1);
      const tl = rr(6, 18) + sw;
      const bx = sx + Math.cos(sa + side * Math.PI / 2) * sw * 0.8, by = sy + Math.sin(sa + side * Math.PI / 2) * sw * 0.8;
      shapes.push([[[bx - Math.cos(sa) * 3, by - Math.sin(sa) * 3], [bx + Math.cos(ta) * tl, by + Math.sin(ta) * tl], [bx + Math.cos(sa) * 3, by + Math.sin(sa) * 3]], layer]);
    }
    // chorreaduras de pintura hacia abajo
    if (rnd() < 0.08 && sw > 2.5) drip(sx, sy + sw * 0.5, sw, layer);
  }

  if (depth <= 0) return;
  const [ex, ey, ea] = spine[spine.length - 1];
  const kids = depth > 2 ? 3 : 2;
  for (let k = 0; k < kids; k++) {
    const spread = (k - (kids - 1) / 2) * rr(0.35, 0.6) + rr(-0.15, 0.15);
    branch(ex, ey, ea + spread, len * rr(0.6, 0.8), width * 0.62, depth - 1, layer);
  }
  // ramitas laterales a mitad de camino
  if (depth > 1) {
    const [mx, my, ma, mw] = spine[Math.floor(spine.length * rr(0.3, 0.6))];
    branch(mx, my, ma + (rnd() < 0.5 ? -1 : 1) * rr(0.5, 0.9), len * 0.5, mw * 0.8, depth - 2, layer);
  }
}

function drip(x, y, w, layer) {
  const len = rr(30, 160), dw = Math.min(w, rr(1.5, 4));
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push([x - dw * (1 - i / 14) + rr(-0.4, 0.4), y + len * i / 10]);
  for (let i = 0; i <= 12; i++) { // gota al final
    const t = Math.PI - (i / 12) * Math.PI;
    pts.push([x + Math.cos(t) * dw * 1.5, y + len + Math.sin(t) * dw * 1.8]);
  }
  for (let i = 10; i >= 0; i--) pts.push([x + dw * (1 - i / 14) + rr(-0.4, 0.4), y + len * i / 10]);
  shapes.push([pts, layer]);
}

// Mitad izquierda: tronco central hacia arriba, raíces hacia abajo y ramas
// que se abren a los costados. Después se espeja para que sea simétrico.
const mid = H * 0.6;
branch(CX, H + 20, -Math.PI / 2 - 0.05, 260, 34, 0, 0);
for (let i = 0; i < 3; i++) branch(CX - 8, mid + rr(-60, 80), -Math.PI / 2 - rr(0.2, 1.1), rr(190, 280), rr(14, 22), 3, i % 2);
for (let i = 0; i < 2; i++) branch(CX - 10, mid + rr(40, 140), Math.PI / 2 + rr(0.3, 1.2), rr(160, 240), rr(10, 16), 2, 1);
for (let i = 0; i < 2; i++) branch(CX - rr(40, 120), mid + rr(-140, 60), Math.PI + rr(-0.5, 0.3), rr(220, 320), rr(11, 17), 3, i % 2);

const mirror = (pts) => pts.map(([x, y]) => [2 * CX - x, y]);
const all = shapes.flatMap(([pts, layer]) => [[pts, layer], [mirror(pts), layer]]);

const path = (layer) => all.filter(([, l]) => l === layer)
  .map(([pts]) => 'M' + pts.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L') + 'Z').join('');

fs.writeFileSync(new URL('../public/bg-tree.svg', import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<filter id="paint" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="${SEED}" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="14" xChannelSelector="R" yChannelSelector="G" result="smear"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${SEED + 1}" result="grit"/>
  <feColorMatrix in="grit" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.6" result="dry"/>
  <feComposite in="smear" in2="dry" operator="in"/>
</filter>
<g filter="url(#paint)">
<path fill="#2f2f2f" d="${path(0)}"/>
<path fill="#262626" d="${path(1)}"/>
</g>
</svg>\n`);
console.log('Fondo generado en public/bg-tree.svg');
