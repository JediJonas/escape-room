/**
 * QR-läsning med kameran. Modulen kontrollerar om kameran finns, ber om
 * tillstånd genom att starta den och läser koder tills den stoppas. Reserven
 * (välja plats i en lista) ligger hos den som visar.
 */

const SCAN_INTERVAL_MS = 150;
/** Bredare bilder än så här gör bara läsningen långsammare. */
const MAX_SCAN_WIDTH_PX = 640;

export function getCameraSupport() {
  return {
    hasCamera: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    // Kameran går bara att nå på en säker anslutning (https).
    isSecure: window.isSecureContext,
  };
}

/**
 * Förklarar ett kamerafel för spelaren.
 */
export function describeCameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') return 'Kameran fick inte användas. Tillåt kameran för sidan i webbläsarens inställningar.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Ingen kamera hittades.';
  if (name === 'NotReadableError') return 'Kameran används av en annan app.';
  return `Kameran gick inte att starta (${name || 'okänt fel'}).`;
}

/** Webbläsarens egen QR-läsare. Finns inte i TypeScripts typer än. */
type BarcodeDetectorClass = {
  new (options: { formats: string[] }): { detect: (source: HTMLCanvasElement) => Promise<{ rawValue: string }[]> };
  getSupportedFormats: () => Promise<string[]>;
};

type QrDecoder = { name: string; decode: (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => Promise<string | null> };

/**
 * Väljer webbläsarens egen läsare där den finns (Android Chrome) och laddar
 * annars jsQR (iPhone Safari saknar BarcodeDetector).
 */
async function createDecoder(): Promise<QrDecoder> {
  const BarcodeDetector = (window as Window & { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (BarcodeDetector) {
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        return {
          name: 'webbläsarens egen läsare',
          decode: async (canvas) => {
            const codes = await detector.detect(canvas);
            return codes.length > 0 ? codes[0].rawValue : null;
          },
        };
      }
    } catch {
      // Läsaren finns men svarar inte. Då används jsQR i stället.
    }
  }
  // Laddas först här, så att mobiler med egen läsare aldrig hämtar jsQR.
  const { default: jsQR } = await import('jsqr');
  return {
    name: 'jsQR',
    decode: async (canvas, context) => {
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height);
      return code && code.data ? code.data : null;
    },
  };
}

/**
 * Startar kameran i videoelementet och anropar onCode för varje läst kod.
 * Kastar kamerans eget fel om den inte går att starta.
 */
export async function startQrScan(video: HTMLVideoElement, onCode: (text: string) => void): Promise<{ decoderName: string; stop: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  let isStopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    isStopped = true;
    clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  try {
    video.srcObject = stream;
    await video.play();
    const decoder = await createDecoder();
    const canvas = document.createElement('canvas');
    const context = (canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D);

    const scanFrame = async () => {
      if (isStopped) return;
      if (video.videoWidth > 0) {
        const scale = Math.min(1, MAX_SCAN_WIDTH_PX / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const text = await decoder.decode(canvas, context).catch(() => null);
        if (text && !isStopped) onCode(text);
      }
      if (!isStopped) timer = setTimeout(scanFrame, SCAN_INTERVAL_MS);
    };
    scanFrame();
    return { decoderName: decoder.name, stop };
  } catch (error) {
    stop();
    throw error;
  }
}
