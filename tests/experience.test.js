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
