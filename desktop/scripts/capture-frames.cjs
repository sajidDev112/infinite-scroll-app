/**
 * Captures frames of a story at given scroll positions (in screen heights) inside real Electron.
 *   npx electron scripts/capture-frames.cjs <outDir> "<story title>" 0,0.3,0.6,...
 * Needs the API running and a built renderer (npm run build).
 */
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const [outDir, title, posList] = process.argv.slice(2);
const positions = (posList || '0,0.5,1').split(',').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.on('browser-window-created', (_e, win) => {
  win.setFullScreen = () => {};
  win.show = () => win.showInactive();
  const js = (code) => win.webContents.executeJavaScript(code, true);
  win.webContents.once('did-finish-load', async () => {
    try {
      await wait(1500);
      const list = await js(`fetch('http://localhost:4000/api/desktop/stories').then(r => r.json())`);
      const story = list.items.find((s) => s.title === title);
      if (!story) throw new Error(`Story not found: ${title}`);
      await js(`location.hash = '#/story/${story.id}'`);
      await wait(4500);
      for (const [i, pos] of positions.entries()) {
        await js(`window.scrollTo(0, ${pos} * innerHeight)`);
        await wait(1600);
        const img = await win.capturePage();
        fs.writeFileSync(path.join(outDir, `${String(i).padStart(2, '0')}_${pos}.png`), img.resize({ width: 640 }).toPNG());
      }
      console.log('CAPTURED', positions.length);
      app.exit(0);
    } catch (err) {
      console.log('CAPTURE_ERROR', err.message);
      app.exit(1);
    }
  });
});

require('../electron/main.cjs');
