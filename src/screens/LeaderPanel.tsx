import type { GameView } from '../../supabase/functions/game/game.ts';

/**
 * Spelledarens del av skärmen. I en scen syns vilka som är klara, i en
 * uppgift ledtrådarna och facit. Paus finns alltid.
 */
/** Mobiler som har kommit efter start och väntar på ett svar. */
function PendingList({ view, isBusy, onAnswer }: { view: GameView; isBusy: boolean; onAnswer: (playerId: string, isAdmitted: boolean) => void }) {
  if (!view.pending || view.pending.length === 0) return null;
  return (
    <div className="pending-list">
      <h2>Vill vara med</h2>
      {view.pending.map((pending) => (
        <div key={pending.playerId} className="pending">
          <p>{pending.takesOver ? `En ny mobil vill ta över ${pending.takesOver}.` : `${pending.name} vill vara med.`}</p>
          <div className="leader-tools">
            <button type="button" className="secondary small" onClick={() => onAnswer(pending.playerId, true)} disabled={isBusy}>
              {pending.takesOver ? 'Låt den ta över' : 'Släpp in'}
            </button>
            <button type="button" className="secondary small" onClick={() => onAnswer(pending.playerId, false)} disabled={isBusy}>Neka</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeaderPanel({ view, isBusy, onSetPaused, onGiveHint, onShowSolution, onAnswerPending }: {
  view: GameView;
  isBusy: boolean;
  onSetPaused: (isPaused: boolean) => void;
  onGiveHint: () => void;
  onShowSolution: () => void;
  onAnswerPending: (playerId: string, isAdmitted: boolean) => void;
}) {
  if (!view.progress) return null;
  const { step } = view;
  const isTask = step.type !== 'scene';
  const doneCount = view.progress.filter((player) => player.isDone).length;
  const isPaused = view.clock?.isPaused ?? false;
  return (
    <section className="leader-panel" aria-label="Spelledare">
      <PendingList view={view} isBusy={isBusy} onAnswer={onAnswerPending} />
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
