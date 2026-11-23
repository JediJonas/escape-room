import { type ReactNode, useRef, useState } from 'react';
import type { HouseView } from '../../supabase/functions/game/house.ts';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import { type Spot, findSpotAt } from '../../supabase/functions/game/spots.ts';
import type { LookDirection } from '../view/lookDirection.ts';
import { RoundImageView, type ScreenProjection } from '../view/RoundImageView.tsx';
import { FRAME_MARGIN_DEG, findSpotFrame, listFrameOutline } from './roomFrame.ts';
import { type RoomTarget, findTappedTarget, listRoomTargets } from './roomTargets.ts';
import './roomView.css';

/**
 * Åt vilket håll spelaren tittade senast och i vilket rum. När hon går
 * tillbaka från en sak tittar hon åt samma håll, och i ett nytt rum rakt fram.
 */
const lastLook: { roomId: string; look: LookDirection } = { roomId: '', look: { yawDeg: 0, pitchDeg: 0 } };

function rememberLook(roomId: string, look: LookDirection) {
  lastLook.roomId = roomId;
  lastLook.look = look;
}

/**
 * Rummet som rundbild i fullskärm. Spelaren ser sig omkring genom att vrida
 * mobilen, med fingret som reserv. Det som hamnar mitt i bilden tänds med en
 * ram runt saken, i stället för ett sikte mitt i bilden (Jonas 2026-11-23), och
 * ett tryck öppnar det: en sak, en dörr eller något som ingen har hittat än
 * (Jonas 2026-11-20). Se docs/koncept.md, Rundbilder i huset.
 *
 * Komponenten ska få rummet som nyckel, så att visaren börjar om i varje rum.
 */
export function RoomView({ house, image, header, note, error, canFind, isBusy, onOpen, onWalk, onFind }: {
  house: HouseView;
  /** Bildens adress. */
  image: string;
  /** Det som står överst bredvid rummets namn, som klockan. */
  header: ReactNode;
  /** Raden längst ner när inget är tänt, till exempel vem som går ner i källaren. */
  note: string;
  error: string;
  canFind: boolean;
  /** Medan servern svarar går det inte att gå eller leta, men det som är hittat går att öppna. */
  isBusy: boolean;
  onOpen: (thingId: string) => void;
  onWalk: (placeId: PlaceId) => void;
  onFind: (spot: Spot) => void;
}) {
  const roomId = house.room.id;
  const lookRef = useRef<LookDirection>(lastLook.roomId === roomId ? lastLook.look : { yawDeg: 0, pitchDeg: 0 });
  const [aimedKey, setAimedKey] = useState<string | null>(null);
  // Ramen flyttas vid varje sensorvärde, så den skrivs direkt i SVG:n utan att React ritar om.
  const frameRef = useRef<SVGPolygonElement>(null);
  const targets = listRoomTargets(house, canFind);
  const aimed = targets.find((target) => target.key === aimedKey) ?? null;
  const callingThing = targets.find((target) => target.kind === 'thing' && target.isCalling);

  function activate(target: RoomTarget) {
    if (target.kind === 'thing') onOpen(target.thingId);
    else if (isBusy) return;
    else if (target.kind === 'door') onWalk(target.placeId);
    else onFind(target.spot);
  }

  function handleLook(look: LookDirection, isSidewaysOnly: boolean, toScreen: ScreenProjection) {
    rememberLook(roomId, look);
    const target = findSpotAt(targets, look, { isSidewaysOnly });
    setAimedKey(target?.key ?? null);
    frameRef.current?.setAttribute('points', target ? listFramePoints(target.spot, toScreen) : '');
  }

  function handleTap(tapped: LookDirection, isSidewaysOnly: boolean) {
    const target = findTappedTarget(targets, tapped, lookRef.current, isSidewaysOnly);
    if (target) activate(target);
  }

  const isAimedCalling = aimed?.kind === 'thing' && aimed.isCalling;
  return (
    <main className="room-screen">
      <p className="hint game-header">
        <span className="room-name">{house.room.name}</span>
        {header}
      </p>
      <p className="error room-error" role="alert">{error}</p>
      <RoundImageView src={image} lookRef={lookRef} onTap={handleTap} onLook={handleLook}>
        <svg className="room-frame" aria-hidden="true">
          <polygon ref={frameRef} />
        </svg>
      </RoundImageView>
      <div className="room-bottom">
        {aimed ? (
          <button type="button" className={isAimedCalling ? 'room-label is-calling' : 'room-label'} onClick={() => activate(aimed)}>
            {aimed.label}
            {isAimedCalling && <span className="calling-note"> · något rör sig</span>}
          </button>
        ) : (
          <p className={callingThing ? 'room-note is-calling' : 'room-note'} role="status">
            {callingThing ? `Något rör sig vid ${callingThing.label.toLocaleLowerCase('sv')}.` : note}
          </p>
        )}
      </div>
    </main>
  );
}

/** Ramens hörn på skärmen, som SVG vill ha dem. Ligger en bit av ramen bakom spelaren ritas ingen ram. */
function listFramePoints(spot: Spot, toScreen: ScreenProjection): string {
  const outline = listFrameOutline(findSpotFrame(spot), FRAME_MARGIN_DEG);
  const points = outline.map(toScreen).filter((point) => point !== null);
  if (points.length < outline.length) return '';
  return points.map((point) => `${point.xPx.toFixed(1)},${point.yPx.toFixed(1)}`).join(' ');
}

/**
 * Reserven för ett rum som inte har någon rundbild än, som källaren: rummets
 * namn, det som har hittats och dörrarna, som en lista (Jonas 2026-11-20).
 */
export function RoomList({ house, isBusy, onOpen, onWalk }: {
  house: HouseView;
  isBusy: boolean;
  onOpen: (thingId: string) => void;
  onWalk: (placeId: PlaceId) => void;
}) {
  return (
    <>
      <h1>{house.room.name}</h1>
      {house.things.length > 0 && (
        <section className="house-list" aria-label="Saker">
          <h2>Saker</h2>
          {house.things.map((thing) => (
            <button key={thing.id} type="button" className={thing.isCalling ? 'secondary is-calling' : 'secondary'} onClick={() => onOpen(thing.id)}>
              {thing.name}
              {thing.isCalling && <span className="calling-note"> · något rör sig</span>}
            </button>
          ))}
        </section>
      )}
      <section className="house-list" aria-label="Dörrar">
        <h2>Dörrar</h2>
        {house.doors.map((door) => (
          <button key={door.id} type="button" className="secondary" onClick={() => onWalk(door.id)} disabled={isBusy}>Gå till {door.name.toLocaleLowerCase('sv')}</button>
        ))}
      </section>
    </>
  );
}
