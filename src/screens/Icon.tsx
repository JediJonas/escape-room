/**
 * Motorns ikoner: linjeikoner i samma stil, 24 px med linjen 1,75, som är
 * desamma i alla uppdrag (Jonas 2026-11-23). Färgen kommer från texten.
 * Fler ikoner ur designförslaget läggs till när en vy behöver dem.
 */
const ICON_PATHS = {
  back: 'M15 5l-7 7 7 7',
  clock: 'M12 9v4l2.5 2.5M9.5 2.5h5M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
