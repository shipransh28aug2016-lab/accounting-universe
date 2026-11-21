/**
 * One consistent icon set for the whole app (24×24, 1.75 px round strokes, `currentColor`), used instead of emoji.
 * Every icon is decorative: it is hidden from screen readers (`aria-hidden`), and the text next to it carries the meaning.
 * The SVG strings below are fixed constants written here — nothing user-supplied is ever put into them.
 */
export type IconName =
  | 'ledger'
  | 'scale'
  | 'trend-down'
  | 'users'
  | 'building'
  | 'bar-chart'
  | 'wallet'
  | 'monitor'
  | 'clipboard'
  | 'target'
  | 'layers'
  | 'book'
  | 'lightbulb'
  | 'steps'
  | 'heart'
  | 'heart-outline'
  | 'flame'
  | 'lock'
  | 'medal'
  | 'display'
  | 'search'
  | 'flask'
  | 'check-circle'
  | 'pencil'
  | 'graduation'
  | 'chalkboard'
  | 'compass';

const P: Record<IconName, string> = {
  ledger: '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18"/><path d="M10 8h6M10 12h6M10 16h4"/>',
  scale: '<path d="M12 3v18M7 21h10"/><path d="M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  'trend-down': '<path d="M3 6l7 7 4-4 7 7"/><path d="M15 16h6v-6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2A5.5 5.5 0 0 1 21.5 20"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M14 10h5a1 1 0 0 1 1 1v10"/><path d="M2 21h20M8 8h2M8 12h2M8 16h2M17 14h1M17 18h1"/>',
  'bar-chart': '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17.5l9 5 9-5" />',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
  lightbulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  steps: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
  heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="currentColor"/>',
  'heart-outline': '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 2.5 1.5 2.5C10 9 10.5 5.5 12 3z"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M8.5 3h7l-2 6.5M8.5 3l2 6.5"/><path d="M12 12.5v5"/>',
  display: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/><path d="M7.5 15h9"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  pencil: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/><path d="M14 7l3 3"/>',
  graduation: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9v6"/>',
  chalkboard: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20l2-4M16 20l-2-4M7 9h6M7 12h4"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
};

/** An inline SVG icon, `size` px square, coloured by the surrounding text. */
export function icon(name: IconName, size = 20): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = 'icon';
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('data-icon', name);
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" focusable="false">${P[name]}</svg>`;
  return el;
}

/** Which icon a lab or page gets, by what it teaches (ids and titles are our own constants). */
export function iconForLab(id: string, title = ''): IconName {
  const s = `${id} ${title}`.toLowerCase();
  const rules: [RegExp, IconName][] = [
    [/crisis/, 'target'],
    [/trainer/, 'pencil'],
    [/ledger|journal|cash-?book|petty|voucher|bank|brs/, 'ledger'],
    [/equation|balance|trial|rectif|error|suspense/, 'scale'],
    [/depreciation|disposal/, 'trend-down'],
    [/partner|goodwill|admission|retire|sacrific|dissol/, 'users'],
    [/company|share|debenture/, 'building'],
    [/ratio|analysis|common-size|comparative|statement/, 'bar-chart'],
    [/cash.?flow|fund/, 'wallet'],
    [/cas|spreadsheet|computer/, 'monitor'],
    [/project/, 'clipboard'],
    [/final|affairs|incomplete|gst|bill/, 'book'],
  ];
  return rules.find(([re]) => re.test(s))?.[1] ?? 'flask';
}
