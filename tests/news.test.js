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
test('publisher RSS supplies the real cover and a short, plain-text description', () => {
  const bbc = `<rss><item><title>Ciência hoje</title><link>https://bbc.example/story</link><pubDate>Wed, 30 Sep 2026 11:00:00 GMT</pubDate><description><![CDATA[<p>Uma descoberta importante para a ciência.</p>]]></description><media:thumbnail url="https://images.example/cover.jpg" /></item></rss>`;
  const first = parseFeed(bbc, 'BBC Brasil', now)[0];
  assert.equal(first.image, 'https://images.example/cover.jpg');
  assert.equal(first.summary, 'Uma descoberta importante para a ciência.');
  const g1 = `<rss><item><title>Economia</title><link>https://g1.example/story</link><pubDate>Wed, 30 Sep 2026 11:00:00 GMT</pubDate><atom:subtitle>Resumo objetivo.</atom:subtitle><description><![CDATA[<img src="https://images.example/real.jpg" />Texto longo da matéria.]]></description></item></rss>`;
  const second = parseFeed(g1, 'g1', now)[0];
  assert.equal(second.image, 'https://images.example/real.jpg');
  assert.equal(second.summary, 'Resumo objetivo.');
});
test('unsafe image URLs are rejected and Google aggregations are not presented as summaries', () => {
  const xml = `<rss><item><title>Manchete</title><link>https://news.example/story</link><pubDate>Wed, 30 Sep 2026 11:00:00 GMT</pubDate><description><![CDATA[<img src="javascript:alert(1)"><a>Outra manchete</a>]]></description></item></rss>`;
  const article = parseFeed(xml, 'Google Notícias', now)[0];
  assert.equal(article.image, '');
  assert.equal(article.summary, '');
});
test('selection deduplicates headlines and URLs and keeps ten items at most', () => {
  const articles = parseFeed('<rss>' + Array.from({length: 15}, (_, i) => item('Notícia ' + i, 'https://example.com/' + i)).join('') + item('Notícia 0', 'https://example.com/duplicate') + '</rss>', 'Jornal', now);
  const selected = selectHeadlines(articles, now);
  assert.equal(selected.length, 10);
  assert.equal(new Set(selected.map(a => a.title)).size, 10);
  assert.equal(selected[0].title, 'Notícia 0');
});
test('generic automated and live-program headlines do not crowd out useful articles', () => {
  const timestamp = now - 3600000;
  const items = [
    { title: 'Resultado das eleições 2026 em Cidade (SC): votação', url: 'https://example.com/a', domain: 'g1', timestamp, rank: 0, image: 'https://example.com/a.jpg', summary: 'Resumo' },
    { title: 'Assista ao jornal desta terça', url: 'https://example.com/b', domain: 'g1', timestamp, rank: 1, image: 'https://example.com/b.jpg', summary: 'Resumo' },
    { title: 'Pesquisa revela novo tratamento', url: 'https://example.com/c', domain: 'BBC', timestamp, rank: 5, image: 'https://example.com/c.jpg', summary: 'Resumo' }
  ];
  assert.equal(selectHeadlines(items, now)[0].title, 'Pesquisa revela novo tratamento');
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
