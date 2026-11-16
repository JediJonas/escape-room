// @ts-check
import { PLACE_IDS, parsePlaceCode } from '../device/placeCode.js';
import { describeCameraError, getCameraSupport, startQrScan } from '../device/qrScanner.js';
import { getButton, getElement } from './dom.js';

const MAX_SHOWN_CODE_LENGTH = 40;

/**
 * @param {{ report: ReturnType<typeof import('./report.js').createReport>, log: (text: string) => void }} dependencies
 */
export function setupQrCard({ report, log }) {
  const startButton = getButton('qr-start');
  const stopButton = getButton('qr-stop');
  const video = /** @type {HTMLVideoElement} */ (getElement('qr-video'));
  const status = getElement('qr-status');
  const result = getElement('qr-result');
  const fallback = getElement('qr-fallback');
  /** @type {(() => void) | null} */
  let stopScan = null;

  // Det lästa kortet visas stort, så att det inte går att missa under kamerabilden.
  /** @param {string} text */
  function showResult(text) {
    result.textContent = text;
    result.hidden = false;
  }

  function closeCamera() {
    if (stopScan) stopScan();
    stopScan = null;
    video.hidden = true;
    stopButton.hidden = true;
    startButton.hidden = false;
    startButton.disabled = false;
  }

  startButton.addEventListener('click', async () => {
    const support = getCameraSupport();
    log(`qr: stöd ${JSON.stringify(support)}`);
    if (!support.hasCamera) {
      const reason = support.isSecure ? 'Webbläsaren ger inte sidan någon kamera.' : 'Kameran kräver en säker anslutning (https).';
      status.textContent = `${reason} Välj plats i listan.`;
      report.setResult('QR', `kamera saknas (${reason})`);
      return;
    }

    startButton.disabled = true;
    result.hidden = true;
    status.textContent = 'Startar kameran …';
    video.hidden = false;
    const startedAt = performance.now();
    let hasReadPlace = false;
    try {
      const scan = await startQrScan(video, (text) => {
        const placeId = parsePlaceCode(text);
        if (!placeId) {
          status.textContent = `Läste en kod som inte är ett platskort: ${text.slice(0, MAX_SHOWN_CODE_LENGTH)}`;
          return;
        }
        status.textContent = 'Kortet är läst. Rikta kameran mot ett annat kort för att läsa fler.';
        showResult(`Läste platskort ${placeId}`);
        if (hasReadPlace) return;
        hasReadPlace = true;
        const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
        report.setResult('QR', `läste kort ${placeId} med ${scan.decoderName}, ${seconds} s efter start`);
        log(`qr: läste ${placeId} efter ${seconds} s`);
      });
      stopScan = scan.stop;
      startButton.hidden = true;
      stopButton.hidden = false;
      status.textContent = 'Kameran är igång. Rikta den mot ett platskort.';
      report.setResult('QR', `kameran startade med ${scan.decoderName}, inget kort läst än`);
      log(`qr: läsare ${scan.decoderName}`);
    } catch (error) {
      closeCamera();
      status.textContent = `${describeCameraError(error)} Välj plats i listan.`;
      report.setResult('QR', `kameran startade inte (${error instanceof Error ? error.name : 'okänt fel'})`);
      log(`qr: fel ${error}`);
    }
  });

  stopButton.addEventListener('click', () => {
    closeCamera();
    status.textContent = 'Kameran är stängd.';
  });

  // Reserven: samma platser går att välja i en lista.
  PLACE_IDS.forEach((placeId) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = placeId;
    button.setAttribute('aria-label', `Plats ${placeId}`);
    button.addEventListener('click', () => {
      status.textContent = 'Platsen valdes i listan.';
      showResult(`Valde plats ${placeId}`);
      report.setResult('QR, reserv', `plats ${placeId} valdes i listan`);
    });
    fallback.append(button);
  });
}
