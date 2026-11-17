import { useEffect, useState } from 'react';
import { buildQrPath, getQrViewBoxSize } from './qrPath.ts';

type QrDrawing = { text: string; path: string; size: number };

/** QR-koden som spelarna skannar för att gå med. */
export function JoinQrCode({ text }: { text: string }) {
  const [drawing, setDrawing] = useState<QrDrawing | null>(null);

  useEffect(() => {
    let isCurrent = true;
    // Biblioteket behövs bara hos spelledaren och laddas därför först här.
    import('qrcode-generator').then(({ default: createQrCode }) => {
      // Typ 0 väljer storlek efter texten. M klarar att en del av koden är skymd.
      const qrCode = createQrCode(0, 'M');
      qrCode.addData(text);
      qrCode.make();
      const moduleCount = qrCode.getModuleCount();
      if (isCurrent) setDrawing({ text, path: buildQrPath(moduleCount, (row, column) => qrCode.isDark(row, column)), size: getQrViewBoxSize(moduleCount) });
    });
    return () => {
      isCurrent = false;
    };
  }, [text]);

  if (drawing?.text !== text) return <div className="qr-code" aria-hidden="true" />;
  return (
    <svg className="qr-code" viewBox={`0 0 ${drawing.size} ${drawing.size}`} role="img" aria-label="QR-kod för att gå med i spelet" shapeRendering="crispEdges">
      <rect width={drawing.size} height={drawing.size} fill="#fff" />
      <path d={drawing.path} fill="#000" />
    </svg>
  );
}
