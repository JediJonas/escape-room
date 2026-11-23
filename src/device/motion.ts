/**
 * Rörelse och lutning. Modulen kontrollerar om sensorerna finns, ber om
 * tillstånd och lämnar värdena vidare. Reserven (dra med fingret) ligger hos
 * den som visar, eftersom den inte behöver någon sensor.
 */

/**
 * iPhone har en egen fråga om tillstånd, som måste ställas inne i ett tryck.
 */
function findPermissionRequest(eventName: 'DeviceOrientationEvent' | 'DeviceMotionEvent'): (() => Promise<string>) | null {
  if (!(eventName in window)) return null;
  const eventType = window[eventName] as { requestPermission?: () => Promise<string> };
  const { requestPermission } = eventType;
  return typeof requestPermission === 'function' ? () => requestPermission.call(eventType) : null;
}

export function getMotionSupport() {
  return {
    hasOrientation: 'DeviceOrientationEvent' in window,
    hasMovement: 'DeviceMotionEvent' in window,
    needsPermission: Boolean(findPermissionRequest('DeviceOrientationEvent') || findPermissionRequest('DeviceMotionEvent')),
    // Sensorerna lämnar bara värden på en säker anslutning (https).
    isSecure: window.isSecureContext,
  };
}

type PermissionAnswer = 'granted' | 'denied' | 'not-needed';

/**
 * Svaret gäller tills sidan laddas om. iPhone glömmer tillståndet vid en
 * omladdning, så då måste frågan ställas igen.
 */
let latestAnswer: PermissionAnswer | null = null;

/**
 * Ber om tillstånd där det krävs. Måste anropas direkt i ett tryck.
 */
export async function requestMotionPermission(): Promise<PermissionAnswer> {
  const requests = [findPermissionRequest('DeviceOrientationEvent'), findPermissionRequest('DeviceMotionEvent')].filter(
    (request) => request !== null,
  );
  if (requests.length === 0) return 'not-needed';
  try {
    const answers = await Promise.all(requests.map((request) => request()));
    latestAnswer = answers.every((answer) => answer === 'granted') ? 'granted' : 'denied';
  } catch {
    // Kastas när frågan ställs utanför ett tryck, eller när sidan inte är säker.
    latestAnswer = 'denied';
  }
  return latestAnswer;
}

/**
 * Sant när mobilen kräver en fråga och den inte har ställts sedan sidan
 * laddades, till exempel när spelaren har laddat om sidan efter scenen som
 * frågar. Har spelaren svarat nej frågar sidan inte igen.
 */
export function shouldAskForMotion(): boolean {
  return latestAnswer === null && getMotionSupport().needsPermission;
}

/** Lyssnar på lutning och rörelse tills den returnerade funktionen anropas. */
export function watchMotion({ onOrientation, onMovement }: {
  onOrientation: (orientation: { alpha: number | null; beta: number | null; gamma: number | null }) => void;
  onMovement: (motion: DeviceMotionEvent) => void;
}): () => void {
  const handleOrientation = (event: DeviceOrientationEvent) => onOrientation({ alpha: event.alpha, beta: event.beta, gamma: event.gamma });
  window.addEventListener('deviceorientation', handleOrientation);
  window.addEventListener('devicemotion', onMovement);
  return () => {
    window.removeEventListener('deviceorientation', handleOrientation);
    window.removeEventListener('devicemotion', onMovement);
  };
}
