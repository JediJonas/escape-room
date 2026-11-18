import { useEffect, useState } from 'react';
import type { GameView } from '../../supabase/functions/game/game.ts';
import './leaderMenu.css';

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

function MenuIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      {isOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

export type LeaderMenuProps = {
  view: GameView;
  isBusy: boolean;
  /** Stegets text, när spelledaren är i en vy som inte visar den, som brädet eller golvuret. */
  stepText: string | null;
  /** Ge ledtråd och Visa facit för mig, bara vid saken som är uppgiften och inte är klarad. */
  canHelpWithTask: boolean;
  /** Ge ledtråd om urklippen, vid byrån medan berättelsen väntar på att alla har läst (Jonas 2026-11-18). */
  canHelpWithReading: boolean;
  onSetPaused: (isPaused: boolean) => void;
  onGiveHint: (isAboutReading: boolean) => void;
  onShowSolution: () => void;
  onNextStep: () => void;
  onEndGame: () => void;
  onAnswerPending: (playerId: string, isAdmitted: boolean) => void;
};

/**
 * Spelledarens meny, en hamburgare som alltid ligger i nedre högra hörnet
 * (Jonas 2026-11-18). Där finns paus, Hoppa över i en uppgift och i urklippen,
 * och vid saken som är uppgiften ledtrådar och facit. Alla är klara togs bort,
 * så i en scen väntar gruppen tills alla har tryckt (Jonas 2026-11-18).
 * Avsluta spelet ligger sist och frågar först, eftersom det inte går att
 * ångra (Jonas 2026-11-18).
 */
export function LeaderMenu({ view, isBusy, stepText, canHelpWithTask, canHelpWithReading, onSetPaused, onGiveHint, onShowSolution, onNextStep, onEndGame, onAnswerPending }: LeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);
  // Frågan om att avsluta börjar om varje gång menyn öppnas.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setIsConfirmingEnd(false);
  }
  const { step } = view;
  // Ett nytt steg börjar med menyn stängd.
  const [openStep, setOpenStep] = useState(step.number);
  if (openStep !== step.number) {
    setOpenStep(step.number);
    setIsOpen(false);
  }
  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  // Urklippen väntar på en uppgift, så där kan spelledaren också hoppa över (Jonas 2026-11-18).
  const canSkip = step.type !== 'scene' || step.isDoneByLeaving;
  const isPaused = view.clock?.isPaused ?? false;
  const pendingCount = view.pending?.length ?? 0;
  const runAndClose = (action: () => void) => () => {
    action();
    setIsOpen(false);
  };
  return (
    <>
      {isOpen && (
        <>
          <button type="button" className="leader-menu-backdrop" aria-label="Stäng menyn" tabIndex={-1} onClick={() => setIsOpen(false)} />
          {isConfirmingEnd ? (
            <section className="leader-menu" aria-label="Avsluta spelet">
              <h2>Avsluta spelet för alla?</h2>
              <p>Det går inte att ångra. Alla mobiler visar att spelet är slut.</p>
              <div className="leader-menu-actions">
                <button type="button" className="secondary" onClick={() => setIsConfirmingEnd(false)}>Avbryt</button>
                <button type="button" className="danger" onClick={runAndClose(onEndGame)} disabled={isBusy}>Avsluta spelet</button>
              </div>
            </section>
          ) : (
          <section className="leader-menu" aria-label="Spelledarens meny">
            <PendingList view={view} isBusy={isBusy} onAnswer={onAnswerPending} />
            {stepText && <p className="leader-menu-text">{stepText}</p>}
            {canHelpWithReading && <p className="hint">Gruppen har fått {step.readingHints.length} av {step.readingHintCount} ledtrådar om {(step.foundTitle ?? '').toLocaleLowerCase('sv')}.</p>}
            {canHelpWithTask && (
              <>
                <p className="hint">Gruppen har fått {step.hints.length} av {step.hintCount} ledtrådar.</p>
                {step.solution && <p className="solution">Facit: {step.solution}</p>}
              </>
            )}
            <div className="leader-menu-actions">
              {canHelpWithReading && (
                <button type="button" className="secondary" onClick={runAndClose(() => onGiveHint(true))} disabled={isBusy || step.readingHints.length >= step.readingHintCount}>
                  Ge ledtråd
                </button>
              )}
              {canHelpWithTask && (
                <button type="button" className="secondary" onClick={runAndClose(() => onGiveHint(false))} disabled={isBusy || step.hints.length >= step.hintCount}>
                  Ge ledtråd
                </button>
              )}
              {canHelpWithTask && !step.solution && <button type="button" className="secondary" onClick={onShowSolution} disabled={isBusy}>Visa facit för mig</button>}
              {canSkip && <button type="button" className="secondary" onClick={runAndClose(onNextStep)} disabled={isBusy}>Hoppa över uppgiften</button>}
              {view.clock && (
                <button type="button" className="secondary" onClick={runAndClose(() => onSetPaused(!isPaused))} disabled={isBusy}>
                  {isPaused ? 'Fortsätt spelet' : 'Pausa spelet'}
                </button>
              )}
              <button type="button" className="secondary" onClick={() => setIsConfirmingEnd(true)} disabled={isBusy}>Avsluta spelet</button>
            </div>
          </section>
          )}
        </>
      )}
      <button
        type="button"
        className="leader-menu-button"
        aria-label={isOpen ? 'Stäng menyn' : 'Meny'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <MenuIcon isOpen={isOpen} />
        {pendingCount > 0 && !isOpen && <span className="leader-menu-badge">{pendingCount}</span>}
      </button>
    </>
  );
}
