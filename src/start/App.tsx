import { useCallback, useEffect, useState } from 'react';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import type { PlayerView } from '../../supabase/functions/game/views.ts';
import { CreateGameScreen } from '../screens/CreateGameScreen.tsx';
import { getErrorMessage } from '../screens/errorMessages.ts';
import { GameScreen } from '../screens/GameScreen.tsx';
import { JoinGameScreen } from '../screens/JoinGameScreen.tsx';
import { LobbyScreen } from '../screens/LobbyScreen.tsx';
import { StartScreen } from '../screens/StartScreen.tsx';
import { ViewportProbe } from '../screens/ViewportProbe.tsx';
import { type GameResponse, callGame, listenToPlayerView, measureClockOffsetMs } from '../sync/gameServer.ts';
import { buildJoinUrl, readJoinCodeFromUrl, removeJoinCodeFromUrl } from './joinLink.ts';
import { readSavedGameId, readSavedPlayerName, saveGameId, savePlayerName } from './savedGame.ts';

type Screen =
  | { name: 'loading' }
  | { name: 'start' }
  | { name: 'create' }
  | { name: 'join'; joinCode: string }
  | { name: 'game'; view: PlayerView };

const SHOWS_VIEWPORT_PROBE = new URLSearchParams(location.search).has('matt');

/** Skärmen när mobilen inte är med i något spel. En kod i adressen leder till formuläret. */
function getScreenWithoutGame(): Screen {
  const joinCode = readJoinCodeFromUrl(location.href);
  return joinCode ? { name: 'join', joinCode } : { name: 'start' };
}

/** Startsidan: skapa ett spel eller gå med, väntrummet och sedan spelet. */
export function App() {
  const [screen, setScreen] = useState<Screen>(() => (readSavedGameId() ? { name: 'loading' } : getScreenWithoutGame()));
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
    if (!savedGameId) return;
    callGame({ type: 'getView', gameId: savedGameId }).then((response) => {
      if (response.ok) {
        showResponse(response);
        return;
      }
      if (response.error === 'notInGame') saveGameId(null);
      showScreen(getScreenWithoutGame());
      if (response.error !== 'notInGame') setError(getErrorMessage(response.error));
    });
  }, [showResponse, showScreen]);

  // Nya vyer kommer i spelarens kanal. När kanalen öppnas och
  // när mobilen vaknar hämtas vyn, ifall något har missats under tiden.
  useEffect(() => {
    if (!playerId || !gameId) return;
    const refresh = () => {
      callGame({ type: 'getView', gameId }).then((response) => {
        if (response.ok && response.view) setScreen({ name: 'game', view: response.view });
      });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    let stopListening: (() => void) | null = null;
    let isCurrent = true;
    listenToPlayerView({ playerId, onView: (view) => setScreen({ name: 'game', view }), onListening: refresh })
      .then((stop) => {
        if (isCurrent) stopListening = stop;
        else stop();
      })
      .catch(() => setError(getErrorMessage('network')));
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      isCurrent = false;
      stopListening?.();
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [playerId, gameId]);

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
    if (!response.ok) setError(getErrorMessage(response.error));
    else if (response.view) setScreen({ name: 'game', view: response.view });
  }

  const startGame = (usesPlaceCards: boolean, minutes: number) => sendInGame({ type: 'startGame', usesPlaceCards, minutes });
  const nextStep = () => sendInGame({ type: 'nextStep' });
  const markReady = () => sendInGame({ type: 'markReady' });
  const setPaused = (isPaused: boolean) => sendInGame({ type: 'setPaused', isPaused });
  const choosePlace = (placeId: PlaceId, source: 'scan' | 'list') => sendInGame({ type: 'choosePlace', placeId, source });

  function leaveFinishedGame() {
    saveGameId(null);
    showScreen({ name: 'start' });
  }

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
      {screen.name === 'game' && screen.view.type === 'game' && (
        <GameScreen
          view={screen.view}
          clockOffsetMs={clockOffsetMs}
          isBusy={isBusy}
          error={error}
          onNextStep={nextStep}
          onMarkReady={markReady}
          onSetPaused={setPaused}
          onChoosePlace={choosePlace}
          onLeave={leaveFinishedGame}
        />
      )}
      {SHOWS_VIEWPORT_PROBE && <ViewportProbe />}
    </>
  );
}
