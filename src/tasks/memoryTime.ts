/** Tiden kvar tills minnet bleknar, som minuter och sekunder, till exempel 2:05. */
export function formatMemoryLeft(msLeft: number): string {
  const seconds = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
