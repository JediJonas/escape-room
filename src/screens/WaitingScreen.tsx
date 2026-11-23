import type { WaitingView } from '../../supabase/functions/game/participants.ts';
import { ScreenLayout } from './ScreenLayout.tsx';
import { useMissionTheme } from '../theme/useMissionTheme.ts';

/** En mobil som kom efter start väntar på att spelledaren svarar. */
export function WaitingScreen({ view, error, onLeave }: { view: WaitingView; error: string; onLeave: () => void }) {
  useMissionTheme(view.theme);
  return (
    <ScreenLayout actions={<button type="button" className="secondary" onClick={onLeave}>Till startsidan</button>}>
      <p className="hint">{view.missionTitle}</p>
      <h1>Vänta på spelledaren</h1>
      <p>
        {view.takesOver
          ? `Spelet har redan börjat. Spelledaren får frågan om den här mobilen ska ta över ${view.takesOver}.`
          : 'Spelet har redan börjat. Spelledaren får frågan om du ska släppas in.'}
      </p>
      <p className="hint">Sidan går vidare av sig själv när spelledaren har svarat.</p>
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
