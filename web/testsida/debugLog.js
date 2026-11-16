// @ts-check

/**
 * Felsökningslogg som slås på med ?debug=1 i adressen. Den ligger längst ner,
 * tar inte emot tryck och kan fällas ut till helskärm.
 * @param {{ version: string }} options
 * @returns {(text: string) => void} skriver en rad i loggen, eller gör ingenting när loggen är av
 */
export function createDebugLog({ version }) {
  if (new URLSearchParams(location.search).get('debug') !== '1') return () => {};

  const panel = document.createElement('div');
  panel.className = 'debug-log';
  const list = document.createElement('ol');
  panel.append(list);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'debug-toggle';
  toggle.textContent = 'Visa loggen';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', () => {
    const isExpanded = panel.classList.toggle('is-expanded');
    toggle.textContent = isExpanded ? 'Dölj loggen' : 'Visa loggen';
    toggle.setAttribute('aria-expanded', String(isExpanded));
  });
  document.body.append(panel, toggle);

  /** @param {string} text */
  const log = (text) => {
    const line = document.createElement('li');
    line.textContent = `${new Date().toLocaleTimeString('sv-SE')} ${text}`;
    list.append(line);
  };
  // Versionen står först, så att det syns om mobilen kör en gammal sida ur cachen.
  log(`version ${version}`);
  return log;
}
