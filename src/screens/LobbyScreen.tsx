import { toCssUrl } from '../view/assetUrl.ts';
import { type CSSProperties, useState } from 'react';
import type { LobbyView } from '../../supabase/functions/game/lobby.ts';
import { MAX_PLAYERS } from '../../supabase/functions/game/lobby.ts';
import { DEFAULT_GAME_MINUTES, GAME_MINUTES } from '../../supabase/functions/game/clock.ts';
import { Icon } from './Icon.tsx';
import { JoinQrCode } from './JoinQrCode.tsx';
import { ScreenLayout } from './ScreenLayout.tsx';
import { useMissionTheme } from '../theme/useMissionTheme.ts';

/** Det spelledaren väljer när hon startar. */
export type StartChoices = { missionId: string; leaderPlays: boolean; minutes: number };

export function LobbyScreen({ view, joinUrl, isBusy, error, onLeave, onStart }: {
  view: LobbyView;
  joinUrl: string;
  isBusy: boolean;
  error: string;
  onLeave: () => void;
  onStart: (choices: StartChoices) => void;
}) {
  const [leaderPlays, setLeaderPlays] = useState(true);
  const [minutes, setMinutes] = useState<number>(DEFAULT_GAME_MINUTES);
  const [missionId, setMissionId] = useState(view.missionId);
  const isLeader = view.me.isLeader;
  const mission = view.missionChoices?.find((choice) => choice.id === missionId) ?? { id: view.missionId, title: view.missionTitle, minPlayers: view.minPlayers, theme: view.theme };
  // Väntrummet byter till det valda uppdragets tema (Jonas 2026-11-23).
  useMissionTheme(mission.theme);
  // Spelledaren som står utanför räknas inte som spelare.
  const missingPlayers = mission.minPlayers - view.players.length + (isLeader && !leaderPlays ? 1 : 0);
  return (
    <ScreenLayout
      className="lobby-screen"
      actions={
        isLeader
          ? <button type="button" onClick={() => onStart({ missionId: mission.id, leaderPlays, minutes })} disabled={isBusy || missingPlayers > 0}>{isBusy ? 'Startar …' : 'Starta spelet'}</button>
          : <button type="button" className="secondary" onClick={onLeave} disabled={isBusy}>Lämna spelet</button>
      }
    >
      <h1 className="page-title">{isLeader ? 'Samla gruppen' : 'Du är med'}</h1>
      {!isLeader && <p className="lead">Vänta tills spelledaren startar spelet.</p>}
      <div className="card join-box">
        {isLeader && <JoinQrCode text={joinUrl} />}
        <div>
          <span className="eyebrow">Koden</span>
          <p className="big-code" aria-label={`Koden är ${[...view.joinCode].join(' ')}`}>{view.joinCode}</p>
          {isLeader && <p className="join-box-note">Skanna med kameran eller skriv koden på startsidan.</p>}
        </div>
      </div>
      <h2 className="eyebrow section-label">Med i spelet · {view.players.length} av {MAX_PLAYERS}</h2>
      <ul className="players">
        {view.players.map((player) => (
          <li key={player.name} className={player.isMe ? 'is-me' : undefined}>
            <span className="avatar" aria-hidden="true">{[...player.name][0]?.toLocaleUpperCase('sv')}</span>
            {player.name}
            {player.isLeader && <small> spelledare</small>}
            {player.isMe && <span className="visually-hidden"> (du)</span>}
          </li>
        ))}
      </ul>
      {missingPlayers > 0 && <p className="hint">Det behövs minst {mission.minPlayers} spelare för {mission.title}.</p>}
      {view.missionChoices && (
        <fieldset className="mission-choices">
          <legend className="eyebrow section-label">Uppdrag</legend>
          {view.missionChoices.map((choice) => (
            <label
              key={choice.id}
              className="mission-card"
              style={{ '--card-image': choice.cover ? toCssUrl(choice.cover) : 'none', '--card-font': choice.theme?.tokens['font-display'] ?? 'var(--font-ui)' } as CSSProperties}
            >
              <input type="radio" name="mission" value={choice.id} checked={missionId === choice.id} onChange={() => setMissionId(choice.id)} />
              <span>
                <strong>{choice.title}</strong>
                <small>{[choice.tagline, `${choice.minPlayers}–${MAX_PLAYERS} spelare`].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="mission-check" aria-hidden="true"><Icon name="check" /></span>
            </label>
          ))}
        </fieldset>
      )}
      {isLeader && (
        <fieldset className="time-choice">
          <legend className="eyebrow section-label">Speltid</legend>
          <div className="segmented">
            {GAME_MINUTES.map((option) => (
              <label key={option}>
                <input type="radio" name="minutes" value={option} checked={minutes === option} onChange={() => setMinutes(option)} />
                {option} min
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {isLeader && (
        <label className="toggle-row">
          <span>Jag spelar med<small>Annars leder du spelet utan egen roll.</small></span>
          <input type="checkbox" role="switch" checked={leaderPlays} onChange={(event) => setLeaderPlays(event.target.checked)} />
        </label>
      )}
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
