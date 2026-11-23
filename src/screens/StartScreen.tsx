import { VERSION } from '../config.ts';
import { ScreenLayout } from './ScreenLayout.tsx';

/**
 * Startsidan, mörk i motorns neutrala färger (Jonas 2026-11-23). Gå med i
 * spel står överst, eftersom de flesta går med (Jonas 2026-11-17).
 */
export function StartScreen({ error, onJoin, onCreate }: { error: string; onJoin: () => void; onCreate: () => void }) {
  return (
    <ScreenLayout
      className="start-screen"
      actions={
        <>
          <button type="button" onClick={onJoin}>Gå med i spel</button>
          <button type="button" className="secondary" onClick={onCreate}>Starta nytt spel</button>
          <p className="version">Version {VERSION} · <a href="testsida/">Den tekniska testsidan</a></p>
        </>
      }
    >
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48"><circle cx="24" cy="19" r="7" /><path d="M20.5 25l-3 14h13l-3-14" /></svg>
        </div>
        <h1>Escape room</h1>
        <p>Ett partyspel för tre till tio personer, var och en med sin mobil.</p>
      </div>
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
