import { useEffect, useRef, useState } from 'react';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import type { RoomsView } from '../../supabase/functions/game/rooms.ts';
import './rooms.css';

const TICK_MS = 1000;
/** Så här långt före slutet börjar minnet blekna på skärmen. */
const FADING_MS = 20_000;

/**
 * Om huset minns just nu, räknat i serverns tid. När tiden har gått säger
 * mobilen till servern en gång, och servern avgör (se rooms.ts).
 */
export function useMemoryTime(remembersUntilMs: number | null, clockOffsetMs: number, onFaded: () => void): { isRemembering: boolean; isFading: boolean } {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const toldFor = useRef<number | null>(null);
  const serverNowMs = nowMs + clockOffsetMs;
  const isRemembering = remembersUntilMs !== null && serverNowMs < remembersUntilMs;
  useEffect(() => {
    if (remembersUntilMs === null) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [remembersUntilMs]);
  useEffect(() => {
    if (remembersUntilMs === null || isRemembering || toldFor.current === remembersUntilMs) return;
    toldFor.current = remembersUntilMs;
    onFaded();
  }, [remembersUntilMs, isRemembering, onFaded]);
  return { isRemembering, isFading: isRemembering && remembersUntilMs - serverNowMs < FADING_MS };
}

/**
 * Huset minns kvällen 1962. Spelaren väljer ett rum bland dem som går att
 * välja och ser det som det var, sepiatonat och flimrande. Det som finns i
 * nuet syns inte så länge minnet varar. Se docs/koncept.md, Nu och 1962.
 */
export function MemoryScreen({ rooms, isFading, canChoose, isBusy, onChoose }: {
  rooms: RoomsView;
  isFading: boolean;
  /** Spelledaren som står utanför väljer inget rum. */
  canChoose: boolean;
  isBusy: boolean;
  onChoose: (placeId: PlaceId) => void;
}) {
  const { myRoom } = rooms;
  return (
    <section className={isFading ? 'memory is-fading' : 'memory'} aria-label="Huset minns">
      <p className="memory-label">{myRoom ? myRoom.place.name : 'Huset minns'} · {rooms.memoryLabel}</p>
      {myRoom && (
        <div className="memory-pieces">
          {myRoom.pieces.map((piece) => <p key={piece}>{piece}</p>)}
        </div>
      )}
      {!myRoom && canChoose && (
        <fieldset className="place-list memory-choices">
          <legend>Vilket rum är du i?</legend>
          <p className="memory-note">Du stannar där tills minnet bleknar. Ett rum går bara att välja om inget annat rum har färre.</p>
          {rooms.rooms.map(({ place, isChoosable }) => (
            <button key={place.id} type="button" className="secondary" onClick={() => onChoose(place.id)} disabled={isBusy || !isChoosable}>{place.name}</button>
          ))}
        </fieldset>
      )}
      {!myRoom && !canChoose && <p className="memory-note">Spelarna väljer var sitt rum och ser det som det var.</p>}
      {isFading && <p className="memory-note" role="status">Minnet håller på att blekna.</p>}
    </section>
  );
}
