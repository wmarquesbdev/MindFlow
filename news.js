const FEEDS = {
  brazil: [['Google Notícias', 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419', 12], ['BBC Brasil', 'https://feeds.bbci.co.uk/portuguese/rss.xml', 6], ['g1', 'https://g1.globo.com/rss/g1/', 0]],
  technology: [['g1 Tecnologia', 'https://g1.globo.com/rss/g1/tecnologia/'], ['Google Notícias', 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=pt-BR&gl=BR&ceid=BR:pt-419']],
  business: [['g1 Economia', 'https://g1.globo.com/rss/g1/economia/'], ['Google Notícias', 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=pt-BR&gl=BR&ceid=BR:pt-419']],
  world: [['g1 Mundo', 'https://g1.globo.com/rss/g1/mundo/'], ['BBC Brasil', 'https://feeds.bbci.co.uk/portuguese/rss.xml']]
};
const CACHE_MS = 15 * 60 * 1000;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const cache = new Map();
const pending = new Map();
function decodeText(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (entity[0] !== '#') return entities[entity.toLowerCase()] || match;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).trim();
}
function httpUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
// Read only RSS 2.0 headline fields; feed HTML is never rendered.
function parseFeed(xml, source, now = Date.now()) {
  if (typeof xml !== 'string' || !/<rss[\s>]/i.test(xml)) return [];
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(([_, item], rank) => {
    const field = name => decodeText(item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '');
    const timestamp = Date.parse(field('pubDate'));
    const publisher = field('source');
    const headline = field('title');
    const suffix = publisher ? ' - ' + publisher : '';
    const title = suffix && headline.endsWith(suffix) ? headline.slice(0, -suffix.length) : headline;
    return { title: title.slice(0, 260), url: httpUrl(field('link')), domain: publisher || source, date: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '', rank, timestamp };
  }).filter(item => item.title && item.url && Number.isFinite(item.timestamp) && item.timestamp <= now + 300000 && now - item.timestamp <= MAX_AGE_MS);
}
function selectHeadlines(items, now = Date.now()) {
  const seenUrls = new Set(), seenTitles = new Set();
  const sorted = items.map(item => ({ ...item, score: Math.max(0, 24 - (now - item.timestamp) / 3600000) + 12 / (1 + item.rank) + (item.editorialWeight || 0) })).sort((a, b) => b.score - a.score);
  return sorted.filter(item => {
    const key = item.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenUrls.has(item.url) || seenTitles.has(key)) return false;
    seenUrls.add(item.url); seenTitles.add(key); return true;
  }).slice(0, 10).map(({ rank, timestamp, score, editorialWeight, ...item }) => item);
}
async function readFeed([source, url, editorialWeight = 0]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(6500), headers: { 'User-Agent': 'MindFlow/2.1 RSS Reader', Accept: 'application/rss+xml, application/xml, text/xml' } });
  if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 2000000) { await reader.cancel(); throw new Error('Feed too large'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return parseFeed(Buffer.concat(chunks).toString('utf8'), source).map(item => ({ ...item, editorialWeight }));
}
async function getNews(topic = 'brazil') {
  topic = Object.hasOwn(FEEDS, topic) ? topic : 'brazil';
  const saved = cache.get(topic);
  if (saved && Date.now() - saved.savedAt < CACHE_MS) return { ...saved.payload, cached: true };
  if (pending.has(topic)) return pending.get(topic);
  const job = (async () => {
    const results = await Promise.allSettled(FEEDS[topic].map(readFeed));
    const articles = selectHeadlines(results.flatMap(result => result.status === 'fulfilled' ? result.value : []));
    if (articles.length) {
      const payload = { articles, topic, updatedAt: new Date().toISOString(), stale: false, partial: results.some(result => result.status === 'rejected'), selection: 'Destaques dos feeds, priorizados por atualidade e sem títulos repetidos. Janela de até 48 horas.' };
      cache.set(topic, { savedAt: Date.now(), payload }); return payload;
    }
    if (saved) return { ...saved.payload, stale: true };
    return { articles: [], topic, error: 'news_unavailable' };
  })();
  pending.set(topic, job);
  try { return await job; } finally { pending.delete(topic); }
}
module.exports = { getNews, parseFeed, selectHeadlines, httpUrl };
