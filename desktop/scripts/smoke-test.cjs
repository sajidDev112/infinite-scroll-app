/**
 * Smoke test for the built desktop app, run inside real Electron:
 *   npm run build && npx electron scripts/smoke-test.cjs <outDir>
 * Boots electron/main.cjs, opens the first published story, scrolls through it and
 * reports the camera transform, writing screenshots to <outDir>. Needs the API running.
 */
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const outDir = path.resolve(process.argv[2] || 'smoke-out');
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.on('browser-window-created', (_e, win) => {
  win.setFullScreen = () => {}; // don't take over the screen during the test
  win.show = () => win.showInactive();
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const shot = async (name) => fs.writeFileSync(path.join(outDir, name), (await win.capturePage()).toPNG());

  win.webContents.once('did-finish-load', async () => {
    const report = {};
    try {
      await wait(2500);
      report.home = await js(`({
        title: document.title,
        version: [...document.querySelectorAll('span')].find(s => /^v\\d/.test(s.textContent))?.textContent,
        hero: document.querySelector('h1')?.textContent,
        categories: [...document.querySelectorAll('[aria-label="Filter by category"] button')].map(b => b.textContent),
      })`);
      await shot('1-home.png');

      const list = await js(`fetch('http://localhost:4000/api/desktop/stories').then(r => r.json())`);
      const id = list.items[0].id;
      await js(`location.hash = '#/story/${id}'`);
      await wait(4000);
      report.viewer = await js(`({ loading: !!document.querySelector('.sp-loading'), scenes: document.querySelectorAll('.sp-scene').length, scrollH: document.documentElement.scrollHeight, vh: innerHeight, vw: innerWidth })`);
      await shot('2-intro.png');

      report.camera = await js(`(async () => {
        window.scrollTo(0, 3.75 * innerHeight);
        await new Promise(r => setTimeout(r, 2000));
        const s = document.querySelector('.sp-scene');
        const m = s.querySelector('.sp-cam').style.transform.match(/translate3d\\(([-\\d.]+)px, ([-\\d.]+)px, 0px\\) scale\\(([\\d.]+)\\)/);
        return { transform: m && m[0], text: s.querySelector('.sp-text')?.style.opacity };
      })()`);
      await shot('3-scene1-zoomed.png');

      report.end = await js(`(async () => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise(r => setTimeout(r, 2000));
        return { endOpacity: getComputedStyle(document.querySelector('.sp-end')).opacity, buttons: [...document.querySelectorAll('.sp-end button')].map(b => b.textContent) };
      })()`);
      await shot('4-end.png');

      await js(`[...document.querySelectorAll('.sp-end button')].find(b => b.textContent.includes('Back')).click()`);
      await wait(1500);
      report.back = await js(`({ hash: location.hash, lenisCleaned: !document.documentElement.classList.contains('lenis'), cards: document.querySelectorAll('main button, section button').length })`);
      report.ok = true;
    } catch (err) {
      report.ok = false;
      report.error = String(err?.stack || err);
    }
    console.log(`SMOKE_REPORT ${JSON.stringify(report)}`);
    app.exit(report.ok ? 0 : 1);
  });
});

require('../electron/main.cjs');
