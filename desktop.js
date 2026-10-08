const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, shell, session, ipcMain, screen, autoUpdater } = require('electron');
const { FocusClock } = require('./focus-clock');
const { createUpdater } = require('./desktop-updates');

const isSquirrelEvent = require('electron-squirrel-startup');
if (isSquirrelEvent) app.quit();

const HOST = '127.0.0.1';
const smokeTest = process.env.MINDFLOW_SMOKE_TEST === '1';
const isolatedTest = smokeTest || process.env.MINDFLOW_UI_TEST === '1';
app.setName('MindFlow');
if (isolatedTest && (!process.env.MINDFLOW_SMOKE_DIR || !process.env.MINDFLOW_DATA_DIR)) throw new Error('Testes exigem pastas isoladas para perfil e dados.');
app.setPath('userData', isolatedTest ? path.resolve(process.env.MINDFLOW_SMOKE_DIR) : path.join(app.getPath('appData'), 'MindFlow'));
const hasLock = !isSquirrelEvent && app.requestSingleInstanceLock();
if (!hasLock && !isSquirrelEvent) app.quit();

let mainWindow;
let localServer;
let miniWindow;
let miniReady;
let localOrigin = '';
let updateController;
const clock = new FocusClock();
const preload = path.join(__dirname, 'preload.js');
function broadcast(channel, value) {
  for (const window of [mainWindow, miniWindow]) if (window && !window.isDestroyed()) window.webContents.send(channel, value);
}
function trusted(event, allowMini = false) {
  return event.senderFrame === event.sender.mainFrame && (event.sender === mainWindow?.webContents && event.senderFrame.url.startsWith(localOrigin + '/') || allowMini && event.sender === miniWindow?.webContents && event.senderFrame.url.startsWith('file:'));
}
function showMain() { if (!mainWindow || mainWindow.isDestroyed()) return; mainWindow.show(); if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
function openMini() {
  if (miniWindow && !miniWindow.isDestroyed()) { if (!smokeTest) miniWindow.showInactive(); return; }
  const bounds = screen.getDisplayMatching(mainWindow.getBounds()).workArea;
  miniWindow = new BrowserWindow({ width: 290, height: 205, x: bounds.x + bounds.width - 314, y: bounds.y + bounds.height - 229, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: '#1d2421', webPreferences: { preload, nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  miniReady = new Promise(resolve => miniWindow.once('ready-to-show', () => {
    miniWindow?.setAlwaysOnTop(true, 'floating');
    if (!smokeTest) miniWindow?.showInactive();
    resolve();
  }));
  miniWindow.loadFile(path.join(__dirname, 'mini-timer.html'));
  miniWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  miniWindow.webContents.on('will-navigate', event => event.preventDefault());
  miniWindow.on('closed', () => { miniWindow = null; });
}
function bindDesktop() {
  const handle = (name, callback, allowMini = false) => ipcMain.handle(name, (event, value) => { if (!trusted(event, allowMini)) throw new Error('Origem inválida.'); return callback(value); });
  handle('focus:get', () => clock.snapshot(), true);
  handle('focus:action', value => {
    if (!value || typeof value !== 'object') throw new Error('Comando inválido.');
    const { action, minutes, mode } = value;
    if (action === 'configure') clock.configure(minutes, mode);
    else if (action === 'start') clock.start();
    else if (action === 'pause') clock.pause();
    else if (action === 'reset') clock.reset();
    else throw new Error('Comando inválido.');
    const result = clock.snapshot(); broadcast('focus:state', result); return result;
  }, true);
  handle('focus:mini', async () => { openMini(); await miniReady; return true; });
  handle('focus:main', () => { showMain(); return true; }, true);
  handle('focus:close', () => { miniWindow?.close(); if (mainWindow?.isMinimized() || !mainWindow?.isVisible()) showMain(); return true; }, true);
  handle('update:get', () => updateController.snapshot());
  handle('update:check', () => updateController.check());
  handle('update:install', () => updateController.install());
  let previous = '';
  setInterval(() => { const value = clock.snapshot(); const key = JSON.stringify(value); if (key !== previous) { previous = key; broadcast('focus:state', value); } }, 250).unref();
  const installed = !isolatedTest && process.platform === 'win32' && app.isPackaged && fs.existsSync(path.resolve(path.dirname(process.execPath), '..', 'Update.exe'));
  updateController = createUpdater({ updater: autoUpdater, version: app.getVersion(), installed, notify: value => broadcast('update:state', value), canInstall: () => !clock.snapshot().running });
  if (installed) {
    setTimeout(() => updateController.check(), process.argv.includes('--squirrel-firstrun') ? 60000 : 15000).unref();
    setInterval(() => updateController.check(), 30 * 60 * 1000).unref();
  }
}

function safeExternal(url) {
  try { return ['https:', 'http:'].includes(new URL(url).protocol); }
  catch { return false; }
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = error => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolve(server.address().port); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, HOST);
  });
}

async function startLocalServer() {
  // The browser and desktop app use the same data file even when another process owns the preferred port.
  const { server } = require('./server');
  localServer = server;
  try { return await listen(server, 3177); }
  catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    return listen(server, 0);
  }
}

function createWindow(port) {
  localOrigin = `http://${HOST}:${port}`;
  const window = new BrowserWindow({
    width: 1260,
    height: 820,
    minWidth: 760,
    minHeight: 600,
    show: false,
    backgroundColor: '#151a18',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'mindflow-icon.png'),
    webPreferences: { preload, nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false, backgroundThrottling: false }
  });
  mainWindow = window;
  window.on('minimize', () => { if (clock.snapshot().running) openMini(); });
  window.on('closed', () => { if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close(); });
  if (!smokeTest) window.once('ready-to-show', () => window.show());
  window.loadURL(localOrigin);
  if (smokeTest) window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`new Promise(resolve => {
        const started = Date.now();
        const check = async () => {
          const status = document.querySelector('#sync-status')?.textContent;
          const ready = document.querySelector('#app-loading')?.hidden;
          const timer = ready ? await window.mindflowDesktop.getTimer() : null;
          if (ready && timer?.configured) resolve({ title: document.title, status, hasProfileDialog: Boolean(document.querySelector('#profile-dialog')?.open), hasFinance: Boolean(document.querySelector('#financas')), uxReady: Boolean(document.querySelector('#open-quick-nav')) });
          else if (Date.now() - started > 8000) resolve({ error: 'startup_timeout', status });
          else setTimeout(check, 100);
        };
        check();
      })`);
      if (result.error || !result.hasFinance) { console.error('MINDFLOW_SMOKE_TEST_FAILED', result.error || 'finance_missing'); app.exit(1); return; }
      const timer = await window.webContents.executeJavaScript(`(async () => {
        const api = window.mindflowDesktop;
        if (!api) throw new Error('preload_missing');
        await api.timerAction({action:'configure',minutes:2,mode:'focus'});
        const running = await api.timerAction({action:'start'});
        await api.openMini();
        return {running,update:await api.getUpdate()};
      })()`);
      if (!timer.running.running || timer.running.seconds > 120 || timer.running.seconds < 118 || timer.update.status !== 'unavailable' || !miniWindow?.isAlwaysOnTop()) throw new Error('desktop_integration_failed: ' + JSON.stringify({ timer, miniAlwaysOnTop: miniWindow?.isAlwaysOnTop() }));
      if (miniWindow.webContents.isLoading()) await new Promise(resolve => miniWindow.webContents.once('did-finish-load', resolve));
      const paused = await miniWindow.webContents.executeJavaScript(`window.mindflowDesktop.timerAction({action:'pause'})`);
      if (paused.running || paused.seconds > 120 || paused.seconds < 100) throw new Error('mini_timer_sync_failed');
      result.desktopTimer = 'preload + independent mini window + shared pause OK';
      result.updater = timer.update.status;
      console.log('MINDFLOW_SMOKE_TEST', JSON.stringify(result));
    } catch (error) { console.error('MINDFLOW_SMOKE_TEST_FAILED', error); app.exit(1); return; }
    app.quit();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (safeExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin === localOrigin) return;
    event.preventDefault();
    if (safeExternal(url)) shell.openExternal(url);
  });
  window.on('closed', () => { mainWindow = null; });
  return window;
}

if (hasLock) {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    app.setAppUserModelId('com.squirrel.MindFlow.MindFlow');
    bindDesktop();
    const port = await startLocalServer();
    createWindow(port);
  }).catch(error => { console.error('Não foi possível abrir o MindFlow:', error); app.quit(); });
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length && localServer?.listening) createWindow(localServer.address().port); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', () => { if (localServer?.listening) localServer.close(); });
}
