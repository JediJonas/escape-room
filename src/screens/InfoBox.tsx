import { useEffect } from 'react';
import { readingMs } from './infoBox.ts';
import './infoBox.css';

/**
 * En ruta längst ner som visas hos alla en stund, till exempel när
 * spelledaren ger en ledtråd eller när spelaren öppnar en sak i sitt steg.
 * Spelarna har ingen meny, så det är här de ser ledtrådar och stegets text
 * (Jonas 2026-11-18). Ett tryck tar bort rutan.
 */
export function InfoBox({ title, text, onClose }: { title?: string; text: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, readingMs(text));
    return () => clearTimeout(timer);
  }, [text, onClose]);

  return (
    <button type="button" className="info-box" onClick={onClose} aria-live="polite">
      {title && <strong>{title} </strong>}
      {text}
    </button>
  );
}
