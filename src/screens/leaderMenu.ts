/** En spelare i spelledarens lista över vilka som är klara. */
export type DoneEntry = { name: string; isDone: boolean };

/**
 * Den lilla raden efter Väntar på att alla ska bli klara, som bara
 * spelledaren ser, med de klara inom parentes. Den ersätter listan med alla
 * spelare (Jonas 2026-11-18).
 */
export function describeDone(progress: readonly DoneEntry[]): string {
  const done = progress.filter((player) => player.isDone).map((player) => player.name);
  const count = `Klara: ${done.length} av ${progress.length}`;
  return done.length > 0 ? `${count} (${done.join(', ')})` : count;
}

/**
 * Raden i urklippen, där berättelsen väntar på att alla har läst. Spelledaren
 * ser vilka som saknas, i stället för vilka som är klara (Jonas 2026-11-18).
 */
export function describeUnread(progress: readonly DoneEntry[], foundTitle: string): string {
  const title = foundTitle.toLocaleLowerCase('sv');
  const missing = progress.filter((player) => !player.isDone).map((player) => player.name);
  return missing.length > 0 ? `Har inte läst ${title}: ${missing.join(', ')}` : `Alla har läst ${title}.`;
}

/**
 * Knappen som hoppar över det berättelsen väntar på i urklippen. Först
 * räknas alla som lästa, och sedan hoppar knappen över uppgiften
 * (Jonas 2026-11-18).
 */
export function describeSceneSkip(progress: readonly DoneEntry[], foundTitle: string | null): string {
  return foundTitle !== null && progress.every((player) => player.isDone) ? 'Hoppa över uppgiften' : 'Alla är klara';
}

/** Det spelledarens mobil vet när den väljer om Ge ledtråd och Visa facit för mig ska synas. */
export type TaskHelpInput = {
  isTask: boolean;
  /** Spelledaren är vid saken som är uppgiften, som ouijabrädet eller golvuret. */
  isAtTask: boolean;
  /** Uppgiften är redan klarad, som en seans där meddelandet är bokstaverat. */
  isSolved: boolean;
};

/**
 * Ledtråd och facit hör till saken och inte till nästa uppgift. De syns bara
 * när spelledaren är vid saken som är uppgiften, och inte när den redan är
 * klarad (Jonas 2026-11-18).
 */
export function canHelpWithTask({ isTask, isAtTask, isSolved }: TaskHelpInput): boolean {
  return isTask && isAtTask && !isSolved;
}
