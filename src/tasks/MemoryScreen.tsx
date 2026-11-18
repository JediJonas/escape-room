import { useEffect, useRef, useState } from 'react';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import type { RoomsView } from '../../supabase/functions/game/rooms.ts';
import { formatMemoryLeft } from './memoryTime.ts';
import './rooms.css';

const TICK_MS = 1000;
/** Så här långt före slutet börjar minnet blekna på skärmen. */
const FADING_MS = 20_000;

/**
 * Om huset minns just nu, räknat i serverns tid. När tiden har gått säger
 * mobilen till servern en gång, och servern avgör (se rooms.ts).
 */
export function useMemoryTime(remembersUntilMs: number | null, clockOffsetMs: number, onFaded: () => void): { isRemembering: boolean; isFading: boolean; msLeft: number } {
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
  const msLeft = isRemembering ? remembersUntilMs - serverNowMs : 0;
  return { isRemembering, isFading: isRemembering && msLeft < FADING_MS, msLeft };
}

/**
 * Huset minns kvällen 1962. Spelaren väljer ett rum bland dem som går att
 * välja och ser det som det var, sepiatonat och flimrande. Det som finns i
 * nuet syns inte så länge minnet varar. Se docs/koncept.md, Nu och 1962.
 */
export function MemoryScreen({ rooms, isFading, msLeft, canChoose, isBusy, onChoose }: {
  rooms: RoomsView;
  isFading: boolean;
  /** Tiden kvar tills minnet bleknar, så att gruppen kan planera (Jonas 2026-11-18). */
  msLeft: number;
  /** Spelledaren som står utanför väljer inget rum. */
  canChoose: boolean;
  isBusy: boolean;
  onChoose: (placeId: PlaceId) => void;
}) {
  const { myRooms, choice } = rooms;
  const [onlyRoom] = myRooms;
  const isTakingAnother = choice === 'takeAnother';
  return (
    <section className={isFading ? 'memory is-fading' : 'memory'} aria-label="Huset minns">
      <p className="memory-label">{myRooms.length === 1 ? onlyRoom.place.name : 'Huset minns'} · {rooms.memoryLabel}</p>
      <p className={isFading ? 'memory-left is-fading' : 'memory-left'} role="timer">Minnet bleknar om {formatMemoryLeft(msLeft)}</p>
      {myRooms.map((room) => (
        <div key={room.place.id} className="memory-pieces">
          {myRooms.length > 1 && <h2 className="memory-room">{room.place.name}</h2>}
          {room.pieces.map((piece) => <p key={piece}>{piece}</p>)}
        </div>
      ))}
      {canChoose && (choice === 'choose' || isTakingAnother) && (
        <fieldset className="place-list memory-choices">
          <legend>{isTakingAnother ? 'Ett rum står tomt. Gå dit också?' : 'Vilket rum är du i?'}</legend>
          <p className="memory-note">
            {isTakingAnother
              ? 'Ni är färre än rummen, så du kan se ett rum till i samma minne.'
              : 'Du stannar där tills minnet bleknar. Ett rum går bara att välja om inget annat rum har färre.'}
          </p>
          {rooms.rooms.map(({ place, isChoosable }) => (
            <button key={place.id} type="button" className="secondary" onClick={() => onChoose(place.id)} disabled={isBusy || !isChoosable}>{place.name}</button>
          ))}
        </fieldset>
      )}
      {canChoose && choice === 'waitForOthers' && <p className="memory-note">När alla har valt rum kan du gå till ett rum som står tomt.</p>}
      {!canChoose && <p className="memory-note">Spelarna väljer var sitt rum och ser det som det var.</p>}
    </section>
  );
}
