const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld('mindflowDesktop', {
  getTimer: () => ipcRenderer.invoke('focus:get'),
  timerAction: value => ipcRenderer.invoke('focus:action', value),
  onTimer: callback => subscribe('focus:state', callback),
  openMini: () => ipcRenderer.invoke('focus:mini'),
  showMain: () => ipcRenderer.invoke('focus:main'),
  closeMini: () => ipcRenderer.invoke('focus:close'),
  getUpdate: () => ipcRenderer.invoke('update:get'),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: callback => subscribe('update:state', callback)
});
