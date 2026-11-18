import { VERSION } from '../config.ts';
import { ScreenLayout } from './ScreenLayout.tsx';

export function StartScreen({ error, onJoin, onCreate }: { error: string; onJoin: () => void; onCreate: () => void }) {
  return (
    <ScreenLayout
      actions={
        <>
          <button type="button" onClick={onJoin}>Gå med i spel</button>
          <button type="button" className="secondary" onClick={onCreate}>Starta nytt spel</button>
        </>
      }
    >
      <h1>Escape room</h1>
      <p className="error" role="alert">{error}</p>
      <p className="hint"><a href="testsida/">Den tekniska testsidan</a> · Version {VERSION}</p>
    </ScreenLayout>
  );
}
