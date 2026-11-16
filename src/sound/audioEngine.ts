/**
 * Ljudmotorn (Web Audio) startas, väcks och vilar på ett ställe. Motorn kan
 * tona ljud, men iPhone stoppar den ibland. Därför har varje klipp vanligt
 * ljud som reserv, se clipPlayer.js.
 */

const RESUME_TIMEOUT_MS = 500;

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createAudioEngine() {
  let context: AudioContext | null = null;

  // Anropas från varje tryck. Motorn får bara skapas av ett tryck, annars
  // står den stilla för alltid.
  function unlock() {
    const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    if (!context) context = new Context();
    // Annars tystar ljudlös-knappen på iPhone ljudmotorn.
    // audioSession finns bara i Safari och saknas i TypeScripts typer.
    const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
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
 */
export async function loadClipToEngine(context: AudioContext | null, url: string): Promise<{ buffer: AudioBuffer } | { why: string }> {
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

export type AudioEngine = ReturnType<typeof createAudioEngine>;
