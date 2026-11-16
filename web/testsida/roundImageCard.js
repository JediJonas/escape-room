// @ts-check
import { dragToTurn, turnLook } from '../view/lookDirection.js';
import { createSphereView, createStripView, FIELD_OF_VIEW_DEG } from '../view/roundImageViewer.js';
import { getElement } from './dom.js';

/** Rundbilderna som går att välja. Skarven ligger alltid rakt bakom startriktningen. */
const ROUND_IMAGES = [{ name: 'Provbild med rutnät', file: 'rundbilder/provbild-rutnat.webp' }];

/** Hur långt knapparna vrider blicken per tryck. */
const BUTTON_TURN_DEG = 30;

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
  let isImageInSphere = false;

  function draw() {
    if (mode === 'sphere' && sphereView) sphereView.draw(look);
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
    getElement('round-up').toggleAttribute('disabled', mode !== 'sphere');
    getElement('round-down').toggleAttribute('disabled', mode !== 'sphere');
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

  /** @type {{ x: number, y: number } | null} */
  let lastPoint = null;
  frame.addEventListener('pointerdown', (event) => {
    lastPoint = { x: event.clientX, y: event.clientY };
    frame.setPointerCapture(event.pointerId);
  });
  frame.addEventListener('pointermove', (event) => {
    if (!lastPoint) return;
    const drag = { xPx: event.clientX - lastPoint.x, yPx: event.clientY - lastPoint.y };
    lastPoint = { x: event.clientX, y: event.clientY };
    lookAt(turnLook(look, dragToTurn(drag, { heightPx: frame.clientHeight, fieldOfViewDeg: FIELD_OF_VIEW_DEG })));
  });
  const endDrag = () => {
    lastPoint = null;
  };
  frame.addEventListener('pointerup', endDrag);
  frame.addEventListener('pointercancel', endDrag);

  // Knapparna gör visaren användbar utan pekskärm, och ställer blicken mot
  // det som ska bedömas: skarven, taket och golvet.
  /** @type {Record<string, () => import('../view/lookDirection.js').LookDirection>} */
  const lookButtons = {
    'round-left': () => turnLook(look, { yawDeg: -BUTTON_TURN_DEG, pitchDeg: 0 }),
    'round-right': () => turnLook(look, { yawDeg: BUTTON_TURN_DEG, pitchDeg: 0 }),
    'round-up': () => turnLook(look, { yawDeg: 0, pitchDeg: BUTTON_TURN_DEG }),
    'round-down': () => turnLook(look, { yawDeg: 0, pitchDeg: -BUTTON_TURN_DEG }),
    'round-ahead': () => LOOK_AHEAD,
    'round-seam': () => LOOK_AT_SEAM,
  };
  Object.entries(lookButtons).forEach(([id, getLook]) => {
    getElement(id).addEventListener('click', () => lookAt(getLook()));
  });

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
