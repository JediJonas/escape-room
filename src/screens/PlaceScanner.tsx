import { useEffect, useRef, useState } from 'react';
import { parsePlaceCode } from '../device/placeCode.ts';
import { describeCameraError, getCameraSupport, startQrScan } from '../device/qrScanner.ts';
import type { PlaceId } from '../../supabase/functions/game/places.ts';

/**
 * Kameran som läser ett platskort. Går kameran inte att starta säger rutan
 * varför, och spelaren väljer i listan i stället.
 */
export function PlaceScanner({ onPlace, onCameraFailed }: { onPlace: (placeId: PlaceId) => void; onCameraFailed: (reason: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Startar kameran …');
  // Kameran ska inte startas om när föräldern ritar om, så funktionerna läses via en ref.
  const callbacks = useRef({ onPlace, onCameraFailed });
  useEffect(() => {
    callbacks.current = { onPlace, onCameraFailed };
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const support = getCameraSupport();
    if (!support.hasCamera) {
      callbacks.current.onCameraFailed(support.isSecure ? 'Webbläsaren ger inte sidan någon kamera.' : 'Kameran kräver en säker anslutning (https).');
      return;
    }
    let stop: (() => void) | null = null;
    let isCurrent = true;
    let hasReadPlace = false;
    startQrScan(video, (text) => {
      const placeId = parsePlaceCode(text);
      if (!placeId) {
        setStatus('Det där är inte ett platskort.');
        return;
      }
      if (hasReadPlace) return;
      hasReadPlace = true;
      callbacks.current.onPlace(placeId);
    })
      .then((scan) => {
        if (!isCurrent) scan.stop();
        else {
          stop = scan.stop;
          setStatus('Rikta kameran mot platskortet.');
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) callbacks.current.onCameraFailed(describeCameraError(error));
      });
    return () => {
      isCurrent = false;
      stop?.();
    };
  }, []);

  return (
    <div className="place-scanner">
      {/* playsInline behövs, annars öppnar iPhone videon i helskärm. */}
      <video ref={videoRef} className="camera" playsInline muted />
      <p className="hint" role="status">{status}</p>
    </div>
  );
}
