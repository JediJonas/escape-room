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
