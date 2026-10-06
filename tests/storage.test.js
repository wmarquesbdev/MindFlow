const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStateStore } = require('../storage');

test('shared data survives restart and rejects stale writes without losing either copy', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mindflow-state-'));
  try {
    const first = createStateStore(directory);
    assert.equal(first.read(), null);
    const original = { profile: { name: 'Alex' }, tasks: [{ id: '1', title: 'Ler' }] };
    const saved = first.write(original, null);
    assert.equal(saved.conflict, false);
    assert.deepEqual(createStateStore(directory).read().state, original);
    const changed = first.write({ ...original, tasks: [{ id: '1', title: 'Estudar' }] }, saved.revision);
    assert.equal(changed.conflict, false);
    assert.equal(first.write({ profile: { name: 'Outra janela' } }, saved.revision).conflict, true);
    assert.deepEqual(first.read().state.tasks, [{ id: '1', title: 'Estudar' }]);
    assert.deepEqual(JSON.parse(fs.readFileSync(first.previousFile, 'utf8')).state, original);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('writes keep dated backups outside the application folder across launches', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mindflow-backups-'));
  let day = '2026-10-01';
  try {
    const store = createStateStore(directory, () => new Date(`${day}T12:00:00Z`));
    const first = store.write({ profile: { name: 'Alex' } }, null);
    const second = store.write({ profile: { name: 'Alex' }, finance: { bills: [{ title: 'Boleto' }] } }, first.revision);
    assert.equal(store.info().backupCount, 1);
    assert.equal(store.info().latestBackup, day);
    assert.equal(JSON.parse(fs.readFileSync(path.join(store.backupDirectory, `state-${day}.json`), 'utf8')).state.profile.name, 'Alex');
    day = '2026-10-02';
    store.write({ profile: { name: 'Alex' }, finance: { bills: [{ title: 'Boleto' }, { title: 'Internet' }] } }, second.revision);
    assert.equal(createStateStore(directory).read().state.finance.bills.length, 2);
    assert.equal(store.info().backupCount, 2);
    assert.equal(store.info().previousAvailable, true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('automatic dated backups are limited to the latest 30 days', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mindflow-retention-'));
  let currentDay = new Date('2026-10-01T12:00:00Z');
  try {
    const store = createStateStore(directory, () => currentDay);
    let revision = null;
    for (let index = 0; index < 33; index += 1) {
      revision = store.write({ counter: index }, revision).revision;
      currentDay = new Date(currentDay.getTime() + 86400000);
    }
    assert.equal(store.read().state.counter, 32);
    assert.equal(store.info().backupCount, 30);
    assert.equal(store.info().previousAvailable, true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('local API shares revisions and refuses requests from remote websites', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mindflow-api-'));
  process.env.MINDFLOW_DATA_DIR = directory;
  const { server } = require('../server');
  delete process.env.MINDFLOW_DATA_DIR;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/state`;
  try {
    const initial = await (await fetch(url)).json();
    assert.deepEqual(initial, { revision: null, state: null });
    const body = JSON.stringify({ revision: null, state: { profile: { name: 'Alex' } } });
    const write = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5500' }, body });
    assert.equal(write.status, 200);
    const revision = (await write.json()).revision;
    assert.equal((await (await fetch(url)).json()).state.profile.name, 'Alex');
    const stale = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5500' }, body });
    assert.equal(stale.status, 409);
    const blocked = await fetch(url, { headers: { Origin: 'https://example.org' } });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
    assert.equal((await (await fetch(url)).json()).revision, revision);
    const info = await (await fetch(url.replace('/api/state', '/api/storage-info'))).json();
    assert.equal(info.file, path.join(directory, 'state.json'));
    assert.equal(info.backupCount, 0);
    const zipResponse = await fetch(url.replace('/api/state', '/api/backup.zip'));
    assert.equal(zipResponse.status, 200);
    const zip = await require('jszip').loadAsync(await zipResponse.arrayBuffer());
    assert.equal(JSON.parse(await zip.file('state.json').async('string')).state.profile.name, 'Alex');
    const badDocument = await fetch(url.replace('/api/state', '/api/documents'), { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: 'not a pdf' });
    assert.equal(badDocument.status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
