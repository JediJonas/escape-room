import { useEffect, useState } from 'react';
import type { GameView } from '../../supabase/functions/game/game.ts';
import { HINT_COUNT } from '../../supabase/functions/game/mission.ts';
import { Icon, type IconName } from './Icon.tsx';
import './leaderMenu.css';

/** Mobiler som har kommit efter start och väntar på ett svar. */
function PendingList({ view, isBusy, onAnswer }: { view: GameView; isBusy: boolean; onAnswer: (playerId: string, isAdmitted: boolean) => void }) {
  if (!view.pending || view.pending.length === 0) return null;
  return (
    <>
      {view.pending.map((pending) => (
        <div key={pending.playerId} className="pending">
          <p>{pending.takesOver ? `En ny mobil vill ta över ${pending.takesOver}.` : <><strong>{pending.name}</strong> vill vara med.</>}</p>
          <div className="pending-answers">
            <button type="button" className="secondary" onClick={() => onAnswer(pending.playerId, false)} disabled={isBusy}>Neka</button>
            <button type="button" onClick={() => onAnswer(pending.playerId, true)} disabled={isBusy}>
              {pending.takesOver ? 'Låt den ta över' : 'Släpp in'}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

/** En rad i menyn, med en ikon framför. */
function MenuItem({ icon, label, note, isDanger, disabled, onClick }: { icon: IconName; label: string; note?: string; isDanger?: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <li>
      <button type="button" className={isDanger ? 'menu-item is-danger' : 'menu-item'} onClick={onClick} disabled={disabled}>
        <Icon name={icon} />
        {label}
        {note && <small>{note}</small>}
      </button>
    </li>
  );
}

export type LeaderMenuProps = {
  view: GameView;
  isBusy: boolean;
  onSetPaused: (isPaused: boolean) => void;
  onGiveHint: () => void;
  onShowSolution: () => void;
  onNextStep: () => void;
  onEndGame: () => void;
  onAnswerPending: (playerId: string, isAdmitted: boolean) => void;
};

/**
 * Spelledarens meny, en hamburgare som alltid ligger i nedre högra hörnet
 * (Jonas 2026-11-18). Där finns paus, Hoppa över i en uppgift och i urklippen,
 * och Ge ledtråd och Visa facit för mig var spelledaren än är, så länge
 * gruppen har något olöst. Servern väljer ledtråden (Jonas 2026-11-18). Alla är klara togs bort,
 * så i en scen väntar gruppen tills alla har tryckt (Jonas 2026-11-18).
 * Avsluta spelet ligger sist och frågar först, eftersom det inte går att
 * ångra (Jonas 2026-11-18).
 */
export function LeaderMenu({ view, isBusy, onSetPaused, onGiveHint, onShowSolution, onNextStep, onEndGame, onAnswerPending }: LeaderMenuProps) {
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
              <header>
                <h2>Avsluta spelet för alla?</h2>
                <small>Det går inte att ångra. Alla mobiler visar att spelet är slut.</small>
              </header>
              <div className="leader-menu-confirm">
                <button type="button" className="secondary" onClick={() => setIsConfirmingEnd(false)}>Avbryt</button>
                <button type="button" className="danger" onClick={runAndClose(onEndGame)} disabled={isBusy}>Avsluta spelet</button>
              </div>
            </section>
          ) : (
          <section className="leader-menu" aria-label="Spelledarens meny">
            {/* Steget och ledtrådarna står överst, så att spelarnas skärmar slipper dem (Jonas 2026-11-23). */}
            <header>
              <h2>Spelledare</h2>
              <small>Steg {step.number} av {step.count}{step.hasHelp && ` · ${step.hints.length} av ${HINT_COUNT} ledtrådar`}</small>
            </header>
            <PendingList view={view} isBusy={isBusy} onAnswer={onAnswerPending} />
            {step.hasHelp && step.solution && <p className="solution">Facit: {step.solution}</p>}
            <ul className="menu-list">
              {step.hasHelp && <MenuItem icon="hint" label="Ge ledtråd" note={`${Math.min(step.hints.length + 1, HINT_COUNT)} av ${HINT_COUNT}`} onClick={runAndClose(onGiveHint)} disabled={isBusy || !step.canGiveHint} />}
              {step.canShowSolution && !step.solution && <MenuItem icon="solution" label="Visa facit för mig" onClick={onShowSolution} disabled={isBusy} />}
              {canSkip && <MenuItem icon="skip" label="Hoppa över uppgiften" onClick={runAndClose(onNextStep)} disabled={isBusy} />}
              {view.clock && <MenuItem icon={isPaused ? 'play' : 'pause'} label={isPaused ? 'Fortsätt spelet' : 'Pausa spelet'} onClick={runAndClose(() => onSetPaused(!isPaused))} disabled={isBusy} />}
            </ul>
            <ul className="menu-list is-last">
              <MenuItem icon="end" label="Avsluta spelet" isDanger onClick={() => setIsConfirmingEnd(true)} disabled={isBusy} />
            </ul>
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
        <Icon name={isOpen ? 'close' : 'menu'} />
        {pendingCount > 0 && !isOpen && <span className="leader-menu-badge">{pendingCount}</span>}
      </button>
    </>
  );
}
