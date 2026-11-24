import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import type { LookDirection } from '../view/lookDirection.ts';
import { RoundImageView } from '../view/RoundImageView.tsx';
import { toCssUrl } from '../view/assetUrl.ts';
import type { FlashbackView } from '../../supabase/functions/game/flashback.ts';
import { formatFlashbackLeft } from './flashbackTime.ts';
import { Icon } from '../screens/Icon.tsx';
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
  return image ? { '--room-image': toCssUrl(image) } as CSSProperties : undefined;
}

/** Raden från uppdraget med stor bokstav först, som "Kvart över tio, 1962". */
function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('sv') + text.slice(1);
}

/**
 * Tiden kvar tills minnet bleknar, nere till vänster. Den är en klocka
 * likadan som spelets uppe till höger, med texten framför tiden
 * (Jonas 2026-11-24). De sista 20 sekunderna är den röd, som spelets klocka
 * när tiden nästan är slut.
 */
export function MemoryCountdown({ msLeft, isFading }: { msLeft: number; isFading: boolean }) {
  return (
    <span className={isFading ? 'chip countdown memory-countdown is-low' : 'chip countdown memory-countdown'} role="timer">
      <Icon name="clock" />
      <span className="memory-countdown-label">Minnet bleknar om</span>
      {formatFlashbackLeft(msLeft)}
    </span>
  );
}

/**
 * Rummet i minnet som rundbild i fullskärm, som ett rum i huset. Spelaren ser
 * sig om genom att vrida mobilen, med fingret som reserv. Inga texter: det som
 * finns att se står i bilden. Bilden är sepiatonad med mörkare kanter och har
 * ett svagt flimrande korn, så att det syns att det är ett minne
 * (Jonas 2026-11-24). Överst står "Huset minns" och rummet med året. Har
 * spelaren flera rum i minnet byter hon mellan dem med knappen i mitten, och
 * står ett rum tomt kan hon gå dit också.
 */
export function MemoryRoomView({ rooms, flashbackLabel, header, error, isFading, msLeft, onTakeAnother }: {
  /** Spelarens rum i minnet som har en rundbild, i den ordning hon valde dem. */
  rooms: { place: { id: PlaceId; name: string }; image: string }[];
  /** Raden överst i minnet, som "kvart över tio, 1962". Året står efter rummets namn. */
  flashbackLabel: string;
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
  // Året efter rummet, som Salongen 1962 (Jonas 2026-11-23).
  const year = /\d{4}/.exec(flashbackLabel)?.[0] ?? '';
  return (
    <main className={isFading ? 'room-screen memory-room-screen is-fading' : 'room-screen memory-room-screen'}>
      <header className="topbar room-top">
        <h1 className="room-name"><span className="eyebrow">Huset minns</span>{year ? `${shown.place.name} ${year}` : shown.place.name}</h1>
        {header}
      </header>
      <p className="error room-error" role="alert">{error}</p>
      <RoundImageView key={shown.place.id} src={`${import.meta.env.BASE_URL}${shown.image}`} lookRef={lookRef} onTap={() => {}}>
        <div className="memory-grain" aria-hidden="true" />
      </RoundImageView>
      {(rooms.length > 1 || onTakeAnother) && (
        <div className="memory-switch">
          {rooms.length > 1 && <button type="button" className="room-label" onClick={() => setShownId(next.place.id)}><Icon name="door" />Till {next.place.name.toLocaleLowerCase('sv')}</button>}
          {onTakeAnother && <button type="button" className="room-label" onClick={onTakeAnother}>Ett rum står tomt</button>}
        </div>
      )}
      <div className="memory-bottom">
        <MemoryCountdown msLeft={msLeft} isFading={isFading} />
      </div>
    </main>
  );
}

/** Raden under rubriken, som säger vad spelaren ska göra. */
function describeAsk(flashback: FlashbackView, canChoose: boolean): string {
  if (!canChoose) return 'Spelarna väljer var sitt rum och ser det som det var.';
  if (flashback.choice === 'choose') return 'Vilket rum är du i? Du stannar där tills minnet bleknar.';
  if (flashback.choice === 'takeAnother') return 'Ett rum står tomt. Ni är färre än rummen, så du kan se ett rum till i samma minne.';
  if (flashback.choice === 'waitForOthers') return 'När alla har valt rum kan du gå till ett rum som står tomt.';
  return '';
}

/**
 * Huset minns kvällen 1962. Spelaren väljer ett rum bland dem som går att
 * välja. Skärmen är byggd som berättartexten, med ornament, "Huset minns" och
 * tiden i minnet, och rummen står som bildkort i sepia. Ett rum som inte går
 * att välja är grått och märkt "Upptaget" (Jonas 2026-11-24). Ett rum med
 * rundbild från 1962 visas i MemoryRoomView, och här står bara bitarna i ett
 * rum utan bild (Jonas 2026-11-23). Det som finns i nuet syns inte så länge
 * minnet varar. Se docs/koncept.md, Nu och 1962.
 */
export function FlashbackScreen({ flashback, isFading, canChoose, isBusy, onChoose }: {
  flashback: FlashbackView;
  isFading: boolean;
  /** Spelledaren som står utanför väljer inget rum. */
  canChoose: boolean;
  isBusy: boolean;
  onChoose: (placeId: PlaceId) => void;
}) {
  const { choice } = flashback;
  // Rum med rundbild visas i fullskärm. Här står bara rummen som saknar bild.
  const myRooms = flashback.myRooms.filter((room) => !room.image);
  const [onlyRoom] = myRooms;
  const myPlaceIds = flashback.myRooms.map((room) => room.place.id);
  const isChoosing = canChoose && (choice === 'choose' || choice === 'takeAnother');
  const ask = describeAsk(flashback, canChoose);
  return (
    <section className={isFading ? 'memory is-fading' : 'memory'} aria-label="Huset minns">
      <span className="ornament" aria-hidden="true" />
      <h2 className="memory-title">{myRooms.length === 1 ? onlyRoom.place.name : 'Huset minns'}</h2>
      <p className="memory-when">{capitalize(flashback.flashbackLabel)}</p>
      {myRooms.map((room) => (
        <div key={room.place.id} className="memory-pieces">
          {myRooms.length > 1 && <h3 className="memory-room">{room.place.name}</h3>}
          {room.pieces.map((piece) => <p key={piece}>{piece}</p>)}
        </div>
      ))}
      {ask && <p className="memory-ask">{ask}</p>}
      {isChoosing && (
        <>
          <div className="memory-room-cards" role="group" aria-label="Rummen">
            {flashback.rooms.map(({ place, image, isChoosable }) => {
              const isMine = myPlaceIds.includes(place.id);
              const state = isMine ? ' is-taken' : isChoosable ? '' : ' is-off';
              return (
                <button key={place.id} type="button" className={`memory-room-card${image ? ' has-image' : ''}${state}`} style={imageStyle(image)} onClick={() => onChoose(place.id)} disabled={isBusy || !isChoosable}>
                  <span className="memory-room-name">{place.name}</span>
                  {isMine && <span className="memory-room-note">Här är du</span>}
                  {!isMine && !isChoosable && <span className="memory-room-note">Upptaget</span>}
                </button>
              );
            })}
          </div>
          {choice === 'choose' && <p className="memory-note">Ett rum går bara att välja om inget annat rum har färre.</p>}
        </>
      )}
    </section>
  );
}
