const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { defaultDataDirectory } = require('./storage');

const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
const TYPES = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const MIME = Object.fromEntries(Object.entries(TYPES).map(([type, extension]) => [extension, type]));
const directory = path.join(defaultDataDirectory(), 'documents');

function parseBrazilianMoney(raw) {
  const digits = String(raw).replace(/R\$/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 && value < 1e10 ? Math.round(value * 100) : null;
}
function isoDate(raw) {
  const match = String(raw).match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (!match) return '';
  const value = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : '';
}
function analyzeText(text) {
  const lines = String(text).split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 1200);
  const moneyPattern = /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|(?:R\$\s*)?\d+,\d{2}/g;
  const evidence = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lower = line.toLocaleLowerCase('pt-BR');
    const amounts = [...line.matchAll(moneyPattern)].filter(match => line[match.index - 1] !== '-' && line[match.index + match[0].length] !== '%').map(match => ({ raw: match[0], cents: parseBrazilianMoney(match[0]) })).filter(item => item.cents);
    if (!amounts.length && !/(venc|pag|multa|juros|encargo|^valor\s*$)/i.test(lower)) continue;
    if (/(multa|juros|encargo|morat[oó]rio)/i.test(lower) && !/(pr[oó]xim|em caso|se voc[eê]|m[aá]ximo|taxa de)/i.test(lower)) evidence.push({ kind: 'charge', line: line.slice(0, 180), amountCents: amounts.find(item => item.raw.includes('R$'))?.cents || null });
    if (/(vencimento|vence em|data de venc)/i.test(lower)) {
      const date = isoDate(line) || isoDate(lines[index + 1]);
      if (date) evidence.push({ kind: 'due', line: line.slice(0, 180), date });
    }
    if (/(valor total|total da fatura|valor da fatura|total a pagar|valor a pagar|valor do documento|valor cobrado|^total\b)/i.test(lower) && amounts.length) evidence.push({ kind: 'total', line: line.slice(0, 180), amountCents: amounts.at(-1).cents });
    if (/^valor\s*$/i.test(line) && /^R\$\s*[\d.,]+/.test(lines[index + 1] || '')) evidence.push({ kind: 'total', line: `${line} ${lines[index + 1]}`.slice(0, 180), amountCents: parseBrazilianMoney(lines[index + 1]) });
    if (/(valor pago|pagamento realizado|pagamento efetuado)/i.test(lower) && amounts.length) evidence.push({ kind: 'paid', line: line.slice(0, 180), amountCents: amounts.at(-1).cents });
  }
  const first = kind => evidence.find(item => item.kind === kind);
  const paymentWords = lines.some(line => /(comprovante de pagamento|pagamento realizado|pagamento efetuado|transa[cç][aã]o conclu[ií]da)/i.test(line));
  const invoiceWords = lines.some(line => /fatura|boleto|demonstrativo/i.test(line));
  return { kind: paymentWords ? 'receipt' : invoiceWords ? 'invoice' : 'unknown', amountCents: first('total')?.amountCents || first('paid')?.amountCents || null, paidCents: first('paid')?.amountCents || null, dueDate: first('due')?.date || '', charges: evidence.filter(item => item.kind === 'charge').slice(0, 8), evidence: evidence.slice(0, 16), reviewRequired: true };
}
async function extractText(buffer, type) {
  if (type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false });
    const pdf = await task.promise;
    try {
      const pages = [];
      for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 12); pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        let line = '', previousY = null;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = item.transform?.[5];
          if (previousY !== null && y !== undefined && Math.abs(y - previousY) > 3) { pages.push(line); line = ''; }
          line += `${item.str} `;
          previousY = y;
        }
        pages.push(line);
      }
      return { text: pages.join('\n').slice(0, 80000), method: 'pdf-text' };
    } finally { await task.destroy(); }
  }
  const { createWorker } = require('tesseract.js');
  const language = require('@tesseract.js-data/por');
  const cachePath = path.join(defaultDataDirectory(), 'ocr-cache');
  fs.mkdirSync(cachePath, { recursive: true });
  const worker = await createWorker(language.code, 1, { langPath: language.langPath, gzip: language.gzip, cachePath });
  try { const result = await worker.recognize(buffer); return { text: result.data.text.slice(0, 80000), method: 'ocr-image' }; }
  finally { await worker.terminate(); }
}
function validSignature(buffer, type) {
  if (type === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
  if (type === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (type === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (type === 'image/webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}
async function saveDocument(buffer, type, name) {
  if (!TYPES[type]) throw Object.assign(new Error('Use PDF, PNG, JPG ou WebP.'), { status: 415 });
  if (!buffer.length || buffer.length > MAX_DOCUMENT_BYTES || !validSignature(buffer, type)) throw Object.assign(new Error('Arquivo inválido ou maior que 12 MB.'), { status: 400 });
  const id = crypto.randomUUID();
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${id}${TYPES[type]}`), buffer, { flag: 'wx' });
  let extracted = { text: '', method: 'unavailable' };
  try { extracted = await extractText(buffer, type); } catch { /* O arquivo continua salvo para revisão manual. */ }
  const analysis = analyzeText(extracted.text);
  return { id, name: path.basename(String(name || 'Documento')).slice(0, 120), type, size: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), method: extracted.method, analysis, needsManualEntry: !extracted.text.trim() };
}
function readDocument(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  for (const [extension, type] of Object.entries(MIME)) {
    const file = path.join(directory, `${id}${extension}`);
    if (fs.existsSync(file)) return { file, type };
  }
  return null;
}
module.exports = { MAX_DOCUMENT_BYTES, analyzeText, extractText, saveDocument, readDocument };
