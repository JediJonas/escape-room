// @ts-check
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, VERSION } from '../config.js';
import { createAudioEngine } from '../sound/audioEngine.js';
import { createClipPlayer } from '../sound/clipPlayer.js';
import { createDebugLog } from './debugLog.js';
import { getButton, getElement } from './dom.js';
import { setupMotionCard } from './motionCard.js';
import { setupQrCard } from './qrCard.js';
import { copyReport, createReport } from './report.js';
import { setupRoundImageCard } from './roundImageCard.js';
import { setupSoundCard } from './soundCard.js';
import { setupSyncCard } from './syncCard.js';

const log = createDebugLog({ version: VERSION });
const reportOutput = getElement('report-text');
const report = createReport({ output: reportOutput, version: VERSION });
const player = createClipPlayer({ engine: createAudioEngine() });

getElement('version').textContent = VERSION;

// Ljudet låses upp vid varje tryck, inte bara det första. Mobilen spelar
// inget ljud som inte har startats av ett tryck.
document.addEventListener('pointerdown', () => player.unlock());

setupMotionCard({ report, log });
setupQrCard({ report, log });
setupSoundCard({ player, report, log });
setupSyncCard({ supabaseConfig: { url: SUPABASE_URL, publicKey: SUPABASE_PUBLIC_KEY }, report, log });
setupRoundImageCard({ report, log });

// Omdömena: testaren svarar själv på det som sidan inte kan mäta, som om ljudet hördes.
document.querySelectorAll('.verdict').forEach((verdict) => {
  const topic = verdict.getAttribute('data-verdict') ?? '';
  const answerButtons = [...verdict.querySelectorAll('button')];
  answerButtons.forEach((answerButton) => {
    answerButton.setAttribute('aria-pressed', 'false');
    answerButton.addEventListener('click', () => {
      answerButtons.forEach((other) => other.setAttribute('aria-pressed', String(other === answerButton)));
      report.setResult(topic, answerButton.getAttribute('data-answer') ?? '');
    });
  });
});

const copyStatus = getElement('report-status');
getButton('report-copy').addEventListener('click', async () => {
  const isCopied = await copyReport(report.getText(), reportOutput);
  copyStatus.textContent = isCopied ? 'Kopierat.' : 'Texten är markerad. Kopiera den för hand.';
});
