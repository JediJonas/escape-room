/**
 * Golvurets urtavla som räknas fram ur fingret eller mobilens lutning. Rena
 * funktioner, så att de går att testa. Servern hakar i visarna och avgör om
 * tiden är rätt, se supabase/functions/game/rooms.ts.
 */

import { DIAL_HOURS, DIAL_MINUTES, snapDial } from '../../supabase/functions/game/rooms.ts';

const DEGREES_PER_TURN = 360;
const MINUTES_PER_HOUR = 60;
const DEGREES_PER_MINUTE = DEGREES_PER_TURN / MINUTES_PER_HOUR;
const RADIANS_TO_DEGREES = DEGREES_PER_TURN / (2 * Math.PI);

/**
 * Hur många minuter visarna går när mobilen vrids en grad som en ratt. Med
 * två minuter räcker ett kvarts varv för en och en halv timme.
 */
export const WHEEL_MINUTES_PER_DEGREE = 2;

/** Under så här mycket tyngdkraft i skärmens plan ligger mobilen för platt för att vara en ratt. */
const WHEEL_MIN_GRAVITY_MS2 = 4;

/** Vinkeln medurs från klockan tolv, mellan 0 och 360 grader, för en punkt i förhållande till mitten. */
export function angleFromCenter(dx: number, dy: number): number {
  const degrees = Math.atan2(dx, -dy) * RADIANS_TO_DEGREES;
  return (degrees + DEGREES_PER_TURN) % DEGREES_PER_TURN;
}

/** Håller en skillnad i vinkel mellan -180 och 180 grader, så att visaren kan gå runt tolvan. */
export function wrapAngleDelta(degrees: number): number {
  const half = DEGREES_PER_TURN / 2;
  return ((((degrees + half) % DEGREES_PER_TURN) + DEGREES_PER_TURN) % DEGREES_PER_TURN) - half;
}

/**
 * Fingret drar minutvisaren. Går den förbi tolvan går timvisaren en timme,
 * som på ett riktigt ur. Ger de nya minuterna, utan att haka i.
 */
export function dragMinuteHand(minutes: number, fromAngle: number, toAngle: number): number {
  return minutes + wrapAngleDelta(toAngle - fromAngle) / DEGREES_PER_MINUTE;
}

/** Visarnas vinklar medurs från tolvan. */
export function findHandAngles(minutes: number): { hour: number; minute: number } {
  const onDial = ((minutes % DIAL_MINUTES) + DIAL_MINUTES) % DIAL_MINUTES;
  return { hour: (onDial / DIAL_MINUTES) * DEGREES_PER_TURN, minute: (onDial % MINUTES_PER_HOUR) * DEGREES_PER_MINUTE };
}

/** Tiden som visarna står på, som "4.40", för skärmläsare. */
export function formatDialTime(minutes: number): string {
  const snapped = snapDial(minutes);
  const hours = Math.floor(snapped / MINUTES_PER_HOUR) || DIAL_HOURS;
  return `${hours}.${String(snapped % MINUTES_PER_HOUR).padStart(2, '0')}`;
}

type Gravity = { x: number | null; y: number | null };

/**
 * Hur mycket mobilen är vriden som en ratt, i grader medurs, räknat ur
 * tyngdkraften i skärmens plan. Webbläsarna ger tyngdkraften åt olika håll,
 * så riktningen bestäms av greppet: mobilen hålls upprätt när spelaren tar
 * tag. Ger null när mobilen ligger för platt.
 */
export function readWheelAngle(gravity: Gravity, isFlipped: boolean): number | null {
  if (gravity.x === null || gravity.y === null || Math.hypot(gravity.x, gravity.y) < WHEEL_MIN_GRAVITY_MS2) return null;
  const sign = isFlipped ? -1 : 1;
  return Math.atan2(-gravity.x * sign, gravity.y * sign) * RADIANS_TO_DEGREES;
}

/** Om webbläsaren ger tyngdkraften nedåt i stället för uppåt, sett från en upprätt mobil. */
export function isGravityFlipped(gravity: Gravity): boolean {
  return (gravity.y ?? 0) < 0;
}
