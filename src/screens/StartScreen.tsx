import { ScreenLayout } from './ScreenLayout.tsx';

/**
 * Startsidan, mörk i motorns neutrala färger (Jonas 2026-11-23). Gå med i
 * spel står överst, eftersom de flesta går med (Jonas 2026-11-17). Länken till
 * testsidan och versionsnumret visas inte längre (Jonas 2026-11-24). Testsidan
 * nås på testsida/ och visar själv versionen.
 */
export function StartScreen({ error, onJoin, onCreate }: { error: string; onJoin: () => void; onCreate: () => void }) {
  return (
    <ScreenLayout
      className="start-screen"
      actions={
        <>
          <button type="button" onClick={onJoin}>Gå med i spel</button>
          <button type="button" className="secondary" onClick={onCreate}>Starta nytt spel</button>
        </>
      }
    >
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          {/* Nyckelhålet är en enda kontur: ringen är öppen nertill och går över i den smala delen (Jonas 2026-11-24). */}
          <svg viewBox="0 0 48 48"><path d="M20.5 25l-3 14h13l-3-14A7 7 0 1 0 20.5 25z" /></svg>
        </div>
        <h1>Escape room</h1>
        <p>Ett partyspel för tre till tio personer, var och en med sin mobil.</p>
      </div>
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
