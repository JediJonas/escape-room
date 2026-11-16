import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, VERSION } from '../config.ts';
import { createAudioEngine } from '../sound/audioEngine.ts';
import { createClipPlayer } from '../sound/clipPlayer.ts';
import { createDebugLog } from './debugLog.ts';
import { getButton, getElement } from './dom.ts';
import { setupMotionCard } from './motionCard.ts';
import { setupQrCard } from './qrCard.ts';
import { copyReport, createReport } from './report.ts';
import { setupRoundImageCard } from './roundImageCard.ts';
import { setupServerCard } from './serverCard.ts';
import { setupSoundCard } from './soundCard.ts';
import { setupSyncCard } from './syncCard.ts';

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
const supabaseConfig = { url: SUPABASE_URL, publicKey: SUPABASE_PUBLIC_KEY };
setupSyncCard({ supabaseConfig, report, log });
setupRoundImageCard({ report, log });
setupServerCard({ supabaseConfig, report, log });

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
