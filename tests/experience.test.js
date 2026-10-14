const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function model() {
  const context = vm.createContext({ structuredClone, URL, console, setInterval: () => 0,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { addEventListener() {}, querySelector: () => ({ hidden: false }) } });
  const source = fs.readFileSync(path.join(__dirname, '..', 'visuals.js'), 'utf8')
    + '\n' + fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8').replace(/initializeSharedState\(\)\.catch\([\s\S]*?\n\}\);/, '');
  vm.runInContext(source, context);
  return expression => vm.runInContext(expression, context);
}

test('upgrading an existing profile does not force first-run setup', () => {
  const run = model();
  assert.equal(run("normalizeState({profile:{name:'Alex'}}).experience.configured"), true);
  assert.equal(run('normalizeState({}).experience.configured'), false);
  assert.equal(run("normalizeState({experience:{scene:'unsafe',intention:'unknown'}}).experience.scene"), 'library');
});

test('task description is independent of next action and old tasks survive', () => {
  const run = model();
  const task = run("normalizeTask({title:'Entrega',description:'Contexto da entrega',note:'Enviar para revisão'})");
  assert.equal(task.description, 'Contexto da entrega');
  assert.equal(task.note, 'Enviar para revisão');
  const old = run("normalizeState({tasks:[{id:'old',title:'Anterior',note:'Primeiro passo'}]}).tasks[0]");
  assert.equal(old.description, '');
  assert.equal(old.note, 'Primeiro passo');
});

test('guide checks actual actions instead of example habit definitions', () => {
  const run = model();
  assert.equal(run("(state=normalizeState({experience:{intention:'tarefas'}}),firstGuideActionDone())"), false);
  assert.equal(run("(state=normalizeState({experience:{intention:'tarefas'},tasks:[{title:'Ação real'}]}),firstGuideActionDone())"), true);
  assert.equal(run("(state=normalizeState({experience:{intention:'hoje'}}),firstGuideActionDone())"), false);
});

test('3.0.1 accepts the new offline avatars and keeps unknown choices safe', () => {
  const run = model();
  assert.equal(run("normalizeState({profile:{avatar:'zoro'}}).profile.avatar"), 'zoro');
  assert.equal(run("normalizeState({profile:{avatar:'sanji'}}).profile.avatar"), 'sanji');
  assert.equal(run("normalizeState({profile:{avatar:'unknown'}}).profile.avatar"), 'frieren');
  assert.equal(run("avatarPath('gojo')"), 'assets/pixel/avatar-gojo.png');
});

test('monthly agenda reads tasks from the selected date and day navigation is calendar safe', () => {
  const run = model();
  run("state=normalizeState({tasks:[{id:'a',title:'Dentista',date:'2026-10-20',status:'next',description:'Levar exames'},{id:'b',title:'Outro dia',date:'2026-10-21'}]})");
  const agenda = run("renderCycleDayAgenda('2026-10-20')");
  assert.match(agenda, /Dentista/);
  assert.match(agenda, /Levar exames/);
  assert.doesNotMatch(agenda, /Outro dia/);
  assert.equal(run("shiftDay('2026-03-01',-1)"), '2026-02-28');
});
