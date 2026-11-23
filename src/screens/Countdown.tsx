import { useEffect, useState } from 'react';
import { type ClockView, findRemainingMs } from '../../supabase/functions/game/clock.ts';
import { formatRemaining, isLowTime } from './countdown.ts';
import { Icon } from './Icon.tsx';

const TICK_MS = 1000;

/**
 * Gruppens nedräkning, uppe till höger i en rund ruta. Mobilen räknar själv
 * med sin skillnad mot serverns klocka.
 */
export function Countdown({ clock, clockOffsetMs }: { clock: ClockView; clockOffsetMs: number }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (clock.isPaused) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [clock.isPaused]);
  const remainingMs = findRemainingMs(clock, nowMs + clockOffsetMs);
  const className = isLowTime(remainingMs) ? 'chip countdown is-low' : 'chip countdown';
  if (remainingMs <= 0) return <span className={className}><Icon name="clock" />Tiden är ute</span>;
  return <span className={className} aria-label={`Tid kvar ${formatRemaining(remainingMs)}`}><Icon name="clock" />{formatRemaining(remainingMs)}</span>;
}
