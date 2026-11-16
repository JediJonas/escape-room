// @ts-check
import { requestMotionPermission, watchMotion } from '../device/motion.js';
import {
  clampPitchDeg,
  DEFAULT_FIELD_OF_VIEW_DEG,
  dragToTurn,
  orientationToLook,
  turnLook,
  wrapYawDeg,
  zoomFieldOfView,
} from '../view/lookDirection.js';
import { createSphereView, createStripView } from '../view/roundImageViewer.js';
import { getElement } from './dom.js';

/** Rundbilderna som går att välja. Skarven ligger alltid rakt bakom startriktningen. */
const ROUND_IMAGES = [
  { name: 'Största källaren (Gemini)', file: 'rundbilder/kallare-storst.webp' },
  { name: 'Stora källaren (Gemini)', file: 'rundbilder/kallare-stor.webp' },
  { name: 'Lilla källaren (Gemini)', file: 'rundbilder/kallare.webp' },
  { name: 'Rutnät, 8 rutor per sida', file: 'rundbilder/provbild-rutnat.webp' },
  { name: 'Rutnät, 16 rutor per sida', file: 'rundbilder/provbild-rutnat-stor.webp' },
];

/** Hur långt knapparna vrider blicken per tryck. */
const BUTTON_TURN_DEG = 30;
/** Hur mycket zoomknapparna och ett hack på mushjulet zoomar. */
const BUTTON_ZOOM_FACTOR = 1.25;
const WHEEL_ZOOM_FACTOR = 1.1;
/** Kommer inga sensorvärden inom den här tiden får fingret ta över igen. */
const NO_SENSOR_VALUES_TIMEOUT_MS = 2000;

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
  /** @type {import('../view/lookDirection.js').LookDirection} */
  let look = LOOK_AHEAD;
  let fieldOfViewDeg = DEFAULT_FIELD_OF_VIEW_DEG;
  /** @type {'straight' | 'soft'} */
  // Ägaren valde det mjuka perspektivet efter prov på riktig mobil.
  let perspective = 'soft';
  // Påslaget från början: ägaren föredrog det på riktig mobil.
  let isRoomKeptLevel = true;
  let isImageInSphere = false;

  function draw() {
    if (mode === 'sphere' && sphereView) {
      const levelLook = isRoomKeptLevel ? look : { ...look, rollDeg: 0 };
      sphereView.draw(levelLook, { fieldOfViewDeg, perspective });
    }
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

  // När mobilens rörelse styr är sensorn facit för höjdled, medan vridningen
  // får ett tillägg. Tillägget gör att bilden inte hoppar när sensorn startar,
  // och att fingret och knapparna kan vrida rummet i förhållande till mobilen.
  /** @type {(() => void) | null} */
  let stopSensor = null;
  /** @type {number | null} */
  let sensorYawOffsetDeg = null;
  let sensedYawDeg = 0;

  /** @param {import('../view/lookDirection.js').LookDirection} newLook */
  function lookAt(newLook) {
    if (stopSensor && sensorYawOffsetDeg !== null) {
      sensorYawOffsetDeg = newLook.yawDeg - sensedYawDeg;
      look = { ...look, yawDeg: newLook.yawDeg };
    } else {
      look = mode === 'sphere' ? newLook : { ...newLook, pitchDeg: 0 };
    }
    draw();
  }

  const sensorButton = getElement('round-sensor');

  function stopFollowingSensor() {
    stopSensor?.();
    stopSensor = null;
    sensorYawOffsetDeg = null;
    sensorButton.setAttribute('aria-pressed', 'false');
  }

  /** @param {{ alpha: number | null, beta: number | null, gamma: number | null }} orientation */
  function followSensor({ alpha, beta, gamma }) {
    if (alpha === null || beta === null || gamma === null) return;
    const sensed = orientationToLook({ alpha, beta, gamma });
    sensedYawDeg = sensed.yawDeg;
    if (sensorYawOffsetDeg === null) {
      sensorYawOffsetDeg = look.yawDeg - sensedYawDeg;
      status.textContent = 'Vrid dig med mobilen framför dig för att se dig omkring.';
      report.setResult('Rundbild, rörelse', 'bilden följer mobilen');
    }
    look = {
      yawDeg: wrapYawDeg(sensedYawDeg + sensorYawOffsetDeg),
      pitchDeg: clampPitchDeg(sensed.pitchDeg),
      rollDeg: sensed.rollDeg,
    };
    draw();
  }

  sensorButton.addEventListener('click', async () => {
    if (stopSensor) {
      stopFollowingSensor();
      status.textContent = 'Dra i bilden för att se dig omkring.';
      return;
    }
    const permission = await requestMotionPermission();
    log(`rundbild: tillstånd för rörelse ${permission}`);
    if (permission === 'denied') {
      status.textContent = 'Rörelsesensorn fick inte användas. Dra i bilden med fingret.';
      report.setResult('Rundbild, rörelse', 'tillstånd nekades');
      return;
    }
    stopSensor = watchMotion({ onOrientation: followSensor, onMovement: () => {} });
    sensorButton.setAttribute('aria-pressed', 'true');
    status.textContent = 'Väntar på sensorn …';
    setTimeout(() => {
      if (!stopSensor || sensorYawOffsetDeg !== null) return;
      stopFollowingSensor();
      status.textContent = 'Inga sensorvärden kom. Dra i bilden med fingret.';
      report.setResult('Rundbild, rörelse', 'inga sensorvärden');
    }, NO_SENSOR_VALUES_TIMEOUT_MS);
  });

  // Synfältet och perspektivet står i resultattexten, så att det går att
  // säga vilken inställning som kändes bäst.
  function reportLens() {
    const perspectiveName = perspective === 'soft' ? 'mjukt' : 'hårt';
    const levelName = isRoomKeptLevel ? 'rummet hålls vågrätt' : 'rummet lutar med mobilen';
    report.setResult('Rundbild, perspektiv', `${perspectiveName}, synfält ${Math.round(fieldOfViewDeg)}°, ${levelName}`);
  }

  const perspectiveButtons = { straight: getElement('round-perspective-straight'), soft: getElement('round-perspective-soft') };
  /** @param {'straight' | 'soft'} newPerspective */
  function showPerspective(newPerspective) {
    perspective = newPerspective;
    perspectiveButtons.straight.setAttribute('aria-pressed', String(perspective === 'straight'));
    perspectiveButtons.soft.setAttribute('aria-pressed', String(perspective === 'soft'));
    reportLens();
    draw();
  }
  perspectiveButtons.straight.addEventListener('click', () => showPerspective('straight'));
  perspectiveButtons.soft.addEventListener('click', () => showPerspective('soft'));

  const levelButton = getElement('round-level');
  levelButton.addEventListener('click', () => {
    isRoomKeptLevel = !isRoomKeptLevel;
    levelButton.setAttribute('aria-pressed', String(isRoomKeptLevel));
    reportLens();
    draw();
  });

  /** @param {number} zoomFactor över 1 zoomar in */
  function zoom(zoomFactor) {
    if (mode !== 'sphere') return;
    fieldOfViewDeg = zoomFieldOfView(fieldOfViewDeg, zoomFactor);
    reportLens();
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
    // Stängknappen ligger ovanpå bilden och ska få sina egna tryck.
    if (event.target instanceof Element && event.target.closest('button')) return;
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

  const openFullscreenButton = getElement('round-fullscreen-open');
  const closeFullscreenButton = getElement('round-fullscreen-close');

  /** @param {boolean} isFullscreen */
  function showFullscreen(isFullscreen) {
    frame.classList.toggle('is-fullscreen', isFullscreen);
    document.documentElement.classList.toggle('is-showing-fullscreen', isFullscreen);
    closeFullscreenButton.hidden = !isFullscreen;
    (isFullscreen ? closeFullscreenButton : openFullscreenButton).focus();
    report.setResult('Rundbild, fullskärm', document.fullscreenElement ? 'riktig fullskärm' : 'hela webbläsarfönstret');
  }

  openFullscreenButton.addEventListener('click', () => {
    showFullscreen(true);
    // Safari på iPhone saknar requestFullscreen för annat än film. Då räcker
    // det att visaren redan täcker webbläsarfönstret.
    frame.requestFullscreen?.().catch((error) => log(`rundbild: ingen riktig fullskärm, ${error}`));
  });
  closeFullscreenButton.addEventListener('click', () => {
    // Från riktig fullskärm stänger händelsen fullscreenchange nedan, så att
    // fokus flyttas först när webbläsaren har lämnat fullskärmen.
    if (document.fullscreenElement) document.exitFullscreen();
    else showFullscreen(false);
  });
  // Riktig fullskärm kan lämnas med webbläsarens egen gest eller knapp.
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) report.setResult('Rundbild, fullskärm', 'riktig fullskärm');
    else if (frame.classList.contains('is-fullscreen')) showFullscreen(false);
  });
  frame.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && frame.classList.contains('is-fullscreen')) closeFullscreenButton.click();
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
