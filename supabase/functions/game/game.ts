/**
 * Spelet efter väntrummet: att starta, gå vidare i uppdraget och vara på en
 * plats. Rena funktioner som tar ett tillstånd och ger ett nytt, se
 * docs/motorn.md.
 */

import { type ClockView, describeClock, pauseClock, resumeClock, shortenClock, startClock } from './clock.ts';
import { type CellarStep, type Mission, type FlashbackStep, type MissionDocument, type MissionStep, type Permission, type Place, type Role, type TaskStep, describeSolution, listPlaces } from './mission.ts';
import { describeViewer, sortByJoinOrder } from './lobby.ts';
import type { PlaceId } from './places.ts';
import { describePending, listParticipants } from './participants.ts';
import { dealRoles, sortByLastTurn } from './roles.ts';
import { type PianoRefusal, type PianoView, describePiano, startPiano } from './piano.ts';
import { type CellarView, describeCellar, markArrived, startCellar } from './cellar.ts';
import { type FlashbackRefusal, type FlashbackView, describeFlashback, startFlashback } from './flashback.ts';
import { type SeanceView, describeSeance, isSeanceComplete, startSeance } from './seance.ts';
import { type FoundItem, describeFound, hasRead, keepFound } from './found.ts';
import { type HouseView, describeHouse, findOpener, placeInHouse } from './house.ts';
import type { GameRecord, GameState, PlayerRecord } from './state.ts';

export type GameRefusal = 'notLeader' | 'gameStarted' | 'tooFewPlayers' | 'notRunning' | 'unknownPlace' | 'notAtPlace' | 'notATask' | 'wrongAnswer' | 'noMoreHints' | 'notTrapped' | 'noMoreFuses' | 'noDoor' | 'locked' | FlashbackRefusal | PianoRefusal;

export type StateChange = { state: GameState } | { refusal: GameRefusal };

/** Gruppen kommer till ett steg: rollerna delas ut på nytt, eller tas bort om steget saknar roller. */
function enterStep(state: GameState, mission: Mission, players: readonly PlayerRecord[], stepIndex: number): GameState {
  const step = mission.steps[stepIndex];
  const cleared = {
    ...state,
    stepIndex,
    readyPlayerIds: [],
    wrongAnswers: 0,
    hintsGiven: 0,
    readingHintsGiven: 0,
    isSolutionShown: false,
    seance: step.type === 'seance' ? startSeance() : null,
    // Golvuret och pianot går att använda hela tiden, så deras läge följer med mellan stegen (Jonas 2026-11-18).
    flashback: state.flashback ?? (step.type === 'flashback' ? startFlashback(step) : null),
    cellar: step.type === 'cellar' ? startCellar() : null,
  };
  // Lika fall om stora roller lottas, olika i varje spel och steg (Jonas 2026-11-18).
  const lotSeed = `${state.clock?.startedAtMs ?? 0}:${step.id}`;
  // Den vars mobil spelar melodin har en framträdande roll, så den roterar som de andra.
  if (step.type === 'piano') {
    const [melodyPlayer] = sortByLastTurn(sortByJoinOrder(players), state.prominentHistory, lotSeed);
    const prominentHistory = melodyPlayer ? [...state.prominentHistory, melodyPlayer.id] : state.prominentHistory;
    const piano = { ...(state.piano ?? startPiano(null)), melodyPlayerId: melodyPlayer?.id ?? null };
    return { ...cleared, roleByPlayer: {}, prominentHistory, piano };
  }
  const { roles } = step;
  if (!roles) return { ...cleared, roleByPlayer: {} };
  // Urklippen delades ut när spelet startade, så att de går att läsa direkt (Jonas 2026-11-18).
  const dealtAtStart = state.found[step.id];
  if (dealtAtStart && players.every((player) => dealtAtStart[player.id] !== undefined)) return { ...cleared, roleByPlayer: dealtAtStart };
  const deal = dealRoles({ roles, players: sortByJoinOrder(players), prominentHistory: state.prominentHistory, lotSeed });
  return { ...cleared, roleByPlayer: deal.roleByPlayer, prominentHistory: deal.prominentHistory };
}

function finish(state: GameState): GameState {
  return { ...state, status: 'finished', roleByPlayer: {}, readyPlayerIds: [], seance: null, flashback: null, cellar: null, piano: null };
}

/**
 * Nästa steg, eller slut efter det sista. Är sista steget en scen är den
 * slutet: spelet tar slut när gruppen kommer dit, så att ingen behöver
 * trycka Klar på sluttexten.
 */
export function moveOn(state: GameState, mission: Mission, players: readonly PlayerRecord[]): GameState {
  return jumpTo(state, mission, players, state.stepIndex + 1);
}

/**
 * Går till ett senare steg. En uppgift som gruppen redan har klarat, som
 * melodin på pianot innan berättelsen kom dit, går gruppen förbi
 * (Jonas 2026-11-18).
 */
function jumpTo(state: GameState, mission: Mission, players: readonly PlayerRecord[], firstIndex: number): GameState {
  const kept = { ...state, found: keepFound(state.found, mission.steps[state.stepIndex], state.roleByPlayer) };
  let nextIndex = firstIndex;
  while (nextIndex < mission.steps.length && state.solvedSteps.includes(mission.steps[nextIndex].id)) nextIndex += 1;
  if (nextIndex >= mission.steps.length) return finish(kept);
  const entered = enterStep(kept, mission, players, nextIndex);
  const isEnding = nextIndex === mission.steps.length - 1 && mission.steps[nextIndex].type === 'scene';
  if (isEnding) return finish(entered);
  return isDoneOnArrival(entered, mission, players) ? jumpTo(entered, mission, players, nextIndex + 1) : entered;
}

/**
 * En scen som väntar på en uppgift, som urklippen, kan vara klar redan när
 * gruppen kommer dit: alla har läst och golvuret är ställt. Då går gruppen
 * förbi den direkt, eftersom ingen annars gör något som för den vidare.
 */
function isDoneOnArrival(state: GameState, mission: Mission, players: readonly PlayerRecord[]): boolean {
  const step = mission.steps[state.stepIndex];
  if (step.type !== 'scene' || step.endsWithStep === undefined) return false;
  return players.length > 0 && !isWaitingForTask(step, state) && players.every((player) => isPlayerDone(step, state, player.id));
}

export function findRole(step: MissionStep, state: GameState, playerId: string): Role | undefined {
  const roleId = state.roleByPlayer[playerId]?.roleId;
  return step.roles?.find((role) => role.id === roleId);
}

/**
 * Platsen som spelaren ska till i steget. En roll kan ha en egen plats, så
 * att gruppen delar på sig. Annars gäller stegets plats, om det har någon.
 */
export function findGoal(step: MissionStep, state: GameState, playerId: string): PlaceId | undefined {
  return findRole(step, state, playerId)?.goTo ?? step.goTo;
}

export function isAtGoal(step: MissionStep, state: GameState, playerId: string): boolean {
  const goal = findGoal(step, state, playerId);
  return goal !== undefined && state.placeByPlayer[playerId] === goal;
}

/**
 * En scen som bara skickar spelarna till en plats är klar när spelaren är
 * framme. Finns något att läsa där trycker spelaren Klar när hon har läst och
 * gjort sitt (Jonas 2026-11-17).
 */
function isDoneWhenArrived(step: MissionStep): boolean {
  const hasRolesWithOwnPlace = step.roles?.some((role) => role.goTo !== undefined) ?? false;
  return step.goTo !== undefined && step.textAtPlace === undefined && !hasRolesWithOwnPlace;
}

function isSeanceDone(step: MissionStep, state: GameState): boolean {
  return step.type === 'seance' && state.seance !== null && isSeanceComplete(state.seance, step.solution.message);
}

/**
 * Om gruppen kan skriva ett svar nu. En seans med svar i facit tar emot svar
 * när meddelandet är klart, och frågan står kvar tills gruppen vet
 * (Jonas 2026-11-17).
 */
function acceptsAnswer(step: MissionStep, state: GameState): boolean {
  return step.type === 'answer' || (step.type === 'seance' && step.solution.answers !== undefined && isSeanceDone(step, state));
}

/**
 * En scen utan plats att gå till, eller med text på platsen, klaras med Klar.
 * En seans också, när meddelandet är klart, så att gruppen hinner prata om
 * det innan skärmen byts. En uppgift med svar klaras genom att lösas.
 */
function usesReadyButton(step: MissionStep, state: GameState): boolean {
  if (step.type === 'seance') return step.solution.answers === undefined && isSeanceDone(step, state);
  if (step.type === 'cellar') return state.cellar !== null && state.cellar.outcome !== null;
  return step.type === 'scene' && !isDoneWhenArrived(step);
}

/**
 * Spelaren blir klar av att lämna saken med Tillbaka, utan någon Klar-knapp:
 * brädet när meddelandet är klart, och urklippen när hon har läst dem
 * (Jonas 2026-11-18). Urklippen räknas med `markRead` i reading.ts.
 */
function isDoneByLeaving(step: MissionStep, state: GameState): boolean {
  if (step.type === 'seance') return usesReadyButton(step, state);
  return step.type === 'scene' && step.endsWithStep !== undefined;
}

/**
 * En scen som slutar med nästa uppgift, som urklippen, går vidare när alla
 * har läst och gruppen har klarat uppgiften, i vilken ordning som helst
 * (Jonas 2026-11-18). Brädet frågar alltså VEM ÄR JAG först när gruppen har
 * sett Rummen minns och alla har läst urklippen.
 */
function isWaitingForTask(step: MissionStep, state: GameState): boolean {
  return step.type === 'scene' && step.endsWithStep !== undefined && !state.solvedSteps.includes(step.endsWithStep);
}

function isPlayerDone(step: MissionStep, state: GameState, playerId: string): boolean {
  // Urklippen går att läsa när som helst. Den som har lämnat dem med Tillbaka har läst (Jonas 2026-11-18).
  if (step.type === 'scene' && step.endsWithStep !== undefined) return step.foundTitle === undefined || hasRead(state.foundReaders, step.id, playerId);
  // Rummen minns och pianot är klara för alla samtidigt. Se taskActions.ts.
  if (step.type === 'flashback' || step.type === 'piano') return false;
  if (step.type === 'scene' && isDoneWhenArrived(step)) return isAtGoal(step, state, playerId);
  return usesReadyButton(step, state) && state.readyPlayerIds.includes(playerId);
}

/** Går vidare när alla är klara, så att ingen behöver vänta på spelledaren. */
export function moveOnIfAllDone(state: GameState, mission: Mission, players: readonly PlayerRecord[]): GameState {
  const step = mission.steps[state.stepIndex];
  const isAllDone = state.status === 'running' && players.length > 0 && !isWaitingForTask(step, state) && players.every((player) => isPlayerDone(step, state, player.id));
  return isAllDone ? moveOn(state, mission, players) : state;
}

export function startGame({ state, mission, players, starter, leaderPlays, minutes, nowMs }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  starter: PlayerRecord;
  /** Spelledaren spelar med som standard och kan välja att stå utanför. */
  leaderPlays: boolean;
  minutes: number;
  nowMs: number;
}): StateChange {
  if (!starter.isLeader) return { refusal: 'notLeader' };
  if (state.status !== 'lobby') return { refusal: 'gameStarted' };
  const started: GameState = { ...state, status: 'running', leaderPlays, clock: startClock(minutes, nowMs) };
  const participants = listParticipants(started, players);
  if (participants.length < mission.minPlayers) return { refusal: 'tooFewPlayers' };
  const placed = mission.house ? placeInHouse(started, mission.house, participants.map((player) => player.id)) : started;
  return { state: enterStep(dealFoundAtStart(placed, mission, participants), mission, participants, 0) };
}

/**
 * Det som går att läsa igen, som urklippen i byrån, delas ut redan när spelet
 * startar, så att det går att läsa direkt (Jonas 2026-11-18). Saker går
 * alltid att undersöka. Det som inte ska nås för tidigt låses i stället.
 */
function dealFoundAtStart(state: GameState, mission: Mission, players: readonly PlayerRecord[]): GameState {
  if (!mission.house) return state;
  const found = { ...state.found };
  for (const step of mission.steps) {
    if (step.type !== 'scene' || step.foundTitle === undefined || !step.roles) continue;
    const lotSeed = `${state.clock?.startedAtMs ?? 0}:${step.id}`;
    found[step.id] = dealRoles({ roles: step.roles, players: sortByJoinOrder(players), prominentHistory: state.prominentHistory, lotSeed }).roleByPlayer;
  }
  return { ...state, found };
}

/**
 * Spelledaren går vidare utan att vänta på alla, till exempel när någon har
 * gått iväg. I urklippen gör `skipReading` i reading.ts det i två steg.
 */
export function advanceStep({ state, mission, players, player }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
}): StateChange {
  if (!player.isLeader) return { refusal: 'notLeader' };
  if (state.status !== 'running') return { refusal: 'notRunning' };
  return { state: moveOn(state, mission, players) };
}

/** Spelaren har läst och gjort sitt i steget. Den sista som blir klar för gruppen vidare. */
export function markReady({ state, mission, players, player }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
}): StateChange {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const step = mission.steps[state.stepIndex];
  if (!usesReadyButton(step, state)) return { state };
  if (findGoal(step, state, player.id) !== undefined && !isAtGoal(step, state, player.id)) return { refusal: 'notAtPlace' };
  if (state.readyPlayerIds.includes(player.id)) return { state };
  return { state: moveOnIfAllDone({ ...state, readyPlayerIds: [...state.readyPlayerIds, player.id] }, mission, players) };
}

/**
 * Spelaren är på en plats när hon har valt den i listan eller gått dit i
 * huset. Kommer den instängda fram till källaren börjar det komma närmare.
 */
export function choosePlace({ state, mission, players, player, placeId, nowMs }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
  placeId: unknown;
  nowMs: number;
}): StateChange {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const place = listPlaces(mission).find((candidate) => candidate.id === placeId);
  if (!place) return { refusal: 'unknownPlace' };
  const moved = { ...state, placeByPlayer: { ...state.placeByPlayer, [player.id]: place.id } };
  return { state: moveOnIfAllDone(markTrappedArrival(moved, mission, player.id, nowMs), mission, players) };
}

/** Kommer den instängda fram till källaren, i listan eller genom dörren i huset, börjar det komma närmare. */
export function markTrappedArrival(state: GameState, mission: Mission, playerId: string, nowMs: number): GameState {
  const step = mission.steps[state.stepIndex];
  const isTrappedArriving = step.type === 'cellar' && state.cellar !== null && findRole(step, state, playerId)?.id === step.trappedRoleId && isAtGoal(step, state, playerId);
  return isTrappedArriving && state.cellar ? { ...state, cellar: markArrived(state.cellar, nowMs) } : state;
}

/** Stora och små bokstäver och extra mellanslag spelar ingen roll i ett svar. */
export function normalizeAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv');
}

/** Den aktuella uppgiften, eller ett nej om gruppen är i en scen eller spelet inte är igång. */
export function findCurrentTask(state: GameState, mission: Mission): { step: TaskStep } | { refusal: GameRefusal } {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const step = mission.steps[state.stepIndex];
  return step.type === 'scene' ? { refusal: 'notATask' } : { step };
}

/**
 * Vem som helst i gruppen kan svara. Ett rätt svar för alla vidare. Kostar
 * ett fel svar tid räknas det, så att alla ser det, och dras från
 * nedräkningen. Annars får bara den som svarade veta att det var fel.
 */
export function submitAnswer({ state, mission, players, answer }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  answer: unknown;
}): StateChange {
  const task = findCurrentTask(state, mission);
  if ('refusal' in task) return { refusal: task.refusal };
  const { step } = task;
  if (!acceptsAnswer(step, state)) return { refusal: 'notATask' };
  const answers = step.type === 'answer' || step.type === 'seance' ? step.solution.answers ?? [] : [];
  const given = typeof answer === 'string' ? normalizeAnswer(answer) : '';
  if (given === '') return { refusal: 'wrongAnswer' };
  if (answers.some((correct) => normalizeAnswer(correct) === given)) return { state: moveOn(state, mission, players) };
  const minutes = step.type === 'seance' ? step.wrongAnswerMinutes : undefined;
  if (minutes === undefined) return { refusal: 'wrongAnswer' };
  const clock = state.clock ? shortenClock(state.clock, nextWrongAnswerCost(minutes, state.wrongAnswers)) : null;
  return { state: { ...state, clock, wrongAnswers: state.wrongAnswers + 1 } };
}

/**
 * Vad nästa fel svar kostar. Varje fel kostar lika mycket mer än det förra,
 * 2, 4, 6 och 8 minuter, så att det inte lönar sig att gissa (Jonas 2026-11-18).
 */
export function nextWrongAnswerCost(minutes: number, wrongAnswers: number): number {
  return minutes * (wrongAnswers + 1);
}

/**
 * Uppgiften som spelledaren kan ge ledtråd och facit i: den aktuella, eller
 * den som scenen väntar på, som golvuret medan berättelsen väntar på
 * urklippen (Jonas 2026-11-18).
 */
export function findHelpTask(state: GameState, mission: Mission): { step: TaskStep } | { refusal: GameRefusal } {
  const task = findCurrentTask(state, mission);
  if (!('refusal' in task) || task.refusal !== 'notATask') return task;
  const awaited = findAwaitedTask(mission.steps[state.stepIndex], state, mission);
  return awaited ? { step: awaited } : task;
}

/** Uppgiften som scenen väntar på, om gruppen inte har klarat den än. */
function findAwaitedTask(step: MissionStep, state: GameState, mission: Mission): TaskStep | null {
  if (!isWaitingForTask(step, state) || step.type !== 'scene') return null;
  const awaited = mission.steps.find((candidate) => candidate.id === step.endsWithStep);
  return awaited && awaited.type !== 'scene' ? awaited : null;
}

/** Spelledaren ger gruppen nästa ledtråd. Alla får den samtidigt. */
export function giveHint({ state, mission, player }: { state: GameState; mission: Mission; player: PlayerRecord }): StateChange {
  if (!player.isLeader) return { refusal: 'notLeader' };
  const task = findHelpTask(state, mission);
  if ('refusal' in task) return { refusal: task.refusal };
  if (state.hintsGiven >= task.step.hints.length) return { refusal: 'noMoreHints' };
  return { state: { ...state, hintsGiven: state.hintsGiven + 1 } };
}

/** Facit visas bara hos spelledaren, och bara när hon ber om det. */
export function showSolution({ state, mission, player }: { state: GameState; mission: Mission; player: PlayerRecord }): StateChange {
  if (!player.isLeader) return { refusal: 'notLeader' };
  const task = findHelpTask(state, mission);
  if ('refusal' in task) return { refusal: task.refusal };
  return { state: { ...state, isSolutionShown: true } };
}

/** Pausar eller fortsätter nedräkningen. Bara spelledaren får göra det. */
export function setPaused({ state, player, isPaused, nowMs }: {
  state: GameState;
  player: PlayerRecord;
  isPaused: boolean;
  nowMs: number;
}): StateChange {
  if (!player.isLeader) return { refusal: 'notLeader' };
  if (state.status !== 'running' || !state.clock) return { refusal: 'notRunning' };
  const clock = isPaused ? pauseClock(state.clock, nowMs) : resumeClock(state.clock, nowMs);
  return { state: { ...state, clock } };
}

/**
 * Det en spelare ser under spelet. Texten på en plats finns bara med hos den
 * som är där.
 */
export type GameView = {
  type: 'game';
  gameId: string;
  missionTitle: string;
  /** isPlaying är falskt för spelledaren som står utanför. Hon får ingen roll. */
  me: { playerId: string; name: string; isLeader: boolean; isPlaying: boolean };
  isFinished: boolean;
  step: {
    number: number;
    count: number;
    text: string;
    goTo: Place | null;
    textAtPlace: string | null;
    /** Tillstånden som mobilen ber om när spelaren trycker Klar. */
    asksFor: Permission[];
    /** Det som alla ser i steget, till exempel en artikel. */
    documents: MissionDocument[];
    /** Spelarens roll i steget och bara hennes egna bitar. */
    role: { title: string; pieces: string[] } | null;
    type: MissionStep['type'];
    /** Saken i huset som öppnar steget, till exempel ouijabrädet. Annars visas steget direkt. */
    opensFrom: string | null;
    /** Om spelaren trycker Klar i steget, eller blir klar av att komma fram. */
    usesReadyButton: boolean;
    /** Spelaren blir klar av att gå därifrån med Tillbaka, och ser ingen Klar-knapp. */
    isDoneByLeaving: boolean;
    /** Texten på knappen, om scenen har en egen. Annars står det Klar. */
    readyLabel: string | null;
    /** Det alla ska ha läst innan berättelsen går vidare, som Tidningsurklippen. */
    foundTitle: string | null;
    /** Om gruppen kan skriva ett svar nu, och frågan ovanför fältet när steget har en. */
    acceptsAnswer: boolean;
    question: string | null;
    /** Fel svar hittills i uppgiften, och vad varje fel kostar, när fel svar kostar tid. */
    wrongAnswers: { count: number; nextMinutes: number } | null;
    isMeDone: boolean;
    /** Ledtrådarna som gruppen har fått, och hur många uppgiften har. */
    hints: string[];
    hintCount: number;
    /** Ledtrådarna om urklippen som gruppen har fått vid byrån, och hur många det finns. */
    readingHints: string[];
    readingHintCount: number;
    /** Bara hos spelledaren och bara när hon har bett om det. */
    solution: string | null;
    /** Brädet i en seans, med bokstaven bara hos den som ska läsa den. */
    seance: SeanceView | null;
    /** Golvuret och minnet i Rummen minns, med bitarna bara i det rum spelaren har valt. */
    flashback: FlashbackView | null;
    /** Källaren, med bilden bara hos den instängda. */
    cellar: CellarView | null;
    /** Pianot, med melodin bara hos den vars mobil spelar den och tangenterna bara hos den som har dem. */
    piano: PianoView | null;
  };
  /** Det gruppen har hittat och kan läsa igen, med bara spelarens egna bitar. */
  found: FoundItem[];
  /** Rummet där spelaren är, med dörrarna och det som har hittats där. Bara i uppdrag med ett hus. */
  house: HouseView | null;
  /** Bara hos spelledaren: vilka som är klara med steget. */
  progress: { name: string; isMe: boolean; isDone: boolean }[] | null;
  /** Bara hos spelledaren: mobiler som väntar på att få vara med eller ta över en spelare. */
  pending: { playerId: string; name: string; takesOver: string | null }[] | null;
  clock: ClockView | null;
  myPlace: Place | null;
  places: Place[];
  /** Antal spelare, så att spelledaren ser att alla är kvar. */
  playerCount: number;
};

function findPlace(places: readonly Place[], placeId: PlaceId | undefined): Place | null {
  return places.find((place) => place.id === placeId) ?? null;
}

/** Spelarens roll och bitar. En roll med egen plats visar bitarna först när spelaren är där. */
function describeRole(step: MissionStep, state: GameState, viewerId: string) {
  const role = findRole(step, state, viewerId);
  const assignment = state.roleByPlayer[viewerId];
  if (!role || !assignment) return null;
  const isHidden = role.goTo !== undefined && !isAtGoal(step, state, viewerId);
  const pieces = isHidden ? [] : assignment.pieceIndexes.map((index) => role.pieces[index]).filter((piece) => piece !== undefined);
  return { title: role.title, pieces };
}

function describeStep(step: MissionStep, state: GameState, places: readonly Place[], viewerId: string) {
  const goal = findGoal(step, state, viewerId);
  const isAtStepPlace = goal === step.goTo && isAtGoal(step, state, viewerId);
  return {
    text: step.text,
    asksFor: step.type === 'scene' ? step.asksFor ?? [] : [],
    documents: step.type === 'scene' ? step.documents ?? [] : [],
    goTo: findPlace(places, goal),
    textAtPlace: isAtStepPlace ? step.textAtPlace ?? null : null,
    role: describeRole(step, state, viewerId),
  };
}

function describeCellarFor(step: CellarStep, state: GameState, players: readonly PlayerRecord[], viewerId: string): CellarView | null {
  if (!state.cellar) return null;
  const trappedId = Object.keys(state.roleByPlayer).find((playerId) => state.roleByPlayer[playerId].roleId === step.trappedRoleId);
  const trappedName = players.find((player) => player.id === trappedId)?.name ?? '';
  const isTrapped = trappedId === viewerId;
  return describeCellar({ cellar: state.cellar, step, isTrapped, isTrappedHere: isTrapped && isAtGoal(step, state, viewerId), trappedName });
}

/**
 * Golvuret och minnet i Rummen minns. Golvuret går att vrida hela tiden, så
 * minnet syns också när huset minns innan berättelsen har kommit dit
 * (Jonas 2026-11-18).
 */
function describeFlashbackFor({ mission, step, state, places, viewerId, participantIds }: {
  mission: Mission;
  step: MissionStep;
  state: GameState;
  places: readonly Place[];
  viewerId: string;
  participantIds: readonly string[];
}): FlashbackView | null {
  const flashbackStep = mission.steps.find((candidate): candidate is FlashbackStep => candidate.type === 'flashback');
  const isShown = step.type === 'flashback' || state.flashback?.remembersUntilMs !== null;
  if (state.status !== 'running' || !state.flashback || !flashbackStep || !isShown) return null;
  return describeFlashback({ flashback: state.flashback, step: flashbackStep, places, viewerId, participantIds });
}

export function buildGameView({ game, mission, players, viewer }: {
  game: GameRecord;
  mission: Mission;
  players: readonly PlayerRecord[];
  viewer: PlayerRecord;
}): GameView {
  const places = listPlaces(mission);
  const { state } = game;
  const myPlace = findPlace(places, state.placeByPlayer[viewer.id]);
  const stepIndex = Math.min(state.stepIndex, mission.steps.length - 1);
  const step = mission.steps[stepIndex];
  const isRunning = state.status === 'running';
  const participants = listParticipants(state, players);
  const showsLeaderTools = viewer.isLeader && isRunning;
  // Ledtrådarna hör till golvuret också medan berättelsen väntar på urklippen.
  const helpStep = findAwaitedTask(step, state, mission) ?? step;
  return {
    type: 'game',
    gameId: game.id,
    missionTitle: mission.title,
    me: { ...describeViewer(viewer), isPlaying: participants.some((player) => player.id === viewer.id) },
    isFinished: state.status === 'finished',
    step: {
      number: stepIndex + 1,
      count: mission.steps.length,
      ...describeStep(step, state, places, viewer.id),
      type: step.type,
      opensFrom: findOpener(mission.house, step.id),
      usesReadyButton: usesReadyButton(step, state),
      isDoneByLeaving: isDoneByLeaving(step, state),
      readyLabel: step.type === 'scene' ? step.readyLabel ?? null : null,
      foundTitle: step.type === 'scene' && step.endsWithStep !== undefined ? step.foundTitle ?? null : null,
      acceptsAnswer: isRunning && acceptsAnswer(step, state),
      question: step.type === 'seance' && isSeanceDone(step, state) ? step.question ?? null : null,
      wrongAnswers: step.type === 'seance' && step.wrongAnswerMinutes !== undefined ? { count: state.wrongAnswers, nextMinutes: nextWrongAnswerCost(step.wrongAnswerMinutes, state.wrongAnswers) } : null,
      isMeDone: isPlayerDone(step, state, viewer.id),
      hints: helpStep.hints?.slice(0, state.hintsGiven) ?? [],
      hintCount: helpStep.hints?.length ?? 0,
      readingHints: step.type === 'scene' ? step.readingHints?.slice(0, state.readingHintsGiven) ?? [] : [],
      readingHintCount: step.type === 'scene' ? step.readingHints?.length ?? 0 : 0,
      solution: viewer.isLeader && state.isSolutionShown && helpStep.type !== 'scene' ? describeSolution(helpStep, places) : null,
      seance: step.type === 'seance' && state.seance && isRunning
        ? describeSeance({ seance: state.seance, message: step.solution.message, players, participantIds: participants.map((player) => player.id), viewerId: viewer.id })
        : null,
      flashback: describeFlashbackFor({ mission, step, state, places, viewerId: viewer.id, participantIds: participants.map((player) => player.id) }),
      cellar: step.type === 'cellar' && state.cellar && isRunning ? describeCellarFor(step, state, players, viewer.id) : null,
      piano: step.type === 'piano' && state.piano && isRunning
        ? describePiano({
          piano: state.piano,
          step,
          viewerId: viewer.id,
          participantIds: sortByJoinOrder(participants).map((player) => player.id),
          melodyPlayerName: players.find((player) => player.id === state.piano?.melodyPlayerId)?.name ?? '',
        })
        : null,
    },
    progress: showsLeaderTools
      ? sortByJoinOrder(participants).map((player) => ({ name: player.name, isMe: player.id === viewer.id, isDone: isPlayerDone(step, state, player.id) }))
      : null,
    found: describeFound(mission, state.found, viewer.id),
    house: mission.house && isRunning ? describeHouse({ state, mission, house: mission.house, places, viewerId: viewer.id, participantIds: sortByJoinOrder(participants).map((player) => player.id) }) : null,
    pending: showsLeaderTools ? describePending(state, players) : null,
    clock: isRunning && state.clock ? describeClock(state.clock) : null,
    myPlace,
    places,
    playerCount: participants.length,
  };
}
