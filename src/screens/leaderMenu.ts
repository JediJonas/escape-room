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
