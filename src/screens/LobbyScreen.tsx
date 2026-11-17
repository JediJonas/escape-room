import { useState } from 'react';
import type { LobbyView } from '../../supabase/functions/game/lobby.ts';
import { MAX_PLAYERS } from '../../supabase/functions/game/lobby.ts';
import { DEFAULT_GAME_MINUTES, GAME_MINUTES } from '../../supabase/functions/game/clock.ts';
import { JoinQrCode } from './JoinQrCode.tsx';
import { ScreenLayout } from './ScreenLayout.tsx';

/** Det spelledaren väljer när hon startar. */
export type StartChoices = { usesPlaceCards: boolean; leaderPlays: boolean; minutes: number };

export function LobbyScreen({ view, joinUrl, isBusy, error, onLeave, onStart }: {
  view: LobbyView;
  joinUrl: string;
  isBusy: boolean;
  error: string;
  onLeave: () => void;
  onStart: (choices: StartChoices) => void;
}) {
  const [usesPlaceCards, setUsesPlaceCards] = useState(true);
  const [leaderPlays, setLeaderPlays] = useState(true);
  const [minutes, setMinutes] = useState<number>(DEFAULT_GAME_MINUTES);
  const isLeader = view.me.isLeader;
  // Spelledaren som står utanför räknas inte som spelare.
  const missingPlayers = view.minPlayers - view.players.length + (isLeader && !leaderPlays ? 1 : 0);
  return (
    <ScreenLayout
      actions={
        isLeader
          ? <button type="button" onClick={() => onStart({ usesPlaceCards, leaderPlays, minutes })} disabled={isBusy || missingPlayers > 0}>{isBusy ? 'Startar …' : 'Starta spelet'}</button>
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
      {missingPlayers > 0 && <p className="hint">Det behövs minst {view.minPlayers} spelare för {view.missionTitle}.</p>}
      {isLeader && (
        <fieldset className="choice-field">
          <legend>Speltid</legend>
          {GAME_MINUTES.map((option) => (
            <label key={option}>
              <input type="radio" name="minutes" value={option} checked={minutes === option} onChange={() => setMinutes(option)} />
              {option} min
            </label>
          ))}
        </fieldset>
      )}
      {isLeader && (
        <p className="checkbox-field">
          <input id="leader-plays" type="checkbox" checked={leaderPlays} onChange={(event) => setLeaderPlays(event.target.checked)} />
          <label htmlFor="leader-plays">Jag spelar med. Utan bocken leder du spelet utan egen roll.</label>
        </p>
      )}
      {isLeader && (
        <p className="checkbox-field">
          <input id="uses-place-cards" type="checkbox" checked={usesPlaceCards} onChange={(event) => setUsesPlaceCards(event.target.checked)} />
          <label htmlFor="uses-place-cards">Vi har satt upp platskorten. Utan korten väljer alla plats i en lista.</label>
        </p>
      )}
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
