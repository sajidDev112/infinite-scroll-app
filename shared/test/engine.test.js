import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLayout,
  cameraAt,
  cameraTransform,
  createScene,
  createStep,
  createTextElement,
  projectPoint,
  textStateAt,
  textWindows,
  validateForPublish,
  visibleRegion,
} from '../engine/index.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const IMG = { w: 3840, h: 2560 };

test('focal point lands exactly on its target when not near an edge', () => {
  const cam = { zoom: 2, fx: 0.62, fy: 0.41, tx: 0.5, ty: 0.5 };
  for (const [W, H] of [[1920, 1080], [1280, 800], [2560, 1080], [800, 600]]) {
    const tr = cameraTransform(cam, IMG.w, IMG.h, W, H);
    const p = projectPoint(tr, IMG.w, IMG.h, W, H, cam.fx, cam.fy);
    near(p.x, 0.5);
    near(p.y, 0.5);
  }
});

test('custom target position is honoured', () => {
  const cam = { zoom: 3, fx: 0.5, fy: 0.5, tx: 0.3, ty: 0.7 };
  const tr = cameraTransform(cam, IMG.w, IMG.h, 1920, 1080);
  const p = projectPoint(tr, IMG.w, IMG.h, 1920, 1080, 0.5, 0.5);
  near(p.x, 0.3);
  near(p.y, 0.7);
});

test('clamping never exposes empty edges (cover)', () => {
  const cam = { zoom: 1.5, fx: 0.98, fy: 0.02, tx: 0.5, ty: 0.5 };
  const W = 1920; const H = 1080;
  const tr = cameraTransform(cam, IMG.w, IMG.h, W, H);
  assert.ok(tr.x <= 0 && tr.x + IMG.w * tr.scale >= W - 1e-6);
  assert.ok(tr.y <= 0 && tr.y + IMG.h * tr.scale >= H - 1e-6);
  const r = visibleRegion(tr, IMG.w, IMG.h, W, H);
  near(r.x + r.width, 1); // pushed against the right edge
  near(r.y, 0); // and the top edge
});

test('zoom 1 cover fills the viewport on the tight axis', () => {
  const tr = cameraTransform({ zoom: 1, fx: 0.5, fy: 0.5, tx: 0.5, ty: 0.5 }, 1000, 1000, 1920, 1080);
  near(tr.scale, 1.92);
  near(tr.x, 0);
});

test('contain fit centers an image smaller than the viewport', () => {
  const tr = cameraTransform({ zoom: 1, fx: 0.9, fy: 0.9, tx: 0.5, ty: 0.5 }, 1000, 1000, 1920, 1080, 'contain');
  near(tr.scale, 1.08);
  near(tr.x, (1920 - 1080) / 2);
  near(tr.y, 0);
});

test('cameraAt holds before first and after last step, interpolates in log space between', () => {
  const steps = [
    createStep({ progress: 0.2, zoomLevel: 1, transitionSettings: { easing: 'none', duration: 1 } }),
    createStep({ progress: 0.6, zoomLevel: 3, focalPoint: { x: 0.8, y: 0.2, targetPositionX: 0.5, targetPositionY: 0.5 }, transitionSettings: { easing: 'none', duration: 1 } }),
  ];
  near(cameraAt(steps, 0).zoom, 1);
  near(cameraAt(steps, 1).zoom, 3);
  near(cameraAt(steps, 1).fx, 0.8);
  near(cameraAt(steps, 0.4).zoom, Math.sqrt(3)); // geometric midpoint
  near(cameraAt(steps, 0.4).fx, 0.65);
});

test('step transition duration shortens the camera move and holds first', () => {
  const steps = [
    createStep({ progress: 0, zoomLevel: 1 }),
    createStep({ progress: 1, zoomLevel: 2, transitionSettings: { easing: 'none', duration: 0.5 } }),
  ];
  near(cameraAt(steps, 0.4).zoom, 1);
  near(cameraAt(steps, 0.75).zoom, Math.SQRT2);
});

test('text reveals bottom-to-top, holds, then exits before the next step', () => {
  const t = createTextElement({ animationDuration: 0.1, easing: 'none' });
  const steps = [createStep({ progress: 0.25, textElements: [t] }), createStep({ progress: 0.5 })];
  const [win] = textWindows(steps);
  assert.equal(textStateAt(t, win, 0.2).opacity, 0);
  const mid = textStateAt(t, win, 0.3);
  near(mid.opacity, 0.5);
  assert.ok(mid.y > 0, 'starts below and moves up');
  near(textStateAt(t, win, 0.4).opacity, 1);
  assert.equal(textStateAt(t, win, 0.5).opacity, 0);
});

test('text on a 100% step is still fully revealed by the end of the scene', () => {
  const t = createTextElement({ animationDuration: 0.1 });
  const steps = [createStep({ progress: 0 }), createStep({ progress: 1, textElements: [t] })];
  const win = textWindows(steps)[1];
  near(textStateAt(t, win, 1).opacity, 1);
});

test('layout totals and scene ordering', () => {
  const img = { id: 'a', url: 'u', width: 10, height: 10 };
  const layout = buildLayout([createScene(img), createScene(img)]);
  const kinds = layout.segments.map((s) => s.type);
  assert.deepEqual(kinds, ['intro', 'scene', 'transition', 'scene', 'end']);
  near(layout.total, 0.8 + (2 + 5) + 1 + (2 + 5) + 0.8); // new scenes: 5 vh of steps + a 2 vh opening (1.2 × 5/3); slide-over transition, 1 screen
});

test('stage unit follows the tighter screen dimension', async () => {
  const { stageUnit } = await import('../engine/constants.js');
  near(stageUnit(1920, 1080), 1);
  near(stageUnit(960, 540), 0.5);
  near(stageUnit(2560, 1080), 1); // ultrawide: limited by height, text doesn't outgrow the screen
  near(stageUnit(1440, 900), 0.75); // 16:10: limited by width
  near(stageUnit(800), 800 / 1920);
});

test('motion blur peaks mid-move and is zero at rest', () => {
  const steps = [
    createStep({ progress: 0 }),
    createStep({ progress: 1, focalPoint: { x: 0.9, y: 0.1, targetPositionX: 0.5, targetPositionY: 0.5 }, transitionSettings: { easing: 'none', duration: 1, blur: 12 } }),
  ];
  near(cameraAt(steps, 0).blur, 0);
  near(cameraAt(steps, 0.5).blur, 12);
  near(cameraAt(steps, 1).blur, 0);
  near(cameraAt([createStep({ progress: 0 }), createStep({ progress: 1 })], 0.5).blur, 0);
});

test('slide-over intro takes exactly one screen of scroll', () => {
  const img = { id: 'a', url: 'u', width: 10, height: 10 };
  const layout = buildLayout([createScene(img)], 'slideOver');
  assert.equal(layout.segments[0].kind, 'slideOver');
  near(layout.segments[0].length, 1);
  near(layout.total, 1 + 2 + 5 + 0.8);
});

test('publish validation', () => {
  assert.ok(validateForPublish({ title: '', scenes: [] }).length >= 2);
  const scene = createScene({ id: 'img', url: 'x', width: 100, height: 50 });
  assert.deepEqual(validateForPublish({ title: 'Ok', scenes: [scene], intro: { textElements: [] } }), []);
  scene.animationSteps[1].progress = 0;
  assert.ok(validateForPublish({ title: 'Ok', scenes: [scene] }).some((e) => e.message.includes('already uses')));
});

test('scene opening: whole image first, then zooms into step 1', () => {
  const W = 1920, H = 1080, iw = 2000, ih = 3000; // portrait image on a landscape screen
  const first = createStep({ progress: 0, zoomLevel: 2, focalPoint: { x: 0.6, y: 0.12, targetPositionX: 0.5, targetPositionY: 0.5 } });
  const steps = [first, createStep({ progress: 1 })];
  // Start of the opening: the whole image is visible.
  const start = cameraTransform(cameraAt(steps, -1), iw, ih, W, H);
  const region = visibleRegion(start, iw, ih, W, H);
  near(region.width, 1); near(region.height, 1);
  // Still resting during the hold.
  near(cameraAt(steps, -0.8).contain, 1);
  // End of the opening is exactly step 1.
  const end = cameraTransform(cameraAt(steps, -1e-9), iw, ih, W, H);
  const step1 = cameraTransform(cameraAt(steps, 0), iw, ih, W, H);
  near(end.scale, step1.scale, 1e-4); near(end.x, step1.x, 1e-2); near(end.y, step1.y, 1e-2);
  // Scenes can opt out.
  const img = { id: 'a', url: 'u', width: 10, height: 10 };
  const scene = { ...createScene(img), openWithFullImage: false };
  near(buildLayout([scene]).segments[1].opening, 0);
});

test('zoom speed: scroll length sets the pace, the opening scales with it', async () => {
  const { sceneLengths } = await import('../engine/layout.js');
  const steps = [{ progress: 0 }, { progress: 1 }];
  assert.deepEqual(sceneLengths({ scrollLength: 3, animationSteps: steps }), { steps: 3, opening: 1.2 }); // older scenes unchanged
  near(sceneLengths({ scrollLength: 5, animationSteps: steps }).opening, 2); // 1.2 × 5/3
  near(sceneLengths({ scrollLength: 12, animationSteps: steps }).opening, 3); // capped at 2.5×
  near(sceneLengths({ animationSteps: steps }).steps, 3); // no value → reference speed
  near(sceneLengths({ scrollLength: 50, animationSteps: steps }).steps, 12); // clamped
  near(sceneLengths({ scrollLength: 8, openWithFullImage: false, animationSteps: steps }).opening, 0);
});

test('uploaded fonts: file name guesses, format sniffing, dropdown and story usage', async () => {
  const { guessFontVariant, sniffFontFormat, fontFamilyOptions, storyFontUses, isBuiltInFontName } = await import('../engine/fonts.js');
  assert.deepEqual(guessFontVariant('Geometria-BoldItalic.woff2'), { weight: 700, style: 'italic', family: 'Geometria' });
  assert.deepEqual(guessFontVariant('Geometria-ExtraLight.otf'), { weight: 200, style: 'normal', family: 'Geometria' });
  assert.equal(guessFontVariant('Geometria-SemiBold.ttf').weight, 600);
  assert.equal(guessFontVariant('Geometria-Heavy.ttf').weight, 900);
  assert.equal(guessFontVariant('Geometria-ExtraBoldItalic.ttf').weight, 800);
  assert.equal(guessFontVariant('MyFont_500.woff').weight, 500);
  assert.equal(guessFontVariant('Geometria.woff2').weight, 400);
  assert.equal(guessFontVariant('BrandonGrotesque-Medium.woff2').family, 'Brandon Grotesque');

  assert.equal(sniffFontFormat(Buffer.from('wOF2xxxx')), 'woff2');
  assert.equal(sniffFontFormat(Buffer.from('wOFFxxxx')), 'woff');
  assert.equal(sniffFontFormat(Buffer.from('OTTOxxxx')), 'otf');
  assert.equal(sniffFontFormat(Buffer.from([0, 1, 0, 0, 9])), 'ttf');
  assert.equal(sniffFontFormat(Buffer.from('<svg>')), null);

  assert.ok(isBuiltInFontName('inter') && isBuiltInFontName('Bebas Neue') && !isBuiltInFontName('Geometria'));
  const opts = fontFamilyOptions([{ family: 'Zeta', files: [{}] }, { family: 'Geometria', files: [{}] }, { family: 'Empty', files: [] }]);
  assert.deepEqual(opts.slice(-2).map((o) => o.value), ['Geometria', 'Zeta']);

  const uses = storyFontUses({
    intro: { textElements: [{ fontFamily: 'Geometria', fontWeight: 700 }] },
    scenes: [{ animationSteps: [{ textElements: [{ fontFamily: 'Geometria', fontWeight: 700 }, { fontFamily: 'Lora Variable', fontStyle: 'italic' }] }] }],
  });
  assert.deepEqual(uses, [{ family: 'Geometria', weight: 700, style: 'normal' }, { family: 'Lora Variable', weight: 600, style: 'italic' }]);
});

test('each intro background keeps its own text and overlay', async () => {
  const { createIntro, switchIntroImage, relinkImages } = await import('../engine/defaults.js');
  const cover = { imageId: 'coverId', url: '/c.webp', thumbUrl: '/c-t.webp', width: 10, height: 20 };
  const scene = { imageId: 'sceneId', url: '/s.webp', thumbUrl: '/s-t.webp', width: 30, height: 20 };
  let intro = { ...switchIntroImage(createIntro(), cover), textElements: [{ id: 'a', content: 'Cover text' }], overlayOpacity: 0.6 };

  intro = switchIntroImage(intro, scene, ['coverId', 'sceneId']);
  assert.equal(intro.imageId, 'sceneId');
  assert.deepEqual(intro.textElements, [], 'a new background starts with no text');
  assert.equal(intro.overlayOpacity, 0.35);
  intro = { ...intro, textElements: [{ id: 'b', content: 'Scene text' }] };

  intro = switchIntroImage(intro, cover, ['coverId', 'sceneId']);
  assert.deepEqual(intro.textElements.map((t) => t.content), ['Cover text']);
  assert.equal(intro.overlayOpacity, 0.6);
  assert.deepEqual(intro.layouts.sceneId.textElements.map((t) => t.content), ['Scene text']);
  assert.equal(intro.layouts.coverId, undefined, 'the active layout is not duplicated');

  // Image ids that change on save are followed.
  const story = relinkImages({ intro }, { sceneId: { imageId: 'newId', url: '/n.webp', thumbUrl: '/n-t.webp' } });
  assert.ok(story.intro.layouts.newId && !story.intro.layouts.sceneId);
});

test('logo and social icons show on the cover image only, unless set per background', async () => {
  const { introShowsFooter } = await import('../engine/defaults.js');
  const story = { coverImage: { imageId: 'coverId' }, scenes: [{ imageId: 'sceneId' }] };
  assert.equal(introShowsFooter({ ...story, intro: { imageId: null } }), true, 'Automatic');
  assert.equal(introShowsFooter({ ...story, intro: { imageId: 'coverId' } }), true);
  assert.equal(introShowsFooter({ ...story, intro: { imageId: 'sceneId' } }), false);
  assert.equal(introShowsFooter({ ...story, intro: { imageId: 'sceneId', showFooter: true } }), true);
  assert.equal(introShowsFooter({ ...story, intro: { imageId: 'coverId', showFooter: false } }), false);
  assert.equal(introShowsFooter({ scenes: story.scenes, intro: { imageId: 'sceneId' } }), true, 'no cover: first scene counts as cover');
});
