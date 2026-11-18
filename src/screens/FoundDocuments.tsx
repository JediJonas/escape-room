import type { FoundItem } from '../../supabase/functions/game/found.ts';
import type { MissionDocument } from '../../supabase/functions/game/mission.ts';

/** Dokument som alla ser, som tidningsartiklar och gästboken, i tidningsstil. Varje rad i texten blir ett stycke. */
export function DocumentList({ documents }: { documents: readonly MissionDocument[] }) {
  return documents.map((document) => (
    <article key={document.title} className="document-card">
      {document.dateline && <p className="dateline">{document.dateline}</p>}
      <h2>{document.title}</h2>
      {document.text.split('\n').map((line) => <p key={line}>{line}</p>)}
    </article>
  ));
}

/**
 * Hittat: det gruppen har hittat och kan läsa igen var spelaren än står. Varje
 * spelare ser bara sina egna bitar, så att de fortfarande måste prata med
 * varandra. Se docs/koncept.md, Rundbilder och Hittat.
 */
export function FoundView({ found }: { found: readonly FoundItem[] }) {
  return (
    <>
      <h1>Hittat</h1>
      {found.map((item) => (
        <section key={item.title} aria-label={item.title}>
          <h2>{item.title}</h2>
          <DocumentList documents={item.documents} />
          {item.pieces.length > 0 && (
            <div className="role-card" aria-label="Bara du har de här">
              {item.pieces.map((piece) => <p key={piece} className="clipping">{piece}</p>)}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
