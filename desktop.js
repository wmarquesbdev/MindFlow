const path = require('node:path');
const { app, BrowserWindow, shell, session } = require('electron');

const isSquirrelEvent = require('electron-squirrel-startup');
if (isSquirrelEvent) app.quit();

const HOST = '127.0.0.1';
const smokeTest = process.env.MINDFLOW_SMOKE_TEST === '1';
app.setName('MindFlow');
app.setPath('userData', smokeTest && process.env.MINDFLOW_SMOKE_DIR ? path.resolve(process.env.MINDFLOW_SMOKE_DIR) : path.join(app.getPath('appData'), 'MindFlow'));
const hasLock = !isSquirrelEvent && app.requestSingleInstanceLock();
if (!hasLock && !isSquirrelEvent) app.quit();

let mainWindow;
let localServer;

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
  const localOrigin = `http://${HOST}:${port}`;
  const window = new BrowserWindow({
    width: 1260,
    height: 820,
    minWidth: 760,
    minHeight: 600,
    show: false,
    backgroundColor: '#151a18',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'mindflow-icon.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false }
  });
  mainWindow = window;
  if (!smokeTest) window.once('ready-to-show', () => window.show());
  window.loadURL(localOrigin);
  if (smokeTest) window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`new Promise(resolve => {
        const started = Date.now();
        const check = () => {
          const status = document.querySelector('#sync-status')?.textContent;
          if (status && status !== 'Carregando dados locais…') resolve({ title: document.title, status, hasProfileDialog: Boolean(document.querySelector('#profile-dialog')?.open), hasFinance: Boolean(document.querySelector('#financas')) });
          else if (Date.now() - started > 8000) resolve({ error: 'startup_timeout', status });
          else setTimeout(check, 100);
        };
        check();
      })`);
      if (result.error || !result.hasFinance) { console.error('MINDFLOW_SMOKE_TEST_FAILED', result.error || 'finance_missing'); app.exit(1); return; }
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
    const port = await startLocalServer();
    createWindow(port);
  }).catch(error => { console.error('Não foi possível abrir o MindFlow:', error); app.quit(); });
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length && localServer?.listening) createWindow(localServer.address().port); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', () => { if (localServer?.listening) localServer.close(); });
}
