import type { GameView } from '../../supabase/functions/game/game.ts';

/**
 * Spelledarens del av skärmen. I en scen syns vilka som är klara, i en
 * uppgift ledtrådarna och facit. Paus finns alltid.
 */
export function LeaderPanel({ view, isBusy, onSetPaused, onGiveHint, onShowSolution }: {
  view: GameView;
  isBusy: boolean;
  onSetPaused: (isPaused: boolean) => void;
  onGiveHint: () => void;
  onShowSolution: () => void;
}) {
  if (!view.progress) return null;
  const { step } = view;
  const isTask = step.type !== 'scene';
  const doneCount = view.progress.filter((player) => player.isDone).length;
  const isPaused = view.clock?.isPaused ?? false;
  return (
    <section className="leader-panel" aria-label="Spelledare">
      {isTask
        ? (
          <>
            <h2>Uppgiften</h2>
            <p className="hint">Gruppen har fått {step.hints.length} av {step.hintCount} ledtrådar.</p>
            {step.solution && <p className="solution">Facit: {step.solution}</p>}
          </>
        )
        : (
          <>
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
          </>
        )}
      <div className="leader-tools">
        {isTask && (
          <button type="button" className="secondary small" onClick={onGiveHint} disabled={isBusy || step.hints.length >= step.hintCount}>
            Ge ledtråd
          </button>
        )}
        {isTask && !step.solution && <button type="button" className="secondary small" onClick={onShowSolution} disabled={isBusy}>Visa facit för mig</button>}
        {view.clock && (
          <button type="button" className="secondary small" onClick={() => onSetPaused(!isPaused)} disabled={isBusy}>
            {isPaused ? 'Fortsätt spelet' : 'Pausa spelet'}
          </button>
        )}
      </div>
    </section>
  );
}
