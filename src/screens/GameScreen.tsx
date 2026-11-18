import { type FormEvent, type ReactNode, useCallback, useState } from 'react';
import type { GameView } from '../../supabase/functions/game/game.ts';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import type { BoardTouch } from '../../supabase/functions/game/seance.ts';
import type { CellarMove } from '../../supabase/functions/game/cellar.ts';
import { requestMotionPermission } from '../device/motion.ts';
import { gameAudio } from '../sound/gameAudio.ts';
import { CellarDark, CellarStatus } from '../tasks/CellarTask.tsx';
import { GrandfatherClock } from '../tasks/GrandfatherClock.tsx';
import { MelodyButton, PianoKeys, PianoTask } from '../tasks/PianoTask.tsx';
import { FlashbackScreen, useFlashbackTime } from '../tasks/FlashbackScreen.tsx';
import { EchoBoard, SeanceBoard } from '../tasks/SeanceBoard.tsx';
import { Countdown } from './Countdown.tsx';
import { LeaderMenu } from './LeaderMenu.tsx';
import { canHelpWithTask, describeDone, describeSceneSkip, describeUnread } from './leaderMenu.ts';
import { canLeaderSkip } from './leaderSkip.ts';
import { DocumentList } from './FoundDocuments.tsx';
import { TextView } from './TextView.tsx';
import { PaperStack, ThingScreen, listFoundPapers, listPages, listPapers } from './ThingScreen.tsx';
import { InfoBox } from './InfoBox.tsx';
import { describePlaceStatus } from './placeStatus.ts';
import { readReadNarrations, saveReadNarrations } from '../start/savedGame.ts';
import { ScreenLayout } from './ScreenLayout.tsx';

/** Allt mobilen kan be servern om under spelet. */
export type GameActions = {
  nextStep: () => void;
  markReady: () => void;
  /** Spelaren har lämnat urklippen och har läst dem. */
  markRead: (thingId: string) => void;
  setPaused: (isPaused: boolean) => void;
  choosePlace: (placeId: PlaceId) => void;
  submitAnswer: (answer: string) => void;
  touchBoard: (touch: BoardTouch) => void;
  moveInCellar: (move: CellarMove) => void;
  walk: (placeId: PlaceId) => void;
  searchRoom: () => void;
  turnClock: (minutes: number) => void;
  chooseFlashbackRoom: (placeId: PlaceId) => void;
  fadeFlashback: () => void;
  playKey: (note: string) => void;
  /** Vid byrån en ledtråd om urklippen, annars om uppgiften. */
  giveHint: (isAboutReading: boolean) => void;
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

/** Det gruppen ska läsa, som tidningsurklippen, mitt i en mening. */
function readingName(step: GameView['step']): string {
  return (step.foundTitle ?? '').toLocaleLowerCase('sv');
}

/** Ledtrådarna som gruppen har fått, först de om urklippen vid byrån. */
function HintCard({ step }: { step: GameView['step'] }) {
  if (step.hints.length === 0 && step.readingHints.length === 0) return null;
  return (
    <section className="hint-card" aria-label="Ledtrådar">
      {step.readingHints.map((hint, index) => <p key={hint}><strong>Ledtråd {index + 1} om {readingName(step)}.</strong> {hint}</p>)}
      {step.hints.map((hint, index) => <p key={hint}><strong>Ledtråd {index + 1}.</strong> {hint}</p>)}
    </section>
  );
}

/** Ledtråden som just kom, om uppgiften eller om urklippen vid byrån. */
function findNewHint(step: GameView['step'], seen: { count: number; readingCount: number }): { title: string; text: string } | null {
  if (step.readingHints.length > seen.readingCount) return { title: `Ledtråd ${step.readingHints.length} om ${readingName(step)}.`, text: step.readingHints[step.readingHints.length - 1] };
  if (step.hints.length > seen.count) return { title: `Ledtråd ${step.hints.length}.`, text: step.hints[step.hints.length - 1] };
  return null;
}

/**
 * Spelet, med inforutan ovanpå. Ger spelledaren en ledtråd visas den hos
 * alla en stund, eftersom spelarna inte har någon meny (Jonas 2026-11-18).
 */
export function GameScreen(props: GameScreenProps) {
  const { step } = props.view;
  const [info, setInfo] = useState<Info | null>(null);
  const [hintsSeen, setHintsSeen] = useState({ stepNumber: step.number, count: step.hints.length, readingCount: step.readingHints.length });
  if (hintsSeen.stepNumber !== step.number || hintsSeen.count !== step.hints.length || hintsSeen.readingCount !== step.readingHints.length) {
    const isSameStep = hintsSeen.stepNumber === step.number;
    const newHint = isSameStep ? findNewHint(step, hintsSeen) : null;
    setHintsSeen({ stepNumber: step.number, count: step.hints.length, readingCount: step.readingHints.length });
    if (newHint) setInfo((shown) => ({ id: (shown?.id ?? 0) + 1, ...newHint }));
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
  const [openThingId, setOpenThingId] = useState<string | null>(null);
  const [readNarrations, setReadNarrations] = useState(readReadNarrations);
  const { step } = view;
  const flashback = useFlashbackTime(step.flashback?.remembersUntilMs ?? null, clockOffsetMs, game.fadeFlashback);
  const isAtGoal = step.goTo !== null && view.myPlace?.id === step.goTo.id;
  const hasPlaceToGo = step.goTo !== null && !isAtGoal;
  const needsPlace = view.me.isPlaying && hasPlaceToGo && !view.isFinished;
  // Ett nytt steg börjar med ett tomt svarsfält.
  if (answeredStep !== view.step.number) {
    setAnsweredStep(view.step.number);
    setAnswer('');
    setIsMenuOpen(false);
    setHasLeftBoard(false);
    setOpenThingId(null);
  }

  // Bara spelledaren har en meny, en hamburgare i nedre högra hörnet. Spelarna har Tillbaka (Jonas 2026-11-18).
  const isLeaderMenuShown = view.me.isLeader && !view.isFinished;
  const canSkipScene = canLeaderSkip({ isLeaderPlaying: view.me.isPlaying, usesReadyButton: step.usesReadyButton && !step.isDoneByLeaving, isMeDone: step.isMeDone, progress: view.progress ?? [] });
  const skipSceneLabel = canSkipScene ? describeSceneSkip(view.progress ?? [], step.foundTitle) : null;
  function withLeaderMenu(screen: ReactNode, { stepText = null, isAtTask = false }: { stepText?: string | null; isAtTask?: boolean } = {}) {
    if (!isLeaderMenuShown) return screen;
    // Golvuret får ledtrådar också medan berättelsen väntar på urklippen (Jonas 2026-11-18).
    const isAtAwaitedTask = openThing?.opensAwaitedTask === true;
    // Byrån får ledtrådar om urklippen medan berättelsen väntar på att alla har läst (Jonas 2026-11-18).
    const isAtReading = openThing?.opensCurrentStep === true && step.readingHintCount > 0;
    return (
      <div className="has-leader-menu">
        {screen}
        <LeaderMenu
          view={view}
          isBusy={isBusy}
          stepText={stepText}
          canHelpWithTask={canHelpWithTask({ isTask: step.type !== 'scene' || isAtAwaitedTask, isAtTask: isAtTask || isAtAwaitedTask, isSolved: step.type !== 'scene' && step.usesReadyButton })}
          canHelpWithReading={isAtReading}
          skipSceneLabel={skipSceneLabel}
          onSetPaused={game.setPaused}
          onGiveHint={game.giveHint}
          onShowSolution={game.showSolution}
          onNextStep={game.nextStep}
          onAnswerPending={game.answerPending}
        />
      </div>
    );
  }
  // Väntar på att alla ska bli klara, och bara hos spelledaren hur många som är klara och vilka
  // (Jonas 2026-11-18). Står hon utanför spelet ser hon raden så länge någon kan bli klar.
  // I urklippen ser spelledaren i stället vilka som inte har läst, hela tiden (Jonas 2026-11-18).
  const countsReady = step.type === 'scene' || step.usesReadyButton;
  const showsDone = view.me.isLeader && view.progress !== null && countsReady && (step.isMeDone || !view.me.isPlaying || step.foundTitle !== null) && !view.isFinished;
  const doneText = view.progress && step.foundTitle !== null ? describeUnread(view.progress, step.foundTitle) : describeDone(view.progress ?? []);
  const doneLine = showsDone ? <span className="leader-done">{doneText}</span> : null;
  const waitingLine = step.isMeDone || doneLine ? <p className="hint">{step.isMeDone && 'Väntar på att alla ska bli klara.'}{doneLine}</p> : null;

  // Medan huset minns ser alla minnet, var de än är, och inget av det som finns i nuet (Jonas 2026-11-17).
  if (step.flashback && flashback.isRemembering && !view.isFinished) {
    return withLeaderMenu(
      <ScreenLayout className="memory-screen" actions={<p className="hint">Dörrarna är stängda tills minnet bleknar.</p>}>
        <p className="hint game-header">
          <span>{view.missionTitle} · steg {step.number} av {step.count}</span>
          {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
        </p>
        <FlashbackScreen flashback={step.flashback} isFading={flashback.isFading} msLeft={flashback.msLeft} canChoose={view.me.isPlaying} isBusy={isBusy} onChoose={game.chooseFlashbackRoom} />
        <p className="error" role="alert">{error}</p>
      </ScreenLayout>,
    );
  }

  // I huset öppnar en sak alltid en vy, och Tillbaka går till rummet (Jonas 2026-11-17).
  const { house } = view;
  const openThing = house?.things.find((thing) => thing.id === openThingId) ?? null;
  const closeThing = <button key="close" type="button" className="secondary" onClick={leaveThing}>Tillbaka</button>;
  // Överst i en sak i fullskärm: Tillbaka till vänster och klockan alltid till höger, också för
  // spelledaren. Hennes meny ligger i nedre högra hörnet (Jonas 2026-11-18).
  const screenHeader = (
    <>
      <button type="button" className="secondary seance-menu-button" onClick={leaveThing}>Tillbaka</button>
      {view.clock?.isPaused && <span className="paused">Pausat</span>}
      {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
    </>
  );
  // Berättartexter i fullskärm, som var och en visas en gång och bekräftas med en knapp (Jonas 2026-11-18).
  // Först det som hörs från ett annat rum när något kallar på gruppen, som planchetten, eller pianots
  // ensamma ton när gruppen lämnar ouijabrädet. Sedan melodin, för den som har den.
  // Källaren börjar med Veras ord och vem som går ner (Jonas 2026-11-18).
  // Alla berättartexter visas likadant, med text och knappen Ok (Jonas 2026-11-18).
  const { cellar } = step;
  const cellarText = house && cellar && cellar.outcome === null ? `${step.text}\n\n${cellar.goDownText}` : null;
  const narrations = view.isFinished ? [] : [
    { id: `${view.gameId}:${step.number}:kallar`, text: house?.callingFrom ?? null },
    { id: `${view.gameId}:${step.number}:melodi`, text: step.piano?.melodyText ?? null },
    { id: `${view.gameId}:${step.number}:kallaren`, text: cellarText },
  ];
  const narration = narrations.find(({ id, text }) => text !== null && !readNarrations.includes(id));
  const narrationHeader = (
    <>
      <span />
      {view.clock?.isPaused && <span className="paused">Pausat</span>}
      {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
    </>
  );
  const showNarration = (text: string, onOk?: () => void) => withLeaderMenu(
    <ThingScreen header={narrationHeader} actions={onOk ? <button type="button" onClick={onOk} disabled={isBusy}>Ok</button> : doneLine ?? undefined}>
      {text.split('\n\n').map((paragraph) => <p key={paragraph} className="narration-text">{paragraph}</p>)}
    </ThingScreen>,
  );
  if (narration?.text) {
    return showNarration(narration.text, () => {
      const read = [...readNarrations, narration.id];
      setReadNarrations(read);
      saveReadNarrations(read);
    });
  }
  // En scen i huset är en berättartext. Efter Ok är spelaren tillbaka i rummet och väntar på de andra
  // (Jonas 2026-11-18). Spelledaren som står utanför ser texten utan knapp.
  const isNarrationScene = house !== null && step.type === 'scene' && step.opensFrom === null && step.documents.length === 0 && step.goTo === null && step.role === null && !view.isFinished;
  if (isNarrationScene && !step.isMeDone && !openThing) {
    return showNarration(step.text, view.me.isPlaying ? markReady : undefined);
  }
  // Efteråt bokstaverar brädet av sig självt, om och om igen, som VERA (Jonas 2026-11-18).
  if (openThing && !openThing.opensCurrentStep && openThing.echo) {
    return withLeaderMenu(
      <main className="thing-screen seance-screen is-still">
        <p className="hint game-header">{screenHeader}</p>
        <EchoBoard message={openThing.echo} clockOffsetMs={clockOffsetMs} />
      </main>,
    );
  }
  // En sak vars steg gruppen inte är på visas i fullskärm, och Tillbaka går till rummet (Jonas 2026-11-18).
  if (openThing && !openThing.opensCurrentStep) {
    // Golvuret och pianot går att använda hela tiden, också innan berättelsen har kommit dit (Jonas 2026-11-18).
    const { instrument } = openThing;
    const papers = openThing.opensFound ? listFoundPapers(view.found.filter((item) => item.title === openThing.opensFound)) : listPages(openThing.pages ?? [], openThing.cover);
    return withLeaderMenu(
      <ThingScreen className={instrument?.type === 'piano' ? 'piano-screen' : undefined} header={screenHeader} actions={error ? <p className="error" role="alert">{error}</p> : undefined}>
        {instrument?.type === 'piano' && view.me.isPlaying && <PianoKeys keys={instrument.keys} onPlayKey={game.playKey} />}
        {instrument?.type === 'clock' && <GrandfatherClock dialMinutes={instrument.dialMinutes} canTurn={view.me.isPlaying && !isBusy} onTurn={game.turnClock} />}
        {papers.length > 0 && <PaperStack papers={papers} />}
        {!instrument && papers.length === 0 && openThing.text && <article className="document-card thing-paper">{openThing.text.split('\n').map((line) => <p key={line}>{line}</p>)}</article>}
        {!instrument && papers.length === 0 && !openThing.text && <p className="thing-empty">{openThing.name}</p>}
      </ThingScreen>,
    );
  }
  // Ett steg som öppnas från en sak, som seansen från ouijabrädet, syns först när spelaren har öppnat saken.
  const showsStep = step.opensFrom === null || openThing !== null || view.isFinished || !house;
  // Den som ska ner i källaren går dit genom huset, som vanligt, och statusraden säger vart (Jonas 2026-11-18).
  const isGoingDown = cellar !== null && cellar.isTrapped && cellar.catchMs === null && cellar.outcome === null && !view.isFinished;
  if ((!showsStep || isGoingDown || isNarrationScene) && house) {
    const houseActions = [];
    if (view.me.isPlaying && house.canSearch) houseActions.push(<button key="search" type="button" onClick={game.searchRoom} disabled={isBusy}>Leta i rummet</button>);
    const houseStatus = isNarrationScene ? 'Väntar på att alla ska bli klara.' : 'Gå runt i huset och leta.';
    const houseHint = <p className="hint">{isGoingDown ? cellar.goDownText : houseStatus}{doneLine}</p>;
    return withLeaderMenu(
      <ScreenLayout actions={houseActions.length > 0 ? houseActions : houseHint}>
        <p className="hint game-header">
          <span>{view.missionTitle} · steg {step.number} av {step.count}</span>
          {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
        </p>
        {view.clock?.isPaused && <p className="status paused" role="status">Spelet är pausat.</p>}
        <TextView house={house} isBusy={isBusy} onOpen={setOpenThingId} onWalk={game.walk} />
        <HintCard step={step} />
        <p className="error" role="alert">{error}</p>
      </ScreenLayout>,
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
  if (step.seance && isBoardShown) {
    return withLeaderMenu(
      <main className={step.seance.isComplete ? 'thing-screen seance-screen is-still' : 'thing-screen seance-screen'}>
        <p className="hint game-header">
          <button type="button" className="secondary seance-menu-button" onClick={leaveThing}>Tillbaka</button>
          {view.clock?.isPaused && <span className="paused">Pausat</span>}
          {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
        </p>
        <SeanceBoard seance={step.seance} answer={boardAnswer} clockOffsetMs={clockOffsetMs} canTouch={view.me.isPlaying} onTouch={game.touchBoard}  />
      </main>,
      { stepText: step.text, isAtTask: true },
    );
  }
  // Vid pianot, golvuret och urklippen fyller saken skärmen, som brädet, utan text. Texten finns i spelledarens meny (Jonas 2026-11-18).
  const thingPapers = listPapers(step.documents, step.role?.pieces ?? []);
  const isThingShown = openThing !== null && !view.isFinished && (step.piano !== null || step.flashback !== null || thingPapers.length > 0);
  if (isThingShown) {
    const canMarkReady = view.me.isPlaying && step.usesReadyButton && !step.isDoneByLeaving && !step.isMeDone;
    const readyButton = canMarkReady ? <button type="button" onClick={markReady} disabled={isBusy}>{step.readyLabel ?? 'Klar'}</button> : null;
    const melodyButton = step.piano?.hasMelody ? <MelodyButton piano={step.piano} /> : null;
    const waiting = step.usesReadyButton && !step.isDoneByLeaving ? waitingLine : null;
    const actions = (readyButton ?? melodyButton ?? waiting ?? error) ? <>{error && <p className="error" role="alert">{error}</p>}{melodyButton}{readyButton}{waiting}</> : undefined;
    return withLeaderMenu(
      <ThingScreen className={step.piano ? 'piano-screen' : undefined} header={screenHeader} actions={actions}>
        {step.piano && view.me.isPlaying && <PianoKeys keys={step.piano.myKeys} onPlayKey={game.playKey} />}
        {step.flashback && <GrandfatherClock dialMinutes={step.flashback.dialMinutes} canTurn={view.me.isPlaying && !isBusy} onTurn={game.turnClock} />}
        {thingPapers.length > 0 && <PaperStack papers={thingPapers} />}
      </ThingScreen>,
      { stepText: step.text, isAtTask: true },
    );
  }
  // I källaren ser den instängda bara mörkret och ficklampan. Resten ligger i menyn, som i seansen.
  const isCellarShown = cellar?.image !== null && cellar?.image !== undefined && cellar.outcome === null && !view.isFinished;
  const timeUpInCellar = () => game.moveInCellar({ type: 'timeUp' });
  if (cellar?.image && isCellarShown && !isMenuOpen) {
    return withLeaderMenu(
      <main className="cellar-screen">
        <p className="hint game-header">
          <button type="button" className="secondary seance-menu-button" onClick={() => setIsMenuOpen(true)}>Meny</button>
          {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
        </p>
        <CellarDark cellar={cellar} image={cellar.image} clockOffsetMs={clockOffsetMs} onOpenDoor={(yawDeg) => game.moveInCellar({ type: 'openDoor', yawDeg })} onTimeUp={timeUpInCellar} />
        <p className="error cellar-error" role="alert">{error}</p>
      </main>,
      { stepText: step.text, isAtTask: true },
    );
  }
  const isTask = step.type !== 'scene' && !view.isFinished;

  // Tillbaka går till rummet. Att lämna brädet efter meddelandet, eller urklippen efter att ha
  // läst dem, räknas som klar, så ingen Klar-knapp behövs (Jonas 2026-11-18).
  function leaveThing() {
    if (openThing?.marksRead && view.me.isPlaying) game.markRead(openThing.id);
    else if (step.isDoneByLeaving && openThing?.opensCurrentStep && view.me.isPlaying && !step.isMeDone) markReady();
    // Utan huset finns inget rum att gå till, så spelaren kommer till stegets sida.
    if (!house && step.seance?.isComplete) setHasLeftBoard(true);
    setIsMenuOpen(false);
    setOpenThingId(null);
  }

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

  // Knapparna ligger med huvudhandlingen underst, närmast tummen.
  const actions = [];
  if (openThing) actions.push(closeThing);
  // Den instängda i källaren har kvar menyn överst, eftersom hon inte kan gå tillbaka därifrån.
  const isMenuOverView = isMenuOpen && isCellarShown;
  // De andra tänder lampan i källaren. Det är deras huvudhandling medan hon letar.
  const canFlipFuse = view.me.isPlaying && cellar !== null && !cellar.isTrapped && cellar.catchMs !== null && cellar.outcome === null && cellar.fusesLeft > 0;
  if (canFlipFuse) {
    actions.push(<button key="fuse" type="button" onClick={() => game.moveInCellar({ type: 'flipFuse' })} disabled={isBusy}>Tänd lampan i källaren</button>);
  }
  if (view.me.isPlaying && !needsPlace && step.usesReadyButton && !step.isDoneByLeaving && !step.isMeDone && !view.isFinished) {
    actions.push(<button key="ready" type="button" onClick={markReady} disabled={isBusy}>{step.readyLabel ?? 'Klar'}</button>);
  }
  if (canAnswer) {
    actions.push(<button key="answer" type="submit" form={ANSWER_FORM_ID} disabled={isBusy || !answer.trim()}>Svara</button>);
  }
  // De andra ser vem som går ner i statusraden tills hon är framme (Jonas 2026-11-18).
  if (house && cellar && cellar.catchMs === null && cellar.outcome === null && !view.isFinished) {
    actions.push(<p key="going-down" className="hint">{cellar.goDownText}</p>);
  }
  if (view.isFinished) {
    actions.push(<button key="leave" type="button" onClick={game.leave}>Till startsidan</button>);
  }

  return withLeaderMenu(
    <ScreenLayout actions={actions.length > 0 ? actions : waitingLine ?? <p className="hint" />}>
      <p className="hint game-header">
        {isMenuOverView && <button type="button" className="secondary seance-menu-button" onClick={() => setIsMenuOpen(false)}>Stäng menyn</button>}
        <span>{view.missionTitle} · {view.isFinished ? 'slut' : `steg ${step.number} av ${step.count}`}</span>
        {view.clock && <Countdown clock={view.clock} clockOffsetMs={clockOffsetMs} />}
      </p>
      {view.clock?.isPaused && <p className="status paused" role="status">Spelet är pausat.</p>}
      {!(house && cellar) && <p className="scene-text">{step.text}</p>}
      <DocumentList documents={step.documents} />
      {step.role && (
        <section className="role-card" aria-label="Bara du ser det här">
          <h2>{step.role.title}</h2>
          {step.role.pieces.map((piece) => <p key={piece} className={step.documents.length > 0 ? 'clipping' : undefined}>{piece}</p>)}
        </section>
      )}
      <HintCard step={step} />
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
      {step.flashback && <GrandfatherClock dialMinutes={step.flashback.dialMinutes} canTurn={view.me.isPlaying && !isBusy} onTurn={game.turnClock} />}
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
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>,
    { stepText: null, isAtTask: isTask && (step.opensFrom === null || openThing !== null) },
  );
}
