const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function model() {
  const context = vm.createContext({ structuredClone, URL, console, setInterval: () => 0,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { addEventListener() {}, querySelector: () => ({ hidden: false }) } });
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInContext(read('visuals.js') + '\n' + read('app.js').replace(/initializeSharedState\(\)\.catch\([\s\S]*?\n\}\);/, ''), context);
  return expression => vm.runInContext(expression, context);
}
test('UX search ignores accents, case and edge spaces', () => {
  const run = model();
  assert.equal(run("matchesSearch('Descrição de Finanças', '  FINANCAS ' )"), true);
  assert.equal(run("matchesSearch('Setembro de 2026', '2026')"), true);
  assert.equal(run("matchesSearch('Aluguel', 'internet')"), false);
});
test('actionable tasks exclude completed and future backlog, prioritize active work', () => {
  const run = model();
  const ids = run(`actionableTasks([
    {id:'done', status:'done', date:'2020-01-01'},
    {id:'later', status:'backlog', date:'2030-01-01'},
    {id:'late', status:'backlog', date:'2026-09-30'},
    {id:'next', status:'next', date:''},
    {id:'doing', status:'doing', date:''},
    {id:'today', status:'backlog', date:'2026-10-08'}
  ], '2026-10-08').map(task => task.id)`);
  assert.deepEqual(Array.from(ids), ['doing', 'late', 'next', 'today']);
});
test('weekly insight weights recorded habits and does not penalize missing days', () => {
  const run = model();
  const summary = run(`weekOverview([
    {hasData:true, total:4, completed:3, focus:25},
    {hasData:true, total:2, completed:0, focus:5},
    {hasData:false, total:9, completed:0, focus:0}
  ])`);
  assert.equal(summary.percentage, 50); assert.equal(summary.days, 2); assert.equal(summary.focus, 30);
  assert.equal(run('weekOverview([]).percentage'), null);
});
test('study range clamps values, rounds by unit, rejects invalid input and supports zero', () => {
  const run = model();
  assert.equal(run("studyProgressValue({unit:'pages',total:100}, 31.7)"), 32);
  assert.equal(run("studyProgressValue({unit:'hours',total:20}, 2.36)"), 2.4);
  assert.equal(run("studyProgressValue({unit:'lessons',total:30}, -10)"), 0);
  assert.equal(run("studyProgressValue({unit:'pages',total:100}, 200)"), 100);
  assert.equal(run("studyProgressValue({unit:'pages',total:100}, 'NaN')"), null);
  assert.equal(run("studyProgressValue({unit:'hours',total:0}, 10)"), null);
});
test('UX update leaves legacy private records intact', () => {
  const run = model();
  assert.equal(run(`normalizeState({profile:{name:'Teste'}, learning:[{id:'s',total:30,current:2.5,unit:'hours'}],journal:{'2020-01-01':{did:'Registro'}},care:{goals:[],events:[]}}).learning[0].current`), 2.5);
  assert.equal(run(`normalizeState({journal:{'2020-01-01':{did:'Registro'}}}).journal['2020-01-01'].did`), 'Registro');
});
test('reload recovers safe pending edits but never overwrites a conflicting other window', () => {
  const run = model();
  assert.equal(run("syncRecoveryDecision({name:'A',newsCache:{x:1}},{name:'A'},'old','new',true)"), 'shared');
  assert.equal(run("syncRecoveryDecision({name:'B'},{name:'A'},'same','same',true)"), 'local');
  assert.equal(run("syncRecoveryDecision({name:'B'},{name:'A'},'old','new',true)"), 'ask');
  assert.equal(run("syncRecoveryDecision({name:'B'},{name:'A'},null,'new',false)"), 'ask');
  assert.equal(run("syncRecoveryDecision({name:'B'},{name:'A'},'old','new',false)"), 'shared');
});
