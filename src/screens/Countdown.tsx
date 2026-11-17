import { useEffect, useState } from 'react';
import { type ClockView, findRemainingMs } from '../../supabase/functions/game/clock.ts';
import { formatRemaining } from './countdown.ts';

const TICK_MS = 1000;

/** Gruppens nedräkning. Mobilen räknar själv med sin skillnad mot serverns klocka. */
export function Countdown({ clock, clockOffsetMs }: { clock: ClockView; clockOffsetMs: number }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (clock.isPaused) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [clock.isPaused]);
  const remainingMs = findRemainingMs(clock, nowMs + clockOffsetMs);
  if (remainingMs <= 0) return <span className="countdown is-over">Tiden är ute</span>;
  return <span className="countdown" aria-label={`Tid kvar ${formatRemaining(remainingMs)}`}>{formatRemaining(remainingMs)}</span>;
}
