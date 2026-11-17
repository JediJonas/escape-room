import { useState } from 'react';
import type { GameView } from '../../supabase/functions/game/game.ts';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import { Countdown } from './Countdown.tsx';
import { PlaceScanner } from './PlaceScanner.tsx';
import { describePlaceStatus } from './placeStatus.ts';
import { ScreenLayout } from './ScreenLayout.tsx';

/** Hur spelaren anger platsen just nu. Utan platskort finns bara listan. */
type PlaceInput = 'none' | 'scan' | 'list';

/** Spelledarens översikt: vilka som är klara, och paus. */
function LeaderPanel({ view, isBusy, onSetPaused }: { view: GameView; isBusy: boolean; onSetPaused: (isPaused: boolean) => void }) {
  if (!view.progress) return null;
  const doneCount = view.progress.filter((player) => player.isDone).length;
  const isPaused = view.clock?.isPaused ?? false;
  return (
    <section className="leader-panel" aria-label="Spelledare">
      <h2>Klara: {doneCount} av {view.progress.length}</h2>
      <ul className="player-list">
        {view.progress.map((player) => (
          <li key={player.name}>
            {player.name}
            {player.isMe && <span className="hint"> · du</span>}
            {player.isDone && <span className="done"> · klar</span>}
          </li>
        ))}
      </ul>
      {view.clock && (
        <button type="button" className="secondary small" onClick={() => onSetPaused(!isPaused)} disabled={isBusy}>
          {isPaused ? 'Fortsätt spelet' : 'Pausa spelet'}
        </button>
      )}
    </section>
  );
}

export function GameScreen({ view, clockOffsetMs, isBusy, error, onNextStep, onMarkReady, onSetPaused, onChoosePlace, onLeave }: {
  view: GameView;
  clockOffsetMs: number;
  isBusy: boolean;
  error: string;
  onNextStep: () => void;
  onMarkReady: () => void;
  onSetPaused: (isPaused: boolean) => void;
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

  // Knapparna ligger med huvudhandlingen underst, närmast tummen.
  const actions = [];
  if (view.me.isLeader && !view.isFinished) {
    // För när någon har gått iväg och gruppen inte ska behöva vänta.
    actions.push(<button key="skip" type="button" className="secondary" onClick={onNextStep} disabled={isBusy}>Gå vidare ändå</button>);
  }
  if (needsPlace && view.usesPlaceCards && shownInput === 'scan') {
    actions.push(<button key="list" type="button" className="secondary" onClick={() => showList('')}>Välj i listan i stället</button>);
  }
  if (needsPlace && view.usesPlaceCards && shownInput !== 'scan') {
    actions.push(<button key="scan" type="button" className={shownInput === 'list' ? 'secondary' : undefined} onClick={() => setPlaceInput('scan')}>Skanna platskortet</button>);
  }
  if (!needsPlace && step.usesReadyButton && !step.isMeDone && !view.isFinished) {
    actions.push(<button key="ready" type="button" onClick={onMarkReady} disabled={isBusy}>Klar</button>);
  }
  if (view.isFinished) {
    actions.push(<button key="leave" type="button" onClick={onLeave}>Till startsidan</button>);
  }
  const waitingText = step.isMeDone ? 'Väntar på att alla ska bli klara.' : '';

  return (
    <ScreenLayout actions={actions.length > 0 ? actions : <p className="hint">{waitingText}</p>}>
      <p className="hint game-header">
        <span>{view.missionTitle} · {view.isFinished ? 'slut' : `steg ${step.number} av ${step.count}`}</span>
        {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
      </p>
      {view.clock?.isPaused && <p className="status paused" role="status">Spelet är pausat.</p>}
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
      {step.isMeDone && view.me.isLeader && <p className="hint">{waitingText}</p>}
      <LeaderPanel view={view} isBusy={isBusy} onSetPaused={onSetPaused} />
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
