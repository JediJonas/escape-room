import { type FormEvent, useState } from 'react';
import type { GameView } from '../../supabase/functions/game/game.ts';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import { Countdown } from './Countdown.tsx';
import { LeaderPanel } from './LeaderPanel.tsx';
import { PlaceScanner } from './PlaceScanner.tsx';
import { describePlaceStatus } from './placeStatus.ts';
import { ScreenLayout } from './ScreenLayout.tsx';

/** Hur spelaren anger platsen just nu. Utan platskort finns bara listan. */
type PlaceInput = 'none' | 'scan' | 'list';

/** Allt mobilen kan be servern om under spelet. */
export type GameActions = {
  nextStep: () => void;
  markReady: () => void;
  setPaused: (isPaused: boolean) => void;
  choosePlace: (placeId: PlaceId, source: 'scan' | 'list') => void;
  submitAnswer: (answer: string) => void;
  giveHint: () => void;
  showSolution: () => void;
  answerPending: (playerId: string, isAdmitted: boolean) => void;
  leave: () => void;
};

const ANSWER_FORM_ID = 'answer-form';

export function GameScreen({ view, clockOffsetMs, isBusy, error, actions: game }: {
  view: GameView;
  clockOffsetMs: number;
  isBusy: boolean;
  error: string;
  actions: GameActions;
}) {
  const [placeInput, setPlaceInput] = useState<PlaceInput>('none');
  const [answer, setAnswer] = useState('');
  const [answeredStep, setAnsweredStep] = useState(view.step.number);
  const [cameraProblem, setCameraProblem] = useState('');
  const { step } = view;
  const isAtGoal = step.goTo !== null && view.myPlace?.id === step.goTo.id;
  const needsPlace = view.me.isPlaying && step.goTo !== null && !isAtGoal && !view.isFinished;
  // Utan platskort visas listan direkt, eftersom det inte finns något att skanna.
  const shownInput: PlaceInput = needsPlace ? (view.usesPlaceCards ? placeInput : 'list') : 'none';

  function choose(placeId: PlaceId, source: 'scan' | 'list') {
    setPlaceInput('none');
    game.choosePlace(placeId, source);
  }

  // Ett nytt steg börjar med ett tomt svarsfält.
  if (answeredStep !== view.step.number) {
    setAnsweredStep(view.step.number);
    setAnswer('');
  }
  const isTask = step.type !== 'scene' && !view.isFinished;
  // Spelledaren som står utanför svarar inte och trycker inte Klar.
  const canAnswer = isTask && view.me.isPlaying;

  function submitAnswer(event: FormEvent) {
    event.preventDefault();
    if (answer.trim()) game.submitAnswer(answer);
  }

  function showList(reason: string) {
    setCameraProblem(reason);
    setPlaceInput('list');
  }

  // Knapparna ligger med huvudhandlingen underst, närmast tummen.
  const actions = [];
  if (view.me.isLeader && !view.isFinished) {
    // För när någon har gått iväg och gruppen inte ska behöva vänta.
    actions.push(<button key="skip" type="button" className="secondary" onClick={game.nextStep} disabled={isBusy}>{isTask ? 'Hoppa över uppgiften' : 'Gå vidare ändå'}</button>);
  }
  if (needsPlace && view.usesPlaceCards && shownInput === 'scan') {
    actions.push(<button key="list" type="button" className="secondary" onClick={() => showList('')}>Välj i listan i stället</button>);
  }
  if (needsPlace && view.usesPlaceCards && shownInput !== 'scan') {
    actions.push(<button key="scan" type="button" className={shownInput === 'list' ? 'secondary' : undefined} onClick={() => setPlaceInput('scan')}>Skanna platskortet</button>);
  }
  if (view.me.isPlaying && !needsPlace && step.usesReadyButton && !step.isMeDone && !view.isFinished) {
    actions.push(<button key="ready" type="button" onClick={game.markReady} disabled={isBusy}>Klar</button>);
  }
  if (canAnswer) {
    actions.push(<button key="answer" type="submit" form={ANSWER_FORM_ID} disabled={isBusy || !answer.trim()}>Svara</button>);
  }
  if (view.isFinished) {
    actions.push(<button key="leave" type="button" onClick={game.leave}>Till startsidan</button>);
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
      {step.hints.length > 0 && (
        <section className="hint-card" aria-label="Ledtrådar">
          {step.hints.map((hint, index) => <p key={hint}><strong>Ledtråd {index + 1}.</strong> {hint}</p>)}
        </section>
      )}
      {!view.me.isPlaying && !view.isFinished && <p className="hint">Du står utanför och leder spelet. Du ser det alla ser, men ingen roll.</p>}
      {canAnswer && (
        <form id={ANSWER_FORM_ID} className="field" onSubmit={submitAnswer}>
          <label htmlFor="answer">Ert svar</label>
          <input id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" enterKeyHint="send" />
        </form>
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
      <LeaderPanel
        view={view}
        isBusy={isBusy}
        onSetPaused={game.setPaused}
        onGiveHint={game.giveHint}
        onShowSolution={game.showSolution}
        onAnswerPending={game.answerPending}
      />
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
