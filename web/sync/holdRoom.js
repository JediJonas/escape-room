// @ts-check

/**
 * Vilka mobiler som är med i ett testrum och vilka som håller fingret på
 * skärmen. Rena funktioner utan nät och klocka: tiden skickas in.
 */

/** En mobil som har varit tyst så här länge räknas som borta. */
export const PEER_TIMEOUT_MS = 6000;

/**
 * @typedef {{ id: string, name: string, isHolding: boolean }} PeerMessage
 * @typedef {{ id: string, name: string, isHolding: boolean, lastSeenAt: number, holdChangedAt: number }} Peer
 * @typedef {Map<string, Peer>} Room
 */

/** @returns {Room} */
export function createRoom() {
  return new Map();
}

/**
 * För in ett meddelande från en mobil i rummet.
 * @param {Room} room
 * @param {PeerMessage} message
 * @param {number} receivedAt när meddelandet kom fram hit, i ms
 */
export function applyPeerMessage(room, message, receivedAt) {
  const known = room.get(message.id);
  const hasHoldChanged = !known || known.isHolding !== message.isHolding;
  room.set(message.id, {
    id: message.id,
    name: message.name,
    isHolding: message.isHolding,
    lastSeenAt: receivedAt,
    holdChangedAt: hasHoldChanged ? receivedAt : known.holdChangedAt,
  });
}

/**
 * Tar bort mobiler som har slutat höras av.
 * @param {Room} room
 * @param {number} now
 */
export function dropSilentPeers(room, now) {
  for (const [id, peer] of room) {
    if (now - peer.lastSeenAt > PEER_TIMEOUT_MS) room.delete(id);
  }
}

/**
 * @param {Room} room
 * @returns {{ peers: Peer[], isEveryoneHolding: boolean, pressSpreadMs: number | null }}
 * pressSpreadMs är tiden mellan första och sista trycket bland dem som håller,
 * så som det kom fram till den här mobilen.
 */
export function summarizeRoom(room) {
  const peers = [...room.values()].sort((a, b) => a.name.localeCompare(b.name, 'sv') || a.id.localeCompare(b.id));
  const holding = peers.filter((peer) => peer.isHolding);
  // En ensam mobil kan inte visa att tryck synkas, så det krävs minst två.
  const isEveryoneHolding = peers.length >= 2 && holding.length === peers.length;
  const pressTimes = holding.map((peer) => peer.holdChangedAt);
  const pressSpreadMs = holding.length >= 2 ? Math.max(...pressTimes) - Math.min(...pressTimes) : null;
  return { peers, isEveryoneHolding, pressSpreadMs };
}
