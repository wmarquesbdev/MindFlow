// Original MindFlow pixel-art collection. All assets are served locally.
const AVATARS = [
  { id: 'ogre', label: 'Ogro' }, { id: 'wizard', label: 'Mago' },
  { id: 'dragon', label: 'Dragão' }, { id: 'princess', label: 'Princesa' }
];
const BANNERS = [
  { id: 'forest', label: 'Floresta encantada' }, { id: 'castle', label: 'Castelo ao amanhecer' },
  { id: 'coast', label: 'Costa tranquila' }, { id: 'library', label: 'Biblioteca do mago' },
  { id: 'mountains', label: 'Lago das montanhas' }, { id: 'village', label: 'Vila acolhedora' },
  { id: 'moon', label: 'Jardim da lua' }, { id: 'desert', label: 'Oásis dourado' },
  { id: 'snow', label: 'Refúgio na neve' }, { id: 'sky', label: 'Ilha nas nuvens' }
];
const avatarPath = id => `assets/pixel/avatar-${AVATARS.some(item => item.id === id) ? id : 'ogre'}.png`;
const bannerPath = id => BANNERS.some(item => item.id === id) ? `assets/pixel/banner-${id}.png` : '';
const ICON_PATHS = {
  inicio: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  hoje: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-12 5 3 3 5-5"/>',
  ciclos: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 4h2m4 0h2"/>',
  tarefas: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16M5 8h2m4 0h2m4 0h2"/>',
  financas: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4M7 3h10"/>',
  foco: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6m3 3 2 2"/>',
  autocuidado: '<path d="M12 21s-8-4.7-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.3-8 11-8 11Z"/><path d="M9 13h6m-3-3v6"/>',
  notas: '<path d="M5 3h14v13l-5 5H5Z"/><path d="M14 21v-5h5M8 7h8m-8 4h6"/>',
  noticias: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4m3 0h3M7 16h4m3 0h3"/>',
  biblioteca: '<path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15"/>',
  historico: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2"/>',
  visao: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  personalizar: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  moon: '<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
  refresh: '<path d="M20 4v6h-6M4 20v-6h6M4 10a8 8 0 0 1 13-6l3 6M4 14l3 6a8 8 0 0 0 13-6"/>'
};
function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] || ICON_PATHS.notas}</svg>`;
}
