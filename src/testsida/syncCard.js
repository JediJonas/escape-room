// @ts-check
import { applyPeerMessage, createRoom, dropSilentPeers, summarizeRoom } from '../sync/holdRoom.js';
import { summarizeRoundTrips } from '../sync/latency.js';
import { createLocalTransport, createSupabaseTransport } from '../sync/transport.js';
import { getButton, getElement } from './dom.js';

const HEARTBEAT_MS = 2000;
const KEPT_ROUND_TRIPS = 20;
const HOLD_KEYS = [' ', 'Enter'];

/** @returns {string} */
const createRandomId = () => Math.random().toString(36).slice(2, 10);

/**
 * @param {{
 *   supabaseConfig: { url: string, publicKey: string },
 *   report: ReturnType<typeof import('./report.js').createReport>,
 *   log: (text: string) => void,
 * }} dependencies
 */
export function setupSyncCard({ supabaseConfig, report, log }) {
  const form = /** @type {HTMLFormElement} */ (getElement('sync-form'));
  const nameInput = /** @type {HTMLInputElement} */ (getElement('sync-name'));
  const roomInput = /** @type {HTMLInputElement} */ (getElement('sync-room'));
  const joinButton = getButton('sync-join');
  const status = getElement('sync-status');
  const roomView = getElement('sync-room-view');
  const pad = getButton('sync-pad');
  const summary = getElement('sync-summary');
  const peerList = getElement('sync-peers');
  const latency = getElement('sync-latency');
  const hasSupabase = Boolean(supabaseConfig.url && supabaseConfig.publicKey);
  // Utan Supabase kan testaren inte svara på om trycken synkades mellan mobiler.
  getElement('sync-notice').hidden = hasSupabase;
  getElement('sync-verdict').hidden = !hasSupabase;

  const myId = createRandomId();
  const room = createRoom();
  /** @type {import('../sync/transport.js').Transport | null} */
  let transport = null;
  let isHolding = false;
  /** @type {Map<string, number>} */
  const pingSentAt = new Map();
  /** @type {number[]} */
  let roundTripsMs = [];
  /** @type {number | null} */
  let lastPressSpreadMs = null;

  nameInput.value = `Mobil ${100 + Math.floor(Math.random() * 900)}`;

  function sendState() {
    if (transport) transport.send({ kind: 'state', id: myId, name: nameInput.value, isHolding });
  }

  function sendPing() {
    if (!transport) return;
    const nonce = createRandomId();
    pingSentAt.set(nonce, performance.now());
    transport.send({ kind: 'ping', id: myId, nonce });
  }

  function render() {
    const { peers, isEveryoneHolding, pressSpreadMs } = summarizeRoom(room);
    peerList.replaceChildren(
      ...peers.map((peer) => {
        const item = document.createElement('li');
        const owner = peer.id === myId ? ' (den här mobilen)' : '';
        item.textContent = `${peer.name}${owner}: ${peer.isHolding ? 'håller' : 'håller inte'}`;
        item.classList.toggle('is-holding', peer.isHolding);
        return item;
      }),
    );
    const holdingCount = peers.filter((peer) => peer.isHolding).length;
    summary.classList.toggle('is-everyone', isEveryoneHolding);
    if (isEveryoneHolding && pressSpreadMs !== null) {
      lastPressSpreadMs = pressSpreadMs;
      summary.textContent = `Alla håller! ${Math.round(pressSpreadMs)} ms mellan första och sista trycket.`;
    } else if (peers.length < 2) {
      summary.textContent = 'Väntar på en mobil till i rummet.';
    } else {
      summary.textContent = `${holdingCount} av ${peers.length} håller.`;
    }

    const roundTrips = summarizeRoundTrips(roundTripsMs);
    const latencyText = roundTrips
      ? `tur och retur median ${Math.round(roundTrips.medianMs)} ms, högst ${Math.round(roundTrips.maxMs)} ms (${roundTrips.count} mätningar)`
      : 'ingen mätning än';
    latency.textContent = `Till servern: ${latencyText}.`;
    if (transport) {
      const spread = lastPressSpreadMs === null ? 'alla har inte hållit samtidigt än' : `senast ${Math.round(lastPressSpreadMs)} ms mellan trycken`;
      report.setResult('Synk', `${transport.name}, ${peers.length} mobiler, ${latencyText}, ${spread}`);
    }
  }

  /** @param {any} message */
  function receiveMessage(message) {
    if (message.kind === 'state') {
      applyPeerMessage(room, message, performance.now());
    } else if (message.kind === 'ping' && message.id === myId) {
      const sentAt = pingSentAt.get(message.nonce);
      if (sentAt === undefined) return;
      pingSentAt.delete(message.nonce);
      roundTripsMs = [...roundTripsMs, performance.now() - sentAt].slice(-KEPT_ROUND_TRIPS);
    }
    render();
  }

  /** @param {boolean} nextIsHolding */
  function setHolding(nextIsHolding) {
    if (isHolding === nextIsHolding) return;
    isHolding = nextIsHolding;
    pad.classList.toggle('is-holding', isHolding);
    pad.textContent = isHolding ? 'Håller' : 'Håll fingret här';
    sendState();
  }

  pad.addEventListener('pointerdown', (event) => {
    // Fångar pekaren, så att trycket gäller även om fingret glider utanför knappen.
    pad.setPointerCapture(event.pointerId);
    setHolding(true);
  });
  pad.addEventListener('pointerup', () => setHolding(false));
  pad.addEventListener('pointercancel', () => setHolding(false));
  // Ett långt tryck öppnar annars en meny i vissa webbläsare.
  pad.addEventListener('contextmenu', (event) => event.preventDefault());
  pad.addEventListener('keydown', (event) => {
    if (HOLD_KEYS.includes(event.key)) setHolding(true);
  });
  pad.addEventListener('keyup', (event) => {
    if (HOLD_KEYS.includes(event.key)) setHolding(false);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (transport) return;
    joinButton.disabled = true;
    const roomCode = roomInput.value.trim();
    try {
      status.textContent = 'Ansluter …';
      transport = hasSupabase
        ? await createSupabaseTransport(roomCode, receiveMessage, supabaseConfig)
        : createLocalTransport(roomCode, receiveMessage);
    } catch (error) {
      joinButton.disabled = false;
      status.textContent = 'Det gick inte att ansluta till Supabase. Försök igen.';
      report.setResult('Synk', `anslutningen misslyckades (${error instanceof Error ? error.message : 'okänt fel'})`);
      log(`synk: fel ${error}`);
      return;
    }

    log(`synk: med i rum ${roomCode} via ${transport.name}`);
    status.textContent = transport.reachesOtherDevices
      ? `Med i rum ${roomCode}.`
      : `Med i rum ${roomCode}, men bara flikar i samma webbläsare syns.`;
    nameInput.disabled = true;
    roomInput.disabled = true;
    roomView.hidden = false;
    sendState();
    sendPing();
    setInterval(() => {
      sendState();
      sendPing();
      dropSilentPeers(room, performance.now());
      render();
    }, HEARTBEAT_MS);
  });
}
