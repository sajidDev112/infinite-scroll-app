/**
 * Creates and publishes the demo stories through the real API (uploads, validation, publish).
 *   node --env-file=.env scripts/demo/seed-demo.js [apiBase=http://localhost:4000]
 * Signs in with ADMIN_EMAIL / ADMIN_PASSWORD. Stories whose title already exists are skipped.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { STORIES } from './stories.js';
import { createIntro, createIntroText, createScene, createStep, createTextElement, imageRef } from '../../../shared/engine/defaults.js';

const args = process.argv.slice(2);
const REPLACE = args.includes('--replace'); // delete + recreate demo stories that already exist
const BASE = (args.find((a) => !a.startsWith('--')) || 'http://localhost:4000').replace(/\/$/, '') + '/api';
const imgPath = (k) => resolve(import.meta.dirname, 'images', `${k}.jpg`);

let token;
async function api(method, path, body, isForm = false) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) {
    const details = data?.error?.details?.map((d) => `  - ${d.path}: ${d.message}`).join('\n') || '';
    throw new Error(`${method} ${path} → ${res.status} ${data?.error?.message}\n${details}`);
  }
  return data;
}

const uploads = new Map();
async function upload(key) {
  if (uploads.has(key)) return uploads.get(key);
  const form = new FormData();
  form.append('images', new Blob([await readFile(imgPath(key))], { type: 'image/jpeg' }), `${key}.jpg`);
  const { images } = await api('POST', '/uploads/images', form, true);
  uploads.set(key, images[0]);
  console.log(`  uploaded ${key} (${images[0].width}×${images[0].height})`);
  return images[0];
}

// Motion blur for long camera pans: the farther the focal point travels, the softer the move.
const panBlur = (prev, st) => {
  if (!prev) return 0;
  const dist = Math.hypot(st.x - prev.x, st.y - prev.y);
  return dist > 0.2 ? Math.min(12, Math.round(dist * 24)) : 0;
};

const sceneText = (t, i, z) => createTextElement({ zIndex: z + i, animationDelay: i * 0.035, animationDuration: 0.09, easing: 'power3.out', ...t });

async function buildStory(spec) {
  const scenes = [];
  for (const [order, s] of spec.scenes.entries()) {
    const img = await upload(s.image);
    const scene = createScene(img, order);
    Object.assign(scene, {
      title: s.title || '',
      scrollLength: s.scrollLength ?? 4,
      fit: s.fit || 'cover',
      // Like a page: the next image scrolls up over this one, 1:1 with the scroll.
      transition: s.transition || { type: 'slideOver', duration: 1 },
      animationSteps: s.steps.map((st, k) => createStep({
        progress: st.progress,
        zoomLevel: st.zoom,
        focalPoint: { x: st.x, y: st.y, targetPositionX: st.tx, targetPositionY: st.ty },
        transitionSettings: { easing: st.easing, duration: st.move, blur: st.blur ?? panBlur(s.steps[k - 1], st) },
        textElements: st.texts.map((t, i) => sceneText(t, i, 1)),
      })),
    });
    scenes.push(scene);
  }
  const introImg = await upload(spec.intro.image);
  const cover = await upload(spec.cover);
  return {
    title: spec.title,
    description: spec.description,
    category: spec.category,
    coverImage: imageRef(cover),
    status: 'draft',
    intro: {
      ...createIntro(),
      imageId: introImg.id, imageUrl: introImg.url, thumbUrl: introImg.thumbUrl, imageWidth: introImg.width, imageHeight: introImg.height,
      overlayColor: spec.intro.overlayColor, overlayOpacity: spec.intro.overlayOpacity,
      exitType: spec.intro.exitType || 'slideOver',
      textElements: spec.intro.texts.map((t, i) => createIntroText({ zIndex: i + 1, ...t })),
    },
    scenes,
  };
}

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
}).then((r) => r.json());
if (!login.token) throw new Error(`Login failed: ${login.error?.message}`);
token = login.token;

const existing = new Map((await api('GET', '/stories?limit=50')).items.map((s) => [s.title, s.id]));
// Seed in reverse so the first story is the newest (shown as "featured" on desktop).
for (const spec of [...STORIES].reverse()) {
  if (existing.has(spec.title)) {
    if (!REPLACE) {
      console.log(`skip  "${spec.title}" (already exists; use --replace to rebuild)`);
      continue;
    }
    await api('DELETE', `/stories/${existing.get(spec.title)}`);
    console.log(`removed old "${spec.title}"`);
  }
  console.log(`story "${spec.title}"`);
  const { story } = await api('POST', '/stories', await buildStory(spec));
  await api('POST', `/stories/${story.id}/publish`);
  console.log(`  published ${story.id} — ${spec.scenes.length} scene(s)`);
}
console.log('done');
