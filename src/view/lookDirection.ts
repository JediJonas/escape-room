/**
 * Åt vilket håll spelaren tittar i en rundbild. Vridningen (yaw) är noll rakt
 * fram, mitt i bilden, och växer åt höger. Lutningen (pitch) är noll vid
 * horisonten och växer uppåt.
 * Rollningen (roll) är hur mobilen är vriden runt blicken, och växer medurs.
 * Den finns bara när mobilens sensor styr.
 */
export type LookDirection = { yawDeg: number; pitchDeg: number; rollDeg?: number };

/** Rakt upp och rakt ner snurrar bilden runt en punkt, så blicken stannar strax innan. */
export const MAX_PITCH_DEG = 85;

/** Synfält i höjdled när visaren öppnas. Ska prövas på riktiga mobiler. */
export const DEFAULT_FIELD_OF_VIEW_DEG = 75;
/** Snävare än så här blir bilden suddig, och vidare blir kanterna utdragna. */
export const MIN_FIELD_OF_VIEW_DEG = 30;
export const MAX_FIELD_OF_VIEW_DEG = 110;

/** Närmare rakt upp eller rakt ner än så här går rollningen inte att räkna ut. */
const MIN_HORIZONTAL_LENGTH_FOR_ROLL = 0.05;

/**
 * Håller vridningen mellan -180 och 180 grader, så att varv efter varv inte växer.
 */
export function wrapYawDeg(yawDeg: number) {
  return ((((yawDeg + 180) % 360) + 360) % 360) - 180;
}

export function clampPitchDeg(pitchDeg: number) {
  return Math.max(-MAX_PITCH_DEG, Math.min(MAX_PITCH_DEG, pitchDeg));
}

/**
 * Vrider blicken ett antal grader åt höger och uppåt.
 */
export function turnLook(look: LookDirection, turn: { yawDeg: number; pitchDeg: number }): LookDirection {
  return {
    yawDeg: wrapYawDeg(look.yawDeg + turn.yawDeg),
    pitchDeg: clampPitchDeg(look.pitchDeg + turn.pitchDeg),
  };
}

/**
 * Gör om ett drag med fingret till en vridning. Bilden följer fingret, så ett
 * drag åt höger vrider blicken åt vänster och ett drag nedåt vrider den uppåt.
 * @param drag hur långt fingret har flyttats
 * @param view visarens höjd och synfält i höjdled
 */
export function dragToTurn(drag: { xPx: number; yPx: number }, view: { heightPx: number; fieldOfViewDeg: number }) {
  const degPerPx = view.fieldOfViewDeg / view.heightPx;
  return { yawDeg: -drag.xPx * degPerPx, pitchDeg: drag.yPx * degPerPx };
}

/**
 * Räknar ut åt vilket håll mobilens baksida pekar, så att mobilen blir ett
 * fönster in i rummet. Vinklarna är de som webbläsaren ger för mobilens läge:
 * alpha runt lodlinjen, beta framåt och bakåt, gamma i sidled. Vridningen i
 * svaret har en godtycklig nollpunkt, eftersom mobiler utan kompass börjar
 * räkna där de råkar stå. Rollningen säger hur mycket mobilens överkant lutar
 * åt höger, så att visaren kan hålla rummet vågrätt.
 * @param orientation i grader
 */
export function orientationToLook({ alpha, beta, gamma }: { alpha: number; beta: number; gamma: number }): Required<LookDirection> {
  const toRadians = Math.PI / 180;
  const [sinAlpha, cosAlpha] = [Math.sin(alpha * toRadians), Math.cos(alpha * toRadians)];
  const [sinBeta, cosBeta] = [Math.sin(beta * toRadians), Math.cos(beta * toRadians)];
  const [sinGamma, cosGamma] = [Math.sin(gamma * toRadians), Math.cos(gamma * toRadians)];
  // Riktningen ut ur mobilens baksida, med öster, norr och uppåt som axlar.
  // Den är tredje kolumnen, med omvänt tecken, i rotationsmatrisen Z-X'-Y''
  // som W3C:s specifikation för deviceorientation beskriver.
  const east = -(cosGamma * sinAlpha * sinBeta + cosAlpha * sinGamma);
  const north = -(sinAlpha * sinGamma - cosAlpha * cosGamma * sinBeta);
  const up = -(cosBeta * cosGamma);
  // Mobilens överkant, som är matrisens andra kolumn.
  const top = { east: -cosBeta * sinAlpha, north: cosAlpha * cosBeta, up: sinBeta };
  // Höger och uppåt för en blick som hålls vågrätt. Rakt upp och rakt ner
  // finns ingen vågrät riktning, och då räknas mobilen som olutad.
  const horizontalLength = Math.hypot(east, north);
  let rollDeg = 0;
  if (horizontalLength > MIN_HORIZONTAL_LENGTH_FOR_ROLL) {
    const right = { east: north / horizontalLength, north: -east / horizontalLength };
    const levelUp = { east: right.north * up, north: -right.east * up, up: right.east * north - right.north * east };
    const topTowardsRight = top.east * right.east + top.north * right.north;
    const topTowardsUp = top.east * levelUp.east + top.north * levelUp.north + top.up * levelUp.up;
    rollDeg = Math.atan2(topTowardsRight, topTowardsUp) / toRadians;
  }
  return {
    yawDeg: wrapYawDeg(Math.atan2(east, north) / toRadians),
    pitchDeg: Math.asin(Math.max(-1, Math.min(1, up))) / toRadians,
    rollDeg,
  };
}

/**
 * Zoomar genom att ändra synfältet. En faktor över 1 zoomar in, alltså ett
 * snävare synfält. Två fingrar som dras isär till dubbla avståndet ger faktorn 2.
 */
export function zoomFieldOfView(fieldOfViewDeg: number, zoomFactor: number) {
  return Math.max(MIN_FIELD_OF_VIEW_DEG, Math.min(MAX_FIELD_OF_VIEW_DEG, fieldOfViewDeg / zoomFactor));
}

/**
 * Hur långt från bildens mitt visarens överkant ligger, i den enhet där
 * avståndet till bilden är 1. Det hårda perspektivet håller raka linjer raka
 * men drar ut kanterna när synfältet är brett. Det mjuka (stereografiska)
 * behåller formen på det som syns i kanterna och böjer i stället raka linjer.
 * @param fieldOfViewDeg synfält i höjdled
 */
export function fieldOfViewToHalfHeight(fieldOfViewDeg: number, perspective: 'straight' | 'soft') {
  const halfAngle = (fieldOfViewDeg * Math.PI) / 360;
  return perspective === 'soft' ? 2 * Math.tan(halfAngle / 2) : Math.tan(halfAngle);
}

/**
 * Var en bred bild som upprepas i sidled ska ligga för att visa vridningen
 * mitt i visaren.
 * @param sizes bildens bredd som den ritas, och visarens bredd
 * @returns bildens vänsterkant i pixlar från visarens vänsterkant
 */
export function yawToStripOffsetPx(yawDeg: number, { imageWidthPx, viewWidthPx }: { imageWidthPx: number; viewWidthPx: number }): number {
  const centerInImagePx = (wrapYawDeg(yawDeg) / 360 + 0.5) * imageWidthPx;
  return viewWidthPx / 2 - centerInImagePx;
}

/**
 * Åt vilket håll en punkt på skärmen pekar ut i rummet, så att ett tryck på
 * en sak träffar saken. Räknar som visarens shader, bara åt andra hållet.
 * @param point punkten från -1 till 1 i båda leden, med y uppåt
 * @param view visarens bredd delat med höjd, synfält i höjdled och perspektiv
 */
export function screenPointToLook(look: LookDirection, point: { x: number; y: number }, view: { aspect: number; fieldOfViewDeg: number; perspective: 'straight' | 'soft' }): LookDirection {
  const toRadians = Math.PI / 180;
  const halfHeight = fieldOfViewToHalfHeight(view.fieldOfViewDeg, view.perspective);
  const roll = (look.rollDeg ?? 0) * toRadians;
  const [screenX, screenY] = [point.x * halfHeight * view.aspect, point.y * halfHeight];
  const x = screenX * Math.cos(roll) + screenY * Math.sin(roll);
  const y = screenY * Math.cos(roll) - screenX * Math.sin(roll);
  let ray: [number, number, number];
  if (view.perspective === 'soft') {
    const distance = Math.hypot(x, y);
    const angle = 2 * Math.atan(distance / 2);
    ray = distance > 0 ? [(x / distance) * Math.sin(angle), (y / distance) * Math.sin(angle), -Math.cos(angle)] : [0, 0, -1];
  } else {
    const length = Math.hypot(x, y, 1);
    ray = [x / length, y / length, -1 / length];
  }
  const [cosPitch, sinPitch] = [Math.cos(look.pitchDeg * toRadians), Math.sin(look.pitchDeg * toRadians)];
  const [cosYaw, sinYaw] = [Math.cos(look.yawDeg * toRadians), Math.sin(look.yawDeg * toRadians)];
  const [rayX, pitchedY, pitchedZ] = [ray[0], ray[1] * cosPitch - ray[2] * sinPitch, ray[1] * sinPitch + ray[2] * cosPitch];
  const [turnedX, turnedZ] = [rayX * cosYaw - pitchedZ * sinYaw, rayX * sinYaw + pitchedZ * cosYaw];
  return {
    yawDeg: wrapYawDeg(Math.atan2(turnedX, -turnedZ) / toRadians),
    pitchDeg: Math.asin(Math.max(-1, Math.min(1, pitchedY))) / toRadians,
  };
}

/**
 * Samma sak för den breda bilden, som bara går att vrida i sidled.
 * @param point i pixlar från visarens övre vänstra hörn
 * @param sizes bildens bredd och höjd som den ritas, och visarens storlek
 */
export function stripPointToLook(yawDeg: number, point: { xPx: number; yPx: number }, sizes: { imageWidthPx: number; imageHeightPx: number; viewWidthPx: number; viewHeightPx: number }): LookDirection {
  return {
    yawDeg: wrapYawDeg(yawDeg + ((point.xPx - sizes.viewWidthPx / 2) / sizes.imageWidthPx) * 360),
    pitchDeg: ((sizes.viewHeightPx / 2 - point.yPx) / sizes.imageHeightPx) * 180,
  };
}
