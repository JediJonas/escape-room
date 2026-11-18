import { type PointerEvent, type ReactNode, useState } from 'react';
import type { FoundItem } from '../../supabase/functions/game/found.ts';
import type { MissionDocument } from '../../supabase/functions/game/mission.ts';
import { swipeTarget } from './swipe.ts';
import './thingScreen.css';

/**
 * En sak i huset i fullskärm, som ouijabrädet: bara saken, utan rubrik och
 * text. Överst ligger klockan och en knapp tillbaka eller till menyn, och
 * underst en eventuell huvudhandling nära tummen (Jonas 2026-11-18).
 */
export function ThingScreen({ className, header, actions, children }: {
  className?: string;
  header: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className={className ? `thing-screen ${className}` : 'thing-screen'}>
      <p className="hint game-header">{header}</p>
      <div className="thing-stage">{children}</div>
      {actions && <div className="thing-actions">{actions}</div>}
    </main>
  );
}

/** Ett papper i högen: en artikel som alla ser, ett urklipp som bara spelaren har eller en sida i en bok. */
export type Paper = { key: string; document?: MissionDocument; text?: string; page?: string };

/** Sidorna i en bok, som gästboken, med första sidan överst (Jonas 2026-11-18). */
export function listPages(pages: readonly string[]): Paper[] {
  return pages.map((page, index) => ({ key: `s:${index}`, page }));
}

/** Artiklarna först, sedan spelarens egna urklipp. */
export function listPapers(documents: readonly MissionDocument[], pieces: readonly string[]): Paper[] {
  return [...documents.map((document) => ({ key: `d:${document.title}`, document })), ...pieces.map((text) => ({ key: `p:${text}`, text }))];
}

export function listFoundPapers(found: readonly FoundItem[]): Paper[] {
  return found.flatMap((item) => listPapers(item.documents, item.pieces));
}

function PaperContent({ paper }: { paper: Paper }) {
  // En tom sida i en bok, som de sista i gästboken (Jonas 2026-11-18).
  if (paper.page === '') return <p className="page-blank">Tom sida</p>;
  if (paper.page !== undefined) {
    const [heading, ...lines] = paper.page.split('\n');
    return (
      <>
        <p className="dateline">{heading}</p>
        {lines.map((line) => <p key={line} className="page-line">{line}</p>)}
      </>
    );
  }
  if (paper.document) {
    return (
      <>
        {paper.document.dateline && <p className="dateline">{paper.document.dateline}</p>}
        <h2>{paper.document.title}</h2>
        {paper.document.text.split('\n').map((line) => <p key={line}>{line}</p>)}
      </>
    );
  }
  return (
    <>
      <p>{paper.text}</p>
      <p className="paper-only-mine">Bara du har det här urklippet.</p>
    </>
  );
}

/** Så många pixlar i sidled lutar papperet en grad när det dras. */
const PX_PER_DEGREE = 40;

/** Hur många papper bakom det översta som syns i kanten, så att man ser att det är en hög. */
const VISIBLE_BEHIND = 2;

/**
 * Papper som ligger ovanpå varandra. Kanterna på dem som ligger under syns,
 * och spelaren bläddrar genom att svajpa i sidled eller med pilarna
 * (Jonas 2026-11-18).
 */
export function PaperStack({ papers }: { papers: readonly Paper[] }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<{ startX: number; dx: number } | null>(null);
  const current = Math.min(index, papers.length - 1);
  if (papers.length === 0) return null;

  function start(event: PointerEvent<HTMLElement>) {
    setDrag({ startX: event.clientX, dx: 0 });
  }

  function move(event: PointerEvent<HTMLElement>) {
    if (drag) setDrag({ ...drag, dx: event.clientX - drag.startX });
  }

  function end() {
    if (drag) setIndex(swipeTarget(current, papers.length, drag.dx));
    setDrag(null);
  }

  const behind = papers.slice(current + 1, current + 1 + VISIBLE_BEHIND);
  return (
    <section className="paper-stack" aria-label="Papper i en hög" aria-roledescription="hög">
      <div className="paper-pile">
        {behind.map((paper, depth) => (
          <div key={paper.key} className={`paper paper-behind depth-${depth + 1}`} aria-hidden="true" />
        )).reverse()}
        <article
          key={papers[current].key}
          className={papers[current].page !== undefined ? 'paper document-card book-page' : 'paper document-card'}
          style={drag ? { transform: `translateX(${drag.dx}px) rotate(${drag.dx / PX_PER_DEGREE}deg)`, transition: 'none' } : undefined}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <PaperContent paper={papers[current]} />
        </article>
      </div>
      {papers.length > 1 && (
        <nav className="paper-nav" aria-label="Bläddra">
          <button type="button" className="secondary" onClick={() => setIndex(current - 1)} disabled={current === 0} aria-label="Föregående">‹</button>
          <span>{current + 1} av {papers.length}</span>
          <button type="button" className="secondary" onClick={() => setIndex(current + 1)} disabled={current === papers.length - 1} aria-label="Nästa">›</button>
        </nav>
      )}
    </section>
  );
}
