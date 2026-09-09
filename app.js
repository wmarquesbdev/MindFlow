// A troca de marca não descarta o que já foi criado localmente.
const STORAGE_KEY = 'mindflow-v1';
const PREVIOUS_STORAGE_KEYS = ['daydream-v1', 'norte-diario-v1'];
const APP_NAME = 'MindFlow';
const DATE_KEY = new Date().toLocaleDateString('en-CA');
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

const defaultState = {
  profile: { name: '' },
  settings: { theme: 'light', newsTopic: 'brazil' },
  habitDefinitions: DEFAULT_HABITS,
  habits: {}, journal: {}, checkin: {}, updates: [], focusMinutes: {}, rituals: {}, focusTask: '', newsCache: {},
  tasks: [],
  learning: [],
  ikigai: {},
  dreams: []
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const clone = value => structuredClone(value);
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const activeHabits = () => state.habitDefinitions.filter(habit => habit.active !== false);
const todayHabits = () => state.habits[DATE_KEY] || {};
const progress = (current, total) => total ? Math.min(100, Math.round((Number(current) / Number(total)) * 100)) : 0;
const asText = (value, fallback = '') => typeof value === 'string' ? value : fallback;

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
    total,
    current: Math.max(0, Math.min(Number(source.current) || 0, total || Number.MAX_SAFE_INTEGER))
  };
}

function normalizeDream(dream = {}) {
  const source = dream && typeof dream === 'object' ? dream : {};
  return { emoji: asText(source.emoji, '✦'), title: asText(source.title, 'Nova direção'), note: asText(source.note) };
}

function normalizeState(incoming = {}) {
  incoming = incoming && typeof incoming === 'object' ? incoming : {};
  const base = clone(defaultState);
  const incomingHabits = incoming.habits && typeof incoming.habits === 'object' ? incoming.habits : {};
  const definitions = Array.isArray(incoming.habitDefinitions) && incoming.habitDefinitions.length
    ? incoming.habitDefinitions.map(habit => ({ id: asText(habit?.id) || makeId(), title: asText(habit?.title, 'Novo hábito') || 'Novo hábito', cue: asText(habit?.cue), active: habit?.active !== false }))
    : clone(DEFAULT_HABITS);
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
    profile: { name: asText(incoming.profile?.name).trim().slice(0, 48) },
    settings: { ...base.settings, ...(incoming.settings || {}) },
    habitDefinitions: definitions,
    habits: migratedDays,
    journal: incoming.journal || {}, checkin: incoming.checkin || {}, updates: Array.isArray(incoming.updates) ? incoming.updates : [],
    focusMinutes: incoming.focusMinutes || {}, rituals: incoming.rituals || {}, newsCache: incoming.newsCache || {}, ikigai: incoming.ikigai || {}, focusTask: asText(incoming.focusTask),
    tasks: Array.isArray(incoming.tasks) ? incoming.tasks.map(normalizeTask) : base.tasks,
    learning: Array.isArray(incoming.learning) ? incoming.learning.map(normalizeLearningItem) : base.learning,
    dreams: Array.isArray(incoming.dreams) ? incoming.dreams.map(normalizeDream) : base.dreams
  };
}

function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY) || PREVIOUS_STORAGE_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
    return normalizeState(current ? JSON.parse(current) : {});
  } catch { return clone(defaultState); }
}

let state = loadState();
let activeLibrary = 'reading';
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerPreset = 25;
let timerRunning = false;
let pipWindow = null;
let newsRequest = null;

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

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
  $('#profile-initial').textContent = name ? [...name][0].toLocaleUpperCase('pt-BR') : '•';
  $('#profile-button').setAttribute('aria-label', name ? `Editar perfil de ${name}` : 'Definir seu nome');
  $('#profile-button').setAttribute('title', name ? `Editar perfil de ${name}` : 'Definir seu nome');
}

function applyTheme() {
  const theme = state.settings.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  $('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#111816' : '#0f766e');
  $('#theme-icon').textContent = theme === 'dark' ? '☀' : '☾';
  $('#theme-toggle').setAttribute('aria-label', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
  $('#theme-toggle').setAttribute('title', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
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
  $('#home-score-label').textContent = percentage ? `${completed} hábitos concluídos` : 'comece por um hábito';
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
    save(); renderHabits(); updateSummary();
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
      save();
      const status = $('#journal-status'); status.textContent = 'salvo agora';
      clearTimeout(renderJournalAndCheckin.timer);
      renderJournalAndCheckin.timer = setTimeout(() => { status.textContent = 'salvo automaticamente'; }, 1500);
    };
  });
  [['#mood-input', 'mood'], ['#sleep-input', 'sleep'], ['#wake-input', 'wake'], ['#water-input', 'water']].forEach(([selector, key]) => {
    $(selector).onchange = event => { state.checkin[DATE_KEY] = { ...(state.checkin[DATE_KEY] || {}), [key]: event.target.value }; save(); };
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
  $('#updates-list').innerHTML = updates.length ? updates.map(update => `<div class="update-item"><p>${escapeHTML(update.text)}</p><time>${escapeHTML(update.date)}</time></div>`).join('') : '<p class="updates-empty">Anote aqui ideias, melhorias e aprendizados que aparecerem no uso real.</p>';
}

function formatTaskDate(date) {
  if (!date) return 'sem data';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`));
}

function renderPlanner() {
  const filter = $('#task-filter').value;
  const tasks = state.tasks.filter(task => filter === 'all' || task.area === filter).sort((a, b) => (a.status === 'done') - (b.status === 'done'));
  $('#planner-list').innerHTML = tasks.length ? tasks.map(task => `
    <div class="planner-item ${task.status === 'done' ? 'done' : ''}">
      <input class="planner-check" type="checkbox" data-planner-task="${escapeHTML(task.id)}" ${task.status === 'done' ? 'checked' : ''}/>
      <div><strong>${escapeHTML(task.title)}</strong><p>${escapeHTML(task.note || STATUS[task.status])}</p></div>
      <div><span class="badge ${task.priority}">${priorityLabel(task.priority)}</span><span class="task-date">${formatTaskDate(task.date)}</span></div>
    </div>`).join('') : '<p class="updates-empty">Nenhuma tarefa nesta área. Capture a primeira.</p>';
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
    const tasks = state.tasks.filter(task => task.status === status);
    const zone = $(`.drop-zone[data-status="${status}"]`);
    $(`#count-${status}`).textContent = tasks.length;
    zone.innerHTML = tasks.length ? tasks.map(task => {
      const index = flow.indexOf(status); const left = index > 0 ? flow[index - 1] : null; const right = index < flow.length - 1 ? flow[index + 1] : null;
      return `<article class="kanban-card" draggable="true" data-task-id="${escapeHTML(task.id)}"><span class="badge ${task.area}">${task.area === 'work' ? 'Trabalho' : 'Pessoal'}</span><h4>${escapeHTML(task.title)}</h4>${task.note ? `<p>${escapeHTML(task.note)}</p>` : ''}<div class="kanban-meta"><span class="badge ${task.priority}">${priorityLabel(task.priority)}</span><span class="task-date">${formatTaskDate(task.date)}</span></div><div class="kanban-actions">${left ? `<button class="move-button" data-move="${escapeHTML(task.id)}" data-to="${left}">← ${STATUS[left]}</button>` : ''}${right ? `<button class="move-button" data-move="${escapeHTML(task.id)}" data-to="${right}">${STATUS[right]} →</button>` : ''}</div></article>`;
    }).join('') : '<p class="empty-column">Solte um cartão aqui</p>';
  });
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
  const items = state.learning.filter(item => item.type === activeLibrary);
  const unit = activeLibrary === 'reading' ? 'páginas' : 'horas';
  $('#library-list').innerHTML = items.length ? items.map(item => {
    const percentage = progress(item.current, item.total);
    return `<article class="learning-card card"><div class="learning-card-top"><span class="learning-type">${item.type === 'reading' ? 'Leitura' : 'Curso'}</span><button class="text-button" data-learning-progress="${escapeHTML(item.id)}">+ progresso</button></div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.author || 'Sem autor/plataforma')}</p><footer><div class="progress-track"><span style="width:${percentage}%"></span></div><span>${item.current || 0}/${item.total || '?'} ${unit}</span></footer></article>`;
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

function renderHabitManager() {
  const habits = state.habitDefinitions;
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
    save(); updateSummary(); showToast(`${timerPreset} minutos de foco registrados. Bom trabalho.`);
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
  const config = NEWS_TOPICS[topic] || NEWS_TOPICS.brazil;
  return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(config.query)}&mode=artlist&maxrecords=6&timespan=24h&sort=datedesc&format=json`;
}

function formatNewsDate(value) {
  if (!value) return 'agora';
  const match = String(value).match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
  if (!match) return 'recente';
  const [, year, month, day, hour = '00', minute = '00'] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function renderNews(items, { loading = false, error = false } = {}) {
  const list = $('#news-list');
  if (loading) { list.innerHTML = '<p class="news-loading">Buscando as notícias mais recentes…</p>'; return; }
  if (error) { list.innerHTML = '<p class="news-error">Não foi possível atualizar agora.<button class="text-button" id="retry-news">Tentar novamente</button></p>'; $('#retry-news').onclick = () => loadNews({ force: true }); return; }
  list.innerHTML = items?.length ? items.map(article => `<a class="news-item" href="${escapeHTML(article.url)}" target="_blank" rel="noopener noreferrer"><span class="news-title">${escapeHTML(article.title || 'Notícia sem título')}</span><span class="news-meta">${escapeHTML(article.domain || 'Fonte original')} · ${formatNewsDate(article.seendate || article.date)}</span></a>`).join('') : '<p class="news-loading">Nenhuma notícia recente encontrada para este tema.</p>';
}

async function loadNews({ force = false } = {}) {
  const topic = state.settings.newsTopic || 'brazil';
  const cached = state.newsCache[topic];
  const fresh = cached && Date.now() - cached.savedAt < 20 * 60 * 1000;
  if (!force && fresh) { renderNews(cached.items); $('#news-status').textContent = 'atualizado agora'; return; }
  newsRequest?.abort();
  newsRequest = new AbortController();
  renderNews([], { loading: true }); $('#news-status').textContent = 'atualizando';
  try {
    const response = await fetch(newsEndpoint(topic), { signal: newsRequest.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const items = Array.isArray(payload.articles) ? payload.articles.filter(article => article.title && article.url).slice(0, 6) : [];
    state.newsCache[topic] = { savedAt: Date.now(), items };
    save(); renderNews(items); $('#news-status').textContent = 'atualizado';
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (cached?.items?.length) { renderNews(cached.items); $('#news-status').textContent = 'mostrando última atualização'; }
    else { renderNews([], { error: true }); $('#news-status').textContent = 'indisponível'; }
  }
}

function renderAll() {
  applyTheme(); renderDate(); renderProfile(); renderHabits(); renderJournalAndCheckin(); renderPriorities(); renderUpdates(); renderPlanner(); renderKanban(); renderLearning(); renderVision(); updateSummary(); bindFocus(); updateTimerDisplay();
}

function setRoute(route) {
  const view = $(`#${route}`);
  if (!view) return;
  $$('.view').forEach(item => item.classList.toggle('active', item === view));
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.route === route));
  renderProfile();
  $('.sidebar').classList.remove('open');
  if (window.location.hash !== `#${route}`) window.location.hash = route;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openDialog(id) { $(`#${id}`).showModal(); }

function bindDialogs() {
  const taskDialog = $('#task-dialog'); const learningDialog = $('#learning-dialog'); const updateDialog = $('#update-dialog'); const captureDialog = $('#capture-dialog'); const habitDialog = $('#habit-dialog'); const profileDialog = $('#profile-dialog');
  $$('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
  const prepareTask = () => { $('#task-form').reset(); $('#task-date-input').value = DATE_KEY; openDialog('task-dialog'); $('#task-title-input').focus(); };
  $('#open-task-form').onclick = prepareTask; $('#open-kanban-form').onclick = prepareTask;
  $('#task-form').onsubmit = event => {
    event.preventDefault();
    const status = $('#task-status-input').value;
    if (status === 'doing' && state.tasks.filter(task => task.status === 'doing').length >= WIP_LIMIT) { showToast(`O limite de ${WIP_LIMIT} itens em andamento foi atingido.`); return; }
    state.tasks.unshift({ id: makeId(), title: $('#task-title-input').value.trim(), area: $('#task-area-input').value, priority: $('#task-priority-input').value, status, date: $('#task-date-input').value, note: $('#task-note-input').value.trim() });
    save(); taskDialog.close(); renderAll(); showToast('Tarefa adicionada ao seu sistema.');
  };
  $('#open-learning-form').onclick = () => { $('#learning-form').reset(); $('#learning-type-input').value = activeLibrary; openDialog('learning-dialog'); $('#learning-title-input').focus(); };
  $('#learning-form').onsubmit = event => {
    event.preventDefault();
    state.learning.unshift({ id: makeId(), title: $('#learning-title-input').value.trim(), type: $('#learning-type-input').value, author: $('#learning-author-input').value.trim(), total: Number($('#learning-total-input').value) || 0, current: Number($('#learning-current-input').value) || 0 });
    activeLibrary = $('#learning-type-input').value; save(); learningDialog.close(); renderLearning(); updateSummary(); showToast('Item salvo na sua biblioteca.');
  };
  $('#add-update').onclick = () => { $('#update-form').reset(); openDialog('update-dialog'); $('#update-text-input').focus(); };
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
  $('#open-habit-manager').onclick = () => { renderHabitManager(); openDialog('habit-dialog'); };
  $('#add-habit-form').onsubmit = event => {
    event.preventDefault();
    const title = $('#new-habit-title').value.trim(); if (!title) return;
    state.habitDefinitions.push({ id: makeId(), title, cue: $('#new-habit-cue').value.trim(), active: true });
    save(); $('#add-habit-form').reset(); renderHabitManager(); renderHabits(); updateSummary(); showToast('Novo hábito adicionado.');
  };
  habitDialog.addEventListener('close', () => { renderHabits(); updateSummary(); });
  const openProfile = () => {
    const configured = Boolean(profileName());
    $('#profile-dialog-kicker').textContent = configured ? 'SEU PERFIL LOCAL' : 'BEM-VINDO';
    $('#profile-dialog-title').textContent = configured ? 'Como quer ser chamado?' : `Bem-vindo ao ${APP_NAME}`;
    $('#profile-dialog-copy').textContent = configured ? 'Altere o nome exibido nas suas saudações.' : 'Informe seu nome para personalizar as saudações. Ele fica salvo somente neste navegador.';
    $('#profile-name-input').value = profileName();
    $('#profile-cancel').hidden = !configured;
    $('#profile-submit').textContent = configured ? 'Salvar nome' : 'Entrar no meu espaço';
    if (!profileDialog.open) profileDialog.showModal();
    setTimeout(() => $('#profile-name-input').focus(), 0);
  };
  $('#profile-button').onclick = openProfile;
  $('#profile-cancel').onclick = () => profileDialog.close();
  profileDialog.addEventListener('cancel', event => { if (!profileName()) event.preventDefault(); });
  $('#profile-form').onsubmit = event => {
    event.preventDefault();
    const name = $('#profile-name-input').value.trim().replace(/\s+/g, ' ');
    if (!name) { $('#profile-name-input').focus(); return; }
    state.profile.name = name.slice(0, 48);
    save(); profileDialog.close(); renderAll(); showToast(`Tudo certo, ${state.profile.name}.`);
  };
  if (!profileName()) openProfile();
}

function bindStorage() {
  $('#export-data').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `mindflow-backup-${DATE_KEY}.json`; link.click(); URL.revokeObjectURL(url); showToast('Backup baixado. Guarde-o em um local seguro.');
  };
  $('#import-data').onchange = event => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = load => {
      try {
        const incoming = JSON.parse(load.target.result);
        if (!incoming || typeof incoming !== 'object') throw new Error('invalid');
        state = normalizeState(incoming); save(); renderAll(); loadNews({ force: false }); showToast('Backup importado com sucesso.');
      } catch { showToast('Não foi possível importar este arquivo de backup.'); }
    };
    reader.readAsText(file); event.target.value = '';
  };
}

function bindApp() {
  $$('[data-route]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); setRoute(button.dataset.route); }));
  $('#menu-toggle').onclick = () => $('.sidebar').classList.toggle('open');
  $('#theme-toggle').onclick = () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); };
  $('#reset-habits').onclick = () => {
    if (!completedHabitCount()) return;
    const values = { ...todayHabits() }; activeHabits().forEach(habit => { values[habit.id] = false; });
    state.habits[DATE_KEY] = values; save(); renderHabits(); updateSummary(); showToast('Hábitos de hoje foram limpos.');
  };
  $('#today-start-focus').onclick = () => { const task = getNextTask(); if (task) { state.focusTask = task.title; save(); } setRoute('foco'); $('#timer-start').focus(); };
  $('#task-filter').onchange = renderPlanner;
  $$('.library-tab').forEach(tab => tab.onclick = () => { activeLibrary = tab.dataset.library; renderLearning(); });
  $('#news-topic').value = state.settings.newsTopic || 'brazil';
  $('#news-topic').onchange = event => { state.settings.newsTopic = event.target.value; save(); loadNews({ force: false }); };
  $('#refresh-news').onclick = () => loadNews({ force: true });
  bindDialogs(); bindStorage();
  window.addEventListener('hashchange', () => { const route = window.location.hash.slice(1); if (route && $(`#${route}`) && !($(`#${route}`).classList.contains('active'))) setRoute(route); });
  const initialRoute = window.location.hash.slice(1); if (initialRoute && $(`#${initialRoute}`)) setRoute(initialRoute);
}

renderAll(); bindApp(); loadNews({ force: false });
