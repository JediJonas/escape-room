import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { watchMotion } from '../device/motion.ts';
import { DEFAULT_FIELD_OF_VIEW_DEG, type LookDirection, clampPitchDeg, dragToTurn, orientationToLook, turnLook, wrapYawDeg } from './lookDirection.ts';
import { createSphereView, createStripView } from './roundImageViewer.ts';

/** Kommer inga sensorvärden inom den här tiden styr fingret. */
const NO_SENSOR_VALUES_TIMEOUT_MS = 2000;
/** Ett finger som har rört sig mindre än så här räknas som ett tryck, inte ett drag. */
const MAX_TAP_MOVE_PX = 10;

/**
 * Rundbilden i spelet, med rummet vågrätt och det mjuka perspektivet som
 * provet på riktig mobil valde (se docs/koncept.md, Rundbilder). Mobilen
 * styr om rörelsesensorn ger värden, annars fingret. Tillståndet begärs i
 * en scen tidigare, så här lyssnar visaren bara. Reserven är den breda
 * bilden som bara går att dra i sidled.
 *
 * Blicken skrivs i lookRef, så att den som visar kan läsa vart spelaren
 * tittar när hon trycker, utan att React ritar om vid varje sensorvärde.
 */
export function RoundImageView({ src, lookRef, onTap, children }: {
  src: string;
  lookRef: RefObject<LookDirection>;
  onTap: () => void;
  /** Det som ligger ovanpå bilden, som mörkret och ficklampan. */
  children?: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'loading' | 'sphere' | 'strip' | 'failed'>('loading');
  const [isSensorSteering, setIsSensorSteering] = useState(false);
  // Trycket läses ur en ref, så att visaren inte startas om när föräldern ritas om.
  const onTapRef = useRef(onTap);
  useEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);


  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    const stripElement = stripRef.current;
    if (!frame || !canvas || !stripElement) return undefined;
    let sphereView: ReturnType<typeof createSphereView> = null;
    try {
      sphereView = createSphereView(canvas);
    } catch {
      sphereView = null;
    }
    const stripView = createStripView(stripElement);
    let isSphere = false;
    let isSensing = false;
    let sensorYawOffsetDeg: number | null = null;

    function draw() {
      const look = lookRef.current;
      if (isSphere && sphereView) sphereView.draw(look, { fieldOfViewDeg: DEFAULT_FIELD_OF_VIEW_DEG, perspective: 'soft' });
      else stripView.draw(look);
    }

    const image = new Image();
    image.onload = () => {
      stripView.setImage(image);
      isSphere = sphereView ? sphereView.setImage(image) : false;
      setMode(isSphere ? 'sphere' : 'strip');
      draw();
    };
    image.onerror = () => setMode('failed');
    image.src = src;

    const stopSensor = watchMotion({
      onOrientation: ({ alpha, beta, gamma }) => {
        if (alpha === null || beta === null || gamma === null) return;
        const sensed = orientationToLook({ alpha, beta, gamma });
        // Sensorns nollpunkt är godtycklig, så blicken börjar där den var.
        if (sensorYawOffsetDeg === null) sensorYawOffsetDeg = lookRef.current.yawDeg - sensed.yawDeg;
        if (!isSensing) {
          isSensing = true;
          setIsSensorSteering(true);
        }
        lookRef.current = { yawDeg: wrapYawDeg(sensed.yawDeg + sensorYawOffsetDeg), pitchDeg: isSphere ? clampPitchDeg(sensed.pitchDeg) : 0, rollDeg: sensed.rollDeg };
        draw();
      },
      onMovement: () => {},
    });
    const sensorTimer = setTimeout(() => {
      if (!isSensing) stopSensor();
    }, NO_SENSOR_VALUES_TIMEOUT_MS);

    // Fingret vrider bara när sensorn inte styr. Ett kort tryck är alltid ett tryck.
    let start: { x: number; y: number } | null = null;
    let last: { x: number; y: number } | null = null;
    const handleDown = (event: PointerEvent) => {
      start = { x: event.clientX, y: event.clientY };
      last = start;
      frame.setPointerCapture(event.pointerId);
    };
    const handleMove = (event: PointerEvent) => {
      if (!last || isSensing) return;
      const drag = { xPx: event.clientX - last.x, yPx: isSphere ? event.clientY - last.y : 0 };
      last = { x: event.clientX, y: event.clientY };
      lookRef.current = turnLook(lookRef.current, dragToTurn(drag, { heightPx: frame.clientHeight, fieldOfViewDeg: DEFAULT_FIELD_OF_VIEW_DEG }));
      draw();
    };
    const handleUp = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= MAX_TAP_MOVE_PX) onTapRef.current();
      start = null;
      last = null;
    };
    // Bilden ritas om när visaren byter storlek, och när canvas eller remsan visas efter att bilden har laddats.
    const resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(canvas);
    resizeObserver.observe(stripElement);
    frame.addEventListener('pointerdown', handleDown);
    frame.addEventListener('pointermove', handleMove);
    frame.addEventListener('pointerup', handleUp);
    return () => {
      clearTimeout(sensorTimer);
      stopSensor();
      frame.removeEventListener('pointerdown', handleDown);
      frame.removeEventListener('pointermove', handleMove);
      frame.removeEventListener('pointerup', handleUp);
      resizeObserver.disconnect();
    };
  }, [src, lookRef]);

  return (
    <div ref={frameRef} className="round-view" data-steering={isSensorSteering ? 'sensor' : 'finger'}>
      <canvas ref={canvasRef} className="round-view-canvas" hidden={mode !== 'sphere'} />
      <div ref={stripRef} className="round-view-strip" hidden={mode !== 'strip'} />
      {mode === 'failed' && <p className="round-view-message">Bilden gick inte att hämta.</p>}
      {children}
    </div>
  );
}
