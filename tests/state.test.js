const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function model() {
  const values = new Map();
  const context = vm.createContext({ structuredClone, URL, console, setInterval: () => 0, localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }, document: { addEventListener() {}, querySelector: () => ({ hidden: false }) } });
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const source = read('visuals.js') + '\n' + read('app.js').replace(/initializeSharedState\(\)\.catch\([\s\S]*?\n\}\);/, '');
  vm.runInContext(source, context);
  return expression => vm.runInContext(expression, context);
}
test('old data survives normalization and receives a valid local avatar', () => {
  const run = model();
  const result = run(`normalizeState({profile:{name:'Will'},tasks:[{id:'t1',title:'Entrega'}],habitDefinitions:[{id:'h1',title:'Ler'}],habits:{'2026-08-01':{h1:true}},notes:[{id:'n1',title:'Ideia',body:'Texto'}]})`);
  assert.equal(result.profile.name, 'Will');
  assert.equal(result.profile.avatar, 'frieren');
  assert.equal(result.habits['2026-08-01'].h1, true);
  assert.equal(result.tasks[0].title, 'Entrega');
  assert.equal(result.notes[0].body, 'Texto');
});
test('editing offline after using shared storage marks the browser copy as pending', () => {
  const run = model();
  run("localStorage.setItem(SYNC_MARKER_KEY, 'saved-revision')");
  run("state.profile.name = 'Alex'; save()");
  assert.equal(run('localStorage.getItem(SYNC_PENDING_KEY)'), '1');
  assert.equal(JSON.parse(run('localStorage.getItem(STORAGE_KEY)')).profile.name, 'Alex');
});
test('opening an archived month does not change Today and archived records remain visible', () => {
  const run = model();
  run(`state=normalizeState({cycles:[{id:'current',month:MONTH_KEY},{id:'old',month:'2020-01'}],activeCycleId:'old',habitDefinitions:[{id:'a',title:'Atual',cycleId:'current'},{id:'b',title:'Antigo',cycleId:'old',active:false}],habits:{'2020-01-01':{b:true}}})`);
  assert.equal(run('activeHabits()[0].id'), 'a');
  assert.equal(run("daySummary('2020-01-01').completed"), 1);
});
test('banner and avatar selection round-trip through JSON and no-banner remains empty', () => {
  const run = model();
  assert.equal(run("normalizeState({profile:{name:'P',avatar:'wizard'}}).profile.avatar"), 'wizard');
  assert.equal(run("normalizeState({profile:{name:'P',avatar:'goku'}}).profile.avatar"), 'goku');
  assert.equal(run("normalizeState({profile:{name:'P',avatar:'custom',photo:'data:image/png;base64,YWJj'}}).profile.avatar"), 'custom');
  assert.equal(run("normalizeState({profile:{name:'P',avatar:'custom',photo:'javascript:alert(1)'}}).profile.avatar"), 'frieren');
  assert.equal(run("normalizeCycle(JSON.parse(JSON.stringify(normalizeCycle({banner:'moon'})))).banner"), 'moon');
  assert.equal(run("normalizeCycle({banner:''}).banner"), '');
  assert.equal(run("safeImage('javascript:alert(1)')"), '');
});
test('all static HTML IDs are unique', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
});
test('all declared navigation destinations have a view', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const routes = [...html.matchAll(/data-route="([a-z]+)"/g)].map(match => match[1]);
  for (const route of routes) assert.match(html, new RegExp(`<section class="view(?: active)?" id="${route}"`));
});
test('financial amounts use cents and reject invalid or ambiguous inputs', () => {
  const run = model();
  assert.equal(run("parseMoneyToCents('1.234,56')"), 123456);
  assert.equal(run("parseMoneyToCents('R$ 19,90')"), 1990);
  assert.equal(run("parseMoneyToCents('1234.50')"), 123450);
  assert.equal(run("parseMoneyToCents('0,00')"), null);
  assert.equal(run("parseMoneyToCents('12,345')"), null);
  assert.equal(run("parseMoneyToCents('2abc')"), null);
  assert.equal(run("parseSignedMoneyToCents('-50,25')"), -5025);
  assert.equal(run("parseSignedMoneyToCents('0,00')"), 0);
});
test('manual invoice and linked existing payment survive reload without a second account debit', () => {
  const run = model();
  const finance = run(`normalizeFinance({transactions:[{id:'t',date:'2026-10-01',type:'expense',title:'Cartão',category:'bills',amountCents:340659,createdAt:'2026-10-01T12:00:00Z'}],account:{balanceCents:500000,anchoredAt:'2026-09-30T12:00:00Z',anchoredDay:'2026-09-30'},card:{statements:{'2026-10':{amountCents:340659,dueDate:'2026-10-01'}},paidInvoices:{'2026-10':{date:'2026-10-01',amountCents:340659,paidAt:'2026-10-01T13:00:00Z',linkedTransactionId:'t'}}}})`);
  assert.equal(finance.card.statements['2026-10'].amountCents, 340659);
  assert.equal(finance.card.paidInvoices['2026-10'].linkedTransactionId, 't');
  assert.equal(run(`accountBalanceCents(${JSON.stringify(finance)}, '2026-10-05')`), 159341);
  assert.equal(run(`invoiceTotalCents(${JSON.stringify(finance.card)}, '2026-10')`), 340659);
});
test('finance summary, month navigation and normalization preserve previous data', () => {
  const run = model();
  const normalized = run(`normalizeState({profile:{name:'Teste'},finance:{transactions:[
    {id:'i',type:'income',date:'2026-09-30',title:'Pagamento',category:'salary',amountCents:300000},
    {id:'e',type:'expense',date:'2026-09-01',title:'Mercado',category:'food',amountCents:12050},
    {id:'x',type:'expense',date:'2026-10-01',title:'Outro mês',category:'food',amountCents:1000},
    {id:'bad',date:'2026-02-30',amountCents:1000}
  ],monthlyLimits:{'2026-09':200000,'invalid':1}}})`);
  assert.equal(normalized.profile.name, 'Teste');
  assert.equal(normalized.finance.transactions.length, 3);
  assert.equal(normalized.finance.transactions[0].method, 'account');
  assert.equal(normalized.finance.monthlyLimits['2026-09'], 200000);
  assert.equal(normalized.finance.monthlyLimits.invalid, undefined);
  assert.equal(run(`financeSummary(${JSON.stringify(normalized.finance.transactions)}, '2026-09').balance`), 287950);
  assert.equal(run("shiftMonth('2026-12',1)"), '2027-01');
  assert.equal(run("shiftMonth('2026-01',-1)"), '2025-12');
  assert.equal(run(`normalizeState(${JSON.stringify(normalized)}).finance.transactions.length`), 3);
});
test('credit-card closing date assigns purchases to the correct invoice', () => {
  const run = model();
  assert.equal(run("firstInvoiceMonth('2026-10-20',25,10)"), '2026-11');
  assert.equal(run("firstInvoiceMonth('2026-10-26',25,10)"), '2026-12');
  assert.equal(run("firstInvoiceMonth('2026-10-05',10,25)"), '2026-10');
  assert.equal(run("firstInvoiceMonth('2026-10-15',10,25)"), '2026-11');
  const purchase = {id:'a',date:'2026-10-20',title:'Óculos',category:'health',amountCents:10001,installments:3,firstInvoiceMonth:'2026-11'};
  const parts = run(`purchaseInstallments(${JSON.stringify(purchase)})`);
  assert.deepEqual(Array.from(parts, part => part.amountCents), [3335, 3333, 3333]);
  assert.deepEqual(Array.from(parts, part => part.month), ['2026-11','2026-12','2027-01']);
  assert.equal(run(`invoiceForMonth({purchases:[${JSON.stringify(purchase)}]},'2026-12')[0].amountCents`), 3333);
});
test('paying an invoice affects account once and restores limit; legacy cash entries remain intact', () => {
  const run = model();
  const input = {finance:{transactions:[{id:'old',type:'expense',date:'2026-10-01',title:'Almoço',category:'food',amountCents:2000}],account:{balanceCents:100000,anchoredAt:'2026-10-01T12:00:00.000Z',anchoredDay:'2026-10-01'},card:{limitCents:50000,purchases:[{id:'p',date:'2026-10-01',title:'Compra',category:'other',amountCents:30000,installments:1,firstInvoiceMonth:'2026-11'}],paidInvoices:{'2026-11':{date:'2026-11-10',amountCents:30000,paidAt:'2026-11-10T12:00:00.000Z'}}}}};
  const finance = run(`normalizeState(${JSON.stringify(input)}).finance`);
  assert.equal(finance.transactions[0].title, 'Almoço');
  assert.equal(run(`cardUsedCents(${JSON.stringify(finance.card)})`), 0);
  assert.equal(run(`accountBalanceCents(${JSON.stringify(finance)}, '2026-11-10')`), 70000);
  assert.equal(run(`accountBalanceCents(${JSON.stringify(finance)}, '2026-10-31')`), 100000);
  assert.equal(run(`cardPurchaseLocked(${JSON.stringify(finance.card)}, ${JSON.stringify(finance.card.purchases[0])})`), true);
});
test('monthly and one-time bills show only in their months and use the last day when needed', () => {
  const run = model();
  const finance = run(`normalizeFinance({bills:[
    {id:'monthly',title:'Boleto',amountCents:94800,dueDay:31,startMonth:'2026-10',recurring:true},
    {id:'once',title:'Óleo',amountCents:5000,dueDay:10,startMonth:'2026-11',recurring:false},
    {id:'bad',amountCents:-1,dueDay:60,startMonth:'2026-11'}
  ]})`);
  assert.equal(finance.bills.length, 2);
  assert.equal(run(`billDueDate('2027-02',31)`), '2027-02-28');
  assert.equal(run(`billsForMonth(${JSON.stringify(finance)},'2026-10').length`), 1);
  assert.equal(run(`billsForMonth(${JSON.stringify(finance)},'2026-11').length`), 2);
  assert.equal(run(`billsForMonth(${JSON.stringify(finance)},'2026-12').length`), 1);
  assert.equal(run(`billsForMonth(${JSON.stringify(finance)},'2026-09').length`), 0);
});
test('bill payment links a single expense and survives normalization without creating another debit', () => {
  const run = model();
  const finance = run(`normalizeFinance({bills:[{id:'b',title:'Internet',amountCents:10000,dueDay:12,startMonth:'2026-10',recurring:true}],
    transactions:[{id:'t',date:'2026-10-11',title:'Internet',amountCents:9900,type:'expense',category:'bills',method:'pix',billId:'b',billMonth:'2026-10',billCreated:false}],
    account:{balanceCents:100000,anchoredAt:'2026-10-01T12:00:00.000Z',anchoredDay:'2026-10-01'}})`);
  const october = run(`billsForMonth(${JSON.stringify(finance)},'2026-10')`);
  assert.equal(october[0].payment.id, 't');
  assert.equal(october[0].payment.amountCents, 9900);
  assert.equal(finance.transactions.length, 1);
  assert.equal(run(`financeSummary(${JSON.stringify(finance.transactions)},'2026-10').expenses`), 9900);
  assert.equal(run(`accountBalanceCents(${JSON.stringify(finance)},'2026-10-31')`), 100000);
  assert.equal(run(`billsForMonth(${JSON.stringify(finance)},'2026-11')[0].payment`), null);
});
test('autocuidado normalizes only valid goals and dated records without predefined personal topics', () => {
  const run = model();
  assert.equal(run('normalizeState({}).care.goals.length'), 0);
  const care = run(`normalizeCare({goals:[{id:'g1',title:'Minha escolha',alternative:'Estudar'}],events:[{id:'e1',goalId:'g1',date:'2026-10-01',type:'urge',trigger:'Tédio'},{id:'bad',goalId:'missing',date:'2026-10-01',type:'episode'}]})`);
  assert.equal(care.goals[0].alternative, 'Estudar');
  assert.equal(care.events.length, 1);
  assert.equal(care.events[0].trigger, 'Tédio');
});
