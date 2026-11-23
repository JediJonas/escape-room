import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { requestMotionPermission, shouldAskForMotion, watchMotion } from '../device/motion.ts';
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
 * en scen tidigare, så här lyssnar visaren bara. Har sidan laddats om
 * efter scenen, eller kom spelaren in senare, ber första trycket i bilden
 * om tillståndet. Reserven är den breda bilden som bara går att dra i sidled.
 *
 * Blicken skrivs i lookRef, så att den som visar kan läsa vart spelaren
 * tittar när hon trycker, utan att React ritar om vid varje sensorvärde.
 */
export function RoundImageView({ src, lookRef, onTap, onLook, children }: {
  src: string;
  lookRef: RefObject<LookDirection>;
  /**
   * Ett tryck. Riktningen är den som punkten under fingret pekar åt. I den
   * breda bilden går blicken bara i sidled, och då är isSidewaysOnly sant.
   */
  onTap: (tapped: LookDirection, isSidewaysOnly: boolean) => void;
  /** Varje gång blicken har ritats, så att den som visar kan tända det som är mitt i bilden. */
  onLook?: (look: LookDirection, isSidewaysOnly: boolean) => void;
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
  const onLookRef = useRef(onLook);
  useEffect(() => {
    onTapRef.current = onTap;
    onLookRef.current = onLook;
  }, [onTap, onLook]);


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

    const lens = { fieldOfViewDeg: DEFAULT_FIELD_OF_VIEW_DEG, perspective: 'soft' } as const;
    let isLoaded = false;
    function draw() {
      const look = lookRef.current;
      if (isSphere && sphereView) sphereView.draw(look, lens);
      else stripView.draw(look);
      if (isLoaded) onLookRef.current?.(look, !isSphere);
    }

    const image = new Image();
    image.onload = () => {
      stripView.setImage(image);
      isSphere = sphereView ? sphereView.setImage(image) : false;
      isLoaded = true;
      setMode(isSphere ? 'sphere' : 'strip');
      draw();
    };
    image.onerror = () => setMode('failed');
    image.src = src;

    let stopSensor = () => {};
    let sensorTimer: ReturnType<typeof setTimeout> | undefined;
    function startSensor() {
      stopSensor();
      clearTimeout(sensorTimer);
      stopSensor = watchMotion({
        onOrientation: handleOrientation,
        onMovement: () => {},
      });
      sensorTimer = setTimeout(() => {
        if (!isSensing) stopSensor();
      }, NO_SENSOR_VALUES_TIMEOUT_MS);
    }
    function handleOrientation({ alpha, beta, gamma }: { alpha: number | null; beta: number | null; gamma: number | null }) {
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
    }
    startSensor();

    // iPhone tar bara frågan direkt i ett tryck. Den ställs innan trycket öppnar något,
    // eftersom visaren då försvinner. Trycket gör ändå det det ska.
    let isStopped = false;
    function askForSensor() {
      if (isSensing || !shouldAskForMotion()) return;
      void requestMotionPermission().then((answer) => {
        if (answer === 'granted' && !isStopped) startSensor();
      });
    }

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
      askForSensor();
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= MAX_TAP_MOVE_PX) {
        const box = frame.getBoundingClientRect();
        const point = { xPx: event.clientX - box.left, yPx: event.clientY - box.top };
        const tapped = isSphere && sphereView ? sphereView.pointToLook(lookRef.current, point, lens) : stripView.pointToLook(lookRef.current, point);
        onTapRef.current(tapped, !isSphere);
      }
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
      isStopped = true;
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
