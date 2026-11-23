/**
 * Motorns ikoner: linjeikoner i samma stil, 24 px med linjen 1,75, som är
 * desamma i alla uppdrag (Jonas 2026-11-23). Färgen kommer från texten.
 */
const ICON_PATHS = {
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  clock: 'M12 9v4l2.5 2.5M9.5 2.5h5M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  hint: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
  solution: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  secret: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  skip: 'M5 5l9 7-9 7zM18 5v14',
  pause: 'M9 5v14M15 5v14',
  play: 'M7 4.5l12 7.5-12 7.5z',
  end: 'M5 21V4M5 4h11l-2 4 2 4H5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  open: 'M16 16l4.5 4.5M17.5 11a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
