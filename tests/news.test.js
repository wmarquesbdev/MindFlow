const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFeed, selectHeadlines, getNews } = require('../news');
const { requestedFile, server } = require('../server');
const now = Date.parse('2026-09-30T12:00:00Z');
const item = (title, url, date = 'Wed, 30 Sep 2026 11:00:00 GMT') => `<item><title><![CDATA[${title}]]></title><link>${url}</link><pubDate>${date}</pubDate></item>`;
test('RSS reads CDATA and rejects stale, future, invalid dates and unsafe links', () => {
  const xml = '<rss>' + item('Ciência &amp; tecnologia', 'https://example.com/a') + item('Antiga', 'https://example.com/b', 'Mon, 01 Jun 2026 11:00:00 GMT') + item('Sem data', 'https://example.com/c', '') + item('Futura', 'https://example.com/d', 'Wed, 30 Sep 2026 18:00:00 GMT') + item('Link inválido', 'javascript:alert(1)') + '</rss>';
  const articles = parseFeed(xml, 'Jornal', now);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'Ciência & tecnologia');
  assert.equal(articles[0].date, '2026-09-30T11:00:00.000Z');
});
test('selection deduplicates headlines and URLs and keeps ten items at most', () => {
  const articles = parseFeed('<rss>' + Array.from({length: 15}, (_, i) => item('Notícia ' + i, 'https://example.com/' + i)).join('') + item('Notícia 0', 'https://example.com/duplicate') + '</rss>', 'Jornal', now);
  const selected = selectHeadlines(articles, now);
  assert.equal(selected.length, 10);
  assert.equal(new Set(selected.map(a => a.title)).size, 10);
  assert.equal(selected[0].title, 'Notícia 0');
});
test('static server serves assets but not git, code internals or traversals', () => {
  assert.ok(requestedFile('/'));
  assert.ok(requestedFile('/assets/pixel/avatar-ogre.png'));
  for (const file of ['/.git/config', '/server.js', '/news.js', '/assets/../package.json', '/assets/%2e%2e/%2e%2e/secret']) assert.equal(requestedFile(file), null);
});
test('feed failure is explicit without cache and preserves dated content when a cache exists', async () => {
  const originalFetch = global.fetch, originalNow = Date.now;
  try {
    global.fetch = async () => { throw new Error('offline'); };
    const empty = await getNews('world');
    assert.equal(empty.error, 'news_unavailable');
    assert.equal(empty.articles.length, 0);
    global.fetch = async () => new Response('<rss>' + item('Manchete salva', 'https://example.com/saved', new Date().toUTCString()) + '</rss>');
    const fresh = await getNews('world');
    assert.equal(fresh.articles.length, 1);
    Date.now = () => originalNow() + 16 * 60 * 1000;
    global.fetch = async () => { throw new Error('offline'); };
    const stale = await getNews('world');
    assert.equal(stale.stale, true);
    assert.equal(stale.updatedAt, fresh.updatedAt);
    assert.deepEqual(stale.articles, fresh.articles);
  } finally { global.fetch = originalFetch; Date.now = originalNow; }
});
test('API accepts local Live Server origins and never grants a remote site access', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/news';
  const originalFetch = global.fetch;
  // Upstream only is mocked: requests to our real local HTTP server are untouched.
  global.fetch = (target, options) => String(target).startsWith('https:') ? Promise.resolve(new Response('<rss>' + item('Manchete', 'https://example.com/story', new Date().toUTCString()) + '</rss>')) : originalFetch(target, options);
  try {
    const local = await originalFetch(url, {headers: {Origin: 'http://127.0.0.1:5500'}});
    assert.equal(local.status, 200);
    assert.equal(local.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5500');
    assert.equal((await local.json()).articles.length, 1);
    const remote = await originalFetch(url, {headers: {Origin: 'https://example.org'}});
    assert.equal(remote.headers.get('access-control-allow-origin'), null);
  } finally { global.fetch = originalFetch; await new Promise(resolve => server.close(resolve)); }
});
