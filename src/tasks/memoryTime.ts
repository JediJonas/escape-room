const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/** Tiden kvar tills minnet bleknar, som minuter och sekunder, till exempel 2:05. */
export function formatMemoryLeft(msLeft: number): string {
  const seconds = Math.max(0, Math.ceil(msLeft / MS_PER_SECOND));
  return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}
