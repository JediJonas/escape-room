import { useEffect } from 'react';
import { readingMs } from './infoBox.ts';
import { Icon } from './Icon.tsx';
import './infoBox.css';

/**
 * En ruta längst ner som visas hos alla en stund när spelledaren ger en
 * ledtråd. Spelarna har ingen meny, så det är här de ser ledtrådarna
 * (Jonas 2026-11-18). Ett tryck tar bort rutan. Ledtråden står med en
 * glödlampa och rubriken Ledtråd 2 i uppdragets lästypsnitt (Jonas 2026-11-23).
 */
export function InfoBox({ title, text, onClose }: { title?: string; text: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, readingMs(text));
    return () => clearTimeout(timer);
  }, [text, onClose]);

  return (
    <button type="button" className="info-box" onClick={onClose} aria-live="polite">
      <span className="info-box-halo" aria-hidden="true"><Icon name="hint" /></span>
      <span>
        {title && <strong className="eyebrow">{title} </strong>}
        <span className="info-box-text">{text}</span>
        <small>Tryck för att stänga</small>
      </span>
    </button>
  );
}
