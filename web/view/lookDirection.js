// @ts-check

/**
 * Åt vilket håll spelaren tittar i en rundbild. Vridningen (yaw) är noll rakt
 * fram, mitt i bilden, och växer åt höger. Lutningen (pitch) är noll vid
 * horisonten och växer uppåt.
 * @typedef {{ yawDeg: number, pitchDeg: number }} LookDirection
 */

/** Rakt upp och rakt ner snurrar bilden runt en punkt, så blicken stannar strax innan. */
export const MAX_PITCH_DEG = 85;

/** Synfält i höjdled när visaren öppnas. Ska prövas på riktiga mobiler. */
export const DEFAULT_FIELD_OF_VIEW_DEG = 75;
/** Snävare än så här blir bilden suddig, och vidare blir kanterna utdragna. */
export const MIN_FIELD_OF_VIEW_DEG = 30;
export const MAX_FIELD_OF_VIEW_DEG = 110;

/**
 * Håller vridningen mellan -180 och 180 grader, så att varv efter varv inte växer.
 * @param {number} yawDeg
 */
export function wrapYawDeg(yawDeg) {
  return ((((yawDeg + 180) % 360) + 360) % 360) - 180;
}

/** @param {number} pitchDeg */
export function clampPitchDeg(pitchDeg) {
  return Math.max(-MAX_PITCH_DEG, Math.min(MAX_PITCH_DEG, pitchDeg));
}

/**
 * Vrider blicken ett antal grader åt höger och uppåt.
 * @param {LookDirection} look
 * @param {{ yawDeg: number, pitchDeg: number }} turn
 * @returns {LookDirection}
 */
export function turnLook(look, turn) {
  return {
    yawDeg: wrapYawDeg(look.yawDeg + turn.yawDeg),
    pitchDeg: clampPitchDeg(look.pitchDeg + turn.pitchDeg),
  };
}

/**
 * Gör om ett drag med fingret till en vridning. Bilden följer fingret, så ett
 * drag åt höger vrider blicken åt vänster och ett drag nedåt vrider den uppåt.
 * @param {{ xPx: number, yPx: number }} drag hur långt fingret har flyttats
 * @param {{ heightPx: number, fieldOfViewDeg: number }} view visarens höjd och synfält i höjdled
 */
export function dragToTurn(drag, view) {
  const degPerPx = view.fieldOfViewDeg / view.heightPx;
  return { yawDeg: -drag.xPx * degPerPx, pitchDeg: drag.yPx * degPerPx };
}

/**
 * Zoomar genom att ändra synfältet. En faktor över 1 zoomar in, alltså ett
 * snävare synfält. Två fingrar som dras isär till dubbla avståndet ger faktorn 2.
 * @param {number} fieldOfViewDeg
 * @param {number} zoomFactor
 */
export function zoomFieldOfView(fieldOfViewDeg, zoomFactor) {
  return Math.max(MIN_FIELD_OF_VIEW_DEG, Math.min(MAX_FIELD_OF_VIEW_DEG, fieldOfViewDeg / zoomFactor));
}

/**
 * Var en bred bild som upprepas i sidled ska ligga för att visa vridningen
 * mitt i visaren.
 * @param {number} yawDeg
 * @param {{ imageWidthPx: number, viewWidthPx: number }} sizes bildens bredd som den ritas, och visarens bredd
 * @returns {number} bildens vänsterkant i pixlar från visarens vänsterkant
 */
export function yawToStripOffsetPx(yawDeg, { imageWidthPx, viewWidthPx }) {
  const centerInImagePx = (wrapYawDeg(yawDeg) / 360 + 0.5) * imageWidthPx;
  return viewWidthPx / 2 - centerInImagePx;
}
