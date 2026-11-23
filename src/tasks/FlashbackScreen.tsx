import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import type { LookDirection } from '../view/lookDirection.ts';
import { RoundImageView } from '../view/RoundImageView.tsx';
import type { FlashbackView } from '../../supabase/functions/game/flashback.ts';
import { formatFlashbackLeft } from './flashbackTime.ts';
import '../screens/roomView.css';
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
 * Rummet i minnet som rundbild i fullskärm, som ett rum i huset. Spelaren ser
 * sig om genom att vrida mobilen, med fingret som reserv. Inga texter: det som
 * finns att se står i bilden. Bilden brusar och flimrar, så att det syns att
 * det är ett minne (Jonas 2026-11-23). Har spelaren flera rum i minnet byter
 * hon mellan dem nertill, och står ett rum tomt kan hon gå dit också.
 */
export function MemoryRoomView({ rooms, flashbackLabel, missionTitle, header, error, isFading, msLeft, onTakeAnother }: {
  /** Spelarens rum i minnet som har en rundbild, i den ordning hon valde dem. */
  rooms: { place: { id: PlaceId; name: string }; image: string }[];
  /** Raden överst i minnet, som "kvart över tio, 1962". Året står efter rummets namn. */
  flashbackLabel: string;
  missionTitle: string;
  /** Det som står överst till höger, som klockan. */
  header: ReactNode;
  error: string;
  isFading: boolean;
  msLeft: number;
  /** Visar valet av ett tomt rum, eller null när det inte går. */
  onTakeAnother: (() => void) | null;
}) {
  const [shownId, setShownId] = useState<PlaceId | null>(null);
  const shown = rooms.find((room) => room.place.id === shownId) ?? rooms[rooms.length - 1];
  const next = rooms[(rooms.indexOf(shown) + 1) % rooms.length];
  const lookRef = useRef<LookDirection>({ yawDeg: 0, pitchDeg: 0 });
  // Uppdraget överst som i husets rum, och året efter rummet, som Salongen 1962 (Jonas 2026-11-23).
  const year = /\d{4}/.exec(flashbackLabel)?.[0] ?? '';
  return (
    <main className={isFading ? 'room-screen memory-room-screen is-fading' : 'room-screen memory-room-screen'}>
      <header className="topbar room-top">
        <h1 className="room-name"><span className="eyebrow">{missionTitle}</span>{year ? `${shown.place.name} ${year}` : shown.place.name}</h1>
        {header}
      </header>
      <p className="error room-error" role="alert">{error}</p>
      <RoundImageView key={shown.place.id} src={`${import.meta.env.BASE_URL}${shown.image}`} lookRef={lookRef} onTap={() => {}}>
        <div className="memory-grain" aria-hidden="true" />
      </RoundImageView>
      <div className="room-bottom memory-bottom">
        <p className={isFading ? 'room-note memory-left is-fading' : 'room-note memory-left'} role="timer">
          Minnet bleknar om {formatFlashbackLeft(msLeft)}
        </p>
        {rooms.length > 1 && <button type="button" className="room-label" onClick={() => setShownId(next.place.id)}>Till {next.place.name.toLocaleLowerCase('sv')}</button>}
        {onTakeAnother && <button type="button" className="room-label" onClick={onTakeAnother}>Ett rum står tomt</button>}
      </div>
    </main>
  );
}

/**
 * Huset minns kvällen 1962. Spelaren väljer ett rum bland dem som går att
 * välja. Valet visar rummen som de ser ut i dag. Ett rum med rundbild från
 * 1962 visas i MemoryRoomView, och här står bara bitarna i ett rum utan bild
 * (Jonas 2026-11-23). Det som finns i nuet syns inte så länge minnet varar.
 * Se docs/koncept.md, Nu och 1962.
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
  const { choice } = flashback;
  // Rum med rundbild visas i fullskärm. Här står bara rummen som saknar bild.
  const myRooms = flashback.myRooms.filter((room) => !room.image);
  const [onlyRoom] = myRooms;
  const isTakingAnother = choice === 'takeAnother';
  return (
    <section className={isFading ? 'memory is-fading' : 'memory'} aria-label="Huset minns">
      <p className="memory-label">{myRooms.length === 1 ? onlyRoom.place.name : 'Huset minns'} · {flashback.flashbackLabel}</p>
      <p className={isFading ? 'memory-left is-fading' : 'memory-left'} role="timer">Minnet bleknar om {formatFlashbackLeft(msLeft)}</p>
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
