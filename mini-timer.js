const api = window.mindflowDesktop;
let current;
function render(value) {
  current = value;
  document.querySelector('#time').textContent = String(Math.floor(value.seconds / 60)).padStart(2, '0') + ':' + String(value.seconds % 60).padStart(2, '0');
  document.querySelector('#toggle').textContent = value.running ? 'Pausar' : value.seconds ? 'Continuar' : 'Novo ciclo';
  document.querySelector('#label').textContent = value.seconds === 0 ? 'Ciclo concluído' : value.mode === 'break' ? 'Pausa consciente' : value.running ? 'Uma coisa por vez' : 'Pronto quando você estiver';
}
api.onTimer(render); api.getTimer().then(render);
document.querySelector('#toggle').onclick = () => api.timerAction({ action: current?.running ? 'pause' : 'start' }).then(render);
document.querySelector('#open').onclick = () => api.showMain();
document.querySelector('#close').onclick = () => api.closeMini();
