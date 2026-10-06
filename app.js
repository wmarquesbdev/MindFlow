// A troca de marca não descarta o que já foi criado localmente.
const STORAGE_KEY = 'mindflow-v1';
const SYNC_MARKER_KEY = 'mindflow-sync-v1';
const SYNC_PENDING_KEY = 'mindflow-sync-pending-v1';
const PREVIOUS_STORAGE_KEYS = ['daydream-v1', 'norte-diario-v1'];
const APP_NAME = 'MindFlow';
const LOCAL_SERVER_PORT = '3177';
let DATE_KEY = new Date().toLocaleDateString('en-CA');
let MONTH_KEY = DATE_KEY.slice(0, 7);
const STATUS = { backlog: 'Backlog', next: 'Próxima', doing: 'Em andamento', done: 'Concluído' };
const WIP_LIMIT = 2;
const NEWS_TOPICS = {
  brazil: { label: 'Brasil', query: 'sourcecountry:brazil' },
  technology: { label: 'Tecnologia', query: 'technology sourcelang:portuguese' },
  business: { label: 'Economia', query: 'economia sourcelang:portuguese' },
  world: { label: 'Mundo', query: 'world' }
};
const DEFAULT_HABITS = [
  { id: 'drink-water', title: 'Beber água', cue: 'ao começar o dia', active: true },
  { id: 'move-body', title: 'Mover o corpo', cue: 'em uma pausa', active: true },
  { id: 'read-ten', title: 'Ler por 10 minutos', cue: 'antes de encerrar o dia', active: true }
];
const FINANCE_CATEGORIES = {
  income: { salary: 'Pagamento', extra: 'Extra', other: 'Outras entradas' },
  expense: { housing: 'Moradia', food: 'Alimentação', transport: 'Transporte', bills: 'Contas', health: 'Saúde', education: 'Educação', leisure: 'Lazer', other: 'Outros gastos' }
};
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const defaultState = {
  profile: { name: '', avatar: 'frieren', photo: '' },
  settings: { theme: 'light', newsTopic: 'brazil', accent: 'sage', density: 'comfortable', fontScale: 'medium', showNews: true, reducedMotion: false, quoteOffset: 0, taskView: 'list' },
  habitDefinitions: DEFAULT_HABITS,
  habits: {}, journal: {}, checkin: {}, updates: [], focusMinutes: {}, rituals: {}, focusTask: '', newsCache: {},
  tasks: [],
  learning: [],
  ikigai: {},
  dreams: [],
  cycles: [],
  activeCycleId: '',
  notes: [],
  finance: { transactions: [], monthlyLimits: {}, bills: [], skippedBills: {}, documents: [], account: { balanceCents: null, anchoredAt: '', anchoredDay: '' }, card: { name: 'Meu cartão', limitCents: 0, closingDay: 25, dueDay: 10, purchases: [], statements: {}, paidInvoices: {} } },
  care: { goals: [], events: [] }
};

const QUOTES = [
  { text: 'A felicidade de sua vida depende da qualidade de seus pensamentos.', author: 'Marco Aurélio' },
  { text: 'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.', author: 'Sêneca' },
  { text: 'A atenção é a forma mais rara e pura de generosidade.', author: 'Simone Weil' },
  { text: 'Conhecer a si mesmo é o começo de toda sabedoria.', author: 'Aristóteles' },
  { text: 'O segredo de avançar é começar.', author: 'Mark Twain' },
  { text: 'A simplicidade é o último grau de sofisticação.', author: 'Leonardo da Vinci' },
  { text: 'A vida não examinada não vale a pena ser vivida.', author: 'Sócrates' }
];

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const clone = value => structuredClone(value);
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const activeHabits = () => habitsForDay(DATE_KEY).filter(habit => habit.active !== false);
const todayHabits = () => state.habits[DATE_KEY] || {};
const progress = (current, total) => total ? Math.min(100, Math.round((Number(current) / Number(total)) * 100)) : 0;
const asText = (value, fallback = '') => typeof value === 'string' ? value : fallback;

function monthLabel(month = MONTH_KEY, options = { month: 'long', year: 'numeric' }) {
  const date = new Date(`${month}-01T12:00:00`);
  return Number.isNaN(date.getTime()) ? month : new Intl.DateTimeFormat('pt-BR', options).format(date).replace(/^./, char => char.toUpperCase());
}

function activeCycle() {
  return state.cycles.find(cycle => cycle.id === state.activeCycleId)
    || state.cycles.find(cycle => cycle.month === MONTH_KEY)
    || state.cycles[0]
    || null;
}

function habitsForCycle(cycleId) {
  return state.habitDefinitions.filter(habit => habit.active !== false && (!cycleId || habit.cycleId === cycleId));
}

function cycleForDay(day) {
  return state.cycles.find(cycle => cycle.month === String(day).slice(0, 7)) || null;
}

function habitsForDay(day) {
  const cycle = cycleForDay(day);
  const recorded = state.habits[day] || {};
  return state.habitDefinitions.filter(habit => (cycle && habit.cycleId === cycle.id && habit.active !== false) || Object.hasOwn(recorded, habit.id));
}

function recentDateKeys(count = 7) {
  const current = new Date();
  current.setHours(12, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(current);
    day.setDate(day.getDate() - index);
    return day.toLocaleDateString('en-CA');
  });
}

function isDateKey(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }

function dateFromKey(key) {
  const date = new Date(`${key}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatHistoryDate(key, options = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const date = dateFromKey(key);
  return date ? new Intl.DateTimeFormat('pt-BR', options).format(date).replace(/^./, char => char.toUpperCase()) : key;
}

function formatHistoryWeekday(key) {
  return formatHistoryDate(key, { weekday: 'short' }).replace('.', '').slice(0, 3);
}

function recordedDayKeys() {
  const dates = new Set();
  [state.habits, state.journal, state.checkin, state.focusMinutes].forEach(source => {
    Object.keys(source || {}).filter(isDateKey).forEach(day => dates.add(day));
  });
  return dates;
}

function hasDayData(day) {
  const habitValues = state.habits[day] || {};
  const journal = state.journal[day] || {};
  const checkin = state.checkin[day] || {};
  return Object.keys(habitValues).length > 0
    || Object.values(journal).some(value => String(value || '').trim())
    || Object.values(checkin).some(Boolean)
    || Number(state.focusMinutes[day]) > 0;
}

function daySummary(day) {
  const habits = habitsForDay(day);
  const values = state.habits[day] || {};
  const completed = habits.filter(habit => values[habit.id]).length;
  const total = habits.length;
  return {
    day,
    habits,
    values,
    completed,
    total,
    percentage: total ? Math.round((completed / total) * 100) : 0,
    journal: state.journal[day] || {},
    checkin: state.checkin[day] || {},
    focus: Number(state.focusMinutes[day]) || 0,
    hasData: hasDayData(day)
  };
}

function historyDateKeys(limit = 28) {
  const dates = new Set([...recentDateKeys(limit), ...recordedDayKeys(), selectedHistoryDate]);
  return [...dates].sort((first, second) => second.localeCompare(first));
}

function normalizeTask(task = {}) {
  const source = task && typeof task === 'object' ? task : {};
  const status = STATUS[source.status] ? source.status : 'backlog';
  return {
    id: asText(source.id) || makeId(),
    title: asText(source.title, 'Nova tarefa').trim() || 'Nova tarefa',
    area: source.area === 'work' ? 'work' : 'personal',
    priority: ['high', 'medium', 'low'].includes(source.priority) ? source.priority : 'medium',
    status,
    date: /^\d{4}-\d{2}-\d{2}$/.test(asText(source.date)) ? source.date : '',
    note: asText(source.note)
  };
}

function normalizeLearningItem(item = {}) {
  const source = item && typeof item === 'object' ? item : {};
  const total = Math.max(0, Number(source.total) || 0);
  return {
    id: asText(source.id) || makeId(),
    title: asText(source.title, 'Novo item').trim() || 'Novo item',
    type: source.type === 'course' ? 'course' : 'reading',
    author: asText(source.author),
    category: asText(source.category, 'Geral').trim().slice(0, 40) || 'Geral',
    total,
    current: Math.max(0, Math.min(Number(source.current) || 0, total || Number.MAX_SAFE_INTEGER))
  };
}

function normalizeDream(dream = {}) {
  const source = dream && typeof dream === 'object' ? dream : {};
  return { emoji: asText(source.emoji, '✦'), title: asText(source.title, 'Nova direção'), note: asText(source.note) };
}
function normalizeCycle(cycle = {}, fallbackHabits = []) {
  const source = cycle && typeof cycle === 'object' ? cycle : {};
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asText(source.month)) ? source.month : MONTH_KEY;
  return {
    id: asText(source.id) || `cycle-${month}-${makeId()}`,
    month,
    name: asText(source.name).trim().slice(0, 60) || monthLabel(month),
    description: asText(source.description).trim().slice(0, 360),
    goals: Array.isArray(source.goals) ? source.goals.map(goal => asText(goal).trim()).filter(Boolean).slice(0, 12) : asText(source.goals).split(/\r?\n/).map(goal => goal.trim()).filter(Boolean).slice(0, 12),
    image: safeImage(asText(source.image)),
    banner: BANNERS.some(item => item.id === source.banner) ? source.banner : (Object.hasOwn(source, 'banner') || source.image ? '' : 'forest'),
    accent: ['sage', 'ocean', 'lavender', 'sand'].includes(source.accent) ? source.accent : 'sage',
    habitIds: Array.isArray(source.habitIds) ? source.habitIds.map(asText).filter(Boolean) : fallbackHabits.map(habit => habit.id),
    createdAt: asText(source.createdAt) || new Date().toISOString()
  };
}

function makeDefaultCycle(definitions = []) {
  return normalizeCycle({
    id: `cycle-${MONTH_KEY}`,
    month: MONTH_KEY,
    name: monthLabel(MONTH_KEY),
    description: 'Um espaço simples para construir constância neste mês.',
    goals: ['Escolher o que realmente importa'],
    accent: 'sage',
    habitIds: definitions.map(habit => habit.id)
  }, definitions);
}

function normalizeNote(note = {}) {
  const source = note && typeof note === 'object' ? note : {};
  return {
    id: asText(source.id) || makeId(),
    title: asText(source.title, 'Nota sem título').trim().slice(0, 100) || 'Nota sem título',
    body: asText(source.body),
    category: asText(source.category, 'Geral').trim().slice(0, 40) || 'Geral',
    pinned: Boolean(source.pinned),
    updatedAt: asText(source.updatedAt) || new Date().toISOString()
  };
}

function parseMoneyToCents(value) {
  const raw = String(value ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  let integer; let fraction = '';
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)) {
    const [whole, decimal = ''] = raw.split(','); integer = whole.replace(/\./g, ''); fraction = decimal;
  } else if (/^\d+(?:[,.]\d{1,2})?$/.test(raw)) {
    [integer, fraction = ''] = raw.split(/[,.]/);
  } else return null;
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
function parseSignedMoneyToCents(value) {
  const raw = String(value ?? '').trim();
  if (/^(?:-?\s*)?(?:R\$\s*)?0(?:[,.]0{1,2})?$/.test(raw)) return 0;
  const negative = raw.startsWith('-');
  const cents = parseMoneyToCents(negative ? raw.slice(1).trim() : raw);
  return cents === null ? null : negative ? -cents : cents;
}

function formatMoney(cents) { return brl.format((Number(cents) || 0) / 100); }
function documentUrl(id) { return `${sharedEndpoint ? sharedEndpoint.replace('/api/state', '') : `http://127.0.0.1:${LOCAL_SERVER_PORT}`}/api/documents/${encodeURIComponent(id)}`; }
function documentLink(id) {
  const document = state.finance.documents.find(item => item.id === id);
  return document ? `<a class="finance-document-link" href="${escapeHTML(documentUrl(id))}" target="_blank" rel="noopener">📎 ${escapeHTML(document.name || 'Abrir arquivo')}</a>` : '';
}
function validFinanceMonth(month) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(month); }
function validFinanceDate(date) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toLocaleDateString('en-CA') === date;
}
function normalizeFinanceTransaction(item) {
  if (!item || typeof item !== 'object' || !validFinanceDate(item.date)) return null;
  const amountCents = Number(item.amountCents);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return null;
  const type = item.type === 'income' ? 'income' : 'expense';
  return {
    id: asText(item.id) || makeId(), date: item.date, type,
    title: asText(item.title).trim().slice(0, 80) || (type === 'income' ? 'Entrada' : 'Gasto'),
    category: Object.hasOwn(FINANCE_CATEGORIES[type], item.category) ? item.category : 'other',
    amountCents, createdAt: asText(item.createdAt), method: item.method === 'pix' ? 'pix' : 'account',
    billId: type === 'expense' ? asText(item.billId) : '', billMonth: type === 'expense' && validFinanceMonth(item.billMonth) ? item.billMonth : '', billCreated: type === 'expense' && Boolean(item.billCreated), documentId: asText(item.documentId)
  };
}
function normalizeBill(item) {
  if (!item || typeof item !== 'object') return null;
  const amountCents = Number(item.amountCents), dueDay = Number(item.dueDay);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || !validFinanceMonth(item.startMonth)) return null;
  const recurring = item.recurring !== false;
  const endMonth = recurring && validFinanceMonth(item.endMonth) && item.endMonth >= item.startMonth ? item.endMonth : '';
  return { id: asText(item.id) || makeId(), title: asText(item.title).trim().slice(0, 80) || 'Conta', amountCents, dueDay, documentId: asText(item.documentId),
    category: Object.hasOwn(FINANCE_CATEGORIES.expense, item.category) ? item.category : 'bills', startMonth: item.startMonth, endMonth, recurring };
}
function billDueDate(month, dueDay) {
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return `${month}-${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`;
}
function billsForMonth(finance, month) {
  return finance.bills.filter(bill => bill.startMonth <= month && (bill.recurring ? (!bill.endMonth || bill.endMonth >= month) : bill.startMonth === month)).map(bill => ({
    ...bill, dueDate: billDueDate(month, bill.dueDay), payment: finance.transactions.find(item => item.type === 'expense' && item.billId === bill.id && item.billMonth === month) || null,
    skipped: Boolean(finance.skippedBills[`${bill.id}:${month}`])
  })).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
}
function normalizeCardPurchase(item) {
  if (!item || typeof item !== 'object' || !validFinanceDate(item.date)) return null;
  const amountCents = Number(item.amountCents);
  const installments = Number(item.installments);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !Number.isInteger(installments) || installments < 1 || installments > 24 || amountCents < installments || !validFinanceMonth(item.firstInvoiceMonth)) return null;
  return { id: asText(item.id) || makeId(), date: item.date, title: asText(item.title).trim().slice(0, 80) || 'Compra', category: Object.hasOwn(FINANCE_CATEGORIES.expense, item.category) ? item.category : 'other', amountCents, installments, firstInvoiceMonth: item.firstInvoiceMonth };
}
function normalizeCard(source = {}) {
  const card = source && typeof source === 'object' ? source : {};
  const statements = {};
  Object.entries(card.statements && typeof card.statements === 'object' ? card.statements : {}).forEach(([month, statement]) => {
    if (!validFinanceMonth(month) || !Number.isSafeInteger(statement?.amountCents) || statement.amountCents <= 0) return;
    statements[month] = { amountCents: statement.amountCents, dueDate: validFinanceDate(statement.dueDate) && statement.dueDate.startsWith(month) ? statement.dueDate : '', documentId: asText(statement.documentId), note: asText(statement.note).trim().slice(0, 200) };
  });
  const paidInvoices = {};
  Object.entries(card.paidInvoices && typeof card.paidInvoices === 'object' ? card.paidInvoices : {}).forEach(([month, payment]) => {
    if (!validFinanceMonth(month)) return;
    const rawParts = Array.isArray(payment?.payments) && payment.payments.length ? payment.payments : [payment];
    const payments = rawParts.filter(part => validFinanceDate(part?.date) && Number.isSafeInteger(part?.amountCents) && part.amountCents > 0).map(part => ({ date: part.date, amountCents: part.amountCents, paidAt: asText(part.paidAt), linkedTransactionId: asText(part.linkedTransactionId), documentId: asText(part.documentId) }));
    if (!payments.length) return;
    paidInvoices[month] = { payments, date: payments.at(-1).date, amountCents: payments.reduce((sum, part) => sum + part.amountCents, 0), paidAt: payments.at(-1).paidAt, linkedTransactionId: payments.at(-1).linkedTransactionId, documentId: asText(payment.documentId) || payments.at(-1).documentId };
  });
  return { name: asText(card.name).trim().slice(0, 36) || 'Meu cartão', limitCents: Number.isSafeInteger(card.limitCents) && card.limitCents > 0 ? card.limitCents : 0,
    closingDay: Number.isInteger(card.closingDay) && card.closingDay >= 1 && card.closingDay <= 28 ? card.closingDay : 25,
    dueDay: Number.isInteger(card.dueDay) && card.dueDay >= 1 && card.dueDay <= 28 ? card.dueDay : 10,
    purchases: Array.isArray(card.purchases) ? card.purchases.map(normalizeCardPurchase).filter(Boolean) : [], statements, paidInvoices };
}
function normalizeFinance(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const monthlyLimits = {};
  if (source.monthlyLimits && typeof source.monthlyLimits === 'object') {
    Object.entries(source.monthlyLimits).forEach(([month, cents]) => {
      if (validFinanceMonth(month) && Number.isSafeInteger(cents) && cents > 0) monthlyLimits[month] = cents;
    });
  }
  const account = source.account && typeof source.account === 'object' ? source.account : {};
  const bills = Array.isArray(source.bills) ? source.bills.map(normalizeBill).filter(Boolean) : [];
  const billIds = new Set(bills.map(bill => bill.id));
  const skippedBills = {};
  if (source.skippedBills && typeof source.skippedBills === 'object') Object.entries(source.skippedBills).forEach(([key, value]) => {
    const split = key.lastIndexOf(':');
    if (value === true && split > 0 && billIds.has(key.slice(0, split)) && validFinanceMonth(key.slice(split + 1))) skippedBills[key] = true;
  });
  const documents = Array.isArray(source.documents) ? source.documents.filter(item => item && /^[0-9a-f-]{36}$/i.test(item.id)).map(item => ({ id: item.id, name: asText(item.name).slice(0, 120), type: asText(item.type), size: Number(item.size) || 0, kind: asText(item.kind), createdAt: asText(item.createdAt) })) : [];
  return { transactions: Array.isArray(source.transactions) ? source.transactions.map(normalizeFinanceTransaction).filter(Boolean) : [], monthlyLimits, bills, skippedBills, documents,
    account: { balanceCents: Number.isSafeInteger(account.balanceCents) ? account.balanceCents : null, anchoredAt: asText(account.anchoredAt), anchoredDay: validFinanceDate(account.anchoredDay) ? account.anchoredDay : '' }, card: normalizeCard(source.card) };
}
function financeSummary(transactions, month) {
  const entries = transactions.filter(item => item.date.startsWith(`${month}-`));
  const income = entries.filter(item => item.type === 'income').reduce((total, item) => total + item.amountCents, 0);
  const expenses = entries.filter(item => item.type === 'expense').reduce((total, item) => total + item.amountCents, 0);
  return { entries, income, expenses, balance: income - expenses };
}
function shiftMonth(month, delta) {
  if (!validFinanceMonth(month)) return MONTH_KEY;
  const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() + delta);
  return date.toLocaleDateString('en-CA').slice(0, 7);
}
function firstInvoiceMonth(date, closingDay, dueDay) {
  const purchaseMonth = date.slice(0, 7);
  const closingMonth = Number(date.slice(8, 10)) <= closingDay ? purchaseMonth : shiftMonth(purchaseMonth, 1);
  return dueDay > closingDay ? closingMonth : shiftMonth(closingMonth, 1);
}
function purchaseInstallments(purchase) {
  const base = Math.floor(purchase.amountCents / purchase.installments);
  return Array.from({ length: purchase.installments }, (_, index) => ({ month: shiftMonth(purchase.firstInvoiceMonth, index), amountCents: base + (index === 0 ? purchase.amountCents % purchase.installments : 0), number: index + 1 }));
}
function cardPurchaseLocked(card, purchase) {
  return purchaseInstallments(purchase).some(part => Boolean(card.paidInvoices[part.month]));
}
function invoiceForMonth(card, month) {
  return card.purchases.flatMap(purchase => purchaseInstallments(purchase).filter(part => part.month === month).map(part => ({ ...part, purchase }))).sort((a, b) => b.purchase.date.localeCompare(a.purchase.date));
}
function invoiceTotalCents(card, month) { return card.statements?.[month]?.amountCents || invoiceForMonth(card, month).reduce((sum, part) => sum + part.amountCents, 0); }
function invoiceDueDate(card, month) { return card.statements?.[month]?.dueDate || billDueDate(month, card.dueDay); }
function invoicePaymentParts(payment) { return Array.isArray(payment?.payments) && payment.payments.length ? payment.payments : payment ? [payment] : []; }
function cardUsedCents(card) {
  return Math.max(0, card.purchases.reduce((sum, purchase) => sum + purchase.amountCents, 0) - Object.entries(card.paidInvoices).reduce((sum, [month, payment]) => sum + Math.min(payment.amountCents, invoiceForMonth(card, month).reduce((total, part) => total + part.amountCents, 0)), 0));
}
function accountBalanceCents(finance, today = DATE_KEY) {
  const account = finance.account;
  if (account.balanceCents === null || !account.anchoredAt) return null;
  const cashDelta = finance.transactions.filter(item => item.createdAt > account.anchoredAt && item.date >= (account.anchoredDay || account.anchoredAt.slice(0, 10)) && item.date <= today).reduce((sum, item) => sum + (item.type === 'income' ? item.amountCents : -item.amountCents), 0);
  const paidDelta = Object.values(finance.card.paidInvoices).flatMap(invoicePaymentParts).filter(payment => !payment.linkedTransactionId && payment.paidAt > account.anchoredAt && payment.date >= (account.anchoredDay || account.anchoredAt.slice(0, 10)) && payment.date <= today).reduce((sum, payment) => sum + payment.amountCents, 0);
  return account.balanceCents + cashDelta - paidDelta;
}
function normalizeCare(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const goals = Array.isArray(source.goals) ? source.goals.filter(item => item && typeof item === 'object').map(item => ({ id: asText(item.id) || makeId(), title: asText(item.title).trim().slice(0, 60) || 'Meu objetivo', reason: asText(item.reason).trim().slice(0, 220), alternative: asText(item.alternative).trim().slice(0, 160), createdAt: asText(item.createdAt) || new Date().toISOString(), archived: Boolean(item.archived) })) : [];
  const ids = new Set(goals.map(item => item.id));
  const events = Array.isArray(source.events) ? source.events.filter(item => item && ids.has(item.goalId) && validFinanceDate(item.date) && ['urge', 'episode'].includes(item.type)).map(item => ({ id: asText(item.id) || makeId(), goalId: item.goalId, date: item.date, type: item.type, trigger: asText(item.trigger).trim().slice(0, 120), note: asText(item.note).trim().slice(0, 240), createdAt: asText(item.createdAt) || new Date().toISOString() })) : [];
  return { goals, events };
}


function normalizeState(incoming = {}) {
  incoming = incoming && typeof incoming === 'object' ? incoming : {};
  const base = clone(defaultState);
  const incomingHabits = incoming.habits && typeof incoming.habits === 'object' ? incoming.habits : {};
  const definitions = Array.isArray(incoming.habitDefinitions) && incoming.habitDefinitions.length
    ? incoming.habitDefinitions.map(habit => ({ id: asText(habit?.id) || makeId(), title: asText(habit?.title, 'Novo hábito') || 'Novo hábito', cue: asText(habit?.cue), active: habit?.active !== false, cycleId: asText(habit?.cycleId) }))
    : clone(DEFAULT_HABITS).map(habit => ({ ...habit, cycleId: '' }));
  const rawCycles = Array.isArray(incoming.cycles) && incoming.cycles.length ? incoming.cycles : [makeDefaultCycle(definitions)];
  const cycles = rawCycles.map(cycle => normalizeCycle(cycle, definitions));
  const cycleIds = new Set(cycles.map(cycle => cycle.id));
  const currentCycle = cycles.find(cycle => cycle.month === MONTH_KEY) || cycles[0];
  definitions.forEach(habit => {
    if (!cycleIds.has(habit.cycleId)) habit.cycleId = currentCycle.id;
    const owner = cycles.find(cycle => cycle.id === habit.cycleId);
    if (owner && !owner.habitIds.includes(habit.id)) owner.habitIds.push(habit.id);
  });
  const migratedDays = {};
  Object.entries(incomingHabits).forEach(([day, values]) => {
    if (!values || typeof values !== 'object') return;
    migratedDays[day] = { ...values };
    definitions.forEach(habit => {
      if (typeof migratedDays[day][habit.id] !== 'boolean' && typeof values[habit.title] === 'boolean') migratedDays[day][habit.id] = values[habit.title];
    });
  });
  return {
    ...base, ...incoming,
    profile: {
      name: asText(incoming.profile?.name).trim().slice(0, 48),
      avatar: incoming.profile?.avatar === 'custom' && safeAvatarData(incoming.profile?.photo) ? 'custom'
        : [...AVATARS, ...LEGACY_AVATARS].some(item => item.id === incoming.profile?.avatar) ? incoming.profile.avatar : 'frieren',
      photo: safeAvatarData(incoming.profile?.photo)
    },
    settings: { ...base.settings, ...(incoming.settings || {}) },
    habitDefinitions: definitions,
    habits: migratedDays,
    cycles,
    activeCycleId: cycleIds.has(incoming.activeCycleId) ? incoming.activeCycleId : currentCycle.id,
    notes: Array.isArray(incoming.notes) ? incoming.notes.map(normalizeNote) : [],
    journal: incoming.journal || {}, checkin: incoming.checkin || {}, updates: Array.isArray(incoming.updates) ? incoming.updates : [],
    focusMinutes: incoming.focusMinutes || {}, rituals: incoming.rituals || {}, newsCache: incoming.newsCache || {}, ikigai: incoming.ikigai || {}, focusTask: asText(incoming.focusTask),
    tasks: Array.isArray(incoming.tasks) ? incoming.tasks.map(normalizeTask) : base.tasks,
    learning: Array.isArray(incoming.learning) ? incoming.learning.map(normalizeLearningItem) : base.learning,
    dreams: Array.isArray(incoming.dreams) ? incoming.dreams.map(normalizeDream) : base.dreams,
    finance: normalizeFinance(incoming.finance),
    care: normalizeCare(incoming.care)
  };
}

function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY) || PREVIOUS_STORAGE_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
    return normalizeState(current ? JSON.parse(current) : {});
  } catch { return normalizeState({}); }
}

let state = loadState();
let sharedEndpoint = '';
let sharedRevision = null;
let sharedPending = false;
let sharedSaving = false;
let sharedConflict = false;
let sharedConnecting = false;
let activeLibrary = 'reading';
let activeLearningCategory = 'all';
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerPreset = 25;
let timerRunning = false;
let pipWindow = null;
let newsRequest = null;
let profilePhotoDraft = '';
let selectedHistoryDate = DATE_KEY;
let notesSearch = '';
let notesCategory = 'all';
let financeMonth = MONTH_KEY;
let financeFilter = 'all';
let financeView = 'account';
let selectedBillId = '';
let pendingDocumentId = '';
let documentTarget = null;
let uploadedDocument = null;
let homeBillMonth = MONTH_KEY;
let selectedCareGoalId = '';
let carePauseDeadline = 0;
let carePauseInterval = null;

function save({ localOnly = false } = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $('#storage-warning').hidden = true;
    if (sharedEndpoint && !localOnly) {
      sharedPending = true;
      localStorage.setItem(SYNC_PENDING_KEY, '1');
      flushSharedState();
    } else if (!sharedEndpoint && !localOnly && localStorage.getItem(SYNC_MARKER_KEY)) {
      // Esta aba já usou o arquivo compartilhado. Não descarte edições offline ao reconectar.
      localStorage.setItem(SYNC_PENDING_KEY, '1');
      setSyncStatus('Alterações neste navegador aguardam reconexão');
    }
    return true;
  } catch {
    $('#storage-warning').hidden = false;
    return false;
  }
}

function setSyncStatus(message) {
  const label = $('#sync-status');
  if (label) label.textContent = message;
  const detail = $('#data-storage-status');
  if (detail) detail.textContent = message === 'Sincronizado neste PC' ? 'App e navegador usam o mesmo arquivo local neste PC.' : message;
}

async function refreshStorageInfo() {
  if (!sharedEndpoint) {
    $('#data-storage-path').textContent = 'Esta página está usando apenas o armazenamento deste navegador.';
    $('#data-backup-copy').textContent = 'Para manter seus dados entre instalações, abra pelo app ou pelo servidor local e baixe um backup JSON agora.';
    return;
  }
  try {
    const { response, payload } = await requestShared(sharedEndpoint.replace('/api/state', '/api/storage-info'));
    if (!response.ok || !payload.file) return;
    $('#data-storage-path').textContent = `Arquivo: ${payload.file}`;
    $('#data-backup-copy').textContent = payload.backupCount ? `${payload.backupCount} ${payload.backupCount === 1 ? 'cópia automática datada' : 'cópias automáticas datadas'} do estado · última: ${payload.latestBackup}. Para incluir anexos, baixe um ZIP completo.` : 'O primeiro backup automático será criado após a próxima alteração. Para incluir anexos, baixe um ZIP completo.';
  } catch { $('#data-backup-copy').textContent = 'Não foi possível consultar as cópias automáticas agora. Você ainda pode baixar um backup JSON.'; }
}

function meaningfulData(value) {
  return Boolean(value?.profile?.name || value?.tasks?.length || value?.notes?.length || value?.learning?.length
    || value?.dreams?.length || value?.updates?.length || value?.finance?.transactions?.length || value?.finance?.bills?.length || value?.finance?.card?.purchases?.length || value?.finance?.card?.limitCents || value?.finance?.account?.anchoredAt || value?.care?.goals?.length || Object.keys(value?.finance?.monthlyLimits || {}).length || Object.keys(value?.habits || {}).length
    || Object.keys(value?.journal || {}).length || Object.keys(value?.checkin || {}).length);
}

function sharedSnapshot() {
  return { ...state, newsCache: {} };
}

async function requestShared(endpoint, options = {}) {
  const response = await fetch(endpoint, { ...options, signal: AbortSignal.timeout(8000) });
  const payload = await response.json();
  return { response, payload };
}

function markShared(revision) {
  sharedRevision = revision;
  try {
    localStorage.setItem(SYNC_MARKER_KEY, revision);
    if (sharedPending) localStorage.setItem(SYNC_PENDING_KEY, '1');
    else localStorage.removeItem(SYNC_PENDING_KEY);
  } catch { /* A cópia compartilhada continua salva no arquivo local. */ }
  setSyncStatus('Sincronizado neste PC');
  refreshStorageInfo();
}

function showSyncConflict() {
  sharedConflict = true;
  setSyncStatus('Conflito entre janelas');
  const dialog = $('#sync-conflict-dialog');
  if (dialog && !dialog.open) dialog.showModal();
}

async function flushSharedState() {
  if (!sharedEndpoint || sharedSaving || sharedConflict) return;
  sharedSaving = true;
  try {
    while (sharedPending && !sharedConflict) {
      sharedPending = false;
      const snapshot = sharedSnapshot();
      const { response, payload } = await requestShared(sharedEndpoint, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: sharedRevision, state: snapshot })
      });
      if (response.status === 409) { sharedPending = true; showSyncConflict(); break; }
      if (!response.ok || !payload.revision) throw new Error('save_failed');
      markShared(payload.revision);
    }
  } catch {
    sharedPending = true;
    setSyncStatus('Aguardando sincronização');
  } finally { sharedSaving = false; }
}

function exportCurrentState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `mindflow-backup-${DATE_KEY}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(state.care.goals.length || state.finance.transactions.length || state.finance.bills.length || state.finance.card.purchases.length ? 'Backup contém dados pessoais e financeiros. Guarde-o em local privado.' : 'Backup baixado. Guarde-o em um local seguro.');
}

function askMigrationChoice() {
  return new Promise(resolve => {
    const dialog = $('#sync-migration-dialog');
    $('#migration-export').onclick = exportCurrentState;
    $('#migration-use-browser').onclick = () => { dialog.close(); resolve('browser'); };
    $('#migration-use-shared').onclick = () => { dialog.close(); resolve('shared'); };
    dialog.addEventListener('cancel', event => event.preventDefault(), { once: true });
    dialog.showModal();
  });
}

async function initializeSharedState() {
  const endpoints = [];
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    endpoints.push(`${location.origin}/api/state`);
    if (location.port !== LOCAL_SERVER_PORT) endpoints.push(`http://127.0.0.1:${LOCAL_SERVER_PORT}/api/state`);
  }
  let remote;
  for (const endpoint of endpoints) {
    try {
      const result = await requestShared(endpoint);
      if (!result.response.ok || !Object.hasOwn(result.payload, 'revision')) continue;
      sharedEndpoint = endpoint;
      remote = result.payload;
      break;
    } catch { /* Live Server não oferece esta API. */ }
  }
  if (!sharedEndpoint) { setSyncStatus(localStorage.getItem(SYNC_PENDING_KEY) === '1' ? 'Alterações neste navegador aguardam reconexão' : 'Dados salvos neste navegador'); refreshStorageInfo(); return; }

  const marker = localStorage.getItem(SYNC_MARKER_KEY);
  const pending = localStorage.getItem(SYNC_PENDING_KEY) === '1';
  sharedRevision = remote.revision;
  refreshStorageInfo();
  if (remote.state) {
    let choice = 'shared';
    if (meaningfulData(state) && (!marker || pending)) choice = await askMigrationChoice();
    if (choice === 'browser') {
      sharedPending = true;
      localStorage.setItem(SYNC_PENDING_KEY, '1');
      await flushSharedState();
      return;
    }
    state = normalizeState(remote.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    markShared(remote.revision);
    return;
  }
  if (meaningfulData(state)) {
    sharedPending = true;
    localStorage.setItem(SYNC_PENDING_KEY, '1');
    await flushSharedState();
  } else setSyncStatus('Pronto para salvar neste PC');
}

async function refreshSharedState() {
  if (sharedSaving || document.querySelector('dialog[open]')) return;
  if (!sharedEndpoint) {
    if (sharedConnecting) return;
    sharedConnecting = true;
    try { await initializeSharedState(); if (sharedEndpoint) renderAll(); }
    catch { setSyncStatus('Dados salvos neste navegador'); }
    finally { sharedConnecting = false; }
    return;
  }
  if (sharedPending) { flushSharedState(); return; }
  try {
    const { response, payload } = await requestShared(sharedEndpoint);
    if (!response.ok || !payload.revision) return;
    if (payload.revision === sharedRevision) { setSyncStatus('Sincronizado neste PC'); return; }
    state = normalizeState(payload.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    markShared(payload.revision);
    renderAll();
    loadNews({ force: false });
    showToast('Dados atualizados em outra janela.');
  } catch { setSyncStatus('Conexão local indisponível'); }
}

function bindSyncConflict() {
  $('#sync-conflict-export').onclick = exportCurrentState;
  $('#sync-conflict-use-shared').onclick = async () => {
    try {
      const { response, payload } = await requestShared(sharedEndpoint);
      if (!response.ok || !payload.state) throw new Error('load_failed');
      state = normalizeState(payload.state);
      sharedPending = false; sharedConflict = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      markShared(payload.revision);
      $('#sync-conflict-dialog').close(); renderAll(); showToast('Dados compartilhados carregados.');
    } catch { setSyncStatus('Não foi possível carregar agora'); }
  };
  $('#sync-conflict-use-local').onclick = async () => {
    try {
      const { response, payload } = await requestShared(sharedEndpoint);
      if (!response.ok) throw new Error('load_failed');
      sharedRevision = payload.revision;
      sharedConflict = false;
      $('#sync-conflict-dialog').close();
      flushSharedState();
    } catch { setSyncStatus('Não foi possível salvar agora'); }
  };
  $('#sync-conflict-dialog').addEventListener('cancel', event => event.preventDefault());
}

function safeHttp(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function safeImage(value) {
  return /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value) ? value : safeHttp(value);
}
function safeAvatarData(value) {
  return typeof value === 'string' && value.length <= 450000 && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value) ? value : '';
}
function profileAvatarSrc(profile = state.profile) {
  return profile?.avatar === 'custom' && safeAvatarData(profile.photo) ? profile.photo : avatarPath(profile?.avatar);
}
function cycleCover(cycle) { return cycle ? bannerPath(cycle.banner) || safeImage(cycle.image || '') : ''; }

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove('show'), 2800);
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date).replace(/^./, char => char.toUpperCase());
}

function renderDate() {
  $('#date-display').textContent = formatDate();
  $('#today-date').textContent = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date());
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function profileName() {
  return String(state.profile?.name || '').trim();
}

function renderProfile() {
  const name = profileName();
  const route = $('.view.active')?.id || 'inicio';
  const view = $(`#${route}`);
  const title = route === 'inicio' && name ? `${greetingForNow()}, ${name}.` : view?.dataset.title || APP_NAME;
  $('#page-title').textContent = title;
  $('#page-kicker').textContent = view?.dataset.kicker || 'SISTEMA PESSOAL';
  $('#profile-avatar').src = profileAvatarSrc();
  $('#home-avatar').src = profileAvatarSrc();
  $('#home-profile-name').textContent = name ? `Um novo dia, ${name}.` : 'Seu espaço pessoal';
  $$('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
  $('#menu-toggle').innerHTML = icon('menu');
  $('#refresh-news').innerHTML = icon('refresh');
  $('#profile-button').setAttribute('aria-label', name ? `Editar perfil de ${name}` : 'Definir seu nome');
  $('#profile-button').setAttribute('title', name ? `Editar perfil de ${name}` : 'Definir seu nome');
}

function applyTheme() {
  const theme = state.settings.theme === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.accent = ['sage', 'ocean', 'lavender', 'sand'].includes(state.settings.accent) ? state.settings.accent : 'sage';
  root.dataset.density = state.settings.density === 'compact' ? 'compact' : 'comfortable';
  root.dataset.fontScale = ['small', 'large'].includes(state.settings.fontScale) ? state.settings.fontScale : 'medium';
  root.dataset.reducedMotion = state.settings.reducedMotion ? 'true' : 'false';
  $('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#161b19' : '#f5f4ef');
  $('#theme-icon').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
  $('#theme-toggle').setAttribute('aria-label', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
  $('#theme-toggle').setAttribute('title', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
  const newsCard = $('#home-news-card') || $('#inicio .news-card');
  if (newsCard) newsCard.hidden = state.settings.showNews === false;
}

function completedHabitCount() { return activeHabits().filter(habit => todayHabits()[habit.id]).length; }

function updateSummary() {
  const total = activeHabits().length;
  const completed = completedHabitCount();
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  const doing = state.tasks.filter(task => task.status === 'doing').length;
  const learning = state.learning.filter(item => item.current > 0 && item.current < item.total).length;
  const focus = state.focusMinutes[DATE_KEY] || 0;
  $('#home-score').textContent = `${percentage}%`;
  $('#home-score-label').textContent = percentage ? `${completed} ${completed === 1 ? 'hábito concluído' : 'hábitos concluídos'}` : 'comece por um hábito';
  $('#home-progress').style.width = `${percentage}%`;
  $('#home-habits').textContent = `${completed} / ${total} hábitos`;
  $('#metric-habits').textContent = `${completed}/${total}`;
  $('#metric-doing').textContent = doing;
  $('#metric-focus').textContent = `${focus} min`;
  $('#metric-learning').textContent = learning;
  $('#today-score').textContent = `${percentage}%`;
  $('#today-habit-progress').style.width = `${percentage}%`;
  $('#today-habit-progress-text').textContent = total ? `${completed} de ${total} concluídos` : 'Adicione seu primeiro hábito';
  $('#focus-minutes').textContent = `${focus} min`;
}

function renderHabits() {
  const habits = activeHabits();
  const values = todayHabits();
  $('#habits-list').innerHTML = habits.length ? habits.map(habit => `
    <label class="habit ${values[habit.id] ? 'done' : ''}">
      <input type="checkbox" data-habit-id="${escapeHTML(habit.id)}" ${values[habit.id] ? 'checked' : ''} />
      <span class="check-symbol">✓</span>
      <span class="habit-copy"><strong>${escapeHTML(habit.title)}</strong>${habit.cue ? `<small>${escapeHTML(habit.cue)}</small>` : ''}</span>
    </label>`).join('') : '<p class="updates-empty">Nenhum hábito ativo. Use “Editar hábitos” para criar o primeiro.</p>';
  $$('[data-habit-id]').forEach(input => input.addEventListener('change', event => {
    const id = event.target.dataset.habitId;
    state.habits[DATE_KEY] = { ...todayHabits(), [id]: event.target.checked };
    save(); renderHabits(); renderCycles(); renderHistoryPreview(); renderHistory(); updateSummary();
  }));
}

function renderJournalAndCheckin() {
  const journal = state.journal[DATE_KEY] || {};
  const journalFields = { '#journal-did': 'did', '#journal-wins': 'wins', '#journal-improve': 'improve', '#journal-reflection': 'reflection', '#journal-tomorrow': 'tomorrow' };
  Object.entries(journalFields).forEach(([selector, key]) => { $(selector).value = journal[key] || ''; });
  const checkin = state.checkin[DATE_KEY] || {};
  $('#mood-input').value = checkin.mood || 'normal';
  $('#sleep-input').value = checkin.sleep || 'bom';
  $('#wake-input').value = checkin.wake || '';
  $('#water-input').value = checkin.water || '';
  Object.entries(journalFields).forEach(([selector, key]) => {
    $(selector).oninput = event => {
      state.journal[DATE_KEY] = { ...(state.journal[DATE_KEY] || {}), [key]: event.target.value };
      save(); renderHistoryPreview(); renderHistory();
      const status = $('#journal-status'); status.textContent = 'salvo agora';
      clearTimeout(renderJournalAndCheckin.timer);
      renderJournalAndCheckin.timer = setTimeout(() => { status.textContent = 'salvo automaticamente'; }, 1500);
    };
  });
  [['#mood-input', 'mood'], ['#sleep-input', 'sleep'], ['#wake-input', 'wake'], ['#water-input', 'water']].forEach(([selector, key]) => {
    $(selector).onchange = event => { state.checkin[DATE_KEY] = { ...(state.checkin[DATE_KEY] || {}), [key]: event.target.value }; save(); renderHistoryPreview(); renderHistory(); };
  });
}

function getNextTask() { return state.tasks.find(task => task.status === 'doing') || state.tasks.find(task => task.status === 'next') || null; }

function renderPriorities() {
  const candidates = state.tasks.filter(task => task.status === 'next' || task.status === 'doing').slice(0, 4);
  $('#priority-list').innerHTML = candidates.length ? candidates.map(task => `
    <div class="priority-item"><input class="priority-checkbox" type="checkbox" data-priority-task="${escapeHTML(task.id)}" ${task.status === 'done' ? 'checked' : ''} />
      <div class="priority-copy"><strong>${escapeHTML(task.title)}</strong><span>${task.status === 'doing' ? 'em andamento' : 'próxima ação'} · ${task.area === 'work' ? 'trabalho' : 'pessoal'}</span></div>
      <span class="badge ${task.priority}">${priorityLabel(task.priority)}</span></div>`).join('') : '<p class="updates-empty">Nada definido ainda. Capture uma tarefa e escolha a próxima ação.</p>';
  $$('[data-priority-task]').forEach(input => input.onchange = () => updateTask(input.dataset.priorityTask, { status: input.checked ? 'done' : 'next' }));
  const nextTask = getNextTask();
  $('#today-next-title').textContent = nextTask ? nextTask.title : 'Escolha a próxima ação.';
  $('#today-next-note').textContent = nextTask ? (nextTask.note || 'Defina um começo simples e inicie um bloco de foco.') : 'Capture uma tarefa, mova para “Próxima” e dê atenção a uma coisa por vez.';
}

function priorityLabel(priority) { return priority === 'high' ? 'Prioridade' : priority === 'medium' ? 'Importante' : 'Quando der'; }

function renderUpdates() {
  const updates = state.updates.slice(0, 5);
  const content = updates.length ? updates.map(update => `<div class="update-item"><p>${escapeHTML(update.text)}</p><time>${escapeHTML(update.date)}</time></div>`).join('') : '<p class="updates-empty">Anote aqui ideias, melhorias e aprendizados que aparecerem no uso real.</p>';
  [$('#updates-list'), $('#updates-list-home')].filter(Boolean).forEach(list => { list.innerHTML = content; });
}

function formatTaskDate(date) {
  if (!date) return 'sem data';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`));
}

function filteredTasks() {
  const area = $('#task-filter').value, period = $('#task-period').value;
  return state.tasks.filter(task => (area === 'all' || task.area === area)
    && ($('#task-show-done').checked || task.status !== 'done')
    && (period === 'all' || (period === 'undated' ? !task.date : task.date && task.date <= DATE_KEY)));
}
function renderTaskView() {
  const board = state.settings.taskView === 'board';
  $('#task-list-view').hidden = board;
  $('#task-board-view').hidden = !board;
  $$('[data-task-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.taskView === (board ? 'board' : 'list'))));
  const tasks = filteredTasks();
  $('#tasks-summary').textContent = `${tasks.length} tarefa(s) nesta visualização · ${state.tasks.filter(task => task.status === 'doing').length} em andamento`;
}
function openTaskEditor(task = null) {
  $('#task-form').reset();
  $('#task-id-input').value = task?.id || '';
  $('#task-title-input').value = task?.title || '';
  $('#task-note-input').value = task?.note || '';
  $('#task-date-input').value = task ? task.date : DATE_KEY;
  $('#task-area-input').value = task?.area || 'personal';
  $('#task-priority-input').value = task?.priority || 'medium';
  $('#task-status-input').value = task?.status || 'backlog';
  $('#task-dialog-title').textContent = task ? 'Editar tarefa' : 'Nova tarefa';
  $('#delete-task').hidden = !task;
  openDialog('task-dialog');
  $('#task-title-input').focus();
}
function bindTaskEditors() {
  $$('[data-edit-task]').forEach(button => button.onclick = () => openTaskEditor(state.tasks.find(task => task.id === button.dataset.editTask)));
}
function renderPlanner() {
  const tasks = filteredTasks().sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.date || '9999').localeCompare(b.date || '9999'));
  $('#planner-list').innerHTML = tasks.length ? tasks.map(task => `
    <div class="planner-item ${task.status === 'done' ? 'done' : ''}">
      <input class="planner-check" type="checkbox" aria-label="Concluir tarefa: ${escapeHTML(task.title)}" data-planner-task="${escapeHTML(task.id)}" ${task.status === 'done' ? 'checked' : ''}/>
      <div class="planner-copy"><button class="task-title-button" data-edit-task="${escapeHTML(task.id)}">${escapeHTML(task.title)}</button><p>${escapeHTML(task.note || STATUS[task.status])}</p></div>
      <div><span class="badge ${task.priority}">${priorityLabel(task.priority)}</span><span class="task-date">${formatTaskDate(task.date)}</span></div>
    </div>`).join('') : '<p class="updates-empty">Nenhuma tarefa nesta área. Capture a primeira.</p>';
  renderTaskView(); bindTaskEditors();
  $$('[data-planner-task]').forEach(input => input.onchange = () => updateTask(input.dataset.plannerTask, { status: input.checked ? 'done' : 'next' }));
}

function moveTask(id, status) {
  const task = state.tasks.find(item => item.id === id);
  if (!task || task.status === status) return;
  if (status === 'doing' && state.tasks.filter(item => item.status === 'doing').length >= WIP_LIMIT) {
    showToast(`O limite de ${WIP_LIMIT} itens em andamento foi atingido. Finalize ou mova um cartão antes.`); return;
  }
  task.status = status; save(); renderAll();
}

function updateTask(id, updates) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  if (updates.status) { moveTask(id, updates.status); return; }
  Object.assign(task, updates); save(); renderAll();
}

function renderKanban() {
  const flow = ['backlog', 'next', 'doing', 'done'];
  flow.forEach(status => {
    const tasks = filteredTasks().filter(task => task.status === status);
    const zone = $(`.drop-zone[data-status="${status}"]`);
    $(`#count-${status}`).textContent = tasks.length;
    zone.innerHTML = tasks.length ? tasks.map(task => {
      const index = flow.indexOf(status); const left = index > 0 ? flow[index - 1] : null; const right = index < flow.length - 1 ? flow[index + 1] : null;
      return `<article class="kanban-card" draggable="true" data-task-id="${escapeHTML(task.id)}"><span class="badge ${task.area}">${task.area === 'work' ? 'Trabalho' : 'Pessoal'}</span><h4><button class="task-title-button" data-edit-task="${escapeHTML(task.id)}">${escapeHTML(task.title)}</button></h4>${task.note ? `<p>${escapeHTML(task.note)}</p>` : ''}<div class="kanban-meta"><span class="badge ${task.priority}">${priorityLabel(task.priority)}</span><span class="task-date">${formatTaskDate(task.date)}</span></div><div class="kanban-actions">${left ? `<button class="move-button" data-move="${escapeHTML(task.id)}" data-to="${left}">← ${STATUS[left]}</button>` : ''}${right ? `<button class="move-button" data-move="${escapeHTML(task.id)}" data-to="${right}">${STATUS[right]} →</button>` : ''}</div></article>`;
    }).join('') : '<p class="empty-column">Solte um cartão aqui</p>';
  });
  bindTaskEditors();
  $$('.kanban-card').forEach(card => card.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', card.dataset.taskId); event.dataTransfer.effectAllowed = 'move'; }));
  $$('.drop-zone').forEach(zone => {
    zone.ondragover = event => { event.preventDefault(); zone.classList.add('drag-over'); };
    zone.ondragleave = () => zone.classList.remove('drag-over');
    zone.ondrop = event => { event.preventDefault(); zone.classList.remove('drag-over'); moveTask(event.dataTransfer.getData('text/plain'), zone.dataset.status); };
  });
  $$('[data-move]').forEach(button => button.onclick = () => moveTask(button.dataset.move, button.dataset.to));
}

function renderLearning() {
  $$('.library-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.library === activeLibrary));
  const categories = [...new Set(state.learning.filter(item => item.type === activeLibrary).map(item => item.category || 'Geral'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const categoryFilter = $('#learning-category-filter');
  categoryFilter.innerHTML = '<option value="all">Todas as categorias</option>' + categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('');
  if (!categories.includes(activeLearningCategory)) activeLearningCategory = 'all';
  categoryFilter.value = activeLearningCategory;
  const items = state.learning.filter(item => item.type === activeLibrary && (activeLearningCategory === 'all' || (item.category || 'Geral') === activeLearningCategory));
  const unit = activeLibrary === 'reading' ? 'páginas' : 'horas';
  $('#library-list').innerHTML = items.length ? items.map(item => {
    const percentage = progress(item.current, item.total);
    return `<article class="learning-card card"><div class="learning-card-top"><span class="learning-type">${escapeHTML(item.category || (item.type === 'reading' ? 'Leitura' : 'Curso'))}</span><button class="text-button" data-learning-progress="${escapeHTML(item.id)}">+ progresso</button></div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.author || 'Sem autor/plataforma')}</p><footer><div class="progress-track"><span style="width:${percentage}%"></span></div><span>${item.current || 0}/${item.total || '?'} ${unit}</span></footer></article>`;
  }).join('') : `<p class="updates-empty">Nenhum item ainda. Adicione seu próximo ${activeLibrary === 'reading' ? 'livro' : 'curso'}.</p>`;
  $$('[data-learning-progress]').forEach(button => button.onclick = () => {
    const item = state.learning.find(entry => entry.id === button.dataset.learningProgress);
    const current = prompt(`Qual é o progresso atual em ${item.type === 'reading' ? 'páginas' : 'horas'}?`, item.current);
    if (current === null) return;
    item.current = Math.max(0, Math.min(Number(current) || 0, Number(item.total) || Infinity));
    save(); renderLearning(); updateSummary();
  });
}

function renderVision() {
  $('#dream-grid').innerHTML = state.dreams.length
    ? state.dreams.map(dream => `<article class="dream-card"><span class="dream-emoji">${escapeHTML(dream.emoji)}</span><h3>${escapeHTML(dream.title)}</h3><p>${escapeHTML(dream.note)}</p></article>`).join('')
    : '<article class="vision-empty"><span>✦</span><h3>Seu quadro começa em branco</h3><p>Use os campos de direção abaixo para registrar o que importa. Em breve, este espaço pode ganhar imagens e metas.</p></article>';
  $$('[data-ikigai]').forEach(field => {
    field.value = state.ikigai[field.dataset.ikigai] || '';
    field.oninput = event => { state.ikigai[event.target.dataset.ikigai] = event.target.value; save(); };
  });
}

function cycleStats(cycle) {
  const habits = habitsForCycle(cycle.id);
  const days = Object.keys(state.habits).filter(day => day.startsWith(cycle.month) && Object.keys(state.habits[day] || {}).length);
  const summaries = days.map(daySummary);
  const possible = summaries.reduce((total, day) => total + day.total, 0);
  const completed = summaries.reduce((total, day) => total + day.completed, 0);
  return { habits: habits.length, days: days.length, percentage: possible ? Math.round((completed / possible) * 100) : 0 };
}

function renderCycles() {
  const selected = activeCycle();
  if (!selected) return;
  const monthName = monthLabel(selected.month);
  const cycleName = $('#today-cycle-name');
  const cycleMonth = $('#today-cycle-month');
  const homeCycle = $('#home-cycle-label');
  const todayCycle = cycleForDay(DATE_KEY);
  if (cycleName) cycleName.textContent = todayCycle?.name || 'Crie o seu mês para começar';
  if (cycleMonth) cycleMonth.textContent = monthLabel(MONTH_KEY);
  if (homeCycle) homeCycle.textContent = selected.name;
  const stats = cycleStats(selected);
  $('#active-cycle-overview').innerHTML = `${cycleCover(selected) ? `<img class="cycle-overview-banner" src="${escapeHTML(cycleCover(selected))}" alt="" />` : ''}<div class="cycle-overview-copy"><span class="soft-pill">Mês aberto · ${escapeHTML(monthName)}</span><h2>${escapeHTML(selected.name)}</h2><p>${escapeHTML(selected.description || 'Defina uma intenção para este ciclo.')}</p><div class="cycle-goals">${selected.goals.length ? selected.goals.map(goal => `<span>○ ${escapeHTML(goal)}</span>`).join('') : '<span>Adicione metas ao editar este mês.</span>'}</div></div><div class="cycle-overview-stats"><strong>${stats.percentage}%</strong><span>consistência em ${stats.days} ${stats.days === 1 ? 'dia' : 'dias'}</span><small>${stats.habits} hábitos ativos</small><button class="secondary-button" data-manage-cycle-habits="${escapeHTML(selected.id)}">Configurar hábitos</button></div>`;
  const calendar = document.createElement('details');
  calendar.className = 'cycle-days';
  const numberOfDays = new Date(Number(selected.month.slice(0, 4)), Number(selected.month.slice(5)), 0).getDate();
  const firstWeekday = new Date(selected.month + '-01T12:00:00').getDay();
  calendar.innerHTML = '<summary>Ver registros do mês</summary><p class="support-note">Selecione um dia para consultar hábitos, foco e diário.</p><div class="cycle-days-grid">'
    + ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => '<span class="calendar-weekday">' + day + '</span>').join('')
    + '<span aria-hidden="true"></span>'.repeat(firstWeekday)
    + Array.from({ length: numberOfDays }, (_, index) => {
    const day = selected.month + '-' + String(index + 1).padStart(2, '0');
    const summary = daySummary(day);
    return `<button type="button" data-cycle-day="${day}" class="${summary.hasData ? 'recorded' : ''}" ${day > DATE_KEY ? 'disabled' : ''} aria-label="${formatHistoryDate(day)}: ${summary.hasData ? summary.percentage + '% concluído' : 'sem registro'}"><span>${index + 1}</span><small>${summary.hasData ? summary.percentage + '%' : '—'}</small></button>`;
  }).join('') + '</div>';
  $('#active-cycle-overview').append(calendar);
  $$('[data-cycle-day]').forEach(button => button.onclick = () => { selectedHistoryDate = button.dataset.cycleDay; renderHistory(); setRoute('historico'); });
  const ordered = [...state.cycles].sort((a, b) => b.month.localeCompare(a.month));
  $('#cycles-grid').innerHTML = ordered.map(cycle => {
    const itemStats = cycleStats(cycle);
    const isActive = cycle.id === selected.id;
    return `<article class="card cycle-card ${isActive ? 'active' : ''}" data-accent-card="${escapeHTML(cycle.accent)}"><div class="cycle-cover ${cycleCover(cycle) ? 'has-image' : ''}" data-cycle-cover="${escapeHTML(cycle.id)}"><span>${escapeHTML(monthLabel(cycle.month, { month: 'short' }))}</span></div><div class="cycle-card-body"><span class="cycle-month">${escapeHTML(monthLabel(cycle.month))}</span><h3>${escapeHTML(cycle.name)}</h3><p>${escapeHTML(cycle.description || 'Sem descrição ainda.')}</p><div class="cycle-card-meta"><span>${itemStats.habits} hábitos</span><span>${itemStats.days} dias</span><strong>${itemStats.percentage}%</strong></div><div class="cycle-card-actions"><button class="${isActive ? 'primary-button' : 'secondary-button'}" data-open-cycle="${escapeHTML(cycle.id)}">${isActive ? 'Mês aberto' : 'Abrir mês'}</button><button class="text-button" data-edit-cycle="${escapeHTML(cycle.id)}">Editar</button></div></div></article>`;
  }).join('');
  $$('[data-cycle-cover]').forEach(cover => {
    const cycle = state.cycles.find(item => item.id === cover.dataset.cycleCover);
    const image = cycleCover(cycle);
    if (image) cover.style.backgroundImage = `url(${JSON.stringify(image)})`;
  });
  $$('[data-open-cycle]').forEach(button => button.onclick = () => { state.activeCycleId = button.dataset.openCycle; save(); renderAll(); $('#active-cycle-overview').scrollIntoView({ behavior: 'smooth' }); });
  $$('[data-edit-cycle]').forEach(button => button.onclick = () => openCycleEditor(state.cycles.find(cycle => cycle.id === button.dataset.editCycle)));
  $$('[data-manage-cycle-habits]').forEach(button => button.onclick = () => { state.activeCycleId = button.dataset.manageCycleHabits; save(); renderHabitManager(); openDialog('habit-dialog'); });
}

function openCycleEditor(cycle = null) {
  $('#cycle-form').reset();
  $('#cycle-id-input').value = cycle?.id || '';
  $('#cycle-month-input').value = cycle?.month || MONTH_KEY;
  $('#cycle-name-input').value = cycle?.name || '';
  $('#cycle-description-input').value = cycle?.description || '';
  $('#cycle-goals-input').value = cycle?.goals?.join('\n') || '';
  $('#cycle-image-input').value = cycle?.image?.startsWith('http') ? cycle.image : '';
  $('#cycle-accent-input').value = cycle?.accent || 'sage';
  $('#cycle-banner-input').value = cycle ? cycle.banner || '' : 'forest';
  $('#copy-cycle-habits-label').hidden = Boolean(cycle);
  $('#copy-cycle-habits').checked = true;
  renderBannerPicker();
  $('#cycle-dialog-title').textContent = cycle ? 'Editar ciclo mensal' : 'Criar um novo mês';
  openDialog('cycle-dialog');
  setTimeout(() => $('#cycle-name-input').focus(), 0);
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(''); return; }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, 1200 / image.width, 720 / image.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', .76));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderNotes() {
  const search = notesSearch.trim().toLocaleLowerCase('pt-BR');
  const categories = [...new Set(state.notes.map(note => note.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const filter = $('#notes-category-filter');
  filter.innerHTML = '<option value="all">Todas as categorias</option>' + categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('');
  filter.value = categories.includes(notesCategory) ? notesCategory : 'all';
  $('#note-categories').innerHTML = categories.map(category => `<option value="${escapeHTML(category)}"></option>`).join('');
  const notes = [...state.notes].filter(note => (notesCategory === 'all' || note.category === notesCategory) && (!search || `${note.title} ${note.body} ${note.category}`.toLocaleLowerCase('pt-BR').includes(search))).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  $('#notes-list').innerHTML = notes.length ? notes.map(note => `<article class="card note-card ${note.pinned ? 'pinned' : ''}"><div class="note-card-top"><span>${escapeHTML(note.category)}</span>${note.pinned ? '<i>fixada</i>' : ''}</div><h3>${escapeHTML(note.title)}</h3><p>${escapeHTML(note.body)}</p><footer><time>${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(note.updatedAt))}</time><button class="text-button" data-edit-note="${escapeHTML(note.id)}">Abrir</button></footer></article>`).join('') : '<div class="empty-state"><span>□</span><h3>Nenhuma nota encontrada</h3><p>Crie um lugar para aquela ideia que não cabe em uma tarefa.</p></div>';
  $$('[data-edit-note]').forEach(button => button.onclick = () => openNoteEditor(state.notes.find(note => note.id === button.dataset.editNote)));
}

function openNoteEditor(note = null) {
  $('#note-form').reset();
  $('#note-id-input').value = note?.id || '';
  $('#note-title-input').value = note?.title || '';
  $('#note-category-input').value = note?.category || '';
  $('#note-body-input').value = note?.body || '';
  $('#note-pinned-input').checked = Boolean(note?.pinned);
  $('#note-dialog-title').textContent = note ? 'Editar nota' : 'Nova nota';
  openDialog('note-dialog');
  setTimeout(() => $('#note-title-input').focus(), 0);
}

function renderQuote() {
  const text = $('#daily-quote-text');
  const author = $('#daily-quote-author');
  if (!text || !author) return;
  const dayIndex = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const quote = QUOTES[(dayIndex + Number(state.settings.quoteOffset || 0)) % QUOTES.length];
  text.textContent = quote.text;
  author.textContent = quote.author;
}

function renderPreferences() {
  $$('[data-accent]').forEach(button => button.classList.toggle('active', button.dataset.accent === state.settings.accent));
  $$('[data-density]').forEach(button => button.classList.toggle('active', button.dataset.density === state.settings.density));
  $$('[data-font-scale]').forEach(button => button.classList.toggle('active', button.dataset.fontScale === state.settings.fontScale));
  $('#toggle-home-news').checked = state.settings.showNews !== false;
  $('#toggle-reduced-motion').checked = Boolean(state.settings.reducedMotion);
}

function renderHabitManager() {
  const cycle = activeCycle();
  const habits = state.habitDefinitions.filter(habit => !cycle || habit.cycleId === cycle.id);
  const title = $('#habit-dialog .modal-header h2');
  const copy = $('#habit-dialog .modal-header p:not(.section-label)');
  if (title) title.textContent = cycle ? `Hábitos de ${cycle.name}` : 'Ajuste seus hábitos';
  if (copy) copy.textContent = 'Arquivar mantém o histórico deste ciclo e remove o hábito da lista de hoje.';
  $('#habit-manager-list').innerHTML = habits.map(habit => `
    <div class="habit-edit-row ${habit.active === false ? 'archived' : ''}">
      <label>Hábito<input data-habit-field="title" data-habit-edit="${escapeHTML(habit.id)}" value="${escapeHTML(habit.title)}" /></label>
      <label>Gatilho<input data-habit-field="cue" data-habit-edit="${escapeHTML(habit.id)}" value="${escapeHTML(habit.cue || '')}" placeholder="Opcional" /></label>
      <button type="button" class="archive-habit" data-archive-habit="${escapeHTML(habit.id)}">${habit.active === false ? 'Reativar' : 'Arquivar'}</button>
    </div>`).join('');
  $$('[data-habit-edit]').forEach(input => input.oninput = event => {
    const habit = state.habitDefinitions.find(item => item.id === event.target.dataset.habitEdit);
    if (!habit) return;
    habit[event.target.dataset.habitField] = event.target.value;
    save(); renderHabits(); updateSummary();
  });
  $$('[data-archive-habit]').forEach(button => button.onclick = () => {
    const habit = state.habitDefinitions.find(item => item.id === button.dataset.archiveHabit);
    if (!habit) return;
    habit.active = habit.active === false;
    save(); renderHabitManager(); renderHabits(); updateSummary();
  });
}

function formatTimer() { return `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`; }

function updatePipTimer() {
  if (!pipWindow || pipWindow.closed) return;
  const display = pipWindow.document.getElementById('pip-timer-display');
  const action = pipWindow.document.getElementById('pip-timer-action');
  const label = pipWindow.document.getElementById('pip-timer-label');
  if (display) display.textContent = formatTimer();
  if (action) action.textContent = timerRunning ? 'Pausar' : 'Começar';
  if (label) label.textContent = timerPreset <= 5 ? 'PAUSA' : timerRunning ? 'FOCO EM ANDAMENTO' : 'FOCO PAUSADO';
}

function updateTimerDisplay() {
  const formatted = formatTimer();
  $('#timer-display').textContent = formatted;
  $('#timer-start').textContent = timerRunning ? 'Pausar' : 'Começar';
  $('#timer-mode').textContent = timerPreset <= 5 ? 'Pausa consciente' : timerRunning ? 'Foco em andamento' : 'Hora de focar';
  $('#floating-timer-display').textContent = formatted;
  $('#floating-timer-toggle').textContent = timerRunning ? 'Pausar' : 'Retomar';
  $('#floating-timer-label').textContent = timerPreset <= 5 ? 'PAUSA' : timerRunning ? 'FOCO EM ANDAMENTO' : 'FOCO PAUSADO';
  updatePipTimer();
}

function setTimerRunning(running) {
  if (timerRunning === running) return;
  timerRunning = running;
  clearInterval(timerInterval);
  if (running) {
    $('#floating-timer').hidden = false;
    timerInterval = setInterval(() => {
      timerSeconds -= 1;
      if (timerSeconds <= 0) completeTimer(); else updateTimerDisplay();
    }, 1000);
  }
  updateTimerDisplay();
}

function completeTimer() {
  clearInterval(timerInterval); timerRunning = false;
  if (timerPreset > 5) {
    state.focusMinutes[DATE_KEY] = (state.focusMinutes[DATE_KEY] || 0) + timerPreset;
    save(); renderHistoryPreview(); renderHistory(); updateSummary(); showToast(`${timerPreset} minutos de foco registrados. Bom trabalho.`);
  } else showToast('Pausa concluída. Respire e volte com intenção.');
  timerSeconds = timerPreset * 60; updateTimerDisplay();
}

async function openTimerPopout() {
  if (!('documentPictureInPicture' in window)) {
    showToast('Seu navegador não suporta mini janela. Use o timer flutuante no canto da página.'); return;
  }
  try {
    pipWindow = await window.documentPictureInPicture.requestWindow({ width: 290, height: 190 });
    const doc = pipWindow.document;
    doc.head.innerHTML = `<title>Foco · ${APP_NAME}</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#15342e;color:#f7fffb;font-family:Inter,Segoe UI,sans-serif}main{width:100%;box-sizing:border-box;padding:22px;text-align:center}.label{font:700 10px ui-monospace,Consolas,monospace;letter-spacing:1px;color:#9fe2d2}.time{margin:7px 0 16px;font:700 52px ui-monospace,Consolas,monospace;letter-spacing:-4px}button{border:0;border-radius:7px;padding:8px 12px;background:#70d2be;color:#09271f;font-weight:800;cursor:pointer}button+button{margin-left:7px;background:transparent;color:#d8f7ee;border:1px solid #4d9688}</style>`;
    doc.body.innerHTML = `<main><div class="label" id="pip-timer-label">FOCO</div><div class="time" id="pip-timer-display">${formatTimer()}</div><button id="pip-timer-action">${timerRunning ? 'Pausar' : 'Começar'}</button><button id="pip-open-focus">Abrir foco</button></main>`;
    doc.getElementById('pip-timer-action').onclick = () => setTimerRunning(!timerRunning);
    doc.getElementById('pip-open-focus').onclick = () => { window.focus(); setRoute('foco'); };
    pipWindow.addEventListener('pagehide', () => { pipWindow = null; }, { once: true });
    updatePipTimer();
  } catch { showToast('Não foi possível abrir a mini janela neste navegador.'); }
}

function bindFocus() {
  $('#timer-start').onclick = () => setTimerRunning(!timerRunning);
  $('#timer-reset').onclick = () => { setTimerRunning(false); timerSeconds = timerPreset * 60; updateTimerDisplay(); };
  $$('.focus-presets button').forEach(button => button.onclick = () => {
    setTimerRunning(false); timerPreset = Number(button.dataset.minutes); timerSeconds = timerPreset * 60;
    $$('.focus-presets button').forEach(item => item.classList.toggle('active', item === button)); updateTimerDisplay();
  });
  $$('.ritual-item input').forEach(input => {
    input.checked = Boolean(state.rituals[input.dataset.ritual]);
    input.onchange = event => { state.rituals[event.target.dataset.ritual] = event.target.checked; save(); };
  });
  $('#focus-task-input').value = state.focusTask || '';
  $('#focus-task-input').oninput = event => { state.focusTask = event.target.value; save(); };
  $('#popout-timer').onclick = openTimerPopout;
  $('#floating-timer-toggle').onclick = () => setTimerRunning(!timerRunning);
  $('#floating-timer-open').onclick = () => setRoute('foco');
  $('#hide-floating-timer').onclick = () => { $('#floating-timer').hidden = true; };
}

function newsEndpoint(topic) {
  return `/api/news?topic=${encodeURIComponent(NEWS_TOPICS[topic] ? topic : 'brazil')}`;
}

function formatNewsDate(value) {
  if (!value) return 'Data não informada';
  const compact = String(value).match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
  const date = compact ? new Date(`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4] || '00'}:${compact[5] || '00'}:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}
function updateNewsPosition(list) {
  const count = list.querySelectorAll('.news-item').length;
  const index = count ? Math.min(count - 1, Math.max(0, Math.round(list.scrollLeft / Math.max(1, list.clientWidth)))) : 0;
  const page = list.id === 'news-list-page';
  $(`#news-position${page ? '-page' : ''}`).textContent = count ? `${index + 1} / ${count}` : '—';
  $(`#news-prev${page ? '-page' : ''}`).disabled = !count || index === 0;
  $(`#news-next${page ? '-page' : ''}`).disabled = !count || index === count - 1;
}
function moveNews(list, step) {
  const count = list.querySelectorAll('.news-item').length;
  if (!count) return;
  const current = Math.round(list.scrollLeft / Math.max(1, list.clientWidth));
  const next = Math.min(count - 1, Math.max(0, current + step));
  list.scrollTo({ left: next * list.clientWidth, behavior: state.settings.reducedMotion ? 'auto' : 'smooth' });
  $(`#news-position${list.id === 'news-list-page' ? '-page' : ''}`).textContent = `${next + 1} / ${count}`;
}
function renderNews(items, { loading = false, error = false, serverMissing = false } = {}) {
  const lists = [$('#news-list'), $('#news-list-page')];
  if (loading) { lists.forEach(list => { list.innerHTML = '<div class="news-skeleton" aria-label="Buscando destaques"><i></i><i></i><i></i></div>'; updateNewsPosition(list); }); return; }
  if (error) {
    lists.forEach(list => { list.innerHTML = serverMissing
      ? '<div class="news-error"><strong>Ative as notícias do seu espaço</strong><p>O Live Server abre a página, mas não fornece as notícias. Na pasta do MindFlow, abra <strong>start.bat</strong> ou execute <code>npm.cmd start</code> e mantenha o terminal aberto. Depois, tente novamente aqui.</p><p>Você pode continuar neste endereço para manter seus dados. Ao trocar de endereço ou porta, use Exportar dados e Importar backup.</p><button class="secondary-button" data-retry-news>Tentar novamente</button></div>'
      : '<div class="news-error"><strong>Os jornais não responderam agora.</strong><p>Confira sua conexão e tente novamente em alguns instantes.</p><button class="text-button" data-retry-news>Tentar novamente</button></div>'; updateNewsPosition(list); });
    $$('[data-retry-news]').forEach(button => button.onclick = () => loadNews({ force: true })); return;
  }
  const news = (Array.isArray(items) ? items : []).filter(item => safeHttp(item.url));
  lists.forEach(list => {
    const limit = list.id === 'news-list' ? 5 : 10;
    list.innerHTML = news.length ? news.slice(0, limit).map(article => {
      const image = safeHttp(article.image);
      const cover = image.startsWith('https://')
        ? `<img data-news-cover src="${escapeHTML(image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
        : '<span class="news-cover-empty">Capa não disponível no feed</span>';
      return `<a class="news-item" href="${escapeHTML(safeHttp(article.url))}" target="_blank" rel="noopener noreferrer"><span class="news-cover">${cover}</span><span class="news-copy"><span class="news-meta">${escapeHTML(article.domain || 'Fonte original')} · ${escapeHTML(formatNewsDate(article.date || article.seendate))}</span><strong class="news-title">${escapeHTML(article.title)}</strong><span class="news-summary">${escapeHTML(article.summary || 'Este veículo não forneceu um resumo no feed. Abra a matéria para ler mais.')}</span><span class="news-open">Ler no veículo original ↗</span></span></a>`;
    }).join('') : '<p class="news-loading">Nenhuma manchete publicada nas últimas 48 horas neste tema. Experimente outro assunto.</p>';
    list.scrollLeft = 0;
    $$('img[data-news-cover]', list).forEach(image => { image.onerror = () => { image.closest('.news-cover').innerHTML = '<span class="news-cover-empty">Capa indisponível</span>'; }; });
    updateNewsPosition(list);
  });
}
function setNewsStatus(message) {
  [$('#news-status'), $('#news-status-page')].forEach(status => { status.textContent = message; });
}
async function fetchNewsPayload(topic, signal) {
  const path = newsEndpoint(topic);
  const endpoints = [path];
  if (['localhost', '127.0.0.1'].includes(location.hostname) && location.port !== LOCAL_SERVER_PORT) endpoints.push(`http://127.0.0.1:${LOCAL_SERVER_PORT}` + path);
  let serverMissing = false;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { signal });
      if (response.status === 404 || !response.headers.get('content-type')?.includes('application/json')) { serverMissing = true; continue; }
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.articles)) throw new Error('upstream');
      return payload;
    } catch (error) {
      if (signal.aborted || error.message === 'upstream') throw error;
      serverMissing = true;
    }
  }
  const error = new Error('news'); error.serverMissing = serverMissing; throw error;
}
async function loadNews({ force = false } = {}) {
  const topic = Object.hasOwn(NEWS_TOPICS, state.settings.newsTopic) ? state.settings.newsTopic : 'brazil';
  state.settings.newsTopic = topic;
  const cached = state.newsCache[topic];
  const validCache = [2, 3].includes(cached?.version) && cached.items?.length;
  const fresh = cached?.version === 3 && validCache && Date.now() - cached.savedAt < 15 * 60 * 1000;
  // Cancel before an early cache return so an older topic cannot overwrite the selected one.
  newsRequest?.abort();
  newsRequest = null;
  if (validCache) { renderNews(cached.items); setNewsStatus(`Salvo em ${formatNewsDate(cached.updatedAt)}`); }
  if (!force && fresh) return;
  const controller = new AbortController(); newsRequest = controller;
  const timeout = setTimeout(() => controller.abort(), 10000);
  if (!validCache) renderNews([], { loading: true });
  setNewsStatus(validCache ? 'Atualizando os destaques…' : 'Buscando nos jornais…');
  try {
    const payload = await fetchNewsPayload(topic, controller.signal);
    if (newsRequest !== controller) return;
    const items = payload.articles.filter(article => article.title && safeHttp(article.url)).slice(0, 10);
    if (payload.stale) {
      renderNews(items); setNewsStatus(`Sem atualização · conteúdo de ${formatNewsDate(payload.updatedAt)}`); return;
    }
    if (!items.length && validCache) { renderNews(cached.items); setNewsStatus('Sem novas manchetes · última consulta salva'); return; }
    state.newsCache[topic] = { version: 3, savedAt: Date.now(), updatedAt: payload.updatedAt, items };
    save({ localOnly: true }); renderNews(items); setNewsStatus(`Consultado em ${formatNewsDate(payload.updatedAt)}`);
  } catch (error) {
    if (newsRequest !== controller) return;
    if (validCache) { renderNews(cached.items); setNewsStatus(`Sem conexão · salvo em ${formatNewsDate(cached.updatedAt)}`); }
    else { renderNews([], { error: true, serverMissing: error.serverMissing }); setNewsStatus('Atualização indisponível'); }
  } finally { clearTimeout(timeout); if (newsRequest === controller) newsRequest = null; }
}

function renderHistoryPreview() {
  const days = recentDateKeys(7).reverse().map(daySummary);
  const recorded = days.filter(day => day.hasData);
  const average = recorded.length ? Math.round(recorded.reduce((sum, day) => sum + day.percentage, 0) / recorded.length) : null;
  $('#history-preview-copy').textContent = recorded.length
    ? `${recorded.length} de 7 dias com registro · ${average}% de consistência quando você registrou.`
    : 'Registre hábitos, foco ou uma nota para começar a enxergar seu ritmo.';
  $('#history-week-preview').innerHTML = days.map(day => `
    <button class="week-day ${day.hasData ? 'recorded' : ''} ${day.day === DATE_KEY ? 'today' : ''}" data-history-preview-date="${escapeHTML(day.day)}" type="button">
      <span>${escapeHTML(formatHistoryWeekday(day.day))}</span>
      <strong>${day.hasData ? `${day.percentage}%` : '—'}</strong>
      <i style="--day-progress:${day.hasData ? Math.max(day.percentage, 8) : 4}%"></i>
    </button>`).join('');
  $$('[data-history-preview-date]').forEach(button => {
    button.onclick = () => { selectedHistoryDate = button.dataset.historyPreviewDate; setRoute('historico'); renderHistory(); };
  });
}

function renderHistory() {
  const summaries = historyDateKeys().map(daySummary);
  const lastWeek = recentDateKeys(7).map(daySummary);
  const recordedWeek = lastWeek.filter(day => day.hasData);
  const recordedDays = recordedDayKeys().size;
  const average = recordedWeek.length ? Math.round(recordedWeek.reduce((sum, day) => sum + day.percentage, 0) / recordedWeek.length) : null;
  const focus = lastWeek.reduce((sum, day) => sum + day.focus, 0);
  if (!summaries.some(day => day.day === selectedHistoryDate)) selectedHistoryDate = DATE_KEY;
  const selected = daySummary(selectedHistoryDate);
  $('#history-days-count').textContent = recordedDays;
  $('#history-week-average').textContent = average === null ? '—' : `${average}%`;
  $('#history-week-focus').textContent = `${focus} min`;
  $('#history-list').innerHTML = summaries.map(day => `
    <button class="history-day ${day.day === selectedHistoryDate ? 'active' : ''} ${day.hasData ? 'recorded' : ''}" type="button" data-history-date="${escapeHTML(day.day)}">
      <span class="history-day-date">${escapeHTML(day.day === DATE_KEY ? 'Hoje' : formatHistoryDate(day.day, { weekday: 'short', day: 'numeric', month: 'short' }))}</span>
      <span class="history-day-meta">${day.hasData ? `${day.completed}/${day.total} hábitos · ${day.focus} min foco` : 'Sem registro'}</span>
      <strong>${day.hasData ? `${day.percentage}%` : '—'}</strong>
    </button>`).join('');
  $$('[data-history-date]').forEach(button => {
    button.onclick = () => { selectedHistoryDate = button.dataset.historyDate; renderHistory(); };
  });
  const journalFields = [
    ['O que fiz', 'did'], ['Conquistas', 'wins'], ['Ajustes', 'improve'], ['Reflexão', 'reflection'], ['Plano seguinte', 'tomorrow']
  ].filter(([, key]) => String(selected.journal[key] || '').trim());
  const checkinFields = [
    selected.checkin.mood && ['Humor', selected.checkin.mood],
    selected.checkin.sleep && ['Sono', selected.checkin.sleep],
    selected.checkin.wake && ['Acordei', selected.checkin.wake],
    selected.checkin.water && ['Água', `${selected.checkin.water} L`]
  ].filter(Boolean);
  $('#history-detail').innerHTML = `
    <div class="history-detail-heading"><div><p class="section-label">DETALHE DO DIA</p><h2>${escapeHTML(selected.day === DATE_KEY ? 'Hoje' : formatHistoryDate(selected.day))}</h2></div><strong>${selected.hasData ? `${selected.percentage}%` : '—'}</strong></div>
    ${selected.hasData ? `<p class="history-detail-summary">${selected.completed} de ${selected.total} hábitos concluídos · ${selected.focus} min de foco.</p>` : '<p class="history-detail-summary">Nenhum registro foi feito neste dia. Tudo bem: consistência começa com o próximo check-in.</p>'}
    <div class="history-habit-grid">${selected.habits.map(habit => `<span class="history-habit ${selected.values[habit.id] ? 'done' : ''}">${selected.values[habit.id] ? '✓' : '–'} ${escapeHTML(habit.title)}</span>`).join('')}</div>
    ${checkinFields.length ? `<div class="history-detail-section"><h3>Check-in</h3><dl>${checkinFields.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl></div>` : ''}
    ${journalFields.length ? `<div class="history-detail-section"><h3>Diário</h3>${journalFields.map(([label, key]) => `<div class="history-note"><strong>${escapeHTML(label)}</strong><p>${escapeHTML(selected.journal[key])}</p></div>`).join('')}</div>` : ''}
    ${selected.day === DATE_KEY ? '<button class="text-button" data-route="hoje">Editar o registro de hoje →</button>' : ''}`;
  const editTodayButton = $('[data-route="hoje"]', $('#history-detail'));
  if (editTodayButton) editTodayButton.onclick = () => setRoute('hoje');
}
function renderFinance() {
  const finance = state.finance;
  const { entries, income, expenses } = financeSummary(finance.transactions, financeMonth);
  const card = finance.card;
  const invoice = invoiceForMonth(card, financeMonth);
  const invoiceTotal = invoiceTotalCents(card, financeMonth);
  const paid = card.paidInvoices[financeMonth];
  const monthPayments = Object.entries(card.paidInvoices).flatMap(([month, payment]) => invoicePaymentParts(payment).filter(part => !part.linkedTransactionId && part.date.startsWith(`${financeMonth}-`)).map(part => ({ month, ...part })));
  const paymentsTotal = monthPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const accountBalance = accountBalanceCents(finance);
  const cardUsed = cardUsedCents(card);
  $('#finance-account-view').hidden = financeView !== 'account';
  $('#finance-card-view').hidden = financeView !== 'card';
  $('#finance-bills-view').hidden = financeView !== 'bills';
  $$('[data-finance-view]').forEach(button => { const selected = button.dataset.financeView === financeView; button.setAttribute('aria-pressed', String(selected)); button.classList.toggle('active', selected); });
  $('#finance-month-label').textContent = monthLabel(financeMonth);
  $('#finance-income').textContent = formatMoney(income);
  $('#finance-expenses').textContent = formatMoney(expenses + paymentsTotal);
  $('#finance-balance').textContent = accountBalance === null ? '—' : formatMoney(accountBalance);
  $('#finance-balance').classList.toggle('negative', accountBalance !== null && accountBalance < 0);
  $('#finance-balance-hint').textContent = accountBalance === null ? 'Ajuste o saldo uma vez para começar' : 'Estimativa após lançamentos feitos desde o último ajuste';
  $('#finance-current-month').hidden = financeMonth === MONTH_KEY;
  $('#finance-filter').value = financeFilter;
  const pendingBills = billsForMonth(finance, financeMonth).filter(bill => !bill.payment && !bill.skipped);
  const pendingInvoice = Math.max(0, invoiceTotal - (paid?.amountCents || 0));
  const pendingTotal = pendingBills.reduce((total, bill) => total + bill.amountCents, 0) + pendingInvoice;
  const dueSoon = pendingBills.filter(bill => bill.dueDate <= DATE_KEY).length + (pendingInvoice && invoiceDueDate(card, financeMonth) <= DATE_KEY ? 1 : 0);
  const insights = [];
  if (dueSoon) insights.push(`${dueSoon} vencimento(s) até hoje para conferir.`);
  if (income) insights.push(`Entrou ${formatMoney(income)}; saiu ${formatMoney(expenses + paymentsTotal)}${expenses + paymentsTotal > income ? ' — as saídas superam as entradas registradas' : ''}.`);
  else insights.push('Sem entradas registradas; ainda não dá para comparar o mês.');
  if (accountBalance === null) insights.push('Saldo bancário não informado; disponibilidade não pode ser estimada.');
  else if (pendingTotal > accountBalance) insights.push('O previsto a pagar supera o saldo estimado; confira os dados no banco.');
  if (paid && paid.date > invoiceDueDate(card, financeMonth)) insights.push('Fatura registrada após o vencimento: confira se houve juros ou multa no extrato.');
  if (paid && paid.amountCents > invoiceTotal) insights.push(`Pago ${formatMoney(paid.amountCents - invoiceTotal)} além do total da fatura; confira encargos ou lançamento duplicado.`);
  const paidBills = billsForMonth(finance, financeMonth).filter(bill => bill.payment);
  if (paidBills.some(bill => bill.payment.amountCents !== bill.amountCents)) insights.push('Há conta paga com valor diferente do previsto; confira multa, desconto ou correção.');
  if (paidBills.some(bill => bill.payment.date > bill.dueDate)) insights.push('Há conta registrada após o vencimento; confira eventuais encargos.');
  if (card.statements[financeMonth] && invoice.length) {
    const itemized = invoice.reduce((total, part) => total + part.amountCents, 0);
    if (itemized !== invoiceTotal) insights.push(`Compras detalhadas somam ${formatMoney(itemized)}, diferente do total informado da fatura; revise taxas ou lançamentos ausentes.`);
  }
  $('#finance-insight').innerHTML = `<div><span class="section-label">LEITURA DO MÊS</span><strong>${pendingTotal ? `${formatMoney(pendingTotal)} ainda previsto para pagar` : 'Sem pendências cadastradas neste mês'}</strong><p>${escapeHTML(insights.slice(0, 3).join(' '))}</p></div><button type="button" class="text-button" id="finance-insight-open-bills">Ver contas →</button>`;
  $('#finance-insight-open-bills').onclick = () => { financeView = 'bills'; renderFinance(); };
  const accountRows = [...entries, ...monthPayments.map(payment => ({ id: `payment-${payment.month}`, date: payment.date, title: `Fatura ${monthLabel(payment.month)}`, type: 'expense', category: 'bills', amountCents: payment.amountCents, payment: true }))];
  const filtered = accountRows.filter(item => financeFilter === 'all' || item.type === financeFilter).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  $('#finance-list').innerHTML = filtered.length ? filtered.map(item => `<div class="finance-row"><div class="finance-row-main"><strong>${escapeHTML(item.title)}</strong><small>${item.payment ? 'Pagamento do cartão' : `${escapeHTML(FINANCE_CATEGORIES[item.type][item.category])} · ${item.method === 'pix' ? 'Pix' : 'Conta'}`} · ${escapeHTML(formatHistoryDate(item.date, { day: '2-digit', month: 'short' }))}</small>${item.documentId ? documentLink(item.documentId) : ''}</div><strong class="finance-amount ${item.type}">${item.type === 'expense' ? '−' : '+'} ${formatMoney(item.amountCents)}</strong>${item.payment ? `<button type="button" class="text-button" data-document-invoice="${escapeHTML(item.month)}">Comprovante</button>` : `<button type="button" class="text-button" data-document-transaction="${escapeHTML(item.id)}">${item.documentId ? 'Trocar arquivo' : 'Anexar'}</button><button type="button" class="text-button" data-finance-edit="${escapeHTML(item.id)}" aria-label="Editar ${escapeHTML(item.title)}">Editar</button>`}</div>`).join('') : `<div class="finance-empty"><h3>${accountRows.length ? 'Nada neste filtro' : 'Comece pela sua conta'}</h3><p>${accountRows.length ? 'Escolha outro tipo para ver os lançamentos.' : 'Ajuste o saldo atual e registre as novas entradas ou saídas. Pix é uma movimentação da conta.'}</p>${accountRows.length ? '' : '<button type="button" class="secondary-button" id="finance-empty-add">+ Registrar lançamento</button>'}</div>`;
  const categories = Object.entries(FINANCE_CATEGORIES.expense).map(([key, label]) => ({ key, label, amount: entries.filter(item => item.type === 'expense' && item.category === key).reduce((sum, item) => sum + item.amountCents, 0) })).filter(item => item.amount).sort((a, b) => b.amount - a.amount);
  $('#finance-categories').innerHTML = categories.length ? categories.map(item => `<div class="finance-category"><div><span>${escapeHTML(item.label)}</span><strong>${formatMoney(item.amount)}</strong></div><div class="progress-track"><span style="width:${progress(item.amount, expenses)}%"></span></div></div>`).join('') : '<p class="finance-category-empty">Os gastos por categoria aparecem quando você registrar uma saída.</p>';
  const limit = state.finance.monthlyLimits[financeMonth] || 0;
  $('#finance-edit-limit').textContent = limit ? 'Editar' : 'Definir';
  $('#finance-limit-track').hidden = !limit;
  $('#finance-limit-copy').textContent = limit ? `${formatMoney(expenses)} de ${formatMoney(limit)} em gastos diretos.` : 'Defina um teto mensal para gastos diretos.';
  $('#finance-limit-progress').style.width = `${progress(expenses, limit)}%`;
  $('#finance-limit-progress').classList.toggle('over-limit', expenses > limit && limit > 0);
  $('#finance-limit-remaining').textContent = limit ? (expenses > limit ? `${formatMoney(expenses - limit)} acima do limite.` : `${formatMoney(limit - expenses)} disponíveis até o limite.`) : '';
  $('#card-invoice-total').textContent = formatMoney(invoiceTotal);
  $('#card-invoice-status').textContent = paid ? `${paid.amountCents >= invoiceTotal ? 'Paga' : 'Parcial'} em ${formatHistoryDate(paid.date, { day: 'numeric', month: 'long' })}` : `Vence ${formatHistoryDate(invoiceDueDate(card, financeMonth), { day: 'numeric', month: 'short' })}`;
  $('#card-used').textContent = card.limitCents || card.purchases.length ? formatMoney(cardUsed) : '—';
  $('#card-available').textContent = card.limitCents ? formatMoney(card.limitCents - cardUsed) : '—';
  $('#card-available').classList.toggle('negative', card.limitCents > 0 && cardUsed > card.limitCents);
  $('#card-limit-hint').textContent = card.limitCents ? `de ${formatMoney(card.limitCents)} de limite total` : 'Configure seu cartão para começar';
  $('#card-invoice-title').textContent = `Fatura de ${monthLabel(financeMonth)}`;
  $('#card-pay-invoice').hidden = !invoiceTotal || Boolean(paid && paid.amountCents >= invoiceTotal);
  $('#card-pay-invoice').textContent = paid ? 'Adicionar pagamento' : 'Registrar pagamento';
  $('#card-statement-detail').innerHTML = invoiceTotal ? `<p>${card.statements[financeMonth] ? 'Total informado pela fatura' : 'Total calculado pelas compras'} · ${formatMoney(invoiceTotal)} · vence ${escapeHTML(formatHistoryDate(invoiceDueDate(card, financeMonth)))}</p>${card.statements[financeMonth]?.note ? `<p>${escapeHTML(card.statements[financeMonth].note)}</p>` : ''}${card.statements[financeMonth]?.documentId ? documentLink(card.statements[financeMonth].documentId) : ''}${paid ? `<p>Total pago ${formatMoney(paid.amountCents)} em ${invoicePaymentParts(paid).length} pagamento(s). ${pendingInvoice ? `Restam ${formatMoney(pendingInvoice)} segundo o total informado.` : 'Sem restante informado.'}</p>${invoicePaymentParts(paid).map(part => `<p>${escapeHTML(formatHistoryDate(part.date))} · ${formatMoney(part.amountCents)}${part.linkedTransactionId ? ' · vinculado à conta' : ''}${part.documentId ? ` · ${documentLink(part.documentId)}` : ''}</p>`).join('')}<button type="button" class="text-button" data-document-invoice="${escapeHTML(financeMonth)}">Anexar comprovante</button><button type="button" class="text-button danger-action" id="card-undo-payment">Desfazer pagamentos</button>` : ''}` : '<p>Você pode informar o total da fatura sem cadastrar cada compra. O valor não é tratado como pago até você confirmar.</p>';
  const undo = $('#card-undo-payment'); if (undo) undo.onclick = undoCardPayment;
  const attach = $('[data-document-invoice]', $('#card-statement-detail')); if (attach) attach.onclick = () => openDocumentDialog({ invoiceMonth: financeMonth });
  $('#card-invoice-list').innerHTML = invoice.length ? invoice.map(part => `<div class="finance-row"><div class="finance-row-main"><strong>${escapeHTML(part.purchase.title)}</strong><small>${escapeHTML(FINANCE_CATEGORIES.expense[part.purchase.category])} · parcela ${part.number}/${part.purchase.installments}</small></div><strong class="finance-amount expense">${formatMoney(part.amountCents)}</strong></div>`).join('') : '<p class="finance-category-empty">Compras detalhadas são opcionais. Você pode registrar só o total da fatura.</p>';
  $('#card-name').textContent = card.name;
  $('#card-dates').textContent = card.limitCents ? `Datas padrão para novas compras: fecha dia ${card.closingDay} · vence dia ${card.dueDay}.` : 'Configurar limite é opcional. Para compras parceladas, informe fechamento e vencimento.';
  const nextMonth = shiftMonth(financeMonth, 1);
  const nextTotal = invoiceTotalCents(card, nextMonth);
  $('#card-next-invoice').textContent = `Próxima fatura (${monthLabel(nextMonth)}): ${formatMoney(nextTotal)}.`;
  $('#card-purchase-list').innerHTML = card.purchases.length ? [...card.purchases].sort((a, b) => b.date.localeCompare(a.date)).map(item => `<div class="finance-row"><div class="finance-row-main"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(formatHistoryDate(item.date, { day: '2-digit', month: 'short' }))} · ${item.installments}x · 1ª fatura: ${escapeHTML(monthLabel(item.firstInvoiceMonth))}</small></div><strong class="finance-amount expense">${formatMoney(item.amountCents)}</strong><button type="button" class="text-button" data-card-edit="${escapeHTML(item.id)}" aria-label="Editar compra ${escapeHTML(item.title)}">Editar</button></div>`).join('') : '<p class="finance-category-empty">Ainda não há compras registradas.</p>';
  renderBills();
  renderHomeBillReminder();
}
function renderBills() {
  const finance = state.finance;
  const bills = billsForMonth(finance, financeMonth);
  const invoice = invoiceForMonth(finance.card, financeMonth);
  const invoiceTotal = invoiceTotalCents(finance.card, financeMonth);
  const cardPaid = finance.card.paidInvoices[financeMonth];
  const pending = bills.filter(bill => !bill.payment && !bill.skipped);
  const invoicePending = Math.max(0, invoiceTotal - (cardPaid?.amountCents || 0));
  const pendingTotal = pending.reduce((sum, bill) => sum + bill.amountCents, 0) + invoicePending;
  const paidTotal = bills.reduce((sum, bill) => sum + (bill.payment?.amountCents || 0), 0) + (cardPaid?.amountCents || 0);
  const next = [...pending.map(bill => ({ dueDate: bill.dueDate, title: bill.title })), ...(invoicePending ? [{ dueDate: invoiceDueDate(finance.card, financeMonth), title: `Fatura ${finance.card.name}` }] : [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  $('#bills-pending-total').textContent = formatMoney(pendingTotal);
  const pendingCount = pending.length + (invoicePending ? 1 : 0);
  $('#bills-pending-count').textContent = pendingCount ? `${pendingCount} ${pendingCount === 1 ? 'conta pendente' : 'contas pendentes'}` : 'Nenhuma conta pendente';
  $('#bills-paid-total').textContent = formatMoney(paidTotal);
  $('#bills-next-due').textContent = next ? formatHistoryDate(next.dueDate, { day: 'numeric', month: 'short' }) : '—';
  $('#bills-next-hint').textContent = next ? next.title : 'Nada pendente neste mês';
  const rows = bills.map(bill => {
    const status = bill.payment ? `Paga em ${formatHistoryDate(bill.payment.date, { day: 'numeric', month: 'short' })}` : bill.skipped ? 'Ignorada neste mês' : bill.dueDate < DATE_KEY ? 'Atrasada' : bill.dueDate === DATE_KEY ? 'Vence hoje' : `Vence ${formatHistoryDate(bill.dueDate, { day: 'numeric', month: 'short' })}`;
    const actions = bill.payment ? `<button type="button" class="text-button" data-bill-undo="${escapeHTML(bill.id)}">Desfazer</button>` : bill.skipped ? `<button type="button" class="text-button" data-bill-unskip="${escapeHTML(bill.id)}">Reativar</button>` : `<button type="button" class="secondary-button" data-bill-pay="${escapeHTML(bill.id)}">Marcar paga</button><button type="button" class="text-button" data-bill-skip="${escapeHTML(bill.id)}">Ignorar mês</button>`;
    return `<div class="bill-row"><div class="bill-row-main"><strong>${escapeHTML(bill.title)}</strong><small class="${!bill.payment && !bill.skipped && bill.dueDate < DATE_KEY ? 'bill-overdue' : ''}">${escapeHTML(status)} · ${bill.recurring ? 'mensal' : 'única'}</small>${bill.documentId ? documentLink(bill.documentId) : ''}${bill.payment?.documentId ? documentLink(bill.payment.documentId) : ''}</div><strong class="finance-amount">${formatMoney(bill.payment?.amountCents || bill.amountCents)}</strong><div class="bill-row-actions">${actions}${bill.payment ? `<button type="button" class="text-button" data-document-transaction="${escapeHTML(bill.payment.id)}">${bill.payment.documentId ? 'Trocar arquivo' : 'Anexar comprovante'}</button>` : ''}<button type="button" class="text-button" data-bill-edit="${escapeHTML(bill.id)}">Editar</button></div></div>`;
  });
  if (invoiceTotal) {
    const dueDate = invoiceDueDate(finance.card, financeMonth);
    rows.push(`<div class="bill-row"><div class="bill-row-main"><strong>Fatura ${escapeHTML(finance.card.name)}</strong><small>${cardPaid ? `${cardPaid.amountCents >= invoiceTotal ? 'Paga' : 'Parcial'} em ${escapeHTML(formatHistoryDate(cardPaid.date, { day: 'numeric', month: 'short' }))}` : dueDate < DATE_KEY ? 'Atrasada' : `Vence ${escapeHTML(formatHistoryDate(dueDate, { day: 'numeric', month: 'short' }))}`} · ${finance.card.statements[financeMonth] ? 'total informado' : 'pelas compras'}</small>${cardPaid?.documentId ? documentLink(cardPaid.documentId) : ''}</div><strong class="finance-amount">${formatMoney(cardPaid ? invoicePending : invoiceTotal)}</strong><div class="bill-row-actions"><button type="button" class="secondary-button" data-bill-card="1">Ver fatura</button></div></div>`);
  }
  $('#bill-list').innerHTML = rows.length ? rows.join('') : '<div class="finance-empty"><h3>Nada a pagar por aqui</h3><p>Cadastre uma conta mensal com valor previsto e vencimento. Ela só vira gasto quando você confirmar o pagamento.</p><button type="button" class="secondary-button" id="bill-empty-add">+ Cadastrar conta</button></div>';
}
function renderHomeBillReminder() {
  const bills = [MONTH_KEY, shiftMonth(MONTH_KEY, 1)].flatMap(month => {
    const rows = billsForMonth(state.finance, month).filter(bill => !bill.payment && !bill.skipped).map(bill => ({ ...bill, month }));
    const invoiceTotal = invoiceTotalCents(state.finance.card, month);
    const remaining = Math.max(0, invoiceTotal - (state.finance.card.paidInvoices[month]?.amountCents || 0));
    if (remaining) rows.push({ title: `Fatura ${state.finance.card.name}`, dueDate: invoiceDueDate(state.finance.card, month), amountCents: remaining, month });
    return rows;
  });
  const horizon = new Date(`${DATE_KEY}T12:00:00`); horizon.setDate(horizon.getDate() + 7);
  const soon = bills.filter(bill => bill.dueDate <= horizon.toLocaleDateString('en-CA')).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  $('#home-bill-reminder').hidden = !soon.length;
  if (soon.length) { homeBillMonth = soon[0].month; $('#home-bill-message').textContent = `${soon.length} ${soon.length === 1 ? 'conta' : 'contas'} em atraso ou a vencer nos próximos 7 dias · ${formatMoney(soon.reduce((sum, bill) => sum + bill.amountCents, 0))}`; }
}
function renderCare() {
  const active = state.care.goals.filter(goal => !goal.archived);
  const archived = state.care.goals.filter(goal => goal.archived);
  if (!active.some(goal => goal.id === selectedCareGoalId)) selectedCareGoalId = active[0]?.id || '';
  $('#care-empty').hidden = active.length > 0;
  $('#care-content').hidden = !active.length;
  $('#care-archived').hidden = !archived.length;
  $('#care-archived').innerHTML = archived.length ? `<span class="section-label">ARQUIVADOS</span>${archived.map(goal => `<button type="button" class="secondary-button" data-care-restore="${escapeHTML(goal.id)}">Reativar ${escapeHTML(goal.title)}</button>`).join('')}` : '';
  if (!active.length) return;
  $('#care-goals').innerHTML = active.map(goal => `<button type="button" data-care-goal="${escapeHTML(goal.id)}" aria-pressed="${goal.id === selectedCareGoalId}">${escapeHTML(goal.title)}</button>`).join('');
  const goal = active.find(item => item.id === selectedCareGoalId);
  $('#care-title').textContent = goal.title;
  $('#care-reason').textContent = goal.reason || 'Sua motivação pode ser escrita no seu plano.';
  $('#care-plan').textContent = goal.alternative || 'Escolha uma ação pequena que você possa fazer quando a vontade aparecer.';
  $('#care-alternative').textContent = goal.alternative ? `Sua alternativa: ${goal.alternative}` : 'Respire, beba água ou mude de ambiente. Você também pode estudar ou escrever.';
  $('#care-pause-panel').hidden = !carePauseDeadline;
  updateCarePauseTimer();
  const events = state.care.events.filter(item => item.goalId === goal.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const week = new Set(recentDateKeys(7));
  $('#care-urges').textContent = events.filter(item => item.type === 'urge' && week.has(item.date)).length;
  $('#care-episodes').textContent = events.filter(item => item.type === 'episode' && week.has(item.date)).length;
  const lastEpisode = events.find(item => item.type === 'episode');
  $('#care-last-episode').textContent = lastEpisode ? `Última ocorrência: ${formatHistoryDate(lastEpisode.date)}. Você pode retomar agora.` : 'Nenhuma ocorrência registrada. Observe seus padrões no seu ritmo.';
  $('#care-event-list').innerHTML = events.length ? events.map(item => `<div class="care-event"><div><strong>${item.type === 'urge' ? 'Impulso atravessado' : 'Ocorrência'}</strong><small>${escapeHTML(formatHistoryDate(item.date))}${item.trigger ? ` · ${escapeHTML(item.trigger)}` : ''}</small>${item.note ? `<p>${escapeHTML(item.note)}</p>` : ''}</div><button type="button" class="text-button" data-care-event="${escapeHTML(item.id)}" aria-label="Editar registro de ${escapeHTML(formatHistoryDate(item.date))}">Editar</button></div>`).join('') : '<p class="finance-category-empty">Se quiser, registre um impulso ou uma ocorrência para descobrir padrões.</p>';
}
function updateCarePauseTimer() {
  if (!carePauseDeadline) return;
  const seconds = Math.max(0, Math.ceil((carePauseDeadline - Date.now()) / 1000));
  $('#care-pause-timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  if (!seconds) { clearInterval(carePauseInterval); carePauseInterval = null; }
}

function renderAll() {
  applyTheme(); renderDate(); renderProfile(); renderCycles(); renderHabits(); renderJournalAndCheckin(); renderPriorities(); renderUpdates(); renderPlanner(); renderKanban(); renderFinance(); renderCare(); renderLearning(); renderVision(); renderNotes(); renderQuote(); renderPreferences(); renderHistoryPreview(); renderHistory(); updateSummary(); bindFocus(); updateTimerDisplay();
}

function setRoute(route) {
  if (route === 'kanban' || route === 'planejamento') {
    state.settings.taskView = route === 'kanban' ? 'board' : 'list';
    route = 'tarefas'; renderTaskView();
  }
  const view = $(`#${route}`);
  if (!view || !view.classList.contains('view')) return;
  $$('.view').forEach(item => item.classList.toggle('active', item === view));
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.route === route));
  $$('.nav-item').forEach(item => {
    if (item.dataset.route === route) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
  });
  if (['notas', 'noticias', 'biblioteca', 'historico', 'visao'].includes(route)) $('#nav-more').open = true;
  renderProfile();
  setMenuOpen(false);
  if (window.location.hash !== `#${route}`) window.location.hash = route;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAvatarPicker() {
  const selected = $('#profile-avatar-input').value;
  const legacy = LEGACY_AVATARS.find(item => item.id === selected);
  const choices = legacy ? [...AVATARS, legacy] : AVATARS;
  $('#avatar-picker').innerHTML = choices.map(avatar => `<button type="button" class="avatar-choice" data-avatar="${avatar.id}" aria-pressed="${avatar.id === selected}" aria-label="Escolher ${escapeHTML(avatar.label)}"><img src="${avatarPath(avatar.id)}" alt="" width="88" height="88" /><span>${escapeHTML(avatar.label)}</span></button>`).join('');
  $$('[data-avatar]').forEach(button => button.onclick = () => { $('#profile-avatar-input').value = button.dataset.avatar; renderAvatarPicker(); $$('#avatar-picker button').find(item => item.dataset.avatar === button.dataset.avatar)?.focus(); });
  const upload = $('#choose-profile-photo');
  upload.setAttribute('aria-pressed', String(selected === 'custom'));
  const preview = $('#profile-photo-preview');
  preview.hidden = !profilePhotoDraft;
  if (profilePhotoDraft) preview.src = profilePhotoDraft;
  $('#profile-photo-label').textContent = profilePhotoDraft ? 'Minha foto' : 'Enviar foto';
}
async function readProfilePhoto(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('Escolha uma imagem PNG, JPG ou WebP de até 8 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar esta imagem.');
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
    const data = canvas.toDataURL('image/webp', .78);
    if (!safeAvatarData(data)) throw new Error('Esta imagem ficou grande demais. Escolha outra foto.');
    return data;
  } finally { bitmap.close(); }
}
function renderBannerPicker() {
  const selected = $('#cycle-banner-input').value;
  $('#banner-picker').innerHTML = BANNERS.map(banner => `<button type="button" class="banner-choice" data-banner="${banner.id}" aria-pressed="${banner.id === selected}"><img src="${bannerPath(banner.id)}" alt="" loading="lazy" width="240" height="80" /><span>${banner.label}</span></button>`).join('') + `<button type="button" class="banner-choice no-banner" data-banner="" aria-pressed="${!selected}">Sem cenário / imagem própria</button>`;
  $$('[data-banner]').forEach(button => button.onclick = () => {
    $('#cycle-banner-input').value = button.dataset.banner;
    if (button.dataset.banner) { $('#cycle-image-input').value = ''; $('#cycle-image-file').value = ''; }
    renderBannerPicker();
    $$('#banner-picker button').find(item => item.dataset.banner === button.dataset.banner)?.focus();
  });
}
function openDialog(id) { $(`#${id}`).showModal(); }

function updateFinanceCategories(selected = '') {
  const type = $('#finance-type-input').value === 'income' ? 'income' : 'expense';
  $('#finance-category-input').innerHTML = Object.entries(FINANCE_CATEGORIES[type]).map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
  $('#finance-category-input').value = Object.hasOwn(FINANCE_CATEGORIES[type], selected) ? selected : (type === 'income' ? 'salary' : 'food');
}
function openFinanceEditor(id = '', type = 'expense') {
  const item = state.finance.transactions.find(entry => entry.id === id);
  pendingDocumentId = '';
  $('#finance-form').reset();
  $('#finance-id-input').value = item?.id || '';
  $('#finance-dialog-title').textContent = item ? 'Editar lançamento' : 'Novo lançamento';
  $('#finance-type-input').value = item?.type || type;
  $('#finance-date-input').value = item?.date || (financeMonth === MONTH_KEY ? DATE_KEY : `${financeMonth}-01`);
  $('#finance-title-input').value = item?.title || '';
  $('#finance-amount-input').value = item ? (item.amountCents / 100).toFixed(2).replace('.', ',') : '';
  $('#finance-method-input').value = item?.method || 'account';
  updateFinanceCategories(item?.category);
  $('#finance-delete').hidden = !item;
  openDialog('finance-dialog');
  $('#finance-title-input').focus();
}
function openCardStatementEditor() {
  const statement = state.finance.card.statements[financeMonth];
  $('#card-statement-form').reset();
  $('#card-statement-month').textContent = monthLabel(financeMonth);
  $('#card-statement-amount').value = statement ? (statement.amountCents / 100).toFixed(2).replace('.', ',') : '';
  $('#card-statement-due').value = statement?.dueDate || billDueDate(financeMonth, state.finance.card.dueDay);
  $('#card-statement-note').value = statement?.note || '';
  $('#card-statement-delete').hidden = !statement;
  pendingDocumentId = statement?.documentId || '';
  openDialog('card-statement-dialog'); $('#card-statement-amount').focus();
}
function undoCardPayment() {
  const payment = state.finance.card.paidInvoices[financeMonth];
  if (!payment || !confirm(`Desfazer todos os pagamentos da fatura de ${monthLabel(financeMonth)}? As saídas vinculadas continuarão na conta; as demais deixarão de ser contadas.`)) return;
  const previous = clone(state.finance);
  delete state.finance.card.paidInvoices[financeMonth];
  if (!save()) { state.finance = previous; return; }
  renderFinance(); showToast('Pagamento desfeito.');
}
function openDocumentDialog(target = null) {
  documentTarget = target;
  uploadedDocument = null;
  $('#finance-document-file').value = '';
  $('#finance-document-use').hidden = true;
  $('#finance-document-destination-label').hidden = Boolean(target);
  $('#finance-document-destination').value = 'invoice';
  $('#finance-document-result').innerHTML = target ? '<p>Escolha o comprovante para anexar ao registro. Um arquivo de fatura não confirma pagamento.</p>' : '<p>PDF com texto ou foto legível. PDF digitalizado sem texto ainda precisa de preenchimento manual.</p>';
  openDialog('finance-document-dialog');
}
function documentAnalysisMarkup(file) {
  const analysis = file.analysis || {};
  const evidence = (analysis.evidence || []).slice(0, 6);
  const charges = (analysis.charges || []).filter(item => item.amountCents);
  return `<div class="document-summary"><strong>${escapeHTML(file.name)}</strong><small>${analysis.kind === 'receipt' ? 'Possível comprovante' : analysis.kind === 'invoice' ? 'Possível fatura ou boleto' : 'Tipo não identificado'} · ${file.method === 'ocr-image' ? 'foto lida por OCR' : file.method === 'pdf-text' ? 'texto do PDF' : 'leitura indisponível'}</small><p>${analysis.amountCents ? `Valor encontrado: <b>${formatMoney(analysis.amountCents)}</b>. ` : 'Valor não identificado. '}${analysis.dueDate ? `Vencimento: <b>${escapeHTML(formatHistoryDate(analysis.dueDate))}</b>. ` : ''}${charges.length ? `Possíveis encargos mencionados (${charges.length}): ${charges.slice(0, 2).map(item => formatMoney(item.amountCents)).join(', ')}. Confira cada trecho; valores não são somados automaticamente. ` : ''}</p><p>${analysis.kind !== 'receipt' ? 'Este documento não comprova quitação.' : 'Confira no banco se o pagamento realmente foi concluído.'}</p></div>${evidence.length ? `<details><summary>Trechos encontrados</summary>${evidence.map(item => `<p>${escapeHTML(item.line)}</p>`).join('')}</details>` : ''}<p class="modal-hint">A leitura pode confundir total, mínimo, parcela e encargos. Não lançamos nada automaticamente.</p>`;
}
function bindFinance() {
  $('#finance-add-income').onclick = () => openFinanceEditor('', 'income');
  $('#finance-add-expense').onclick = () => openFinanceEditor('', 'expense');
  $('#finance-add-bill').onclick = () => openBillEditor();
  $('#finance-add-invoice').onclick = () => openCardStatementEditor();
  $('#finance-read-document').onclick = () => openDocumentDialog();
  $$('[data-finance-view]').forEach(button => button.onclick = () => { financeView = button.dataset.financeView; renderFinance(); });
  $('#finance-prev-month').onclick = () => { financeMonth = shiftMonth(financeMonth, -1); renderFinance(); };
  $('#finance-next-month').onclick = () => { financeMonth = shiftMonth(financeMonth, 1); renderFinance(); };
  $('#finance-current-month').onclick = () => { financeMonth = MONTH_KEY; renderFinance(); };
  $('#finance-filter').onchange = event => { financeFilter = event.target.value; renderFinance(); };
  $('#finance-type-input').onchange = () => updateFinanceCategories();
  $('#finance-list').onclick = event => {
    const documentButton = event.target.closest('[data-document-transaction],[data-document-invoice]');
    if (documentButton) { openDocumentDialog(documentButton.dataset.documentTransaction ? { transactionId: documentButton.dataset.documentTransaction } : { invoiceMonth: documentButton.dataset.documentInvoice }); return; }
    const edit = event.target.closest('[data-finance-edit]');
    if (edit) openFinanceEditor(edit.dataset.financeEdit);
    if (event.target.closest('#finance-empty-add')) openFinanceEditor();
  };
  $('#finance-form').onsubmit = event => {
    event.preventDefault();
    const cents = parseMoneyToCents($('#finance-amount-input').value);
    const date = $('#finance-date-input').value;
    if (!cents) { showToast('Informe um valor positivo, como 125,50.'); $('#finance-amount-input').focus(); return; }
    if (!validFinanceDate(date)) { showToast('Escolha uma data válida.'); $('#finance-date-input').focus(); return; }
    const id = $('#finance-id-input').value;
    const existing = state.finance.transactions.find(item => item.id === id);
    const item = normalizeFinanceTransaction({ id: existing?.id || makeId(), date, type: $('#finance-type-input').value, title: $('#finance-title-input').value, category: $('#finance-category-input').value, amountCents: cents, createdAt: existing?.createdAt || new Date().toISOString(), method: $('#finance-method-input').value, billId: existing?.billId, billMonth: existing?.billMonth, billCreated: existing?.billCreated, documentId: existing?.documentId || pendingDocumentId });
    const previous = clone(state.finance);
    if (existing) Object.assign(existing, item); else state.finance.transactions.push(item);
    if (!save()) { state.finance = previous; return; }
    financeMonth = date.slice(0, 7);
    pendingDocumentId = ''; $('#finance-dialog').close(); renderFinance(); showToast(existing ? 'Lançamento atualizado.' : 'Lançamento salvo.');
  };
  $('#finance-delete').onclick = () => {
    const id = $('#finance-id-input').value;
    const item = state.finance.transactions.find(entry => entry.id === id);
    if (!item || !confirm(`Excluir “${item.title}” de ${formatMoney(item.amountCents)}?`)) return;
    const previous = clone(state.finance);
    state.finance.transactions = state.finance.transactions.filter(entry => entry.id !== id);
    if (!save()) { state.finance = previous; return; }
    $('#finance-dialog').close(); renderFinance(); showToast('Lançamento excluído.');
  };
  $('#finance-edit-limit').onclick = () => {
    $('#finance-limit-month').textContent = `Referência para ${monthLabel(financeMonth)}.`;
    const cents = state.finance.monthlyLimits[financeMonth] || 0;
    $('#finance-limit-input').value = cents ? (cents / 100).toFixed(2).replace('.', ',') : '';
    openDialog('finance-limit-dialog'); $('#finance-limit-input').focus();
  };
  $('#finance-limit-form').onsubmit = event => {
    event.preventDefault();
    const value = $('#finance-limit-input').value.trim();
    const cents = value ? parseMoneyToCents(value) : null;
    if (value && !cents) { showToast('Informe um limite positivo ou deixe em branco para remover.'); $('#finance-limit-input').focus(); return; }
    const previous = clone(state.finance);
    if (cents) state.finance.monthlyLimits[financeMonth] = cents; else delete state.finance.monthlyLimits[financeMonth];
    if (!save()) { state.finance = previous; return; }
    $('#finance-limit-dialog').close(); renderFinance(); showToast(cents ? 'Limite atualizado.' : 'Limite removido.');
  };
  $('#finance-set-balance').onclick = () => {
    const cents = accountBalanceCents(state.finance);
    $('#finance-balance-input').value = cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
    openDialog('finance-balance-dialog'); $('#finance-balance-input').focus();
  };
  $('#finance-balance-form').onsubmit = event => {
    event.preventDefault();
    const cents = parseSignedMoneyToCents($('#finance-balance-input').value);
    if (cents === null) { showToast('Informe um saldo válido, como 250,00 ou -50,00.'); return; }
    const previous = clone(state.finance);
    state.finance.account = { balanceCents: cents, anchoredAt: new Date().toISOString(), anchoredDay: DATE_KEY };
    if (!save()) { state.finance = previous; return; }
    $('#finance-balance-dialog').close(); renderFinance(); showToast('Saldo ajustado. Novos lançamentos atualizarão a estimativa.');
  };
  $('#card-configure').onclick = () => {
    const card = state.finance.card;
    $('#card-name-input').value = card.name;
    $('#card-limit-input').value = card.limitCents ? (card.limitCents / 100).toFixed(2).replace('.', ',') : '';
    $('#card-closing-input').value = card.closingDay;
    $('#card-due-input').value = card.dueDay;
    openDialog('card-config-dialog'); $('#card-name-input').focus();
  };
  $('#card-config-form').onsubmit = event => {
    event.preventDefault();
    const limitCents = parseMoneyToCents($('#card-limit-input').value);
    const closingDay = Number($('#card-closing-input').value), dueDay = Number($('#card-due-input').value);
    if (!limitCents || !Number.isInteger(closingDay) || !Number.isInteger(dueDay) || closingDay < 1 || dueDay < 1 || closingDay > 28 || dueDay > 28 || closingDay === dueDay) { showToast('Informe limite positivo e dias de fechamento/vencimento diferentes, entre 1 e 28.'); return; }
    const previous = clone(state.finance);
    Object.assign(state.finance.card, { name: $('#card-name-input').value.trim().slice(0, 36) || 'Meu cartão', limitCents, closingDay, dueDay });
    if (!save()) { state.finance = previous; return; }
    $('#card-config-dialog').close(); renderFinance(); showToast('Cartão configurado.');
  };
  $('#card-purchase-list').onclick = event => { const button = event.target.closest('[data-card-edit]'); if (button) openCardPurchaseEditor(button.dataset.cardEdit); };
  ['#card-purchase-date', '#card-purchase-amount', '#card-purchase-installments'].forEach(selector => $(selector).oninput = renderCardPurchasePreview);
  $('#card-purchase-form').onsubmit = event => {
    event.preventDefault();
    const amountCents = parseMoneyToCents($('#card-purchase-amount').value);
    const installments = Number($('#card-purchase-installments').value);
    const date = $('#card-purchase-date').value;
    if (!amountCents || !validFinanceDate(date) || !Number.isInteger(installments) || installments < 1 || installments > 24 || amountCents < installments) { showToast('Confira data, valor total e parcelas (1 a 24). Cada parcela precisa ter ao menos um centavo.'); return; }
    const card = state.finance.card;
    const id = $('#card-purchase-id').value;
    const existing = card.purchases.find(item => item.id === id);
    if (existing && cardPurchaseLocked(card, existing)) { showToast('Desfaça o pagamento da fatura antes de editar esta compra.'); return; }
    const firstMonth = existing && existing.date === date ? existing.firstInvoiceMonth : firstInvoiceMonth(date, card.closingDay, card.dueDay);
    const purchase = normalizeCardPurchase({ id: existing?.id || makeId(), title: $('#card-purchase-name').value, date, category: $('#card-purchase-category').value, amountCents, installments, firstInvoiceMonth: firstMonth });
    if (cardPurchaseLocked(card, purchase)) { showToast('Esta compra entraria em uma fatura já paga. Desfaça o pagamento primeiro.'); return; }
    const previous = clone(state.finance);
    if (existing) Object.assign(existing, purchase); else card.purchases.push(purchase);
    if (!save()) { state.finance = previous; return; }
    financeMonth = firstMonth;
    $('#card-purchase-dialog').close(); renderFinance(); showToast(existing ? 'Compra atualizada.' : 'Compra adicionada ao cartão.');
  };
  $('#card-purchase-delete').onclick = () => {
    const card = state.finance.card;
    const item = card.purchases.find(entry => entry.id === $('#card-purchase-id').value);
    if (!item) return;
    if (cardPurchaseLocked(card, item)) { showToast('Desfaça o pagamento da fatura antes de excluir esta compra.'); return; }
    if (!confirm(`Excluir a compra “${item.title}” e todas as suas parcelas?`)) return;
    const previous = clone(state.finance);
    card.purchases = card.purchases.filter(entry => entry.id !== item.id);
    if (!save()) { state.finance = previous; return; }
    $('#card-purchase-dialog').close(); renderFinance(); showToast('Compra excluída.');
  };
  $('#card-add-purchase').onclick = () => openCardPurchaseEditor();
  $('#card-edit-statement').onclick = () => openCardStatementEditor();
  $('#card-statement-form').onsubmit = event => {
    event.preventDefault();
    const amountCents = parseMoneyToCents($('#card-statement-amount').value), dueDate = $('#card-statement-due').value;
    if (!amountCents || !validFinanceDate(dueDate) || !dueDate.startsWith(financeMonth)) { showToast('Informe total e vencimento válidos para o mês da fatura.'); return; }
    const previous = clone(state.finance);
    state.finance.card.statements[financeMonth] = { amountCents, dueDate, note: $('#card-statement-note').value.trim().slice(0, 200), documentId: pendingDocumentId };
    if (!save()) { state.finance = previous; return; }
    pendingDocumentId = ''; $('#card-statement-dialog').close(); renderFinance(); showToast('Fatura registrada como prevista, não como paga.');
  };
  $('#card-statement-delete').onclick = () => {
    if (!confirm('Remover o total informado? Compras detalhadas e pagamento permanecem.')) return;
    const previous = clone(state.finance);
    delete state.finance.card.statements[financeMonth];
    if (!save()) { state.finance = previous; return; }
    $('#card-statement-dialog').close(); renderFinance();
  };
  $('#card-pay-invoice').onclick = () => {
    const card = state.finance.card;
    const amountCents = invoiceTotalCents(card, financeMonth);
    if (!amountCents) return;
    const payment = card.paidInvoices[financeMonth];
    $('#card-payment-copy').textContent = `${monthLabel(financeMonth)} · total da fatura ${formatMoney(amountCents)}. Informe o valor efetivamente pago.`;
    $('#card-payment-amount').value = ((amountCents - (payment?.amountCents || 0)) / 100).toFixed(2).replace('.', ',');
    $('#card-payment-date').value = DATE_KEY;
    const usedTransactions = new Set(Object.values(card.paidInvoices).flatMap(invoicePaymentParts).map(part => part.linkedTransactionId).filter(Boolean));
    const candidates = state.finance.transactions.filter(item => item.type === 'expense' && !item.billId && item.date <= DATE_KEY && !usedTransactions.has(item.id));
    $('#card-payment-existing').innerHTML = '<option value="">Não, lançar agora</option>' + candidates.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.title)} · ${formatMoney(item.amountCents)} · ${escapeHTML(formatHistoryDate(item.date))}</option>`).join('');
    $('#card-payment-existing').value = '';
    openDialog('card-payment-dialog');
  };
  $('#card-payment-form').onsubmit = event => {
    event.preventDefault();
    const linkedTransactionId = $('#card-payment-existing').value;
    const linked = state.finance.transactions.find(item => item.id === linkedTransactionId);
    const amountCents = linked ? linked.amountCents : parseMoneyToCents($('#card-payment-amount').value);
    const date = linked ? linked.date : $('#card-payment-date').value;
    if (!amountCents || !validFinanceDate(date) || date > DATE_KEY) { showToast('Confira valor pago e data até hoje.'); return; }
    if (linked && parseMoneyToCents($('#card-payment-amount').value) !== linked.amountCents && !confirm(`A saída existente é de ${formatMoney(linked.amountCents)}. Usar esse valor real para a fatura?`)) return;
    const previous = clone(state.finance);
    const parts = invoicePaymentParts(previous.card.paidInvoices[financeMonth]).map(part => ({ ...part }));
    parts.push({ date, amountCents, paidAt: new Date().toISOString(), linkedTransactionId, documentId: '' });
    state.finance.card.paidInvoices[financeMonth] = { payments: parts, date, amountCents: parts.reduce((sum, part) => sum + part.amountCents, 0), paidAt: parts.at(-1).paidAt, linkedTransactionId, documentId: previous.card.paidInvoices[financeMonth]?.documentId || '' };
    if (!save()) { state.finance = previous; return; }
    $('#card-payment-dialog').close(); renderFinance(); showToast(linked ? 'Pagamento vinculado sem duplicar a saída.' : 'Pagamento registrado. Anexe o comprovante quando tiver.');
  };
  $('#finance-document-file').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!sharedEndpoint) { showToast('Abra o MindFlow com o servidor local para guardar documentos.'); return; }
    if (file.size > 12 * 1024 * 1024) { showToast('O limite é 12 MB por arquivo.'); return; }
    $('#finance-document-result').textContent = 'Guardando e lendo o arquivo neste PC…';
    $('#finance-document-use').hidden = true;
    try {
      const response = await fetch(sharedEndpoint.replace('/api/state', '/api/documents'), { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Document-Name': encodeURIComponent(file.name) }, body: file, signal: AbortSignal.timeout(90000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Falha ao guardar documento.');
      uploadedDocument = result;
      if (!documentTarget && result.analysis.kind === 'receipt') $('#finance-document-destination').value = 'expense';
      const previous = clone(state.finance);
      state.finance.documents.push({ id: result.id, name: result.name, type: result.type, size: result.size, kind: result.analysis.kind, createdAt: new Date().toISOString() });
      if (documentTarget?.transactionId) {
        const transaction = state.finance.transactions.find(item => item.id === documentTarget.transactionId);
        if (transaction) transaction.documentId = result.id;
      } else if (documentTarget?.invoiceMonth) {
        const payment = state.finance.card.paidInvoices[documentTarget.invoiceMonth];
        const statement = state.finance.card.statements[documentTarget.invoiceMonth];
        if (payment) { payment.documentId = result.id; invoicePaymentParts(payment).at(-1).documentId = result.id; }
        else if (statement) statement.documentId = result.id;
      }
      if (!save()) { state.finance = previous; throw new Error('Não foi possível salvar o vínculo no estado. O arquivo permanece na pasta de dados.'); }
      $('#finance-document-result').innerHTML = documentAnalysisMarkup(result);
      $('#finance-document-use').hidden = Boolean(documentTarget);
      renderFinance();
    } catch (error) { $('#finance-document-result').textContent = `Não foi possível concluir: ${error.message}`; }
  };
  $('#finance-document-use').onclick = () => {
    if (!uploadedDocument) return;
    const { analysis } = uploadedDocument;
    const destination = $('#finance-document-destination').value;
    $('#finance-document-dialog').close();
    if (destination === 'invoice') {
      openCardStatementEditor(); pendingDocumentId = uploadedDocument.id;
      if (analysis.amountCents) $('#card-statement-amount').value = (analysis.amountCents / 100).toFixed(2).replace('.', ',');
      if (analysis.dueDate) { financeMonth = analysis.dueDate.slice(0, 7); $('#card-statement-due').value = analysis.dueDate; $('#card-statement-month').textContent = monthLabel(financeMonth); }
    } else if (destination === 'bill') {
      if (analysis.dueDate) financeMonth = analysis.dueDate.slice(0, 7);
      openBillEditor(); pendingDocumentId = uploadedDocument.id;
      $('#bill-title-input').value = uploadedDocument.name.replace(/\.[^.]+$/, '').slice(0, 80);
      if (analysis.amountCents) $('#bill-amount-input').value = (analysis.amountCents / 100).toFixed(2).replace('.', ',');
      if (analysis.dueDate) $('#bill-due-input').value = Number(analysis.dueDate.slice(8));
      $('#bill-repeat-input').value = 'once';
    } else {
      openFinanceEditor('', destination); pendingDocumentId = uploadedDocument.id;
      $('#finance-title-input').value = uploadedDocument.name.replace(/\.[^.]+$/, '').slice(0, 80);
      if (analysis.amountCents) $('#finance-amount-input').value = (analysis.amountCents / 100).toFixed(2).replace('.', ',');
    }
  };
  bindBills();
}
function openBillEditor(id = '') {
  const bill = state.finance.bills.find(item => item.id === id);
  const hasPayments = bill && state.finance.transactions.some(item => item.billId === bill.id);
  $('#bill-form').reset();
  pendingDocumentId = bill?.documentId || '';
  $('#bill-id-input').value = bill?.id || '';
  $('#bill-dialog-title').textContent = bill ? 'Editar conta' : 'Nova conta';
  $('#bill-title-input').value = bill?.title || '';
  $('#bill-amount-input').value = bill ? (bill.amountCents / 100).toFixed(2).replace('.', ',') : '';
  $('#bill-due-input').value = bill?.dueDay || 10;
  $('#bill-category-input').value = bill?.category || 'bills';
  $('#bill-repeat-input').value = bill?.recurring === false ? 'once' : 'monthly';
  $('#bill-repeat-input').disabled = Boolean(hasPayments);
  $('#bill-archive').hidden = !bill || (bill.recurring === false && hasPayments);
  $('#bill-archive').textContent = bill?.endMonth ? 'Reativar repetição' : hasPayments ? 'Encerrar após este mês' : 'Excluir conta';
  $('#bill-archive').classList.toggle('danger-action', !bill?.endMonth);
  openDialog('bill-dialog'); $('#bill-title-input').focus();
}
function openBillPayment(id) {
  const bill = billsForMonth(state.finance, financeMonth).find(item => item.id === id);
  if (!bill || bill.payment || bill.skipped) return;
  selectedBillId = id;
  $('#bill-payment-form').reset();
  $('#bill-payment-title').textContent = `Pagar ${bill.title}`;
  $('#bill-payment-copy').textContent = `${monthLabel(financeMonth)} · previsto ${formatMoney(bill.amountCents)} · vence dia ${bill.dueDay}.`;
  $('#bill-paid-amount').value = (bill.amountCents / 100).toFixed(2).replace('.', ',');
  $('#bill-paid-date').value = DATE_KEY;
  const candidates = state.finance.transactions.filter(item => item.type === 'expense' && !item.billId && item.date <= DATE_KEY && item.date.startsWith(`${financeMonth}-`));
  $('#bill-existing-input').innerHTML = '<option value="">Não, registrar pagamento agora</option>' + candidates.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.title)} · ${escapeHTML(formatHistoryDate(item.date, { day: 'numeric', month: 'short' }))} · ${formatMoney(item.amountCents)}</option>`).join('');
  $('#bill-payment-fields').hidden = false;
  openDialog('bill-payment-dialog');
}
function bindBills() {
  $('#home-open-bills').onclick = () => { financeView = 'bills'; financeMonth = homeBillMonth; setRoute('financas'); renderFinance(); };
  $('#bill-list').onclick = event => {
    const documentButton = event.target.closest('[data-document-transaction]');
    if (documentButton) { openDocumentDialog({ transactionId: documentButton.dataset.documentTransaction }); return; }
    if (event.target.closest('#bill-empty-add')) { openBillEditor(); return; }
    if (event.target.closest('[data-bill-card]')) { financeView = 'card'; renderFinance(); return; }
    const button = event.target.closest('[data-bill-edit],[data-bill-pay],[data-bill-skip],[data-bill-unskip],[data-bill-undo]');
    if (!button) return;
    const id = button.dataset.billEdit || button.dataset.billPay || button.dataset.billSkip || button.dataset.billUnskip || button.dataset.billUndo;
    if (button.dataset.billEdit) { openBillEditor(id); return; }
    if (button.dataset.billPay) { openBillPayment(id); return; }
    const previous = clone(state.finance);
    const key = `${id}:${financeMonth}`;
    if (button.dataset.billSkip) state.finance.skippedBills[key] = true;
    if (button.dataset.billUnskip) delete state.finance.skippedBills[key];
    if (button.dataset.billUndo) {
      const payment = state.finance.transactions.find(item => item.billId === id && item.billMonth === financeMonth);
      if (!payment || !confirm(payment.billCreated ? 'Desfazer o pagamento e retirar a saída da conta?' : 'Desvincular esta conta? O gasto lançado manualmente continuará na conta.')) return;
      if (payment.billCreated) state.finance.transactions = state.finance.transactions.filter(item => item.id !== payment.id);
      else { payment.billId = ''; payment.billMonth = ''; }
    }
    if (!save()) { state.finance = previous; return; }
    renderFinance(); renderHomeBillReminder(); showToast(button.dataset.billSkip ? 'Conta ignorada neste mês.' : button.dataset.billUnskip ? 'Conta reativada.' : 'Pagamento desfeito.');
  };
  $('#bill-form').onsubmit = event => {
    event.preventDefault();
    const amountCents = parseMoneyToCents($('#bill-amount-input').value), dueDay = Number($('#bill-due-input').value);
    if (!amountCents || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) { showToast('Confira o valor previsto e o dia de vencimento (1 a 31).'); return; }
    const existing = state.finance.bills.find(item => item.id === $('#bill-id-input').value);
    const hasPayments = existing && state.finance.transactions.some(item => item.billId === existing.id);
    const bill = normalizeBill({ id: existing?.id || makeId(), title: $('#bill-title-input').value, amountCents, dueDay, category: $('#bill-category-input').value, documentId: pendingDocumentId,
      startMonth: existing?.startMonth || financeMonth, endMonth: existing?.endMonth || '', recurring: hasPayments ? existing.recurring : $('#bill-repeat-input').value === 'monthly' });
    if (!bill) { showToast('Não foi possível salvar esta conta.'); return; }
    const previous = clone(state.finance);
    if (existing) Object.assign(existing, bill); else state.finance.bills.push(bill);
    if (!save()) { state.finance = previous; return; }
    pendingDocumentId = ''; $('#bill-dialog').close(); renderFinance(); renderHomeBillReminder(); showToast(existing ? 'Conta atualizada.' : 'Conta adicionada.');
  };
  $('#bill-archive').onclick = () => {
    const bill = state.finance.bills.find(item => item.id === $('#bill-id-input').value);
    if (!bill) return;
    const hasPayments = state.finance.transactions.some(item => item.billId === bill.id);
    if (!bill.endMonth && !confirm(hasPayments ? `Encerrar “${bill.title}” após ${monthLabel(financeMonth)}? Os pagamentos anteriores permanecem.` : `Excluir “${bill.title}”?`)) return;
    const previous = clone(state.finance);
    if (bill.endMonth) bill.endMonth = '';
    else if (hasPayments) bill.endMonth = financeMonth >= bill.startMonth ? financeMonth : bill.startMonth;
    else { state.finance.bills = state.finance.bills.filter(item => item.id !== bill.id); Object.keys(state.finance.skippedBills).filter(key => key.startsWith(`${bill.id}:`)).forEach(key => delete state.finance.skippedBills[key]); }
    if (!save()) { state.finance = previous; return; }
    $('#bill-dialog').close(); renderFinance(); renderHomeBillReminder(); showToast(previous.bills.find(item => item.id === bill.id)?.endMonth ? 'Repetição reativada.' : hasPayments ? 'Repetição encerrada.' : 'Conta excluída.');
  };
  $('#bill-existing-input').onchange = () => { $('#bill-payment-fields').hidden = Boolean($('#bill-existing-input').value); };
  $('#bill-payment-form').onsubmit = event => {
    event.preventDefault();
    const bill = billsForMonth(state.finance, financeMonth).find(item => item.id === selectedBillId);
    if (!bill || bill.payment || bill.skipped) return;
    const previous = clone(state.finance);
    const existingId = $('#bill-existing-input').value;
    if (existingId) {
      const transaction = state.finance.transactions.find(item => item.id === existingId && item.type === 'expense' && !item.billId && item.date <= DATE_KEY && item.date.startsWith(`${financeMonth}-`));
      if (!transaction) { showToast('Este gasto não está mais disponível para vincular.'); return; }
      if (transaction.amountCents !== bill.amountCents && !confirm(`O gasto selecionado é de ${formatMoney(transaction.amountCents)}, mas a conta prevista é de ${formatMoney(bill.amountCents)}. Vincular mesmo assim?`)) return;
      transaction.billId = bill.id; transaction.billMonth = financeMonth; transaction.billCreated = false;
    } else {
      const amountCents = parseMoneyToCents($('#bill-paid-amount').value), date = $('#bill-paid-date').value;
      if (!amountCents || !validFinanceDate(date) || date > DATE_KEY) { showToast('Informe valor pago e uma data válida até hoje.'); return; }
      state.finance.transactions.push(normalizeFinanceTransaction({ id: makeId(), date, type: 'expense', title: bill.title, category: bill.category, amountCents, method: $('#bill-paid-method').value, createdAt: new Date().toISOString(), billId: bill.id, billMonth: financeMonth, billCreated: true }));
    }
    delete state.finance.skippedBills[`${bill.id}:${financeMonth}`];
    if (!save()) { state.finance = previous; return; }
    $('#bill-payment-dialog').close(); renderFinance(); renderHomeBillReminder(); showToast('Pagamento registrado sem duplicar o gasto.');
  };
}
function openCardPurchaseEditor(id = '') {
  const card = state.finance.card;
  if (!card.limitCents) { $('#card-configure').click(); showToast('Configure seu cartão antes de registrar uma compra.'); return; }
  const item = card.purchases.find(entry => entry.id === id);
  $('#card-purchase-form').reset();
  $('#card-purchase-id').value = item?.id || '';
  $('#card-purchase-title').textContent = item ? 'Editar compra' : 'Nova compra';
  $('#card-purchase-name').value = item?.title || '';
  $('#card-purchase-date').value = item?.date || DATE_KEY;
  $('#card-purchase-category').value = item?.category || 'food';
  $('#card-purchase-amount').value = item ? (item.amountCents / 100).toFixed(2).replace('.', ',') : '';
  $('#card-purchase-installments').value = item?.installments || 1;
  $('#card-purchase-delete').hidden = !item;
  renderCardPurchasePreview();
  openDialog('card-purchase-dialog'); $('#card-purchase-name').focus();
}
function renderCardPurchasePreview() {
  const date = $('#card-purchase-date').value;
  const amountCents = parseMoneyToCents($('#card-purchase-amount').value);
  const installments = Number($('#card-purchase-installments').value);
  const existing = state.finance.card.purchases.find(item => item.id === $('#card-purchase-id').value);
  if (!validFinanceDate(date) || !amountCents || !Number.isInteger(installments) || installments < 1 || installments > 24 || amountCents < installments) { $('#card-purchase-preview').textContent = 'Informe o total já com eventuais juros e taxas. Até 24 parcelas, com ao menos um centavo por parcela.'; return; }
  const firstMonth = existing && existing.date === date ? existing.firstInvoiceMonth : firstInvoiceMonth(date, state.finance.card.closingDay, state.finance.card.dueDay);
  const first = purchaseInstallments({ amountCents, installments, firstInvoiceMonth: firstMonth })[0];
  $('#card-purchase-preview').textContent = `${installments}x; primeira parcela de ${formatMoney(first.amountCents)} na fatura de ${monthLabel(firstMonth)}. Centavos restantes entram na primeira parcela.`;
}
function openCareGoalEditor(id = '') {
  const goal = state.care.goals.find(item => item.id === id);
  $('#care-goal-form').reset();
  $('#care-goal-id').value = goal?.id || '';
  $('#care-goal-dialog-title').textContent = goal ? 'Editar meu plano' : 'Novo objetivo';
  $('#care-goal-title').value = goal?.title || '';
  $('#care-goal-reason').value = goal?.reason || '';
  $('#care-goal-alternative').value = goal?.alternative || '';
  $('#care-goal-archive').hidden = !goal;
  openDialog('care-goal-dialog'); $('#care-goal-title').focus();
}
function openCareEventEditor(type = 'episode', id = '') {
  const item = state.care.events.find(event => event.id === id);
  if (!selectedCareGoalId) return;
  $('#care-event-form').reset();
  $('#care-event-id').value = item?.id || '';
  $('#care-event-type').value = item?.type || type;
  $('#care-event-dialog-title').textContent = (item?.type || type) === 'urge' ? 'Impulso atravessado' : 'Registrar ocorrência';
  $('#care-event-date').value = item?.date || DATE_KEY;
  $('#care-event-trigger').value = item?.trigger || '';
  $('#care-event-note').value = item?.note || '';
  $('#care-event-delete').hidden = !item;
  openDialog('care-event-dialog');
}
function bindCare() {
  $('#care-new-goal').onclick = () => openCareGoalEditor();
  $('#care-empty-add').onclick = () => openCareGoalEditor();
  $('#care-edit-goal').onclick = () => openCareGoalEditor(selectedCareGoalId);
  $('#care-goals').onclick = event => { const button = event.target.closest('[data-care-goal]'); if (!button) return; selectedCareGoalId = button.dataset.careGoal; carePauseDeadline = 0; renderCare(); };
  $('#care-archived').onclick = event => {
    const button = event.target.closest('[data-care-restore]'); if (!button) return;
    const goal = state.care.goals.find(item => item.id === button.dataset.careRestore); if (!goal) return;
    const previous = clone(state.care); goal.archived = false; selectedCareGoalId = goal.id;
    if (!save()) { state.care = previous; return; }
    renderCare(); showToast('Objetivo reativado.');
  };
  $('#care-goal-form').onsubmit = event => {
    event.preventDefault();
    const title = $('#care-goal-title').value.trim(); if (!title) return;
    const existing = state.care.goals.find(item => item.id === $('#care-goal-id').value);
    const previous = clone(state.care);
    const next = { id: existing?.id || makeId(), title: title.slice(0, 60), reason: $('#care-goal-reason').value.trim().slice(0, 220), alternative: $('#care-goal-alternative').value.trim().slice(0, 160), createdAt: existing?.createdAt || new Date().toISOString(), archived: false };
    if (existing) Object.assign(existing, next); else state.care.goals.push(next);
    if (!save()) { state.care = previous; return; }
    selectedCareGoalId = next.id;
    $('#care-goal-dialog').close(); renderCare(); showToast(existing ? 'Plano atualizado.' : 'Objetivo criado.');
  };
  $('#care-goal-archive').onclick = () => {
    const goal = state.care.goals.find(item => item.id === $('#care-goal-id').value);
    if (!goal || !confirm(`Arquivar “${goal.title}”? Os registros serão preservados.`)) return;
    const previous = clone(state.care); goal.archived = true; selectedCareGoalId = ''; carePauseDeadline = 0;
    if (!save()) { state.care = previous; return; }
    $('#care-goal-dialog').close(); renderCare(); showToast('Objetivo arquivado. Você pode reativá-lo depois.');
  };
  $('#care-pause').onclick = () => {
    carePauseDeadline = Date.now() + 5 * 60 * 1000;
    clearInterval(carePauseInterval); carePauseInterval = setInterval(updateCarePauseTimer, 1000);
    renderCare(); $('#care-pause-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  $('#care-open-studies').onclick = () => setRoute('biblioteca');
  $('#care-open-notes').onclick = () => setRoute('notas');
  $('#care-urge-done').onclick = () => openCareEventEditor('urge');
  $('#care-log-episode').onclick = () => openCareEventEditor('episode');
  $('#care-event-list').onclick = event => { const button = event.target.closest('[data-care-event]'); if (button) openCareEventEditor('episode', button.dataset.careEvent); };
  $('#care-event-form').onsubmit = event => {
    event.preventDefault();
    const date = $('#care-event-date').value;
    if (!validFinanceDate(date) || date > DATE_KEY) { showToast('Escolha uma data válida, até hoje.'); return; }
    const existing = state.care.events.find(item => item.id === $('#care-event-id').value);
    const previous = clone(state.care);
    const next = { id: existing?.id || makeId(), goalId: existing?.goalId || selectedCareGoalId, date, type: $('#care-event-type').value === 'urge' ? 'urge' : 'episode', trigger: $('#care-event-trigger').value.trim().slice(0, 120), note: $('#care-event-note').value.trim().slice(0, 240), createdAt: existing?.createdAt || new Date().toISOString() };
    if (existing) Object.assign(existing, next); else state.care.events.push(next);
    if (!save()) { state.care = previous; return; }
    $('#care-event-dialog').close(); carePauseDeadline = 0; clearInterval(carePauseInterval); renderCare(); showToast(next.type === 'urge' ? 'Impulso registrado. Um passo de cada vez.' : 'Registro salvo. Você pode recomeçar agora.');
  };
  $('#care-event-delete').onclick = () => {
    const id = $('#care-event-id').value;
    if (!id || !confirm('Excluir este registro?')) return;
    const previous = clone(state.care); state.care.events = state.care.events.filter(item => item.id !== id);
    if (!save()) { state.care = previous; return; }
    $('#care-event-dialog').close(); renderCare(); showToast('Registro excluído.');
  };
}

function setMenuOpen(open) {
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  $('.sidebar').classList.toggle('open', open && mobile);
  $('.sidebar').inert = mobile && !open;
  $('.main-content').inert = mobile && open;
  $('#menu-backdrop').hidden = !mobile || !open;
  $('#menu-toggle').setAttribute('aria-expanded', String(mobile && open));
  if (mobile && open) $('#menu-close').focus();
}

function bindDialogs() {
  const taskDialog = $('#task-dialog'); const learningDialog = $('#learning-dialog'); const updateDialog = $('#update-dialog'); const captureDialog = $('#capture-dialog'); const habitDialog = $('#habit-dialog'); const profileDialog = $('#profile-dialog'); const cycleDialog = $('#cycle-dialog'); const noteDialog = $('#note-dialog');
  $$('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
  $('#open-task-form').onclick = () => openTaskEditor();
  $('#task-form').onsubmit = event => {
    event.preventDefault();
    const id = $('#task-id-input').value;
    const existing = state.tasks.find(task => task.id === id);
    const title = $('#task-title-input').value.trim();
    if (!title) { $('#task-title-input').focus(); return; }
    const status = $('#task-status-input').value;
    if (status === 'doing' && state.tasks.filter(task => task.status === 'doing' && task.id !== id).length >= WIP_LIMIT) { showToast('Finalize uma das duas tarefas em andamento antes de iniciar outra.'); return; }
    const task = normalizeTask({ id: id || makeId(), title, area: $('#task-area-input').value, priority: $('#task-priority-input').value, status, date: $('#task-date-input').value, note: $('#task-note-input').value.trim() });
    if (existing) Object.assign(existing, task); else state.tasks.unshift(task);
    if (!save()) return;
    taskDialog.close(); renderAll(); showToast(existing ? 'Tarefa atualizada.' : 'Tarefa criada.');
  };
  $('#delete-task').onclick = () => {
    const id = $('#task-id-input').value;
    const task = state.tasks.find(item => item.id === id);
    if (!task || !confirm(`Excluir a tarefa “${task.title}”?`)) return;
    state.tasks = state.tasks.filter(item => item.id !== id);
    if (!save()) return;
    taskDialog.close(); renderAll(); showToast('Tarefa excluída.');
  };
  $('#open-learning-form').onclick = () => { $('#learning-form').reset(); $('#learning-type-input').value = activeLibrary; openDialog('learning-dialog'); $('#learning-title-input').focus(); };
  $('#learning-form').onsubmit = event => {
    event.preventDefault();
    state.learning.unshift({ id: makeId(), title: $('#learning-title-input').value.trim(), type: $('#learning-type-input').value, category: $('#learning-category-input').value.trim() || 'Geral', author: $('#learning-author-input').value.trim(), total: Number($('#learning-total-input').value) || 0, current: Number($('#learning-current-input').value) || 0 });
    activeLibrary = $('#learning-type-input').value; save(); learningDialog.close(); renderLearning(); updateSummary(); showToast('Item salvo na sua biblioteca.');
  };
  const openUpdate = () => { $('#update-form').reset(); openDialog('update-dialog'); $('#update-text-input').focus(); };
  [$('#add-update'), $('#add-update-home')].filter(Boolean).forEach(button => { button.onclick = openUpdate; });
  $('#update-form').onsubmit = event => {
    event.preventDefault();
    state.updates.unshift({ id: makeId(), text: $('#update-text-input').value.trim(), date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()) });
    save(); updateDialog.close(); renderUpdates(); showToast('Atualização registrada.');
  };
  $('#open-capture').onclick = () => { $('#capture-form').reset(); openDialog('capture-dialog'); $('#capture-input').focus(); };
  $('#capture-form').onsubmit = event => {
    event.preventDefault();
    state.tasks.unshift({ id: makeId(), title: $('#capture-input').value.trim(), area: 'personal', priority: 'low', status: 'backlog', date: '', note: '' });
    save(); captureDialog.close(); renderAll(); showToast('Capturado no Backlog.');
  };
  $('#open-habit-manager').onclick = () => {
    const cycle = cycleForDay(DATE_KEY);
    if (!cycle) { openCycleEditor(); showToast('Crie o mês atual para organizar os hábitos de hoje.'); return; }
    state.activeCycleId = cycle.id; renderHabitManager(); openDialog('habit-dialog');
  };
  $('#add-habit-form').onsubmit = event => {
    event.preventDefault();
    const title = $('#new-habit-title').value.trim(); if (!title) return;
    const cycle = activeCycle();
    const habit = { id: makeId(), title, cue: $('#new-habit-cue').value.trim(), active: true, cycleId: cycle?.id || '' };
    state.habitDefinitions.push(habit);
    if (cycle && !cycle.habitIds.includes(habit.id)) cycle.habitIds.push(habit.id);
    save(); $('#add-habit-form').reset(); renderHabitManager(); renderHabits(); updateSummary(); showToast('Novo hábito adicionado.');
  };
  habitDialog.addEventListener('close', () => { renderAll(); });
  $('#open-cycle-form').onclick = () => openCycleEditor();
  ['#cycle-image-input', '#cycle-image-file'].forEach(selector => $(selector).onchange = () => { $('#cycle-banner-input').value = ''; renderBannerPicker(); });
  $('#cycle-form').onsubmit = async event => {
    event.preventDefault();
    const id = $('#cycle-id-input').value;
    const existing = state.cycles.find(cycle => cycle.id === id);
    const month = $('#cycle-month-input').value;
    const duplicate = state.cycles.find(cycle => cycle.month === month && cycle.id !== id);
    if (duplicate) { showToast('Já existe um ciclo para este mês. Edite o cartão existente.'); return; }
    let image = $('#cycle-image-input').value.trim() || existing?.image || '';
    const file = $('#cycle-image-file').files[0];
    if (file) {
      try { image = await resizeImageFile(file); }
      catch { showToast('Não foi possível processar esta imagem.'); return; }
    }
    const cycle = normalizeCycle({
      ...existing,
      id: existing?.id || makeId(),
      month,
      name: $('#cycle-name-input').value.trim(),
      description: $('#cycle-description-input').value.trim(),
      goals: $('#cycle-goals-input').value,
      image: $('#cycle-banner-input').value ? '' : image,
      banner: $('#cycle-banner-input').value,
      accent: $('#cycle-accent-input').value,
      habitIds: existing?.habitIds || []
    });
    if (existing) Object.assign(existing, cycle);
    else {
      if ($('#copy-cycle-habits').checked) {
        const copies = habitsForCycle(activeCycle()?.id).map(habit => ({ ...habit, id: makeId(), cycleId: cycle.id }));
        state.habitDefinitions.push(...copies);
        cycle.habitIds = copies.map(habit => habit.id);
      }
      state.cycles.push(cycle);
    }
    state.activeCycleId = cycle.id;
    if (!save()) return;
    cycleDialog.close(); renderAll(); showToast(existing ? 'Ciclo atualizado.' : 'Novo ciclo criado. Agora escolha os hábitos do mês.');
  };
  $('#open-note-form').onclick = () => openNoteEditor();
  $('#note-form').onsubmit = event => {
    event.preventDefault();
    const id = $('#note-id-input').value;
    const existing = state.notes.find(note => note.id === id);
    const note = normalizeNote({
      ...existing,
      id: existing?.id || makeId(),
      title: $('#note-title-input').value,
      category: $('#note-category-input').value,
      body: $('#note-body-input').value,
      pinned: $('#note-pinned-input').checked,
      updatedAt: new Date().toISOString()
    });
    if (existing) Object.assign(existing, note); else state.notes.unshift(note);
    save(); noteDialog.close(); renderNotes(); showToast(existing ? 'Nota atualizada.' : 'Nota criada.');
  };
  const openProfile = () => {
    const configured = Boolean(profileName());
    $('#profile-dialog-kicker').textContent = configured ? 'SEU PERFIL LOCAL' : 'BEM-VINDO';
    $('#profile-dialog-title').textContent = configured ? 'Como quer ser chamado?' : `Bem-vindo ao ${APP_NAME}`;
    $('#profile-dialog-copy').textContent = configured ? 'Escolha um personagem ou sua própria foto. Tudo fica neste PC.' : 'Escolha um apelido e um avatar. Sem conta, sem senha.';
    $('#profile-name-input').value = profileName();
    $('#profile-avatar-input').value = state.profile.avatar || 'frieren';
    profilePhotoDraft = safeAvatarData(state.profile.photo);
    $('#profile-photo-input').value = '';
    renderAvatarPicker();
    $('#profile-cancel').hidden = !configured;
    $('#profile-submit').textContent = configured ? 'Salvar perfil' : 'Entrar no meu espaço';
    if (!profileDialog.open) profileDialog.showModal();
    setTimeout(() => $('#profile-name-input').focus(), 0);
  };
  $('#profile-button').onclick = openProfile;
  $('#edit-profile-home').onclick = openProfile;
  $('#choose-profile-photo').onclick = () => $('#profile-photo-input').click();
  $('#profile-photo-input').onchange = async event => {
    try {
      profilePhotoDraft = await readProfilePhoto(event.target.files?.[0]);
      $('#profile-avatar-input').value = 'custom';
      renderAvatarPicker();
      $('#choose-profile-photo').focus();
    } catch (error) { showToast(error.message || 'Não foi possível abrir esta foto.'); }
  };
  $('#profile-cancel').onclick = () => profileDialog.close();
  profileDialog.addEventListener('cancel', event => { if (!profileName()) event.preventDefault(); });
  $('#profile-form').onsubmit = event => {
    event.preventDefault();
    const name = $('#profile-name-input').value.trim().replace(/\s+/g, ' ');
    if (!name) { $('#profile-name-input').focus(); return; }
    state.profile.name = name.slice(0, 48);
    state.profile.avatar = $('#profile-avatar-input').value;
    state.profile.photo = profilePhotoDraft;
    if (!save()) return;
    profileDialog.close(); renderAll(); showToast(`Tudo certo, ${state.profile.name}.`);
  };
  if (!profileName()) openProfile();
}

function bindStorage() {
  $('#export-data').onclick = exportCurrentState;
  $('#data-export').onclick = exportCurrentState;
  $('#data-export-full').onclick = async () => {
    if (!sharedEndpoint) { showToast('Abra pelo app ou servidor local para baixar os arquivos anexados.'); return; }
    try {
      await flushSharedState();
      const start = Date.now();
      while (sharedSaving && Date.now() - start < 10000) await new Promise(resolve => setTimeout(resolve, 100));
      if (sharedPending || sharedConflict || sharedSaving) throw new Error('Há alterações aguardando sincronização. Resolva-as antes de baixar o ZIP.');
      const response = await fetch(sharedEndpoint.replace('/api/state', '/api/backup.zip'), { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('Backup indisponível; copie a pasta de dados manualmente.');
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `mindflow-completo-${DATE_KEY}.zip`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('Backup completo baixado. Guarde-o em local privado.');
    } catch (error) { showToast(error.message); }
  };
  $('#import-data').onchange = event => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = load => {
      try {
        const incoming = JSON.parse(load.target.result);
        const imported = incoming?.state && typeof incoming.state === 'object' ? incoming.state : incoming;
        if (!imported || typeof imported !== 'object' || Array.isArray(imported) || !['profile', 'habits', 'tasks', 'cycles', 'finance', 'notes', 'care'].some(key => Object.hasOwn(imported, key))) throw new Error('invalid');
        if (meaningfulData(state) && !confirm('Importar este backup substituirá os dados atuais. Baixe uma cópia antes de continuar. Deseja prosseguir?')) return;
        const previous = state;
        state = normalizeState(imported);
        if (!save()) { state = previous; return; }
        renderAll(); loadNews({ force: false }); showToast('Backup importado com sucesso.');
      } catch { showToast('Não foi possível importar este arquivo de backup.'); }
    };
    reader.readAsText(file); event.target.value = '';
  };
}

function bindApp() {
  $$('[data-route]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); setRoute(button.dataset.route); }));
  $('#menu-toggle').onclick = () => setMenuOpen(true);
  const closeMenu = () => { setMenuOpen(false); $('#menu-toggle').focus(); };
  $('#menu-close').onclick = closeMenu;
  $('#menu-backdrop').onclick = closeMenu;
  window.matchMedia('(max-width: 760px)').addEventListener('change', () => setMenuOpen(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('.sidebar').classList.contains('open')) closeMenu(); });
  setMenuOpen(false);
  $('#theme-toggle').onclick = () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); };
  $('#reset-habits').onclick = () => {
    if (!completedHabitCount()) return;
    const values = { ...todayHabits() }; activeHabits().forEach(habit => { values[habit.id] = false; });
    state.habits[DATE_KEY] = values; save(); renderHabits(); renderHistoryPreview(); renderHistory(); updateSummary(); showToast('Hábitos de hoje foram limpos.');
  };
  $('#today-start-focus').onclick = () => { const task = getNextTask(); if (task) { state.focusTask = task.title; save(); } setRoute('foco'); $('#timer-start').focus(); };
  $('#today-cycle-strip [data-route]').addEventListener('click', () => {
    const cycle = cycleForDay(DATE_KEY);
    if (cycle) { state.activeCycleId = cycle.id; save(); renderCycles(); }
  });
  ['#task-filter', '#task-period', '#task-show-done'].forEach(selector => $(selector).onchange = () => { renderPlanner(); renderKanban(); });
  $$('[data-task-view]').forEach(button => button.onclick = () => { state.settings.taskView = button.dataset.taskView; save(); renderTaskView(); });
  $$('.library-tab').forEach(tab => tab.onclick = () => { activeLibrary = tab.dataset.library; activeLearningCategory = 'all'; renderLearning(); });
  $('#learning-category-filter').onchange = event => { activeLearningCategory = event.target.value; renderLearning(); };
  const setTopic = topic => {
    state.settings.newsTopic = topic;
    [$('#news-topic'), $('#news-topic-page')].filter(Boolean).forEach(select => { select.value = topic; });
    save(); loadNews({ force: false });
  };
  [$('#news-topic'), $('#news-topic-page')].filter(Boolean).forEach(select => { select.value = state.settings.newsTopic || 'brazil'; select.onchange = event => setTopic(event.target.value); });
  [$('#refresh-news'), $('#refresh-news-page')].filter(Boolean).forEach(button => { button.onclick = () => loadNews({ force: true }); });
  for (const [suffix, id] of [['', 'news-list'], ['-page', 'news-list-page']]) {
    const list = $(`#${id}`);
    $(`#news-prev${suffix}`).onclick = () => moveNews(list, -1);
    $(`#news-next${suffix}`).onclick = () => moveNews(list, 1);
    list.onscroll = () => updateNewsPosition(list);
    list.onkeydown = event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); moveNews(list, event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
  }
  $('#notes-search').oninput = event => { notesSearch = event.target.value; renderNotes(); };
  $('#notes-category-filter').onchange = event => { notesCategory = event.target.value; renderNotes(); };
  const updatePreference = (key, value) => { state.settings[key] = value; save(); applyTheme(); renderPreferences(); };
  $$('[data-accent]').forEach(button => button.onclick = () => updatePreference('accent', button.dataset.accent));
  $$('[data-density]').forEach(button => button.onclick = () => updatePreference('density', button.dataset.density));
  $$('[data-font-scale]').forEach(button => button.onclick = () => updatePreference('fontScale', button.dataset.fontScale));
  $('#toggle-home-news').onchange = event => updatePreference('showNews', event.target.checked);
  $('#toggle-reduced-motion').onchange = event => updatePreference('reducedMotion', event.target.checked);
  $('#next-quote').onclick = () => { state.settings.quoteOffset = Number(state.settings.quoteOffset || 0) + 1; save(); renderQuote(); };
  bindDialogs(); bindFinance(); bindCare(); bindStorage(); bindSyncConflict();
  const routeFromHash = () => {
    const route = window.location.hash.slice(1);
    if (/^[a-z]+$/.test(route)) setRoute(route);
  };
  window.addEventListener('hashchange', routeFromHash);
  routeFromHash();
}

initializeSharedState().catch(() => setSyncStatus('Dados salvos neste navegador')).finally(() => {
  renderAll(); bindApp(); loadNews({ force: false });
});
// Keep a tab left open overnight on the correct day without losing unsaved form input.
function refreshCalendarDay() {
  const day = new Date().toLocaleDateString('en-CA');
  if (day === DATE_KEY || document.querySelector('dialog[open]')) return;
  const wasCurrentFinanceMonth = financeMonth === MONTH_KEY;
  DATE_KEY = day; MONTH_KEY = day.slice(0, 7); selectedHistoryDate = day;
  if (wasCurrentFinanceMonth) financeMonth = MONTH_KEY;
  renderAll(); loadNews({ force: false });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshCalendarDay(); });
setInterval(refreshCalendarDay, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSharedState(); });
setInterval(refreshSharedState, 15000);
