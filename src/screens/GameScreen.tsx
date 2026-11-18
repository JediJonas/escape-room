import { type FormEvent, useCallback, useState } from 'react';
import type { GameView } from '../../supabase/functions/game/game.ts';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import type { BoardTouch } from '../../supabase/functions/game/seance.ts';
import type { CellarMove } from '../../supabase/functions/game/cellar.ts';
import { requestMotionPermission } from '../device/motion.ts';
import { gameAudio } from '../sound/gameAudio.ts';
import { CellarDark, CellarStatus } from '../tasks/CellarTask.tsx';
import { GrandfatherClock } from '../tasks/GrandfatherClock.tsx';
import { MelodyButton, PianoKeys, PianoTask } from '../tasks/PianoTask.tsx';
import { MemoryScreen, useMemoryTime } from '../tasks/MemoryScreen.tsx';
import { SeanceBoard } from '../tasks/SeanceBoard.tsx';
import { Countdown } from './Countdown.tsx';
import { LeaderPanel } from './LeaderPanel.tsx';
import { canLeaderSkip } from './leaderSkip.ts';
import { DocumentList, FoundView } from './FoundDocuments.tsx';
import { RoomList } from './HouseView.tsx';
import { PaperStack, ThingScreen, listFoundPapers, listPages, listPapers } from './ThingScreen.tsx';
import { InfoBox } from './InfoBox.tsx';
import { describePlaceStatus } from './placeStatus.ts';
import { ScreenLayout } from './ScreenLayout.tsx';

/** Allt mobilen kan be servern om under spelet. */
export type GameActions = {
  nextStep: () => void;
  markReady: () => void;
  setPaused: (isPaused: boolean) => void;
  choosePlace: (placeId: PlaceId) => void;
  submitAnswer: (answer: string) => void;
  touchBoard: (touch: BoardTouch) => void;
  moveInCellar: (move: CellarMove) => void;
  walk: (placeId: PlaceId) => void;
  searchRoom: () => void;
  turnClock: (minutes: number) => void;
  chooseMemoryRoom: (placeId: PlaceId) => void;
  fadeMemory: () => void;
  playKey: (note: string) => void;
  giveHint: () => void;
  showSolution: () => void;
  answerPending: (playerId: string, isAdmitted: boolean) => void;
  leave: () => void;
};

const ANSWER_FORM_ID = 'answer-form';

type GameScreenProps = {
  view: GameView;
  clockOffsetMs: number;
  isBusy: boolean;
  error: string;
  actions: GameActions;
};

/** Det som visas i inforutan, med ett nummer så att en ny text börjar om tiden. */
type Info = { id: number; title?: string; text: string };

/**
 * Spelet, med inforutan ovanpå. Ger spelledaren en ledtråd visas den hos
 * alla en stund, eftersom spelarna inte har någon meny (Jonas 2026-11-18).
 */
export function GameScreen(props: GameScreenProps) {
  const { step } = props.view;
  const [info, setInfo] = useState<Info | null>(null);
  const [hintsSeen, setHintsSeen] = useState({ stepNumber: step.number, count: step.hints.length });
  if (hintsSeen.stepNumber !== step.number || hintsSeen.count !== step.hints.length) {
    const isNewHint = hintsSeen.stepNumber === step.number && step.hints.length > hintsSeen.count;
    setHintsSeen({ stepNumber: step.number, count: step.hints.length });
    if (isNewHint) setInfo((shown) => ({ id: (shown?.id ?? 0) + 1, title: `Ledtråd ${step.hints.length}.`, text: step.hints[step.hints.length - 1] }));
  }
  const closeInfo = useCallback(() => setInfo(null), []);
  return (
    <>
      <GameContent {...props} />
      {info && <InfoBox key={info.id} title={info.title} text={info.text} onClose={closeInfo} />}
    </>
  );
}

function GameContent({ view, clockOffsetMs, isBusy, error, actions: game }: GameScreenProps) {
  const [answer, setAnswer] = useState('');
  const [answeredStep, setAnsweredStep] = useState(view.step.number);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasLeftBoard, setHasLeftBoard] = useState(false);
  const [isFoundOpen, setIsFoundOpen] = useState(false);
  const [openThingId, setOpenThingId] = useState<string | null>(null);
  const { step } = view;
  const memory = useMemoryTime(step.rooms?.remembersUntilMs ?? null, clockOffsetMs, game.fadeMemory);
  const isAtGoal = step.goTo !== null && view.myPlace?.id === step.goTo.id;
  const hasPlaceToGo = step.goTo !== null && !isAtGoal;
  const needsPlace = view.me.isPlaying && hasPlaceToGo && !view.isFinished;
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
  const closeThing = <button key="close" type="button" className="secondary" onClick={leaveThing}>Tillbaka</button>;
  // Bara spelledaren har en meny, med paus, ledtrådar och facit. Spelarna har Tillbaka (Jonas 2026-11-18).
  const stepButton = view.me.isLeader ? 'menu' : 'back';
  // Överst i en sak i fullskärm: klockan och en knapp tillbaka eller till menyn.
  const screenHeader = (button: 'back' | 'menu') => (
    <>
      {view.clock ? <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} /> : <span />}
      {view.clock?.isPaused && <span className="paused">Pausat</span>}
      {button === 'back'
        ? <button type="button" className="secondary seance-menu-button" onClick={leaveThing}>Tillbaka</button>
        : <button type="button" className="secondary seance-menu-button" onClick={() => setIsMenuOpen(true)}>Meny</button>}
    </>
  );
  // En sak vars steg gruppen inte är på visas i fullskärm, och Tillbaka går till rummet (Jonas 2026-11-18).
  if (openThing && !openThing.opensCurrentStep) {
    // Golvuret och pianot går att använda hela tiden, också innan berättelsen har kommit dit (Jonas 2026-11-18).
    const { instrument } = openThing;
    const papers = openThing.opensFound ? listFoundPapers(view.found.filter((item) => item.title === openThing.opensFound)) : listPages(openThing.pages ?? []);
    return (
      <ThingScreen className={instrument?.type === 'piano' ? 'piano-screen' : undefined} header={screenHeader('back')} actions={error ? <p className="error" role="alert">{error}</p> : undefined}>
        {instrument?.type === 'piano' && view.me.isPlaying && <PianoKeys keys={instrument.keys} onPlayKey={game.playKey} />}
        {instrument?.type === 'clock' && <GrandfatherClock dialMinutes={instrument.dialMinutes} canTurn={view.me.isPlaying && !isBusy} onTurn={game.turnClock} />}
        {papers.length > 0 && <PaperStack papers={papers} />}
        {!instrument && papers.length === 0 && openThing.text && <article className="document-card thing-paper">{openThing.text.split('\n').map((line) => <p key={line}>{line}</p>)}</article>}
        {!instrument && papers.length === 0 && !openThing.text && <p className="thing-empty">{openThing.name}</p>}
      </ThingScreen>
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

  // Under seansen fyller brädet skärmen, utan text. Hur man gör är första ledtråden (Jonas 2026-11-18).
  // När skenet har slocknat står brädet kvar tills spelaren själv lämnar det (Jonas 2026-11-17).
  const isBoardShown = step.seance !== null && !hasLeftBoard && !view.isFinished;
  // Spelledaren som står utanför svarar inte och trycker inte Klar.
  const canAnswer = step.acceptsAnswer && !view.isFinished && view.me.isPlaying;
  // Svaret skrivs på brädet, längst ner, när skenet har bokstaverat frågan (Jonas 2026-11-18).
  const boardAnswer = canAnswer ? (
    <form className="board-answer" onSubmit={submitAnswer}>
      {step.wrongAnswers && <p className="hint" role="status">Ett fel svar kostar {step.wrongAnswers.nextMinutes} minuter.</p>}
      <input aria-label="Ert svar" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Ert svar" autoComplete="off" enterKeyHint="send" />
      <button type="submit" disabled={isBusy || !answer.trim()}>Svara</button>
    </form>
  ) : undefined;
  if (step.seance && isBoardShown && !isMenuOpen) {
    return (
      <main className="seance-screen">
        <p className="hint game-header">
          {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
          {view.clock?.isPaused && <span className="paused">Pausat</span>}
          {stepButton === 'menu'
            ? <button type="button" className="secondary seance-menu-button" onClick={() => setIsMenuOpen(true)}>Meny</button>
            : <button type="button" className="secondary seance-menu-button" onClick={leaveThing}>Tillbaka</button>}
        </p>
        <SeanceBoard seance={step.seance} answer={boardAnswer} clockOffsetMs={clockOffsetMs} canTouch={view.me.isPlaying} onTouch={game.touchBoard}  />
      </main>
    );
  }
  // Vid pianot, golvuret och urklippen fyller saken skärmen, som brädet, utan text. Texten finns i spelledarens meny (Jonas 2026-11-18).
  const thingPapers = listPapers(step.documents, step.role?.pieces ?? []);
  const isThingShown = openThing !== null && !view.isFinished && (step.piano !== null || step.rooms !== null || thingPapers.length > 0);
  if (isThingShown && !isMenuOpen) {
    const canMarkReady = view.me.isPlaying && step.usesReadyButton && !step.isMeDone;
    const readyButton = canMarkReady ? <button type="button" onClick={markReady} disabled={isBusy}>{step.readyLabel ?? 'Klar'}</button> : null;
    const melodyButton = step.piano?.hasMelody ? <MelodyButton piano={step.piano} /> : null;
    const waiting = step.usesReadyButton && step.isMeDone ? <p className="hint">Väntar på att alla ska bli klara.</p> : null;
    const actions = (readyButton ?? melodyButton ?? waiting ?? error) ? <>{error && <p className="error" role="alert">{error}</p>}{melodyButton}{readyButton}{waiting}</> : undefined;
    return (
      <ThingScreen className={step.piano ? 'piano-screen' : undefined} header={screenHeader(stepButton)} actions={actions}>
        {step.piano && view.me.isPlaying && <PianoKeys keys={step.piano.myKeys} onPlayKey={game.playKey} />}
        {step.rooms && <GrandfatherClock dialMinutes={step.rooms.dialMinutes} canTurn={view.me.isPlaying && !isBusy} onTurn={game.turnClock} />}
        {thingPapers.length > 0 && <PaperStack papers={thingPapers} />}
      </ThingScreen>
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

  // Tillstånden måste begäras direkt i trycket, annars nekar iPhone. Svaret behövs inte här:
  // en uppgift som använder rörelse lyssnar bara, och fingret tar över om inga värden kommer.
  // Tillbaka går till rummet. Att lämna brädet efter meddelandet räknas som klar, så ingen
  // Klar-knapp behövs (Jonas 2026-11-18).
  function leaveThing() {
    const isBoardDone = step.seance?.isComplete === true && openThing?.opensCurrentStep === true;
    if (isBoardDone && view.me.isPlaying && step.usesReadyButton && !step.isMeDone) markReady();
    // Utan huset finns inget rum att gå till, så spelaren kommer till stegets sida.
    if (!house && step.seance?.isComplete) setHasLeftBoard(true);
    setIsMenuOpen(false);
    setOpenThingId(null);
  }

  function markReady() {
    if (step.asksFor.includes('sound')) gameAudio.unlock();
    if (step.asksFor.includes('motion')) void requestMotionPermission();
    game.markReady();
  }

  function submitAnswer(event: FormEvent) {
    event.preventDefault();
    if (answer.trim()) game.submitAnswer(answer);
  }

  // Knapparna ligger med huvudhandlingen underst, närmast tummen.
  const actions = [];
  if (openThing) actions.push(closeThing);
  // Menyn öppnas från brädet, saken eller källaren, och samma knapp överst stänger den (Jonas 2026-11-18).
  const isMenuOverView = isMenuOpen && (isBoardShown || (isThingShown && openThing !== null) || isCellarShown);
  // De andra tänder lampan i källaren. Det är deras huvudhandling medan hon letar.
  const canFlipFuse = view.me.isPlaying && cellar !== null && !cellar.isTrapped && cellar.catchMs !== null && cellar.outcome === null && cellar.fusesLeft > 0;
  if (canFlipFuse) {
    actions.push(<button key="fuse" type="button" onClick={() => game.moveInCellar({ type: 'flipFuse' })} disabled={isBusy}>Tänd lampan i källaren</button>);
  }
  const canSkip = canLeaderSkip({ isLeaderPlaying: view.me.isPlaying, usesReadyButton: step.usesReadyButton, isMeDone: step.isMeDone, progress: view.progress ?? [] });
  if (view.me.isLeader && !view.isFinished && canSkip) {
    // För när någon har gått iväg och gruppen inte ska behöva vänta.
    actions.push(<button key="skip" type="button" className="secondary" onClick={game.nextStep} disabled={isBusy}>{isTask ? 'Hoppa över uppgiften' : 'Gå vidare ändå'}</button>);
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
        {isMenuOverView && <button type="button" className="secondary seance-menu-button" onClick={() => setIsMenuOpen(false)}>Stäng menyn</button>}
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
      {step.piano && <PianoTask piano={step.piano} canPlay={!isThingShown && view.me.isPlaying && !view.isFinished} onPlayKey={game.playKey} />}
      {step.rooms && <GrandfatherClock dialMinutes={step.rooms.dialMinutes} canTurn={view.me.isPlaying && !isBusy} onTurn={game.turnClock} />}
      {step.goTo && <p className="status" role="status">{describePlaceStatus(step.goTo, view.myPlace)}</p>}
      {step.textAtPlace && <p className="place-text">{step.textAtPlace}</p>}
      {needsPlace && (
        <fieldset className="place-list">
          <legend>Var är du?</legend>
          {view.places.map((place) => (
            <button key={place.id} type="button" className="secondary" onClick={() => game.choosePlace(place.id)} disabled={isBusy}>{place.name}</button>
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
