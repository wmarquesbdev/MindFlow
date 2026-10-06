const FEEDS = {
  brazil: [
    ['BBC Brasil', 'https://feeds.bbci.co.uk/portuguese/rss.xml', 5],
    ['g1', 'https://g1.globo.com/rss/g1/', 4],
    ['Google Notícias', 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419', 0]
  ],
  technology: [
    ['g1 Tecnologia', 'https://g1.globo.com/rss/g1/tecnologia/', 5],
    ['Google Notícias', 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=pt-BR&gl=BR&ceid=BR:pt-419', 0]
  ],
  business: [
    ['g1 Economia', 'https://g1.globo.com/rss/g1/economia/', 5],
    ['Google Notícias', 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=pt-BR&gl=BR&ceid=BR:pt-419', 0]
  ],
  world: [
    ['BBC Brasil', 'https://feeds.bbci.co.uk/portuguese/rss.xml', 5],
    ['g1 Mundo', 'https://g1.globo.com/rss/g1/mundo/', 4]
  ]
};
const CACHE_MS = 15 * 60 * 1000;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const cache = new Map();
const pending = new Map();

function decodeEntities(value = '') {
  return String(value).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (entity[0] !== '#') return named[entity.toLowerCase()] || match;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  });
}
function unwrap(value = '') { return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'); }
function plainText(value = '') {
  return decodeEntities(decodeEntities(unwrap(value))).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function httpUrl(value) {
  try { const url = new URL(decodeEntities(value)); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function imageUrl(value) {
  const url = httpUrl(value);
  return url.startsWith('https://') ? url : '';
}
function tagAttribute(tag, name) {
  const match = tag?.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return decodeEntities(match?.[1] || match?.[2] || '');
}
function firstImage(item, description) {
  for (const tag of item.match(/<(?:media:thumbnail|media:content|enclosure)\b[^>]*>/gi) || []) {
    if (/^<media:content\b/i.test(tag) && !/\b(?:medium|type)\s*=\s*["']image(?:\/[\w.+-]+)?["']/i.test(tag)) continue;
    if (/^<enclosure\b/i.test(tag) && !/^image\//i.test(tagAttribute(tag, 'type'))) continue;
    const url = imageUrl(tagAttribute(tag, 'url'));
    if (url) return url;
  }
  const markup = decodeEntities(decodeEntities(unwrap(description)));
  for (const tag of markup.match(/<img\b[^>]*>/gi) || []) {
    const url = imageUrl(tagAttribute(tag, 'src'));
    if (url) return url;
  }
  return '';
}
function briefSummary(value, title) {
  const text = plainText(value);
  if (!text || text === title) return '';
  if (text.length <= 240) return text;
  const sentence = text.slice(0, 260).match(/^(.{80,240}?[.!?])(?:\s|$)/);
  return sentence ? sentence[1] : text.slice(0, 237).trimEnd() + '…';
}

// Only publisher-provided RSS fields are shown. Article HTML is never rendered.
function parseFeed(xml, source, now = Date.now()) {
  if (typeof xml !== 'string' || !/<rss[\s>]/i.test(xml)) return [];
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(([_, item], rank) => {
    const rawField = name => item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '';
    const field = name => plainText(rawField(name));
    const timestamp = Date.parse(field('pubDate'));
    const publisher = field('source');
    const headline = field('title');
    const suffix = publisher ? ' - ' + publisher : '';
    const title = suffix && headline.endsWith(suffix) ? headline.slice(0, -suffix.length) : headline;
    const description = rawField('description');
    const summary = source === 'Google Notícias' ? '' : briefSummary(rawField('atom:subtitle') || rawField('media:description') || description, title);
    return {
      title: title.slice(0, 260), url: httpUrl(field('link')), domain: publisher || source,
      date: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '',
      summary, image: firstImage(item, description), rank, timestamp
    };
  }).filter(item => item.title && item.url && Number.isFinite(item.timestamp) && item.timestamp <= now + 300000 && now - item.timestamp <= MAX_AGE_MS);
}
function selectHeadlines(items, now = Date.now()) {
  const seenUrls = new Set(), seenTitles = new Set();
  const sorted = items.map(item => ({
    ...item,
    score: Math.max(0, 24 - (now - item.timestamp) / 3600000) + 12 / (1 + item.rank)
      + (item.editorialWeight || 0) + (item.image ? 6 : -8) + (item.summary ? 2 : -4)
      - (/^(?:resultado das elei[cç][oõ]es \d{4} em |assista ao |clique aqui$)/i.test(item.title) ? 40 : 0)
  })).sort((a, b) => b.score - a.score);
  const unique = sorted.filter(item => {
    const key = item.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenUrls.has(item.url) || seenTitles.has(key)) return false;
    seenUrls.add(item.url); seenTitles.add(key); return true;
  });
  const selected = [], sourceCounts = new Map();
  for (const item of unique) {
    const count = sourceCounts.get(item.domain) || 0;
    if (count >= 5) continue;
    selected.push(item); sourceCounts.set(item.domain, count + 1);
    if (selected.length === 10) break;
  }
  for (const item of unique) {
    if (selected.length === 10) break;
    if (!selected.includes(item)) selected.push(item);
  }
  return selected.map(({ rank, timestamp, score, editorialWeight, ...item }) => item);
}
async function readFeed([source, url, editorialWeight = 0]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(6500), headers: { 'User-Agent': 'MindFlow/2.7 RSS Reader', Accept: 'application/rss+xml, application/xml, text/xml' } });
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
      const payload = { articles, topic, updatedAt: new Date().toISOString(), stale: false, partial: results.some(result => result.status === 'rejected'), selection: 'Manchetes dos feeds, priorizadas por atualidade. Imagem e resumo são publicados pelos veículos quando disponíveis.' };
      cache.set(topic, { savedAt: Date.now(), payload }); return payload;
    }
    if (saved) return { ...saved.payload, stale: true };
    return { articles: [], topic, error: 'news_unavailable' };
  })();
  pending.set(topic, job);
  try { return await job; } finally { pending.delete(topic); }
}
module.exports = { getNews, parseFeed, selectHeadlines, httpUrl };
