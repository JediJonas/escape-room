import { useState } from 'react';
import type { GameView } from '../../supabase/functions/game/game.ts';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import { PlaceScanner } from './PlaceScanner.tsx';
import { describePlaceStatus } from './placeStatus.ts';
import { ScreenLayout } from './ScreenLayout.tsx';

/** Hur spelaren anger platsen just nu. Utan platskort finns bara listan. */
type PlaceInput = 'none' | 'scan' | 'list';

export function GameScreen({ view, isBusy, error, onNextStep, onChoosePlace, onLeave }: {
  view: GameView;
  isBusy: boolean;
  error: string;
  onNextStep: () => void;
  onChoosePlace: (placeId: PlaceId, source: 'scan' | 'list') => void;
  onLeave: () => void;
}) {
  const [placeInput, setPlaceInput] = useState<PlaceInput>('none');
  const [cameraProblem, setCameraProblem] = useState('');
  const { step } = view;
  const isAtGoal = step.goTo !== null && view.myPlace?.id === step.goTo.id;
  const needsPlace = step.goTo !== null && !isAtGoal && !view.isFinished;
  // Utan platskort visas listan direkt, eftersom det inte finns något att skanna.
  const shownInput: PlaceInput = needsPlace ? (view.usesPlaceCards ? placeInput : 'list') : 'none';

  function choose(placeId: PlaceId, source: 'scan' | 'list') {
    setPlaceInput('none');
    onChoosePlace(placeId, source);
  }

  function showList(reason: string) {
    setCameraProblem(reason);
    setPlaceInput('list');
  }

  const actions = [];
  if (needsPlace && view.usesPlaceCards && shownInput !== 'scan') {
    actions.push(<button key="scan" type="button" className={shownInput === 'list' ? 'secondary' : undefined} onClick={() => setPlaceInput('scan')}>Skanna platskortet</button>);
  }
  if (needsPlace && view.usesPlaceCards && shownInput === 'scan') {
    actions.push(<button key="list" type="button" className="secondary" onClick={() => showList('')}>Välj i listan i stället</button>);
  }
  if (view.isFinished) {
    actions.push(<button key="leave" type="button" onClick={onLeave}>Till startsidan</button>);
  } else if (view.me.isLeader) {
    // Tillfällig knapp tills uppgifterna och spelledarvyn finns (steg 4). När
    // spelaren ska till en plats är skanningen huvudhandlingen och ligger underst.
    const nextButton = <button key="next" type="button" className={needsPlace ? 'secondary' : undefined} onClick={onNextStep} disabled={isBusy}>Nästa</button>;
    if (needsPlace) actions.unshift(nextButton);
    else actions.push(nextButton);
  }

  return (
    <ScreenLayout actions={actions.length > 0 ? actions : <p className="hint">Spelledaren går vidare när alla är klara.</p>}>
      <p className="hint">{view.missionTitle} · {view.isFinished ? 'slut' : `steg ${step.number} av ${step.count}`}</p>
      <p className="scene-text">{step.text}</p>
      {step.role && (
        <section className="role-card" aria-label="Bara du ser det här">
          <h2>{step.role.title}</h2>
          {step.role.pieces.map((piece) => <p key={piece}>{piece}</p>)}
        </section>
      )}
      {step.goTo && <p className="status" role="status">{describePlaceStatus(step.goTo, view.myPlace)}</p>}
      {step.textAtPlace && <p className="place-text">{step.textAtPlace}</p>}
      {shownInput === 'scan' && <PlaceScanner onPlace={(placeId) => choose(placeId, 'scan')} onCameraFailed={(reason) => showList(`${reason} Välj platsen i listan.`)} />}
      {shownInput === 'list' && (
        <fieldset className="place-list">
          <legend>Var är du?</legend>
          {cameraProblem && <p className="hint">{cameraProblem}</p>}
          {view.places.map((place) => (
            <button key={place.id} type="button" className="secondary" onClick={() => choose(place.id, 'list')} disabled={isBusy}>{place.name}</button>
          ))}
        </fieldset>
      )}
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
