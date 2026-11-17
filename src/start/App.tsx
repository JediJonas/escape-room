import { useCallback, useEffect, useState } from 'react';
import type { PlayerView, SeanceUpdate } from '../../supabase/functions/game/views.ts';
import { CreateGameScreen } from '../screens/CreateGameScreen.tsx';
import { getErrorMessage } from '../screens/errorMessages.ts';
import { type GameActions, GameScreen } from '../screens/GameScreen.tsx';
import { JoinGameScreen } from '../screens/JoinGameScreen.tsx';
import { LobbyScreen, type StartChoices } from '../screens/LobbyScreen.tsx';
import { WaitingScreen } from '../screens/WaitingScreen.tsx';
import { StartScreen } from '../screens/StartScreen.tsx';
import { ViewportProbe } from '../screens/ViewportProbe.tsx';
import { type GameResponse, callGame, listenToGroup, listenToPlayerView, measureClockOffsetMs } from '../sync/gameServer.ts';
import { applySeanceUpdate, keepNewerSeance } from '../sync/seanceUpdate.ts';
import { buildJoinUrl, readJoinCodeFromUrl, removeJoinCodeFromUrl } from './joinLink.ts';
import { readSavedGameId, readSavedPlayerName, saveGameId, savePlayerName } from './savedGame.ts';

type Screen =
  | { name: 'loading' }
  | { name: 'start' }
  | { name: 'create' }
  | { name: 'join'; joinCode: string }
  | { name: 'game'; view: PlayerView };

/** Hur ofta en mobil som väntar på spelledaren frågar servern. */
const WAITING_POLL_MS = 3000;
const NOT_ADMITTED_MESSAGE = 'Spelledaren släppte inte in den här mobilen.';

const SHOWS_VIEWPORT_PROBE = new URLSearchParams(location.search).has('matt');

/** Skärmen när mobilen inte är med i något spel. En kod i adressen leder till formuläret. */
function getScreenWithoutGame(): Screen {
  const joinCode = readJoinCodeFromUrl(location.href);
  return joinCode ? { name: 'join', joinCode } : { name: 'start' };
}

/** Startsidan: skapa ett spel eller gå med, väntrummet och sedan spelet. */
export function App() {
  // En kod i adressen går före ett sparat spel: den som skannar en ny QR-kod vill till det nya spelet.
  const [screen, setScreen] = useState<Screen>(() => (readSavedGameId() && !readJoinCodeFromUrl(location.href) ? { name: 'loading' } : getScreenWithoutGame()));
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const currentView = screen.name === 'game' ? screen.view : null;
  const playerId = currentView?.me.playerId ?? null;
  const gameId = currentView?.gameId ?? null;
  const isPlaying = currentView?.type === 'game';
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

  // Nedräkningen behöver serverns klocka. Mäts en gång när spelet har börjat.
  useEffect(() => {
    if (!isPlaying) return;
    measureClockOffsetMs().then((offsetMs) => {
      if (offsetMs !== null) setClockOffsetMs(offsetMs);
    });
  }, [isPlaying, gameId]);

  const showScreen = useCallback((next: Screen) => {
    setError('');
    setScreen(next);
  }, []);

  /** Visar spelet efter ett lyckat svar, eller felet. */
  const showResponse = useCallback((response: GameResponse) => {
    if (!response.ok) {
      setError(getErrorMessage(response.error));
      return;
    }
    if (!response.view) return;
    saveGameId(response.view.gameId);
    history.replaceState(null, '', removeJoinCodeFromUrl(location.href));
    showScreen({ name: 'game', view: response.view });
  }, [showScreen]);

  // Efter en omladdning hämtas spelet som mobilen var med i.
  useEffect(() => {
    const savedGameId = readSavedGameId();
    if (!savedGameId || readJoinCodeFromUrl(location.href)) return;
    callGame({ type: 'getView', gameId: savedGameId }).then((response) => {
      // Ett spel som är slut glöms, så att mobilen börjar på startsidan nästa gång.
      if (response.ok && response.view?.type === 'game' && response.view.isFinished) {
        saveGameId(null);
        showScreen(getScreenWithoutGame());
        return;
      }
      if (response.ok) {
        showResponse(response);
        return;
      }
      if (response.error === 'notInGame') saveGameId(null);
      showScreen(getScreenWithoutGame());
      if (response.error !== 'notInGame') setError(getErrorMessage(response.error));
    });
  }, [showResponse, showScreen]);

  // En mobil som väntar frågar servern med jämna mellanrum. Tar den över en
  // spelare försvinner kanalen den lyssnar på, så kanalen räcker inte.
  const isWaiting = currentView?.type === 'waiting';
  useEffect(() => {
    if (!isWaiting || !gameId) return undefined;
    const timer = setInterval(() => {
      callGame({ type: 'getView', gameId }).then((response) => {
        if (response.ok && response.view) {
          setScreen({ name: 'game', view: response.view });
        } else if (!response.ok && response.error === 'notInGame') {
          saveGameId(null);
          setScreen({ name: 'start' });
          setError(NOT_ADMITTED_MESSAGE);
        }
      });
    }, WAITING_POLL_MS);
    return () => clearInterval(timer);
  }, [isWaiting, gameId]);

  /** Visar en ny vy, men behåller seansens läge om gruppens kanal redan har gett ett nyare. */
  const showGameView = useCallback((view: PlayerView) => {
    setScreen((previous) => ({ name: 'game', view: keepNewerSeance(previous.name === 'game' ? previous.view : null, view) }));
  }, []);

  // Nya vyer kommer i spelarens kanal och seansens läge i gruppens kanal. När
  // kanalen öppnas och när mobilen vaknar hämtas vyn, ifall något har missats under tiden.
  useEffect(() => {
    if (!playerId || !gameId) return;
    const refresh = () => {
      callGame({ type: 'getView', gameId }).then((response) => {
        if (response.ok && response.view) showGameView(response.view);
      });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const stops: (() => void)[] = [];
    let isCurrent = true;
    const keep = (stop: () => void) => {
      if (isCurrent) stops.push(stop);
      else stop();
    };
    const showError = () => setError(getErrorMessage('network'));
    listenToPlayerView({ playerId, onView: showGameView, onListening: refresh }).then(keep).catch(showError);
    const onSeance = (update: SeanceUpdate) => setScreen((previous) => (previous.name === 'game' ? { name: 'game', view: applySeanceUpdate(previous.view, update) } : previous));
    listenToGroup({ gameId, onSeance }).then(keep).catch(showError);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      isCurrent = false;
      for (const stop of stops) stop();
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [playerId, gameId, showGameView]);

  async function send(action: { type: string } & Record<string, unknown>) {
    setIsBusy(true);
    setError('');
    const response = await callGame(action);
    setIsBusy(false);
    return response;
  }

  async function createGame(name: string) {
    savePlayerName(name.trim());
    showResponse(await send({ type: 'createGame', name }));
  }

  async function joinGame(joinCode: string, name: string) {
    savePlayerName(name.trim());
    showResponse(await send({ type: 'joinGame', joinCode, name }));
  }

  async function leaveGame() {
    if (!gameId) return;
    const response = await send({ type: 'leaveGame', gameId });
    if (!response.ok) {
      setError(getErrorMessage(response.error));
      return;
    }
    saveGameId(null);
    showScreen({ name: 'start' });
  }

  /** Skickar en handling i spelet och visar den nya vyn, eller felet. */
  async function sendInGame(action: { type: string } & Record<string, unknown>) {
    if (!gameId) return;
    const response = await send({ ...action, gameId });
    if (!response.ok) {
      setError(getErrorMessage(response.error));
      return;
    }
    // Ett gammalt fel, som ett fel svar, ska inte stå kvar efter ett lyckat anrop.
    setError('');
    if (response.view) showGameView(response.view);
  }

  const startGame = (choices: StartChoices) => sendInGame({ type: 'startGame', ...choices });
  const gameActions: GameActions = {
    nextStep: () => sendInGame({ type: 'nextStep' }),
    markReady: () => sendInGame({ type: 'markReady' }),
    setPaused: (isPaused) => sendInGame({ type: 'setPaused', isPaused }),
    choosePlace: (placeId, source) => sendInGame({ type: 'choosePlace', placeId, source }),
    submitAnswer: (answer) => sendInGame({ type: 'submitAnswer', answer }),
    // Planchetten skickas utan att knapparna blir upptagna, och svaret används inte:
    // vyn kommer i kanalen, i rätt ordning, även när flera anrop är på väg samtidigt.
    touchBoard: (touch) => {
      if (gameId) void callGame({ type: 'touchBoard', gameId, touch });
    },
    chooseGuest: (guest) => sendInGame({ type: 'chooseGuest', guest }),
    moveInCellar: (move) => sendInGame({ type: 'moveInCellar', move }),
    walk: (placeId) => sendInGame({ type: 'walk', placeId }),
    searchRoom: () => sendInGame({ type: 'searchRoom' }),
    giveHint: () => sendInGame({ type: 'giveHint' }),
    showSolution: () => sendInGame({ type: 'showSolution' }),
    answerPending: (playerId, isAdmitted) => sendInGame({ type: isAdmitted ? 'admitPlayer' : 'rejectPlayer', playerId }),
    leave: () => {
      saveGameId(null);
      showScreen({ name: 'start' });
    },
  };

  const goToStart = () => showScreen({ name: 'start' });

  return (
    <>
      {screen.name === 'loading' && <main className="screen"><p>Hämtar spelet …</p></main>}
      {screen.name === 'start' && (
        <StartScreen error={error} onJoin={() => showScreen({ name: 'join', joinCode: '' })} onCreate={() => showScreen({ name: 'create' })} />
      )}
      {screen.name === 'create' && (
        <CreateGameScreen initialName={readSavedPlayerName()} isBusy={isBusy} error={error} onCreate={createGame} onBack={goToStart} />
      )}
      {screen.name === 'join' && (
        <JoinGameScreen initialCode={screen.joinCode} initialName={readSavedPlayerName()} isBusy={isBusy} error={error} onJoin={joinGame} onBack={goToStart} />
      )}
      {screen.name === 'game' && screen.view.type === 'lobby' && (
        <LobbyScreen view={screen.view} joinUrl={buildJoinUrl(location.href, screen.view.joinCode)} isBusy={isBusy} error={error} onLeave={leaveGame} onStart={startGame} />
      )}
      {screen.name === 'game' && screen.view.type === 'waiting' && (
        <WaitingScreen view={screen.view} error={error} onLeave={gameActions.leave} />
      )}
      {screen.name === 'game' && screen.view.type === 'game' && (
        <GameScreen view={screen.view} clockOffsetMs={clockOffsetMs} isBusy={isBusy} error={error} actions={gameActions} />
      )}
      {SHOWS_VIEWPORT_PROBE && <ViewportProbe />}
    </>
  );
}
