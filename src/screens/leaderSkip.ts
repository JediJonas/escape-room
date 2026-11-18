/** Det spelledarens mobil vet om steget när den väljer om Alla är klara ska synas i menyn. */
export type LeaderSkipInput = {
  isLeaderPlaying: boolean;
  usesReadyButton: boolean;
  isMeDone: boolean;
  progress: readonly { isMe: boolean; isDone: boolean }[];
};

/**
 * Alla är klara, som förut hette Gå vidare ändå (Jonas 2026-11-18), är till
 * för när någon annan har gått iväg. Har alla andra tryckt Klar kan spelledaren trycka Klar själv, så knappen döljs. Den kommer
 * tillbaka om någon annan blir oklar, till exempel när en ny spelare släpps
 * in. En scen där man går till en plats har ingen Klar-knapp, och där syns
 * knappen alltid (Jonas 2026-11-18).
 */
export function canLeaderSkip({ isLeaderPlaying, usesReadyButton, isMeDone, progress }: LeaderSkipInput): boolean {
  if (!isLeaderPlaying || !usesReadyButton || isMeDone) return true;
  return progress.some((player) => !player.isMe && !player.isDone);
}
