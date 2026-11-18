import { type FormEvent, useState } from 'react';
import type { GameView } from '../../supabase/functions/game/game.ts';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import type { BoardTouch } from '../../supabase/functions/game/seance.ts';
import type { CellarMove } from '../../supabase/functions/game/cellar.ts';
import { requestMotionPermission } from '../device/motion.ts';
import { gameAudio } from '../sound/gameAudio.ts';
import { CellarDark, CellarStatus } from '../tasks/CellarTask.tsx';
import { GrandfatherClock } from '../tasks/GrandfatherClock.tsx';
import { MemoryScreen, useMemoryTime } from '../tasks/MemoryScreen.tsx';
import { useKnocking } from '../tasks/useKnocking.ts';
import { SeanceBoard } from '../tasks/SeanceBoard.tsx';
import { Countdown } from './Countdown.tsx';
import { LeaderPanel } from './LeaderPanel.tsx';
import { PlaceScanner } from './PlaceScanner.tsx';
import { DocumentList, FoundView } from './FoundDocuments.tsx';
import { RoomList, ThingContent } from './HouseView.tsx';
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
  touchBoard: (touch: BoardTouch) => void;
  moveInCellar: (move: CellarMove) => void;
  walk: (placeId: PlaceId) => void;
  searchRoom: () => void;
  turnClock: (minutes: number) => void;
  chooseMemoryRoom: (placeId: PlaceId) => void;
  fadeMemory: () => void;
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasLeftBoard, setHasLeftBoard] = useState(false);
  const [isFoundOpen, setIsFoundOpen] = useState(false);
  const [openThingId, setOpenThingId] = useState<string | null>(null);
  const { step } = view;
  const memory = useMemoryTime(step.rooms?.remembersUntilMs ?? null, clockOffsetMs, game.fadeMemory);
  // Brädet kallar med knackningar så länge spelaren är ute i huset (Jonas 2026-11-17).
  const isHouseCalling = view.house?.things.some((thing) => thing.isCalling) ?? false;
  useKnocking(isHouseCalling && openThingId === null && !isFoundOpen && !view.isFinished);
  const isAtGoal = step.goTo !== null && view.myPlace?.id === step.goTo.id;
  const hasPlaceToGo = step.goTo !== null && !isAtGoal;
  const needsPlace = view.me.isPlaying && hasPlaceToGo && !view.isFinished;
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
    setIsMenuOpen(false);
    setHasLeftBoard(false);
    setIsFoundOpen(false);
    setOpenThingId(null);
  }

  if (isFoundOpen) {
    return (
      <ScreenLayout actions={<button type="button" onClick={() => setIsFoundOpen(false)}>Tillbaka</button>}>
        <FoundView found={view.found} />
      </ScreenLayout>
    );
  }

  // Medan huset minns ser alla minnet, var de än är, och inget av det som finns i nuet (Jonas 2026-11-17).
  if (step.rooms && memory.isRemembering && !view.isFinished) {
    return (
      <ScreenLayout className="memory-screen" actions={<p className="hint">Dörrarna är stängda tills minnet bleknar.</p>}>
        <p className="hint game-header">
          <span>{view.missionTitle} · steg {step.number} av {step.count}</span>
          {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
        </p>
        <MemoryScreen rooms={step.rooms} isFading={memory.isFading} msLeft={memory.msLeft} canChoose={view.me.isPlaying} isBusy={isBusy} onChoose={game.chooseMemoryRoom} />
        <LeaderPanel view={view} isBusy={isBusy} onSetPaused={game.setPaused} onGiveHint={game.giveHint} onShowSolution={game.showSolution} onAnswerPending={game.answerPending} />
        <p className="error" role="alert">{error}</p>
      </ScreenLayout>
    );
  }

  // I huset öppnar en sak alltid en vy, och Tillbaka går till rummet (Jonas 2026-11-17).
  const { house } = view;
  const openThing = house?.things.find((thing) => thing.id === openThingId) ?? null;
  const closeThing = <button key="close" type="button" className="secondary" onClick={() => setOpenThingId(null)}>Tillbaka</button>;
  if (openThing && !openThing.opensCurrentStep) {
    return (
      <ScreenLayout actions={closeThing}>
        <ThingContent thing={openThing} found={view.found} />
      </ScreenLayout>
    );
  }
  // Ett steg som öppnas från en sak, som seansen från ouijabrädet, syns först när spelaren har öppnat saken.
  const showsStep = step.opensFrom === null || openThing !== null || view.isFinished || !house;
  if (!showsStep && house) {
    const houseActions = [];
    if (view.me.isLeader) houseActions.push(<button key="skip" type="button" className="secondary" onClick={game.nextStep} disabled={isBusy}>Hoppa över uppgiften</button>);
    if (view.me.isPlaying && house.canSearch) houseActions.push(<button key="search" type="button" onClick={game.searchRoom} disabled={isBusy}>Leta i rummet</button>);
    return (
      <ScreenLayout actions={houseActions.length > 0 ? houseActions : <p className="hint">Gå runt i huset och leta.</p>}>
        <p className="hint game-header">
          <span>{view.missionTitle} · steg {step.number} av {step.count}</span>
          {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
        </p>
        {view.clock?.isPaused && <p className="status paused" role="status">Spelet är pausat.</p>}
        <RoomList house={house} isBusy={isBusy} onOpen={setOpenThingId} onWalk={game.walk} />
        {step.hints.length > 0 && (
          <section className="hint-card" aria-label="Ledtrådar">
            {step.hints.map((hint, index) => <p key={hint}><strong>Ledtråd {index + 1}.</strong> {hint}</p>)}
          </section>
        )}
        <LeaderPanel view={view} isBusy={isBusy} onSetPaused={game.setPaused} onGiveHint={game.giveHint} onShowSolution={game.showSolution} onAnswerPending={game.answerPending} />
        <p className="error" role="alert">{error}</p>
      </ScreenLayout>
    );
  }

  // Under seansen fyller brädet skärmen. Texten, ledtrådarna och spelledarens knappar ligger i menyn.
  // När skenet har slocknat står brädet kvar tills spelaren själv lämnar det (Jonas 2026-11-17).
  const isBoardShown = step.seance !== null && !hasLeftBoard && !view.isFinished;
  if (step.seance && isBoardShown && !isMenuOpen) {
    return (
      <main className="seance-screen">
        <p className="hint game-header">
          {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
          {view.clock?.isPaused && <span className="paused">Pausat</span>}
          <button type="button" className="secondary seance-menu-button" onClick={() => setIsMenuOpen(true)}>Meny</button>
        </p>
        <SeanceBoard seance={step.seance} text={step.text} clockOffsetMs={clockOffsetMs} canTouch={view.me.isPlaying} onTouch={game.touchBoard} onLeave={() => setHasLeftBoard(true)} />
      </main>
    );
  }
  // I källaren ser den instängda bara mörkret och ficklampan. Resten ligger i menyn, som i seansen.
  const { cellar } = step;
  const isCellarShown = cellar?.image !== null && cellar?.image !== undefined && cellar.outcome === null && !view.isFinished;
  const timeUpInCellar = () => game.moveInCellar({ type: 'timeUp' });
  if (cellar?.image && isCellarShown && !isMenuOpen) {
    return (
      <main className="cellar-screen">
        <p className="hint game-header">
          {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
          <button type="button" className="secondary seance-menu-button" onClick={() => setIsMenuOpen(true)}>Meny</button>
        </p>
        <CellarDark cellar={cellar} image={cellar.image} clockOffsetMs={clockOffsetMs} onOpenDoor={(yawDeg) => game.moveInCellar({ type: 'openDoor', yawDeg })} onTimeUp={timeUpInCellar} />
        <p className="error cellar-error" role="alert">{error}</p>
      </main>
    );
  }
  const isTask = step.type !== 'scene' && !view.isFinished;
  // Spelledaren som står utanför svarar inte och trycker inte Klar.
  const canAnswer = step.acceptsAnswer && !view.isFinished && view.me.isPlaying;

  // Tillstånden måste begäras direkt i trycket, annars nekar iPhone. Svaret behövs inte här:
  // en uppgift som använder rörelse lyssnar bara, och fingret tar över om inga värden kommer.
  function markReady() {
    if (step.asksFor.includes('sound')) gameAudio.unlock();
    if (step.asksFor.includes('motion')) void requestMotionPermission();
    game.markReady();
  }

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
  if (openThing) actions.push(closeThing);
  if (isBoardShown) {
    actions.push(<button key="board" type="button" onClick={() => setIsMenuOpen(false)}>Tillbaka till brädet</button>);
  }
  if (isCellarShown) {
    actions.push(<button key="cellar" type="button" onClick={() => setIsMenuOpen(false)}>Tillbaka till källaren</button>);
  }
  // De andra tänder lampan i källaren. Det är deras huvudhandling medan hon letar.
  const canFlipFuse = view.me.isPlaying && cellar !== null && !cellar.isTrapped && cellar.catchMs !== null && cellar.outcome === null && cellar.fusesLeft > 0;
  if (canFlipFuse) {
    actions.push(<button key="fuse" type="button" onClick={() => game.moveInCellar({ type: 'flipFuse' })} disabled={isBusy}>Tänd lampan i källaren</button>);
  }
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
    actions.push(<button key="ready" type="button" onClick={markReady} disabled={isBusy}>{step.readyLabel ?? 'Klar'}</button>);
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
      {view.found.length > 0 && !house && <button type="button" className="secondary small found-button" onClick={() => setIsFoundOpen(true)}>Hittat</button>}
      <p className="scene-text">{step.text}</p>
      <DocumentList documents={step.documents} />
      {step.role && (
        <section className="role-card" aria-label="Bara du ser det här">
          <h2>{step.role.title}</h2>
          {step.role.pieces.map((piece) => <p key={piece} className={step.documents.length > 0 ? 'clipping' : undefined}>{piece}</p>)}
        </section>
      )}
      {step.hints.length > 0 && (
        <section className="hint-card" aria-label="Ledtrådar">
          {step.hints.map((hint, index) => <p key={hint}><strong>Ledtråd {index + 1}.</strong> {hint}</p>)}
        </section>
      )}
      {!view.me.isPlaying && !view.isFinished && <p className="hint">Du står utanför och leder spelet. Du ser det alla ser, men ingen roll.</p>}
      {step.question && <p className="status" role="status">{step.question}</p>}
      {canAnswer && (
        <form id={ANSWER_FORM_ID} className="field" onSubmit={submitAnswer}>
          <label htmlFor="answer">Ert svar</label>
          {step.wrongAnswers && (
            <p className="hint" role="status">
              {step.wrongAnswers.count > 0 && `Ni har svarat fel ${step.wrongAnswers.count} ${step.wrongAnswers.count === 1 ? 'gång' : 'gånger'}. `}
              Ett fel svar kostar nu {step.wrongAnswers.nextMinutes} minuter.
            </p>
          )}
          <input id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" enterKeyHint="send" />
        </form>
      )}
      {cellar && <CellarStatus cellar={cellar} clockOffsetMs={clockOffsetMs} onTimeUp={timeUpInCellar} />}
      {step.rooms && <GrandfatherClock dialMinutes={step.rooms.dialMinutes} canTurn={view.me.isPlaying && !isBusy} onTurn={game.turnClock} />}
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
