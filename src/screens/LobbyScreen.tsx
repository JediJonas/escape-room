import type { LobbyView } from '../../supabase/functions/game/lobby.ts';
import { MAX_PLAYERS } from '../../supabase/functions/game/lobby.ts';
import { JoinQrCode } from './JoinQrCode.tsx';
import { ScreenLayout } from './ScreenLayout.tsx';

/** Konceptet: tre till tio spelare. */
const MIN_PLAYERS = 3;

export function LobbyScreen({ view, joinUrl, isBusy, error, onLeave }: {
  view: LobbyView;
  joinUrl: string;
  isBusy: boolean;
  error: string;
  onLeave: () => void;
}) {
  const isLeader = view.me.isLeader;
  const missingPlayers = MIN_PLAYERS - view.players.length;
  return (
    <ScreenLayout
      actions={
        isLeader
          ? <p className="hint">Att starta spelet kommer i ett senare steg av bygget.</p>
          : <button type="button" className="secondary" onClick={onLeave} disabled={isBusy}>Lämna spelet</button>
      }
    >
      <h1>{isLeader ? 'Samla gruppen' : 'Du är med'}</h1>
      {isLeader
        ? (
          <>
            <p>Låt de andra skanna koden med kameran, eller gå till startsidan och skriva in koden.</p>
            <JoinQrCode text={joinUrl} />
          </>
        )
        : <p>Vänta tills spelledaren startar spelet.</p>}
      <p className="join-code" aria-label={`Koden är ${[...view.joinCode].join(' ')}`}>{view.joinCode}</p>
      <h2>Med i spelet ({view.players.length} av {MAX_PLAYERS})</h2>
      <ul className="player-list">
        {view.players.map((player) => (
          <li key={player.name}>
            {player.name}
            {player.isLeader && <span className="hint"> · spelledare</span>}
            {player.isMe && <span className="hint"> · du</span>}
          </li>
        ))}
      </ul>
      {missingPlayers > 0 && <p className="hint">Det behövs minst {MIN_PLAYERS} spelare.</p>}
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
