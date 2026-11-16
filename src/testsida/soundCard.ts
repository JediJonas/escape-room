import { wait } from '../sound/audioEngine.ts';
import type { ClipPlayer } from '../sound/clipPlayer.ts';
import { encodeWav, synthesizeChime } from '../sound/wav.ts';
import { getButton, getElement } from './dom.ts';
import type { Log, Report } from './report.ts';

const DELAY_BEFORE_UNPROMPTED_SOUND_MS = 5000;
const CHIME = { notesHz: [659, 880, 1319], noteMs: 700 };

export function setupSoundCard({ player, report, log }: {
  player: ClipPlayer;
  report: Report;
  log: Log;
}) {
  const buttons = [getButton('sound-engine'), getButton('sound-element'), getButton('sound-delayed')];
  const playing = getElement('sound-playing');
  const status = getElement('sound-status');
  const chimeUrl = URL.createObjectURL(new Blob([encodeWav(synthesizeChime(CHIME))], { type: 'audio/wav' }));

  /**
   * @param topic rubriken i resultatet
   */
  async function playChime(topic: string, { preferEngine }: { preferEngine: boolean }) {
    const playback = await player.play(chimeUrl, { preferEngine });
    if (!playback) return;
    const how = playback.why ? `${playback.method} (${playback.why})` : playback.method;
    log(`ljud: ${topic}: ${how}, fel ${playback.error ?? 'inget'}, motorn ${player.describeEngine()}`);

    if (playback.error === 'needs-tap') {
      status.textContent = 'Mobilen kräver ett tryck för att spela. Tryck på knappen igen.';
      report.setResult(topic, `${how}, stoppades eftersom ett tryck saknades`);
      return;
    }
    if (playback.error === 'failed') {
      status.textContent = 'Ljudet gick inte att spela.';
      report.setResult(topic, `${how}, gick inte att spela`);
      return;
    }
    const startedAfterMs = Math.round(playback.startedAfterMs);
    status.textContent = `Spelades med ${how}.`;
    report.setResult(topic, `${how}, startade efter ${startedAfterMs} ms`);
    // Reserven för ljud är att samma sak syns på skärmen.
    playing.hidden = false;
    await playback.finished;
    playing.hidden = true;
  }

  async function runWithButtonsDisabled(test: () => Promise<void>) {
    // Ett ljud i taget: två klipp samtidigt vägrar ofta starta på iPhone.
    buttons.forEach((button) => {
      button.disabled = true;
    });
    try {
      await test();
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }
  }

  buttons[0].addEventListener('click', () => runWithButtonsDisabled(() => playChime('Ljud, med toning', { preferEngine: true })));
  buttons[1].addEventListener('click', () => runWithButtonsDisabled(() => playChime('Ljud, vanligt', { preferEngine: false })));
  buttons[2].addEventListener('click', () =>
    runWithButtonsDisabled(async () => {
      status.textContent = 'Ljudet kommer om 5 sekunder. Rör inte skärmen.';
      await wait(DELAY_BEFORE_UNPROMPTED_SOUND_MS);
      await playChime('Ljud, utan tryck', { preferEngine: true });
    }),
  );
}
