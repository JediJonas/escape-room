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
  /**
   * Alla är klara, för när någon har gått iväg och gruppen inte ska behöva
   * vänta, eller null när knappen inte ska synas. När alla har läst urklippen
   * hoppar knappen i stället över uppgiften som berättelsen väntar på.
   */
  skipSceneLabel: string | null;
  onSetPaused: (isPaused: boolean) => void;
  onGiveHint: (isAboutReading: boolean) => void;
  onShowSolution: () => void;
  onNextStep: () => void;
  onAnswerPending: (playerId: string, isAdmitted: boolean) => void;
};

/**
 * Spelledarens meny, en hamburgare som alltid ligger i nedre högra hörnet
 * (Jonas 2026-11-18). Där finns paus, Alla är klara i en scen, Hoppa över i
 * en uppgift, och vid saken som är uppgiften ledtrådar och facit.
 */
export function LeaderMenu({ view, isBusy, stepText, canHelpWithTask, canHelpWithReading, skipSceneLabel, onSetPaused, onGiveHint, onShowSolution, onNextStep, onAnswerPending }: LeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const isTask = step.type !== 'scene';
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
              {isTask && <button type="button" className="secondary" onClick={runAndClose(onNextStep)} disabled={isBusy}>Hoppa över uppgiften</button>}
              {!isTask && skipSceneLabel && <button type="button" className="secondary" onClick={runAndClose(onNextStep)} disabled={isBusy}>{skipSceneLabel}</button>}
              {view.clock && (
                <button type="button" className="secondary" onClick={runAndClose(() => onSetPaused(!isPaused))} disabled={isBusy}>
                  {isPaused ? 'Fortsätt spelet' : 'Pausa spelet'}
                </button>
              )}
            </div>
          </section>
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
