import { type PointerEvent, useEffect, useState } from 'react';
import { dragPendulum, swingPendulum } from './pendulum.ts';

/** Pendeln är släppt från en vinkel vid en tidpunkt och gungar ut. */
type Swing = { from: number; startMs: number };

/**
 * Fönstret i golvurets skåp med pendeln bakom en glaslucka. Ett tryck på
 * luckan öppnar och stänger den, och när den är öppen gungar spelaren
 * pendeln genom att svajpa i sidled (Jonas 2026-11-18). Pendeln står still
 * av sig själv, eftersom uret har stannat. Gungningen syns bara i den egna
 * mobilen.
 */
export function Pendulum() {
  const [isOpen, setIsOpen] = useState(false);
  const [drag, setDrag] = useState<{ startX: number; angle: number } | null>(null);
  const [swing, setSwing] = useState<Swing | null>(null);
  const [swingAngle, setSwingAngle] = useState(0);

  useEffect(() => {
    if (!swing) return undefined;
    let frame = requestAnimationFrame(function step(nowMs) {
      const angle = swingPendulum(swing.from, nowMs - swing.startMs);
      setSwingAngle(angle);
      if (angle === 0) setSwing(null);
      else frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [swing]);

  const angle = drag ? drag.angle : swingAngle;

  function start(event: PointerEvent<HTMLDivElement>) {
    if (!isOpen) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSwing(null);
    setDrag({ startX: event.clientX - swingAngle, angle: swingAngle });
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (drag) setDrag({ ...drag, angle: dragPendulum(event.clientX - drag.startX) });
  }

  function release() {
    if (!drag) return;
    setDrag(null);
    setSwingAngle(drag.angle);
    setSwing({ from: drag.angle, startMs: performance.now() });
  }

  return (
    <div
      className={isOpen ? 'clock-window is-open' : 'clock-window'}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {/* Pendeln svänger åt det håll fingret drar, och skåpets kanter skymmer den. */}
      <div className="clock-glass"><div className="clock-pendulum" style={{ transform: `rotate(${-angle}deg)` }} /></div>
      <button
        type="button"
        className="clock-door"
        aria-label={isOpen ? 'Stäng glasluckan' : 'Öppna glasluckan'}
        aria-pressed={isOpen}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setIsOpen(!isOpen)}
      />
    </div>
  );
}
