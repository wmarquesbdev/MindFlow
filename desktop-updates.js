const FEED_URL = 'https://github.com/wmarquesbdev/MindFlow/releases/latest/download/';
function createUpdater({ updater, version, installed, notify = () => {}, canInstall = () => true }) {
  let state = { version, status: installed ? 'idle' : 'unavailable', message: installed ? 'As atualizações serão baixadas automaticamente.' : 'Atualizações automáticas disponíveis no app instalado para Windows.' };
  const publish = (status, message) => { state = { ...state, status, message }; notify({ ...state }); };
  if (installed) {
    updater.setFeedURL({ url: FEED_URL });
    updater.on('checking-for-update', () => publish('checking', 'Procurando uma nova versão…'));
    updater.on('update-available', () => publish('downloading', 'Baixando atualização. Você pode continuar usando o app.'));
    updater.on('update-not-available', () => publish('current', 'Você está com a versão mais recente.'));
    updater.on('update-downloaded', () => publish('ready', 'Atualização pronta. Será aplicada quando você reabrir o app.'));
    updater.on('error', () => publish('error', 'Não foi possível verificar agora. Tentaremos novamente mais tarde.'));
  }
  return {
    snapshot: () => ({ ...state }),
    check() {
      if (!installed || ['checking', 'downloading', 'ready'].includes(state.status)) return { ...state };
      publish('checking', 'Procurando uma nova versão…');
      try { updater.checkForUpdates(); } catch { publish('error', 'Não foi possível verificar agora. Tente novamente.'); }
      return { ...state };
    },
    install() {
      if (state.status !== 'ready' || !canInstall()) return false;
      updater.quitAndInstall(); return true;
    }
  };
}
module.exports = { createUpdater, FEED_URL };
