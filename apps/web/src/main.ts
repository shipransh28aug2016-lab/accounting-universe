import './styles.css';
import { clear, h } from './dom';
import { parseHash, navigate } from './router';
import { state } from './state';
import { getProfile, ready, setProfile } from './store';
import { ALL_LABS, labById } from './labs';
import { homePage } from './pages/home';
import { classPage, labsIndex } from './pages/classpage';
import { labPage } from './pages/lab';
import { ledgerPage } from './pages/ledger';
import { practicePage } from './pages/practice';
import { progressPage } from './pages/progress';
import { teacherPage } from './pages/teacher';
import { tutorPage } from './pages/tutor';

const NAV: { label: string; hash: string; match: (p: string[]) => boolean }[] = [
  { label: 'HOME', hash: '#/', match: p => p.length === 0 },
  { label: 'CLASS XI', hash: '#/class/XI', match: p => p[0] === 'class' && p[1] === 'XI' },
  { label: 'CLASS XII', hash: '#/class/XII', match: p => p[0] === 'class' && p[1] === 'XII' },
  { label: 'VISUAL LABS', hash: '#/labs', match: p => p[0] === 'labs' || p[0] === 'lab' || p[0] === 'ledger' },
  { label: 'PRACTICE', hash: '#/practice', match: p => p[0] === 'practice' },
  { label: 'AI TUTOR', hash: '#/tutor', match: p => p[0] === 'tutor' },
  { label: 'MY PROGRESS', hash: '#/progress', match: p => p[0] === 'progress' },
  { label: 'TEACHER DASHBOARD', hash: '#/teacher', match: p => p[0] === 'teacher' },
];

const main = h('main', { id: 'main', tabindex: -1 });
const nav = h('nav', { id: 'nav', 'aria-label': 'Main' });
const net = h('span', { class: 'net', role: 'status' });

function drawNav(path: string[]) {
  clear(nav);
  for (const n of NAV) nav.appendChild(h('a', { href: n.hash, ...(n.match(path) ? { 'aria-current': 'page' } : {}) }, n.label));
}
function drawNet() { net.textContent = navigator.onLine ? 'Online' : 'Offline — everything still works'; net.className = 'net ' + (navigator.onLine ? 'on' : 'off'); }

function render() {
  const { path } = parseHash();
  drawNav(path);
  clear(main);
  let page: HTMLElement;
  try {
    if (path.length === 0) page = homePage(render);
    else if (path[0] === 'class' && (path[1] === 'XI' || path[1] === 'XII')) page = classPage(path[1]);
    else if (path[0] === 'labs') page = labsIndex();
    else if (path[0] === 'lab' && path[1] && labById(path[1])) page = labPage(labById(path[1])!);
    else if (path[0] === 'ledger') page = ledgerPage();
    else if (path[0] === 'practice') page = practicePage(path[1], path[2]);
    else if (path[0] === 'tutor') page = tutorPage();
    else if (path[0] === 'progress') page = progressPage();
    else if (path[0] === 'teacher') page = teacherPage();
    else page = h('div', { class: 'panel' }, h('h2', {}, 'Page not found'), h('p', {}, 'That address does not exist. '), h('a', { href: '#/' }, 'Go home'));
  } catch (e) {
    page = h('div', { class: 'panel' }, h('h2', {}, 'Something went wrong'), h('p', { class: 'note bad', role: 'alert' }, e instanceof Error ? e.message : String(e)), h('a', { href: '#/' }, 'Go home'));
    console.error(e);
  }
  main.appendChild(page);
  document.title = (path.length ? (document.querySelector('main h2')?.textContent ?? 'Accounting Universe') + ' · ' : '') + 'Accounting Universe';
  window.scrollTo(0, 0);
}

async function boot() {
  const app = document.getElementById('app')!;
  const menu = h('button', { type: 'button', class: 'menu', 'aria-expanded': 'false', 'aria-controls': 'nav', onclick: () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); } }, '☰ Menu');
  app.append(
    h('a', { class: 'skip', href: '#main', onclick: (e: Event) => { e.preventDefault(); main.focus(); } }, 'Skip to content'),
    h('header', { class: 'top' }, h('div', { class: 'brand' }, h('b', {}, 'Accounting Universe'), h('span', {}, 'Learn Accounting by Doing Accounting.')), net, menu),
    nav, main);
  await ready();
  const p = await getProfile();
  if (p) state.profile = p; else await setProfile(state.profile);
  window.addEventListener('hashchange', () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); render(); });
  window.addEventListener('online', drawNet); window.addEventListener('offline', drawNet);
  drawNet(); render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
}
void boot();
void ALL_LABS; void navigate;
