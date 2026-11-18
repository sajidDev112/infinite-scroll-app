// Minimal, explicit bridge — the renderer gets no Node.js access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('storyframe', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setFullScreen: (value) => ipcRenderer.invoke('window:set-fullscreen', value),
  isFullScreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  onFullScreenChange: (cb) => {
    const listener = (_e, value) => cb(value);
    ipcRenderer.on('window:fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('window:fullscreen-changed', listener);
  },
});
