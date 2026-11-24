import type { NoticeSymbol } from './notice.ts';

/**
 * Symbolen i en notis, ritad i svart med SVG i stället för en bild från
 * Gemini (Jonas 2026-11-24): två ringar som går i varandra, eller ett kors.
 */
export function NoticeSymbolMark({ symbol }: { symbol: NoticeSymbol }) {
  return (
    <svg className={`np-symbol np-symbol-${symbol}`} viewBox={symbol === 'rings' ? '6 5 36 24' : '13 0 22 32'} aria-hidden="true">
      {symbol === 'rings'
        ? (
          <g fill="none" stroke="currentColor" strokeWidth="3">
            <circle cx="18" cy="17" r="10" />
            <circle cx="30" cy="17" r="10" />
          </g>
        )
        : <path d="M21.5 1h5v8h8v5h-8v17h-5V14h-8V9h8z" fill="currentColor" />}
    </svg>
  );
}
