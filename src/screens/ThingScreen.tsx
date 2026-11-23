import { type PointerEvent, type ReactNode, useState } from 'react';
import type { FoundItem } from '../../supabase/functions/game/found.ts';
import type { MissionDocument } from '../../supabase/functions/game/mission.ts';
import { Icon } from './Icon.tsx';
import { splitNotice } from './notice.ts';
import { swipeTarget } from './swipe.ts';
import './thingScreen.css';
import '../tasks/guestbook.css';
import '../tasks/clippings.css';

/**
 * En sak i huset i fullskärm, som ouijabrädet: bara saken, utan text. Överst
 * ligger klockan och en knapp tillbaka eller till menyn, och underst en
 * eventuell huvudhandling nära tummen (Jonas 2026-11-18). Mellan knappen och
 * klockan står sakens namn som rubrik (Jonas 2026-11-23).
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

/**
 * En sak att titta på, som tavlan: närbilden överst och texten under
 * (Jonas 2026-11-20). Pianot och ouijabrädet visas likadant innan spelaren
 * trycker Använd (Jonas 2026-11-23).
 */
export function ThingLook({ name, text, image }: { name: string; text: string; image: string | null }) {
  return (
    <div className={image ? 'thing-look has-image' : 'thing-look'}>
      {image && <img className="thing-image" src={`${import.meta.env.BASE_URL}${image}`} alt={name} />}
      <article className="thing-paper thing-caption">{text.split('\n').map((line) => <p key={line}>{line}</p>)}</article>
    </div>
  );
}

/** Ett papper i högen: en artikel som alla ser, ett urklipp som bara spelaren har eller en sida i en bok. */
export type Paper = { key: string; document?: MissionDocument; text?: string; page?: string; cover?: string };

/**
 * Sidorna i en bok, som gästboken, med första sidan överst (Jonas 2026-11-18).
 * Har boken en första sida med titeln, som Gästbok Ekbacken, kommer den först (Jonas 2026-11-18).
 */
export function listPages(pages: readonly string[], cover: string | null = null): Paper[] {
  const written = pages.map((page, index) => ({ key: `s:${index}`, page }));
  return cover === null ? written : [{ key: 'omslag', cover }, ...written];
}

/** Artiklarna först, sedan spelarens egna urklipp. */
export function listPapers(documents: readonly MissionDocument[], pieces: readonly string[]): Paper[] {
  return [...documents.map((document) => ({ key: `d:${document.title}`, document })), ...pieces.map((text) => ({ key: `p:${text}`, text }))];
}

export function listFoundPapers(found: readonly FoundItem[]): Paper[] {
  return found.flatMap((item) => listPapers(item.documents, item.pieces));
}

function PaperContent({ paper }: { paper: Paper }) {
  if (paper.cover !== undefined) return <p className="book-cover">{paper.cover}</p>;
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
  // Tidningsurklippen är tecknade urklipp, och texten sätts i ett tidningstypsnitt (Jonas 2026-11-23).
  if (paper.document) {
    const [first, ...rest] = paper.document.text.split('\n');
    return (
      <>
        {paper.document.dateline && <p className="np-date">{paper.document.dateline}</p>}
        <h2 className="np-head">{paper.document.title}</h2>
        <p className="np-body np-lead">{first}</p>
        {rest.map((line) => <p key={line} className="np-body">{line}</p>)}
      </>
    );
  }
  const notice = splitNotice(paper.text ?? '');
  return (
    <>
      {notice.heading && <p className="np-kicker">{notice.heading}</p>}
      <p className="np-notice">{notice.body}</p>
    </>
  );
}

function isBookPage(paper: Paper): boolean {
  return paper.page !== undefined || paper.cover !== undefined;
}

/** Vilket slags papper det är, som avgör bilden bakom texten. */
function describePaperKind(paper: Paper): string {
  if (isBookPage(paper)) return 'book-page';
  return paper.document ? 'clip clip-big' : 'clip clip-small';
}

function describePaperClass(paper: Paper): string {
  const kind = `paper ${describePaperKind(paper)}`;
  return paper.cover !== undefined ? `${kind} is-cover` : kind;
}

/** Ett av spelarens egna urklipp, som bara hon ser. */
function isMine(paper: Paper): boolean {
  return paper.text !== undefined;
}

/** Så många pixlar i sidled lutar papperet en grad när det dras. */
const PX_PER_DEGREE = 40;

/** Hur många papper bakom det översta som syns i kanten, så att man ser att det är en hög. */
const VISIBLE_BEHIND = 2;

/**
 * Papper som ligger ovanpå varandra. Kanterna på dem som ligger under syns,
 * och spelaren bläddrar genom att svajpa i sidled eller med pilarna
 * (Jonas 2026-11-18). Pilarna ligger längst ner, närmast tummen, och högen
 * överst under rubriken (Jonas 2026-11-23).
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
          <div key={paper.key} className={`paper paper-behind ${describePaperKind(paper)} depth-${depth + 1}`} aria-hidden="true" />
        )).reverse()}
        <article
          key={papers[current].key}
          className={describePaperClass(papers[current])}
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
          <button type="button" className="secondary" onClick={() => setIndex(current - 1)} disabled={current === 0} aria-label="Föregående"><Icon name="back" /></button>
          <span>{current + 1} av {papers.length}</span>
          <button type="button" className="secondary" onClick={() => setIndex(current + 1)} disabled={current === papers.length - 1} aria-label="Nästa"><Icon name="next" /></button>
        </nav>
      )}
      {/* Statusraden nere till vänster säger när spelaren tittar på sina egna urklipp (Jonas 2026-11-23). */}
      {isMine(papers[current]) && <p className="status-line paper-secret"><Icon name="secret" />Bara du ser det här</p>}
    </section>
  );
}
