import { Icon } from './Icon.tsx';

/** Tillbaka uppe till vänster, som en rund ruta i glas (Jonas 2026-11-23). */
export function BackChip({ onClick, label = 'Tillbaka' }: { onClick: () => void; label?: string }) {
  return <button type="button" className="chip" onClick={onClick}><Icon name="back" />{label}</button>;
}
