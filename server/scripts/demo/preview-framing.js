/**
 * Renders what the viewer shows at every animation step (1920×1080 screen) into contact
 * sheets, to check focal points before seeding.  node scripts/demo/preview-framing.js <outDir>
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { STORIES } from './stories.js';
import { cameraTransform, visibleRegion } from '../../../shared/engine/camera.js';

const IMG = (k) => resolve(import.meta.dirname, 'images', `${k}.jpg`);
const out = resolve(process.argv[2] || 'framing');
mkdirSync(out, { recursive: true });
const W = 1920; const H = 1080; const TW = 384; const TH = 216; const COLS = 4;
const esc = (s) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);

for (const [si, story] of STORIES.entries()) {
  const tiles = [];
  for (const [ci, scene] of story.scenes.entries()) {
    const meta = await sharp(IMG(scene.image)).metadata();
    for (const [k, st] of scene.steps.entries()) {
      const tr = cameraTransform({ zoom: st.zoom, fx: st.x, fy: st.y, tx: st.tx, ty: st.ty }, meta.width, meta.height, W, H, scene.fit);
      const r = visibleRegion(tr, meta.width, meta.height, W, H);
      const left = Math.round(r.x * meta.width); const top = Math.round(r.y * meta.height);
      const width = Math.max(1, Math.min(meta.width - left, Math.round(r.width * meta.width)));
      const height = Math.max(1, Math.min(meta.height - top, Math.round(r.height * meta.height)));
      const crop = await sharp(IMG(scene.image)).extract({ left, top, width, height }).resize(TW, TH, { fit: 'fill' }).toBuffer();
      // focal point projected on screen + text boxes (approximate height)
      const fx = ((tr.x + st.x * meta.width * tr.scale) / W) * TW;
      const fy = ((tr.y + st.y * meta.height * tr.scale) / H) * TH;
      const boxes = st.texts.map((t) => `<rect x="${(t.positionX ?? 0) * TW}" y="${(t.positionY ?? 0) * TH}" width="${(t.width || 0.4) * TW}" height="${Math.max(10, (t.fontSize || 40) * 1.4 * (t.content.split('\n').length) * (TW / W) * (t.width ? Math.max(1, t.content.length * (t.fontSize || 40) * 0.5 / (t.width * W)) / t.content.split('\n').length : 1))}" fill="rgba(129,140,248,0.25)" stroke="#a5b4fc"/>`).join('');
      const svg = `<svg width="${TW}" height="${TH}" xmlns="http://www.w3.org/2000/svg">${boxes}
        <circle cx="${fx}" cy="${fy}" r="7" fill="none" stroke="#ff2d55" stroke-width="2.5"/>
        <rect x="0" y="0" width="${TW}" height="20" fill="rgba(0,0,0,0.7)"/>
        <text x="6" y="14" font-size="12" font-family="Arial" fill="#fff">${esc(`S${ci + 1}.${k + 1} ${scene.image} ${Math.round(st.progress * 100)}% ${st.zoom}x`)}</text></svg>`;
      tiles.push(await sharp(crop).composite([{ input: Buffer.from(svg) }]).png().toBuffer());
    }
  }
  const rows = Math.ceil(tiles.length / COLS);
  await sharp({ create: { width: COLS * (TW + 6), height: rows * (TH + 6), channels: 3, background: '#111' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % COLS) * (TW + 6), top: Math.floor(i / COLS) * (TH + 6) })))
    .jpeg({ quality: 78 }).toFile(resolve(out, `${si + 1}.jpg`));
  console.log(`${si + 1}. ${story.title}: ${tiles.length} steps`);
}
