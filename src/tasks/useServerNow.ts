import { useEffect, useState } from 'react';

/** Serverns tid i mobilen, uppdaterad med jämna mellanrum. Skillnaden mot serverns klocka mäts av livstecknen. */
export function useServerNow(clockOffsetMs: number, tickMs: number): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);
  return nowMs + clockOffsetMs;
}
