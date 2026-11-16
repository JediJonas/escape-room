// @ts-check
import { getMotionSupport, requestMotionPermission, watchMotion } from '../device/motion.js';
import { measureMovement, tiltToPosition } from '../device/tilt.js';
import { getButton, getElement } from './dom.js';

/** Kommer inga värden inom den här tiden används reserven. */
const NO_VALUES_TIMEOUT_MS = 2000;
/** Över den här nivån räknas mobilen som i rörelse. Ska prövas på riktiga mobiler. */
const MOVING_THRESHOLD_MS2 = 0.8;

/** @param {number | null} degrees */
const formatDegrees = (degrees) => (degrees === null ? '–' : `${Math.round(degrees)}°`);

/**
 * @param {{ report: ReturnType<typeof import('./report.js').createReport>, log: (text: string) => void }} dependencies
 */
export function setupMotionCard({ report, log }) {
  const startButton = getButton('motion-start');
  const arena = getElement('motion-arena');
  const ball = getElement('motion-ball');
  const status = getElement('motion-status');
  const betaValue = getElement('motion-beta');
  const gammaValue = getElement('motion-gamma');
  const alphaValue = getElement('motion-alpha');
  const movementValue = getElement('motion-movement');
  let hasTiltValues = false;
  let hasMovementValues = false;
  let peakMovement = 0;

  /** @param {{ x: number, y: number }} position mellan -1 och 1 */
  function moveBall(position) {
    ball.style.setProperty('--x', String(position.x));
    ball.style.setProperty('--y', String(position.y));
  }

  // Reserven: pricken följer fingret så länge sensorn inte ger några värden.
  /** @param {PointerEvent} event */
  function dragBall(event) {
    if (hasTiltValues || event.buttons === 0) return;
    const box = arena.getBoundingClientRect();
    const toUnit = (/** @type {number} */ share) => Math.max(-1, Math.min(1, share * 2 - 1));
    moveBall({ x: toUnit((event.clientX - box.left) / box.width), y: toUnit((event.clientY - box.top) / box.height) });
    report.setResult('Rörelse, reserv', 'pricken drogs med fingret');
  }
  arena.addEventListener('pointerdown', dragBall);
  arena.addEventListener('pointermove', dragBall);

  /** @param {string} permission */
  function reportSensors(permission) {
    const tilt = hasTiltValues ? 'ja' : 'nej';
    const movement = hasMovementValues ? `ja, högst ${peakMovement.toFixed(1)} m/s²` : 'nej';
    report.setResult('Rörelse', `tillstånd ${permission}, lutning ${tilt}, rörelsemätning ${movement}`);
  }

  startButton.addEventListener('click', async () => {
    const support = getMotionSupport();
    log(`rörelse: stöd ${JSON.stringify(support)}`);
    if (!support.hasOrientation && !support.hasMovement) {
      status.textContent = 'Webbläsaren har ingen rörelsesensor. Dra pricken med fingret.';
      report.setResult('Rörelse', 'sensor saknas i webbläsaren');
      return;
    }
    const permission = await requestMotionPermission();
    log(`rörelse: tillstånd ${permission}`);
    if (permission === 'denied') {
      status.textContent = 'Rörelsesensorn fick inte användas. Dra pricken med fingret.';
      report.setResult('Rörelse', 'tillstånd nekades');
      return;
    }

    startButton.disabled = true;
    status.textContent = 'Väntar på sensorn …';
    watchMotion({
      onOrientation: (orientation) => {
        if (orientation.beta === null || orientation.gamma === null) return;
        if (!hasTiltValues) {
          hasTiltValues = true;
          status.textContent = 'Sensorn är igång. Luta mobilen.';
          reportSensors(permission);
        }
        moveBall(tiltToPosition(orientation));
        betaValue.textContent = formatDegrees(orientation.beta);
        gammaValue.textContent = formatDegrees(orientation.gamma);
        alphaValue.textContent = formatDegrees(orientation.alpha);
      },
      onMovement: (motion) => {
        const movement = measureMovement(motion);
        if (movement === null) return;
        hasMovementValues = true;
        const isMoving = movement > MOVING_THRESHOLD_MS2;
        movementValue.textContent = `${isMoving ? 'Rör sig' : 'Stilla'} (${movement.toFixed(1)} m/s²)`;
        if (movement > peakMovement) {
          peakMovement = movement;
          reportSensors(permission);
        }
      },
    });

    setTimeout(() => {
      if (hasTiltValues) return;
      status.textContent = 'Inga sensorvärden kom. Dra pricken med fingret.';
      reportSensors(permission);
    }, NO_VALUES_TIMEOUT_MS);
  });
}
