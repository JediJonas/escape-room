// @ts-check
import { loadClipToEngine, wait } from './audioEngine.js';
import { buildFadeOutCurve } from './fade.js';
import { encodeWav, synthesizeSilence } from './wav.js';

/**
 * Spelar ett klipp i taget. Klippet spelas i ljudmotorn när den går, med
 * toning, och annars som vanligt ljud utan toning. Sättet bestäms en gång per
 * klipp och byts aldrig mitt i, eftersom det ger ett hopp i ljudet.
 */

const FADE_IN_S = 0.3;
const FADE_OUT_S = 0.8;
const FADE_CURVE_STEPS = 32;
/** iPhone kan säga att motorn går fast klockan står still. Så här länge väntar vi innan vi kollar. */
const CLOCK_CHECK_MS = 300;
const SILENCE_MS = 100;

/**
 * @typedef {{
 *   method: 'ljudmotorn' | 'vanligt ljud',
 *   why: string | null,
 *   error: 'needs-tap' | 'failed' | null,
 *   startedAfterMs: number,
 *   finished: Promise<void>,
 * }} Playback
 * method är sättet klippet spelades på, why skälet när reserven användes.
 */

/**
 * @param {{ engine: ReturnType<typeof import('./audioEngine.js').createAudioEngine> }} dependencies
 */
export function createClipPlayer({ engine }) {
  // Samma element återanvänds för alla klipp. Ett nytt element senare vore
  // inte upplåst och fick inte spela utan tryck.
  const element = new Audio();
  element.preload = 'auto';
  const silenceUrl = URL.createObjectURL(new Blob([encodeWav(synthesizeSilence(SILENCE_MS))], { type: 'audio/wav' }));
  let isElementUnlocked = false;
  // Ökar vid varje start, så att ett sent svar inte startar ett klipp som har ersatts.
  let round = 0;
  /** @type {AudioBufferSourceNode | null} */
  let engineSource = null;

  // Anropas från varje tryck. Billig, och gör ingenting när allt är upplåst.
  function unlock() {
    engine.unlock();
    // Ett element som redan spelar får inte avbrytas av tystnaden.
    if (isElementUnlocked || !element.paused) return;
    element.src = silenceUrl;
    element.play().then(
      () => {
        isElementUnlocked = true;
      },
      () => {},
    );
  }

  function stopCurrentClip() {
    if (engineSource) {
      engineSource.onended = null;
      engineSource.stop();
      engineSource = null;
    }
    // pause() på ett stillastående element kan ta ljudet från ett annat på iPhone.
    if (!element.paused) element.pause();
  }

  /**
   * @param {AudioContext} context
   * @param {AudioBuffer} buffer
   * @returns {Promise<{ finished: Promise<void>, startedAtMs: number } | null>} null om motorns klocka stod still
   */
  async function startInEngine(context, buffer) {
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    const startAt = context.currentTime;
    const fadeOutAt = startAt + Math.max(FADE_IN_S, buffer.duration - FADE_OUT_S);
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(1, startAt + FADE_IN_S);
    gain.gain.setValueCurveAtTime(buildFadeOutCurve(1, FADE_CURVE_STEPS), fadeOutAt, FADE_OUT_S);
    source.connect(gain).connect(context.destination);
    /** @type {Promise<void>} */
    const finished = new Promise((resolve) => {
      source.onended = () => resolve();
    });
    source.start();
    const startedAtMs = performance.now();
    engineSource = source;
    await wait(CLOCK_CHECK_MS);
    if (context.currentTime > startAt) return { finished, startedAtMs };
    source.onended = null;
    source.stop();
    engineSource = null;
    return null;
  }

  /**
   * @param {string} url
   * @returns {Promise<{ error: Playback['error'], finished: Promise<void> }>}
   */
  async function startInElement(url) {
    element.src = url;
    /** @type {Promise<void>} */
    const finished = new Promise((resolve) => {
      element.onended = () => resolve();
      element.onerror = () => resolve();
    });
    try {
      await element.play();
      isElementUnlocked = true;
      return { error: null, finished };
    } catch (error) {
      // NotAllowedError betyder att ett tryck saknas. Andra fel betyder att klippet inte gick att spela.
      const needsTap = error instanceof Error && error.name === 'NotAllowedError';
      return { error: needsTap ? 'needs-tap' : 'failed', finished: Promise.resolve() };
    }
  }

  /**
   * @param {string} url
   * @param {{ preferEngine: boolean }} options
   * @returns {Promise<Playback | null>} null om ett nyare klipp hann ersätta det här
   */
  async function play(url, { preferEngine }) {
    round += 1;
    const myRound = round;
    const askedAt = performance.now();
    stopCurrentClip();
    let why = preferEngine ? null : 'vanligt ljud valdes';

    if (preferEngine) {
      const loaded = await loadClipToEngine(engine.getContext(), url);
      if (myRound !== round) return null;
      if ('why' in loaded) {
        why = loaded.why;
      } else {
        await engine.resume();
        if (myRound !== round) return null;
        const context = engine.getContext();
        if (!context || !engine.isRunning()) {
          why = `ljudmotorn vaknade inte (${engine.describeState()})`;
        } else {
          const started = await startInEngine(context, loaded.buffer);
          if (started) {
            return { method: 'ljudmotorn', why: null, error: null, startedAfterMs: started.startedAtMs - askedAt, finished: started.finished };
          }
          why = 'motorns klocka stod still';
        }
      }
    }

    if (myRound !== round) return null;
    const started = await startInElement(url);
    return { method: 'vanligt ljud', why, error: started.error, startedAfterMs: performance.now() - askedAt, finished: started.finished };
  }

  return { unlock, play, describeEngine: engine.describeState };
}
