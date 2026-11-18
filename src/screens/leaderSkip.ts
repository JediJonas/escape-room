/** Det spelledarens mobil vet om steget när den väljer om Gå vidare ändå ska synas. */
export type LeaderSkipInput = {
  isLeaderPlaying: boolean;
  usesReadyButton: boolean;
  isMeDone: boolean;
  progress: readonly { isMe: boolean; isDone: boolean }[];
};

/**
 * Gå vidare ändå är till för när någon annan har gått iväg. Har alla andra
 * tryckt Klar kan spelledaren trycka Klar själv, så knappen döljs. Den kommer
 * tillbaka om någon annan blir oklar, till exempel när en ny spelare släpps
 * in. En scen där man går till en plats har ingen Klar-knapp, och där syns
 * knappen alltid (Jonas 2026-11-18).
 */
export function canLeaderSkip({ isLeaderPlaying, usesReadyButton, isMeDone, progress }: LeaderSkipInput): boolean {
  if (!isLeaderPlaying || !usesReadyButton || isMeDone) return true;
  return progress.some((player) => !player.isMe && !player.isDone);
}
