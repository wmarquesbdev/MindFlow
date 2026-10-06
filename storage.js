const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_STATE_BYTES = 12 * 1024 * 1024;

function defaultDataDirectory() {
  if (process.env.MINDFLOW_DATA_DIR) return path.resolve(process.env.MINDFLOW_DATA_DIR);
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'MindFlow', 'data');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'MindFlow', 'data');
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'mindflow');
}

function createStateStore(directory = defaultDataDirectory(), now = () => new Date()) {
  const file = path.join(directory, 'state.json');
  const previousFile = path.join(directory, 'state.previous.json');
  const backupDirectory = path.join(directory, 'backups');
  const backupName = name => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(name);

  function backups() {
    try { return fs.readdirSync(backupDirectory).filter(backupName).sort().reverse(); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }

  function info() {
    const saved = backups();
    return { file, backupDirectory, backupCount: saved.length, latestBackup: saved[0]?.slice(6, 16) || null, previousAvailable: fs.existsSync(previousFile) };
  }

  function read() {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      if (Buffer.byteLength(raw) > MAX_STATE_BYTES) throw new Error('O arquivo de dados é grande demais.');
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || !value.state || typeof value.state !== 'object' || typeof value.revision !== 'string') throw new Error('Arquivo de dados inválido.');
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  function write(state, expectedRevision) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Dados inválidos.');
    const current = read();
    if ((current?.revision || null) !== expectedRevision) return { conflict: true, current };
    const next = { revision: crypto.randomUUID(), state };
    const json = JSON.stringify(next);
    if (Buffer.byteLength(json) > MAX_STATE_BYTES) throw new Error('O backup excede o tamanho permitido.');
    fs.mkdirSync(directory, { recursive: true });
    const temporaryFile = path.join(directory, `state.${crypto.randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temporaryFile, json, { encoding: 'utf8', flag: 'wx' });
      if (current) {
        const day = now().toISOString().slice(0, 10);
        const datedBackup = path.join(backupDirectory, `state-${day}.json`);
        fs.mkdirSync(backupDirectory, { recursive: true });
        try { fs.copyFileSync(file, datedBackup, fs.constants.COPYFILE_EXCL); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
        fs.copyFileSync(file, previousFile);
      }
      fs.renameSync(temporaryFile, file);
      try { backups().slice(30).forEach(name => fs.unlinkSync(path.join(backupDirectory, name))); }
      catch { /* A gravação principal já foi concluída; preserve o estado salvo. */ }
    } finally {
      try { fs.unlinkSync(temporaryFile); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return { conflict: false, revision: next.revision };
  }

  return { file, previousFile, backupDirectory, info, read, write };
}

module.exports = { MAX_STATE_BYTES, createStateStore, defaultDataDirectory };
