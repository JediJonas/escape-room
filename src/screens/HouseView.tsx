import type { FoundItem } from '../../supabase/functions/game/found.ts';
import type { HouseView, ThingView } from '../../supabase/functions/game/house.ts';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import { FoundView } from './FoundDocuments.tsx';

/**
 * Textläget i huset: var spelaren är, det som har hittats i rummet och
 * dörrarna till rummen intill. Se docs/koncept.md, Rundbilder och två lägen.
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
        <section className="house-list" aria-label="Det som har hittats här">
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

/** En sak att titta på, eller något gruppen har hittat tidigare och kan läsa igen. */
export function ThingContent({ thing, found }: { thing: ThingView; found: readonly FoundItem[] }) {
  if (thing.opensFound) return <FoundView found={found.filter((item) => item.title === thing.opensFound)} />;
  return (
    <>
      <h1>{thing.name}</h1>
      {thing.text && <article className="document-card"><p>{thing.text}</p></article>}
    </>
  );
}
