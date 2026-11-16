// @ts-check
import { DEFAULT_FIELD_OF_VIEW_DEG, dragToTurn, turnLook, zoomFieldOfView } from '../view/lookDirection.js';
import { createSphereView, createStripView } from '../view/roundImageViewer.js';
import { getElement } from './dom.js';

/** Rundbilderna som går att välja. Skarven ligger alltid rakt bakom startriktningen. */
const ROUND_IMAGES = [
  { name: 'Stora källaren (Gemini)', file: 'rundbilder/kallare-stor.webp' },
  { name: 'Lilla källaren (Gemini)', file: 'rundbilder/kallare.webp' },
  { name: 'Provbild med rutnät', file: 'rundbilder/provbild-rutnat.webp' },
];

/** Hur långt knapparna vrider blicken per tryck. */
const BUTTON_TURN_DEG = 30;
/** Hur mycket zoomknapparna och ett hack på mushjulet zoomar. */
const BUTTON_ZOOM_FACTOR = 1.25;
const WHEEL_ZOOM_FACTOR = 1.1;

const LOOK_AHEAD = { yawDeg: 0, pitchDeg: 0 };
const LOOK_AT_SEAM = { yawDeg: -180, pitchDeg: 0 };

/**
 * @param {{ report: ReturnType<typeof import('./report.js').createReport>, log: (text: string) => void }} dependencies
 */
export function setupRoundImageCard({ report, log }) {
  const frame = getElement('round-frame');
  const canvas = /** @type {HTMLCanvasElement} */ (getElement('round-canvas'));
  const stripElement = getElement('round-strip');
  const imageSelect = /** @type {HTMLSelectElement} */ (getElement('round-image'));
  const modeButtons = { sphere: getElement('round-mode-sphere'), strip: getElement('round-mode-strip') };
  const status = getElement('round-status');

  const stripView = createStripView(stripElement);
  /** @type {ReturnType<typeof createSphereView>} */
  let sphereView = null;
  try {
    sphereView = createSphereView(canvas);
  } catch (error) {
    log(`rundbild: rundvisaren gick inte att starta, ${error}`);
  }

  /** @type {'sphere' | 'strip'} */
  let mode = sphereView ? 'sphere' : 'strip';
  let look = LOOK_AHEAD;
  let fieldOfViewDeg = DEFAULT_FIELD_OF_VIEW_DEG;
  let isImageInSphere = false;

  function draw() {
    if (mode === 'sphere' && sphereView) sphereView.draw(look, fieldOfViewDeg);
    else stripView.draw(look);
  }

  /** @param {'sphere' | 'strip'} newMode */
  function showMode(newMode) {
    mode = newMode;
    canvas.hidden = mode !== 'sphere';
    stripElement.hidden = mode !== 'strip';
    // Rundvisaren behöver drag i höjdled. Remsan låter sidan rulla som vanligt.
    frame.style.touchAction = mode === 'sphere' ? 'none' : 'pan-y';
    modeButtons.sphere.setAttribute('aria-pressed', String(mode === 'sphere'));
    modeButtons.strip.setAttribute('aria-pressed', String(mode === 'strip'));
    // Reserven har varken höjdled eller zoom.
    ['round-up', 'round-down', 'round-zoom-in', 'round-zoom-out'].forEach((id) => {
      getElement(id).toggleAttribute('disabled', mode !== 'sphere');
    });
    report.setResult('Rundbild, visare', mode === 'sphere' ? 'rundvisaren (WebGL)' : 'reserven (bred bild)');
    draw();
  }

  /** @param {{ name: string, file: string }} roundImage */
  function loadImage(roundImage) {
    const image = new Image();
    status.textContent = 'Hämtar bilden …';
    image.onload = () => {
      stripView.setImage(image);
      isImageInSphere = sphereView ? sphereView.setImage(image) : false;
      status.textContent = isImageInSphere
        ? 'Dra i bilden för att se dig omkring.'
        : 'Rundvisaren fungerar inte i den här mobilen. Reserven visas: dra bilden i sidled.';
      log(`rundbild: ${roundImage.file}, ${image.naturalWidth}×${image.naturalHeight}, rundvisare ${isImageInSphere}`);
      report.setResult('Rundbild', `${roundImage.name}, ${image.naturalWidth}×${image.naturalHeight}`);
      modeButtons.sphere.toggleAttribute('disabled', !isImageInSphere);
      showMode(isImageInSphere ? mode : 'strip');
    };
    image.onerror = () => {
      status.textContent = 'Bilden gick inte att hämta.';
      report.setResult('Rundbild', `${roundImage.name} gick inte att hämta`);
    };
    image.src = roundImage.file;
  }

  /** @param {import('../view/lookDirection.js').LookDirection} newLook */
  function lookAt(newLook) {
    look = mode === 'sphere' ? newLook : { ...newLook, pitchDeg: 0 };
    draw();
  }

  /** @param {number} zoomFactor över 1 zoomar in */
  function zoom(zoomFactor) {
    if (mode !== 'sphere') return;
    fieldOfViewDeg = zoomFieldOfView(fieldOfViewDeg, zoomFactor);
    draw();
  }

  // Ett finger vrider blicken, två fingrar zoomar. Fingrarna hålls isär med
  // sina id, eftersom varje finger skickar egna händelser.
  /** @type {Map<number, { x: number, y: number }>} */
  const fingers = new Map();
  const measureFingerSpreadPx = () => {
    const [first, second] = [...fingers.values()];
    return Math.hypot(first.x - second.x, first.y - second.y);
  };

  frame.addEventListener('pointerdown', (event) => {
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    frame.setPointerCapture(event.pointerId);
  });
  frame.addEventListener('pointermove', (event) => {
    const lastPoint = fingers.get(event.pointerId);
    if (!lastPoint) return;
    const spreadBeforePx = fingers.size === 2 ? measureFingerSpreadPx() : 0;
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (fingers.size === 2) {
      if (spreadBeforePx > 0) zoom(measureFingerSpreadPx() / spreadBeforePx);
      return;
    }
    const drag = { xPx: event.clientX - lastPoint.x, yPx: event.clientY - lastPoint.y };
    lookAt(turnLook(look, dragToTurn(drag, { heightPx: frame.clientHeight, fieldOfViewDeg })));
  });
  /** @param {PointerEvent} event */
  const liftFinger = (event) => fingers.delete(event.pointerId);
  frame.addEventListener('pointerup', liftFinger);
  frame.addEventListener('pointercancel', liftFinger);

  frame.addEventListener(
    'wheel',
    (event) => {
      if (mode !== 'sphere') return;
      event.preventDefault();
      zoom(event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR);
    },
    { passive: false },
  );
  // Safari på iPhone zoomar annars hela sidan när två fingrar dras isär.
  frame.addEventListener('gesturestart', (event) => event.preventDefault());

  // Knapparna gör visaren användbar utan pekskärm, och ställer blicken mot
  // det som ska bedömas: skarven, taket och golvet.
  /** @type {Record<string, () => import('../view/lookDirection.js').LookDirection>} */
  const lookButtons = {
    'round-left': () => turnLook(look, { yawDeg: -BUTTON_TURN_DEG, pitchDeg: 0 }),
    'round-right': () => turnLook(look, { yawDeg: BUTTON_TURN_DEG, pitchDeg: 0 }),
    'round-up': () => turnLook(look, { yawDeg: 0, pitchDeg: BUTTON_TURN_DEG }),
    'round-down': () => turnLook(look, { yawDeg: 0, pitchDeg: -BUTTON_TURN_DEG }),
    'round-ahead': () => {
      fieldOfViewDeg = DEFAULT_FIELD_OF_VIEW_DEG;
      return LOOK_AHEAD;
    },
    'round-seam': () => LOOK_AT_SEAM,
  };
  Object.entries(lookButtons).forEach(([id, getLook]) => {
    getElement(id).addEventListener('click', () => lookAt(getLook()));
  });

  getElement('round-zoom-in').addEventListener('click', () => zoom(BUTTON_ZOOM_FACTOR));
  getElement('round-zoom-out').addEventListener('click', () => zoom(1 / BUTTON_ZOOM_FACTOR));

  modeButtons.sphere.addEventListener('click', () => showMode('sphere'));
  modeButtons.strip.addEventListener('click', () => {
    look = { ...look, pitchDeg: 0 };
    showMode('strip');
  });

  ROUND_IMAGES.forEach((roundImage, index) => imageSelect.add(new Option(roundImage.name, String(index))));
  imageSelect.addEventListener('change', () => loadImage(ROUND_IMAGES[Number(imageSelect.value)]));
  new ResizeObserver(draw).observe(frame);
  loadImage(ROUND_IMAGES[0]);
}
