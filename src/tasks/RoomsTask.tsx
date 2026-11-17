import { useEffect, useState } from 'react';
import type { RoomsView } from '../../supabase/functions/game/rooms.ts';
import { countForgetSeconds, describeRoomsGoal } from './roomsText.ts';

const TICK_MS = 1000;

/**
 * Rummen minns i mobilen: rummet där spelaren står, med det hon ser och hör,
 * och gästerna att välja bland. Fel val gör att rummet glömmer en stund, och
 * servern avgör hur länge. Se supabase/functions/game/rooms.ts.
 */
export function RoomsTask({ rooms, clockOffsetMs, canChoose, isBusy, onChoose }: {
  rooms: RoomsView;
  clockOffsetMs: number;
  /** Spelledaren som står utanför väljer inte. */
  canChoose: boolean;
  isBusy: boolean;
  onChoose: (guest: string) => void;
}) {
  const { current } = rooms;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const forgetSeconds = countForgetSeconds(current?.forgetsUntilMs ?? null, nowMs + clockOffsetMs);
  const isForgetting = forgetSeconds > 0;
  useEffect(() => {
    if (!current?.forgetsUntilMs) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [current?.forgetsUntilMs]);
  const goal = describeRoomsGoal(rooms);

  return (
    <>
      {current && (
        <section className="role-card" aria-label="Bara du ser det här">
          <h2>{current.place.name} 1962</h2>
          {current.pieces.map((piece) => <p key={piece}>{piece}</p>)}
        </section>
      )}
      {current?.guest && <p className="status" role="status">Rätt. {current.guest} stod här när ljuset slocknade.</p>}
      {current && !current.guest && canChoose && (
        <fieldset className="place-list">
          <legend>Vem stod här?</legend>
          {isForgetting && <p className="status" role="status">Fel. Rummet glömmer. Försök igen om {forgetSeconds} s.</p>}
          {rooms.guests.map((guest) => (
            <button key={guest} type="button" className="secondary" onClick={() => onChoose(guest)} disabled={isBusy || isForgetting}>{guest}</button>
          ))}
        </fieldset>
      )}
      {goal && canChoose && <p className="status" role="status">{goal}</p>}
      <p className="hint">{rooms.solvedCount} av {rooms.roomCount} rum klara.</p>
    </>
  );
}
