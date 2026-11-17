import { useEffect, useState } from 'react';

/**
 * Mätrutan som visas med ?matt i adressen. Chromium har inte Safaris
 * verktygsfält, så knapparnas avstånd till det måste mätas på en riktig
 * iPhone. Se skillen knappar-i-mobilen.
 */

/** Skärmarna byts utan att fönstret ändras, så rutan mäter om varje sekund. */
const PROBE_INTERVAL_MS = 1000;

const PROBE_HEIGHTS = ['100vh', '100svh', '100dvh', '100lvh', 'env(safe-area-inset-top)', 'env(safe-area-inset-bottom)', 'var(--bottom-gap)'];

/** Mäter ett CSS-värde som höjden på ett osynligt element. */
function measureHeight(cssHeight: string): number {
  const element = document.createElement('div');
  element.style.cssText = `position:absolute;visibility:hidden;width:1px;height:${cssHeight}`;
  document.body.append(element);
  const height = element.getBoundingClientRect().height;
  element.remove();
  return Math.round(height);
}

function measureViewport(): [string, string][] {
  const lastButton = [...document.querySelectorAll('.screen-actions > *')].at(-1);
  const matches = (query: string) => (matchMedia(query).matches ? 'ja' : 'nej');
  return [
    ['screen', `${screen.width}×${screen.height}`],
    ['innerHeight', String(innerHeight)],
    ['visualViewport', String(Math.round(visualViewport?.height ?? 0))],
    ['clientHeight', String(document.documentElement.clientHeight)],
    ...PROBE_HEIGHTS.map((cssHeight): [string, string] => [cssHeight, String(measureHeight(cssHeight))]),
    ['display-mode: browser', matches('(display-mode: browser)')],
    ['pointer: coarse', matches('(pointer: coarse)')],
    ['stående', matches('(orientation: portrait)')],
    ['sista knappens underkant', lastButton ? String(Math.round(lastButton.getBoundingClientRect().bottom)) : '–'],
  ];
}

export function ViewportProbe() {
  const [rows, setRows] = useState<[string, string][]>([]);
  useEffect(() => {
    const update = () => setRows(measureViewport());
    update();
    const interval = setInterval(update, PROBE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
  return (
    <>
      <div className="viewport-line" aria-hidden="true" />
      <dl className="viewport-probe">
        {rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </>
  );
}
