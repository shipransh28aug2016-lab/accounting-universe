import './styles.css';
import { clear, h } from './dom';
import { parseHash } from './router';
import { NAV, resolve } from './routes';
import { Machine } from '../../../packages/engine/src';
import { APP_BOOT, NETWORK } from '../../../packages/curriculum/src';
import { icon } from './icons';
import { HINDI_PAGES, hindiBanner, tr } from './i18n';
import type { Key } from '../../../packages/curriculum/src/i18n';
import { register, runDisposers } from './machine-dom';
import { state } from './state';
import { t } from '../../../packages/curriculum/src/i18n';
import { getProfile, ready, setProfile, storage } from './store';
import { labById } from './labs';
import { homePage } from './pages/home';
import { classPage, labsIndex } from './pages/classpage';
import { labPage } from './pages/lab';
import { ledgerPage } from './pages/ledger';
import { practicePage } from './pages/practice';
import { progressPage } from './pages/progress';
import { teacherPage } from './pages/teacher';
import { tutorPage } from './pages/tutor';
import { cardPage, cardsIndex } from './pages/cards';
import { trainerPage } from './pages/trainer';
import { crisisPage } from './pages/crisis';
import { casPage } from './pages/cas';
import { projectPage } from './pages/project';
import { rescuePage } from './pages/rescue';
import { assignmentPage } from './pages/assignment';
import { CARDS } from '../../../packages/curriculum/src';

const main = h('main', { id: 'main', tabindex: -1 });
const nav = h('nav', { id: 'nav', 'aria-label': 'Main' });
const net = h('span', { class: 'net', role: 'status' });
const langBtn = h('button', { type: 'button', class: 'lang', 'data-lang-toggle': '', onclick: () => { void setLang(state.lang === 'hi' ? 'en' : 'hi'); } });
function drawLang() {
  langBtn.textContent = t(state.lang, 'lang.toggle');
  langBtn.setAttribute('lang', state.lang === 'hi' ? 'en' : 'hi');
  langBtn.setAttribute('aria-label', t(state.lang, 'lang.toggle.aria'));
  root.setAttribute('data-lang', state.lang);
  root.setAttribute('lang', state.lang);                    // the page language, so screen readers and browsers pick the right voice and hyphenation
  draftBanner.hidden = state.lang !== 'hi' || draftBanner.getAttribute('data-hindi-draft') === 'reviewed';
  for (const f of relabel) f();
  drawNetText();
}
async function setLang(l: 'en' | 'hi') { state.lang = l; state.profile = { ...state.profile, lang: l }; drawLang(); render(); await setProfile(state.profile); }

// Everything in the header that has words in it registers a relabel function here; drawLang() runs them all when the language changes.
const relabel: (() => void)[] = [];
const draftBanner = hindiBanner();

function drawNav(active: string | null) {
  clear(nav);
  for (const n of NAV) nav.appendChild(h('a', { href: n.hash, ...(n.key === active ? { 'aria-current': 'page' } : {}) }, tr(`nav.${n.key}` as Key)));
}

// --- Display menu: projector mode (high contrast, larger type) lives here, out of the way of the main header ---
function initDisplayMenu(): HTMLElement {
  const saved = (() => { try { return localStorage.getItem('au-projector') === '1'; } catch { return false; } })();
  const panelId = 'display-panel';
  const projTitle = h('b', {}), projSub = h('small', {});
  const toggle = h('button', { type: 'button', class: 'projector-toggle', role: 'switch', 'aria-checked': String(saved) }, h('span', { class: 'switch-track', 'aria-hidden': 'true' }, h('span', { class: 'switch-knob' })), h('span', {}, projTitle, projSub));
  const panel = h('div', { id: panelId, class: 'display-panel', role: 'group', hidden: true }, toggle);
  const btnText = h('span', {});
  const btn = h('button', { type: 'button', class: 'display-btn', 'aria-expanded': 'false', 'aria-controls': panelId }, icon('display', 16), btnText);
  relabel.push(() => {
    btnText.textContent = tr('ui.display'); btn.setAttribute('aria-label', tr('ui.display.aria')); panel.setAttribute('aria-label', tr('ui.display.aria'));
    projTitle.textContent = tr('ui.projector'); projSub.textContent = tr('ui.projector.sub');
  });
  const wrap = h('div', { class: 'display-menu' }, btn, panel);
  const apply = (on: boolean) => {
    document.documentElement.classList.toggle('projector', on);
    toggle.setAttribute('aria-checked', String(on));
    try { localStorage.setItem('au-projector', on ? '1' : '0'); } catch { /* storage may be blocked */ }
  };
  const isOpen = () => !panel.hasAttribute('hidden');
  const setOpen = (open: boolean) => { panel.toggleAttribute('hidden', !open); btn.setAttribute('aria-expanded', String(open)); };
  if (saved) document.documentElement.classList.add('projector');
  toggle.onclick = () => apply(!document.documentElement.classList.contains('projector'));
  btn.onclick = () => setOpen(!isOpen());
  document.addEventListener('click', e => { if (isOpen() && !wrap.contains(e.target as Node)) setOpen(false); });
  wrap.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Escape' && isOpen()) { setOpen(false); btn.focus(); } });
  return wrap;
}
const boot_ = new Machine(APP_BOOT), network = new Machine(NETWORK);
register(boot_); register(network);
const root = document.documentElement;
root.setAttribute('data-app', boot_.state.toLowerCase()); root.setAttribute('data-net', network.state.toLowerCase());
boot_.subscribe(m => root.setAttribute('data-app', m.state.toLowerCase())); network.subscribe(m => root.setAttribute('data-net', m.state.toLowerCase()));
const banner = h('div', { class: 'banner', role: 'alert', hidden: true });
function drawBanner() {
  const memory = storage.is('MEMORY'), degraded = storage.is('DEGRADED');
  banner.hidden = !(memory || degraded);
  if (banner.hidden) return;
  banner.replaceChildren(h('b', {}, memory ? 'Progress cannot be saved on this device right now. ' : 'Saving to this device just failed. '),
    memory ? 'Your browser is blocking storage (private mode?). Everything still works, but your progress will be lost when you close this tab. ' : 'Recent progress is only held in memory. ', h('a', { href: '#/progress' }, 'Export a copy on My Progress'), '.');
}
function drawNetText() {
  const online = navigator.onLine;
  net.textContent = online ? tr('ui.online') : tr('ui.offline'); net.className = 'net ' + (online ? 'on' : 'off');
}
function drawNet() {
  network.send(navigator.onLine ? 'WENT_ONLINE' : 'WENT_OFFLINE');
  drawNetText();
}

function render() {
  runDisposers();                                         // stop timers / ignore late results of the page we are leaving
  const { path } = parseHash(), r = resolve(path);
  drawNav(r.nav);
  clear(main); main.setAttribute('data-route', r.id);
  let page: HTMLElement;
  try {
    const [a, b, c] = r.rest;
    switch (r.id) {
      case 'home': page = homePage(render); break;
      case 'class': page = classPage(a === 'XII' ? 'XII' : 'XI'); break;
      case 'labs': page = labsIndex(); break;
      case 'lab': { const lab = a ? labById(a) : undefined; page = lab ? labPage(lab, 'learn', b) : notFound(); break; }
      case 'ledger': page = ledgerPage(); break;
      case 'practice': page = practicePage(a, b, c); break;
      case 'cards': { const card = a ? CARDS.find(x => x.id === a) : undefined; page = card ? cardPage(card) : cardsIndex(); break; }
      case 'trainer': page = trainerPage(); break;
      case 'crisis': page = crisisPage(a); break;
      case 'cas': page = casPage(); break;
      case 'project': page = projectPage(a === 'XII' ? 'XII' : 'XI', state.profile.route); break;
      case 'rescue': page = rescuePage(a); break;
      case 'assignment': page = assignmentPage(a!); break;
      case 'tutor': page = tutorPage(); break;
      case 'progress': page = progressPage(); break;
      case 'teacher': page = teacherPage(); break;
      default: page = notFound();
    }
  } catch (e) {
    page = h('div', { class: 'panel' }, h('h2', {}, 'Something went wrong'), h('p', { class: 'note bad', role: 'alert' }, e instanceof Error ? e.message : String(e)), h('a', { href: '#/' }, 'Go home'));
    console.error(e);
  }
  // In Hindi mode, pages whose text is not translated yet stay English: say so, and mark the language so screen readers read them correctly.
  const englishOnly = state.lang === 'hi' && !HINDI_PAGES.has(r.id);
  if (englishOnly) main.setAttribute('lang', 'en'); else main.removeAttribute('lang');
  if (englishOnly) main.appendChild(h('p', { class: 'note warn english-only-note', lang: 'hi', 'data-english-only': '' }, tr('ui.englishOnly')));
  main.appendChild(page);
  document.title = (path.length ? (document.querySelector('main h2')?.textContent ?? 'Accounting Universe') + ' · ' : '') + 'Accounting Universe';
  window.scrollTo(0, 0);
}
const notFound = () => h('div', { class: 'panel' }, h('h2', {}, 'Page not found'), h('p', {}, 'That address does not exist. '), h('a', { href: '#/' }, 'Go home'));

async function boot() {
  const app = document.getElementById('app')!;
  const menu = h('button', { type: 'button', class: 'menu', 'aria-expanded': 'false', 'aria-controls': 'nav', onclick: () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); } });
  const displayMenu = initDisplayMenu();
  const skip = h('a', { class: 'skip', href: '#main', onclick: (e: Event) => { e.preventDefault(); main.focus(); } });
  const tagline = h('span', {});
  relabel.push(() => { menu.textContent = tr('ui.menu'); skip.textContent = tr('ui.skip'); tagline.textContent = tr('ui.tagline'); });
  app.append(
    skip,
    h('header', { class: 'top' }, h('div', { class: 'brand' }, h('b', { lang: 'en' }, 'Accounting Universe'), tagline), net, displayMenu, langBtn, menu),
    draftBanner,
    banner, nav, main);
  for (const f of relabel) f();                              // header words in the saved language before the first paint of the page
  await ready();
  drawBanner(); storage.subscribe(drawBanner);
  const p = await getProfile();
  if (p) { state.profile = p; state.lang = p.lang ?? 'en'; } else await setProfile(state.profile);
  drawLang();
  window.addEventListener('hashchange', () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); render(); });
  window.addEventListener('online', drawNet); window.addEventListener('offline', drawNet);
  drawNet(); render();
  boot_.send('BOOTED');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
}
boot().catch(e => { boot_.send('CRASHED'); main.replaceChildren(h('div', { class: 'panel', role: 'alert' }, h('h2', {}, 'The app could not start'), h('p', {}, e instanceof Error ? e.message : String(e)), h('button', { type: 'button', class: 'primary', onclick: () => location.reload() }, 'Reload'))); });
