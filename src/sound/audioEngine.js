// @ts-check

/**
 * Ljudmotorn (Web Audio) startas, väcks och vilar på ett ställe. Motorn kan
 * tona ljud, men iPhone stoppar den ibland. Därför har varje klipp vanligt
 * ljud som reserv, se clipPlayer.js.
 */

const RESUME_TIMEOUT_MS = 500;

/** @param {number} ms */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createAudioEngine() {
  /** @type {AudioContext | null} */
  let context = null;

  // Anropas från varje tryck. Motorn får bara skapas av ett tryck, annars
  // står den stilla för alltid.
  function unlock() {
    const Context = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!Context) return;
    if (!context) context = new Context();
    // Annars tystar ljudlös-knappen på iPhone ljudmotorn.
    const audioSession = /** @type {any} */ (navigator).audioSession;
    if (audioSession && audioSession.type !== 'playback') audioSession.type = 'playback';
    if (context.state !== 'running') context.resume().catch(() => {});
  }

  // Väcker motorn inför ett ljud. Väntar högst RESUME_TIMEOUT_MS, eftersom
  // resume() kan hänga på iPhone.
  function resume() {
    if (!context || context.state === 'running') return Promise.resolve();
    return Promise.race([context.resume().catch(() => {}), wait(RESUME_TIMEOUT_MS)]);
  }

  const isRunning = () => Boolean(context && context.state === 'running');
  const describeState = () => (context ? context.state : 'ingen ljudmotor');
  return { unlock, resume, isRunning, describeState, getContext: () => context };
}

/**
 * Hämtar ett klipp till motorn, eller säger varför det inte gick.
 * @param {AudioContext | null} context
 * @param {string} url
 * @returns {Promise<{ buffer: AudioBuffer } | { why: string }>}
 */
export async function loadClipToEngine(context, url) {
  if (!context) return { why: 'ingen ljudmotor, inget tryck än' };
  let response;
  try {
    response = await fetch(url);
  } catch {
    return { why: 'hämtningen nekades, troligen CORS' };
  }
  if (!response.ok) return { why: `servern svarade ${response.status}` };
  try {
    return { buffer: await context.decodeAudioData(await response.arrayBuffer()) };
  } catch {
    return { why: 'klippet kunde inte avkodas' };
  }
}
