import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import type { FlashbackView } from '../../supabase/functions/game/flashback.ts';
import { formatFlashbackLeft } from './flashbackTime.ts';
import './flashback.css';

const TICK_MS = 1000;
/** Så här långt före slutet börjar minnet blekna på skärmen. */
const FADING_MS = 20_000;

/**
 * Om huset minns just nu, räknat i serverns tid. När tiden har gått säger
 * mobilen till servern en gång, och servern avgör (se flashback.ts).
 */
export function useFlashbackTime(remembersUntilMs: number | null, clockOffsetMs: number, onFaded: () => void): { isRemembering: boolean; isFading: boolean; msLeft: number } {
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

/** Rummets rundbild som bakgrund, eller ingen när servern inte har skickat någon. */
function imageStyle(image: string | null | undefined): CSSProperties | undefined {
  return image ? { '--room-image': `url(${import.meta.env.BASE_URL}${image})` } as CSSProperties : undefined;
}

/**
 * Huset minns kvällen 1962. Spelaren väljer ett rum bland dem som går att
 * välja och ser det som det var, sepiatonat och flimrande. Rummen visas med
 * sina rundbilder, både i valet och i minnet (Jonas 2026-11-23). Det som
 * finns i nuet syns inte så länge minnet varar. Se docs/koncept.md, Nu och 1962.
 */
export function FlashbackScreen({ flashback, isFading, msLeft, canChoose, isBusy, onChoose }: {
  flashback: FlashbackView;
  isFading: boolean;
  /** Tiden kvar tills minnet bleknar, så att gruppen kan planera (Jonas 2026-11-18). */
  msLeft: number;
  /** Spelledaren som står utanför väljer inget rum. */
  canChoose: boolean;
  isBusy: boolean;
  onChoose: (placeId: PlaceId) => void;
}) {
  const { myRooms, choice } = flashback;
  const [onlyRoom] = myRooms;
  const isTakingAnother = choice === 'takeAnother';
  return (
    <section className={isFading ? 'memory is-fading' : 'memory'} aria-label="Huset minns">
      <p className="memory-label">{myRooms.length === 1 ? onlyRoom.place.name : 'Huset minns'} · {flashback.flashbackLabel}</p>
      <p className={isFading ? 'memory-left is-fading' : 'memory-left'} role="timer">Minnet bleknar om {formatFlashbackLeft(msLeft)}</p>
      {myRooms.map((room) => (
        <div key={room.place.id} className="memory-pieces">
          {myRooms.length > 1 && <h2 className="memory-room">{room.place.name}</h2>}
          {room.image && <div className="memory-picture" style={imageStyle(room.image)} role="img" aria-label={`${room.place.name} som det var`} />}
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
          <div className="memory-room-cards">
            {flashback.rooms.map(({ place, image, isChoosable }) => (
              <button key={place.id} type="button" className={image ? 'memory-room-card has-image' : 'memory-room-card'} style={imageStyle(image)} onClick={() => onChoose(place.id)} disabled={isBusy || !isChoosable}>
                <span className="memory-room-name">{place.name}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {canChoose && choice === 'waitForOthers' && <p className="memory-note">När alla har valt rum kan du gå till ett rum som står tomt.</p>}
      {!canChoose && <p className="memory-note">Spelarna väljer var sitt rum och ser det som det var.</p>}
    </section>
  );
}
